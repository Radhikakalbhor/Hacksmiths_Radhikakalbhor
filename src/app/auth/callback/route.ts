/**
 * OAuth Callback Handler
 * Securely exchanges the authorization code for a session cookie via @supabase/ssr,
 * safely verifies or initializes the user profile in public.profiles,
 * and redirects to the appropriate dashboard without privilege escalation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { UserRole } from '@/types/database.types';

/**
 * Pure function to resolve role and redirect destination securely.
 * Enforces zero-trust:
 * 1. Existing database roles are NEVER overwritten.
 * 2. New users can only be 'customer' or 'worker' (privilege escalation to 'admin' blocked).
 * 3. Redirect destinations are strictly role-bounded and open redirects prevented.
 */
export function resolveOAuthRoleAndDestination({
  existingProfileRole,
  requestedRoleParam,
  redirectParam,
}: {
  existingProfileRole: UserRole | null | undefined;
  requestedRoleParam: string | null;
  redirectParam: string | null;
}): { finalRole: UserRole; isNewUser: boolean; destination: string } {
  let finalRole: UserRole;
  const isNewUser = !existingProfileRole;

  if (existingProfileRole) {
    // CRITICAL SECURITY RULE: NEVER overwrite an existing user's role through an OAuth callback.
    finalRole = existingProfileRole;
  } else {
    // New user registration: Sanitize requested role. Only 'customer' or 'worker' are permitted.
    finalRole = requestedRoleParam === 'worker' ? 'worker' : 'customer';
  }

  // Secure Redirect Destination
  let destination = finalRole === 'worker' ? '/dashboard?role=worker' : '/dashboard';

  // If a safe internal redirect parameter was provided and doesn't contradict role boundaries
  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    if (finalRole === 'customer' && !redirectParam.includes('role=worker')) {
      destination = redirectParam;
    } else if (finalRole === 'worker') {
      destination = redirectParam;
    }
  }

  return { finalRole, isNewUser, destination };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const rawRole = requestUrl.searchParams.get('role');
  const redirectParam = requestUrl.searchParams.get('redirect');
  const authError = requestUrl.searchParams.get('error');
  const authErrorDescription = requestUrl.searchParams.get('error_description');

  // Handle OAuth provider errors (e.g. user cancelled Google consent)
  if (authError) {
    const errorMsg = encodeURIComponent(authErrorDescription || authError || 'OAuth authentication failed');
    return NextResponse.redirect(new URL(`/login?error=${errorMsg}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_oauth_code', request.url));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL('/login?error=database_not_configured', request.url)
    );
  }

  // 1. Exchange the temporary authorization code for a secure session
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !sessionData?.user) {
    console.error('[OAuth Callback] Code exchange error:', exchangeError?.message);
    const errorMsg = encodeURIComponent(exchangeError?.message || 'Failed to exchange authorization code');
    return NextResponse.redirect(new URL(`/login?error=${errorMsg}`, request.url));
  }

  const user = sessionData.user;

  // 2. Query existing profile to prevent role overwriting or privilege escalation
  const { data: existingProfile, error: profileQueryError } = await supabase
    .from('profiles')
    .select('id, role, verification_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileQueryError) {
    console.warn('[OAuth Callback] Profile lookup notice:', profileQueryError.message);
  }

  // Resolve role and destination with security invariants
  const { finalRole, isNewUser, destination } = resolveOAuthRoleAndDestination({
    existingProfileRole: existingProfile?.role,
    requestedRoleParam: rawRole,
    redirectParam,
  });

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

    // If new user registered as a worker, initialize their base worker profile
    if (finalRole === 'worker') {
      const { error: workerInsertError } = await supabase.from('worker_profiles').insert({
        user_id: user.id,
        primary_category: 'plumbing',
        skills: ['general'],
        bio: 'Partner registered via Google Sign-In',
        years_experience: 1,
        is_available: true,
        is_publicly_visible: false,
      });

      if (workerInsertError) {
        const adminClient = getSupabaseAdminClient();
        if (adminClient) {
          await adminClient.from('worker_profiles').insert({
            user_id: user.id,
            primary_category: 'plumbing',
            skills: ['general'],
            bio: 'Partner registered via Google Sign-In',
            years_experience: 1,
            is_available: true,
            is_publicly_visible: false,
          });
        }
      }
    }
  }

  return NextResponse.redirect(new URL(destination, request.url));
}

