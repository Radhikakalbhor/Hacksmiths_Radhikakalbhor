/**
 * OAuth Callback Handler
 * Securely exchanges the authorization code for a session cookie via @supabase/ssr,
 * safely verifies or initializes the user profile in public.profiles,
 * ensures base worker_profiles records exist for workers,
 * detects explicit account role mismatches without privilege escalation,
 * and redirects to the appropriate dashboard without privilege escalation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { EmailOtpType } from '@supabase/supabase-js';
import { resolveOAuthRoleAndDestination } from '@/lib/auth/oauth';
import { UserRole } from '@/types/database.types';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const otpType = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const rawRole = requestUrl.searchParams.get('role');
  const redirectParam = requestUrl.searchParams.get('redirect');
  const authError = requestUrl.searchParams.get('error');
  const authErrorDescription = requestUrl.searchParams.get('error_description');

  console.log(`[OAuth Callback] Initiation: requestedRole=${rawRole}, hasCode=${!!code}, hasTokenHash=${!!tokenHash}`);

  // Handle OAuth provider errors (e.g. user cancelled Google consent)
  if (authError) {
    const errorMsg = encodeURIComponent(authErrorDescription || authError || 'OAuth authentication failed');
    return NextResponse.redirect(new URL(`/login?error=${errorMsg}`, request.url));
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/login?error=missing_oauth_code', request.url));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL('/login?error=database_not_configured', request.url)
    );
  }

  // 1. Exchange the temporary authorization code (Google OAuth) or verify token hash (email OTP fallback)
  let sessionData: { user: import('@supabase/supabase-js').User | null } | null = null;
  let exchangeError: { message: string } | null = null;

  if (code) {
    const exchangeRes = await supabase.auth.exchangeCodeForSession(code);
    sessionData = exchangeRes.data;
    exchangeError = exchangeRes.error;
  } else if (tokenHash && otpType) {
    const verifyRes = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    sessionData = verifyRes.data;
    exchangeError = verifyRes.error;
  } else {
    return NextResponse.redirect(new URL('/login?error=invalid_auth_parameters', request.url));
  }

  if (exchangeError || !sessionData?.user) {
    console.error('[OAuth Callback] Code exchange / verify error:', exchangeError?.message);
    const errorMsg = encodeURIComponent(exchangeError?.message || 'Failed to exchange authorization code');
    return NextResponse.redirect(new URL(`/login?error=${errorMsg}`, request.url));
  }

  const user = sessionData.user;
  const userMasked = user.id.slice(0, 8) + '...';

  // 2. Query existing profile to prevent role overwriting or privilege escalation
  // Includes adminClient fallback to prevent false negatives from RLS race conditions
  let existingProfile: { id: string; role: UserRole; verification_status?: string } | null = null;

  const { data: userProfile, error: profileQueryError } = await supabase
    .from('profiles')
    .select('id, role, verification_status')
    .eq('id', user.id)
    .maybeSingle();

  if (userProfile && !profileQueryError) {
    existingProfile = userProfile as { id: string; role: UserRole; verification_status?: string };
  } else {
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { data: adminProf } = await adminClient
        .from('profiles')
        .select('id, role, verification_status')
        .eq('id', user.id)
        .maybeSingle();
      if (adminProf) {
        existingProfile = adminProf as { id: string; role: UserRole; verification_status?: string };
      }
    }
  }

  console.log(`[OAuth Callback] User: ${userMasked}, existingProfileRole=${existingProfile?.role || 'none (new user)'}`);

  // Resolve role and destination with security invariants
  const { finalRole, isNewUser, destination, roleMismatch, expectedRole, actualRole } =
    resolveOAuthRoleAndDestination({
      existingProfileRole: existingProfile?.role,
      requestedRoleParam: rawRole,
      redirectParam,
    });

  // Handle explicit Account-Role Mismatch:
  // If the user selected Worker login, but their existing account is a Customer,
  // do NOT silently send them to /post-job. Inform them via /login with clear instructions.
  if (roleMismatch) {
    console.warn(`[OAuth Callback] Role mismatch for ${userMasked}: requested=${expectedRole}, actual=${actualRole}. Redirecting to /login.`);
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'account_role_mismatch');
    errorUrl.searchParams.set('role', expectedRole || 'worker');
    errorUrl.searchParams.set('actualRole', actualRole || 'customer');
    if (user.email) {
      errorUrl.searchParams.set('email', user.email);
    }
    return NextResponse.redirect(errorUrl);
  }

  // 3. New user registration
  if (isNewUser) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      (finalRole === 'worker' ? 'Sahayak Partner' : 'Sahayak Customer');

    const email = user.email || null;
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
    // Database requires a non-null phone. Use metadata phone if present, or deterministic safe placeholder.
    const phone =
      user.phone ||
      user.user_metadata?.phone ||
      `google_${user.id.replace(/-/g, '').slice(0, 10)}`;

    // Try inserting via authenticated user client
    const { error: profileInsertError } = await supabase.from('profiles').insert({
      id: user.id,
      email,
      phone,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: finalRole,
      verification_status: 'unverified',
      primary_city: 'Delhi NCR',
    });

    if (profileInsertError) {
      console.warn('[OAuth Callback] User client profile insert warning:', profileInsertError.message);
      // Fallback: If user client is constrained by RLS, attempt server admin client if configured
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        await adminClient.from('profiles').insert({
          id: user.id,
          email,
          phone,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: finalRole,
          verification_status: 'unverified',
          primary_city: 'Delhi NCR',
        });
      }
    }
  }

  // 4. Ensure worker profile exists for any confirmed worker account (auto-healing incomplete onboarding)
  if (finalRole === 'worker') {
    const adminClient = getSupabaseAdminClient();
    const client = adminClient || supabase;
    const { data: existingWp } = await client
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingWp) {
      const meta = user.user_metadata || {};
      const primaryCategory = (meta.primary_category as string) || 'plumbing';
      const bio = (meta.bio as string) || 'Partner profile registered via Sahayak Auth';
      const yearsExp = typeof meta.years_experience === 'number' ? meta.years_experience : (parseInt(String(meta.years_experience || '1'), 10) || 1);
      const skills = Array.isArray(meta.skills) && meta.skills.length > 0 ? meta.skills : [primaryCategory];

      console.log(`[OAuth Callback] Initializing worker_profiles record for worker ${userMasked}`);
      await client.from('worker_profiles').insert({
        user_id: user.id,
        primary_category: primaryCategory,
        skills: skills,
        bio: bio,
        years_experience: yearsExp,
        is_available: true,
        is_publicly_visible: false,
      });
    }
  }

  console.log(`[OAuth Callback] Complete. Redirecting ${userMasked} (role: ${finalRole}) to: ${destination}`);
  return NextResponse.redirect(new URL(destination, request.url));
}
