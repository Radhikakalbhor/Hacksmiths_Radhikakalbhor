/**
 * Server-Authoritative Identity & Role Resolution API: GET /api/auth/me
 * Returns verified session, trusted database profile, role, and role-bounded destination.
 * Eliminates client-side RLS race conditions and session hydration mismatches.
 */

import { NextRequest, connection } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiSuccess } from '@/lib/api/response';
import { determineUserRole, getDestinationForRole } from '@/lib/auth/roles';
import { UserRole } from '@/types/database.types';

function createNoCacheResponse<T>(data: T) {
  const response = apiSuccess(data);
  response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function GET(request: NextRequest) {
  // Explicitly opt-out of static prerendering in Next.js 16 Cache Components model
  await connection();

  try {
    const supabase = await getSupabaseServerClient(request);
    if (!supabase) {
      return createNoCacheResponse({
        authenticated: false,
        user: null,
        role: null,
        destination: '/login',
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createNoCacheResponse({
        authenticated: false,
        user: null,
        role: null,
        destination: '/login',
      });
    }

    // Query trusted profile from database using user client, with admin client fallback
    let profile: { id: string; role: UserRole; full_name?: string; email?: string } | null = null;

    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    if (userProfile && !profileErr) {
      profile = userProfile as { id: string; role: UserRole; full_name?: string; email?: string };
    } else {
      const admin = getSupabaseAdminClient();
      if (admin) {
        const { data: adminProfile } = await admin
          .from('profiles')
          .select('id, role, full_name, email')
          .eq('id', user.id)
          .maybeSingle();

        if (adminProfile) {
          profile = adminProfile as { id: string; role: UserRole; full_name?: string; email?: string };
        }
      }
    }

    const metadataRole = (user.user_metadata?.role as string) || null;
    const finalRole = determineUserRole({
      profileRole: profile?.role,
      metadataRole,
      fallbackRole: 'customer',
    });

    const destination = getDestinationForRole(finalRole);

    return createNoCacheResponse({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email || profile?.email || '',
        fullName: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
      },
      role: finalRole,
      destination,
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && ('digest' in err || 'route' in err)) {
      throw err;
    }
    console.error('[GET /api/auth/me] Error:', err);
    return createNoCacheResponse({
      authenticated: false,
      user: null,
      role: null,
      destination: '/login',
    });
  }
}

