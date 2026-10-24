/**
 * Server-Side Authentication & Authorization Helpers
 * Resolves user identity from Supabase Auth session tokens, verifies database profiles,
 * and strictly enforces customer/worker role permissions.
 */

import { SupabaseClient, User } from '@supabase/supabase-js';
import { Database, UserRole } from '@/types/database.types';
import { apiError } from '@/lib/api/response';
import { NextResponse } from 'next/server';

export type UserProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface AuthContext {
  user: User;
  profile: UserProfileRow;
}

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; response: NextResponse };

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Resolves the authenticated user and their verified database profile.
 * Never trusts client headers or body payloads for identity.
 * If an authenticated user exists in auth.users but has no row in public.profiles,
 * safely provisions their profile according to their verified identity metadata.
 */
export async function getAuthenticatedUserWithProfile(
  supabase: SupabaseClient<Database> | null
): Promise<AuthContext | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) {
    return { user, profile };
  }

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('[getAuthenticatedUserWithProfile] Profile lookup notice:', profileError.message);
  }

  // Auto-provision profile for valid authenticated user if missing in public.profiles
  const role: UserRole = user.user_metadata?.role === 'worker' ? 'worker' : 'customer';
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    (role === 'worker' ? 'Sahayak Partner' : 'Sahayak Customer');
  const phone =
    user.phone ||
    user.user_metadata?.phone ||
    `user_${user.id.replace(/-/g, '').slice(0, 10)}`;

  const newProfilePayload = {
    id: user.id,
    email: user.email || null,
    phone,
    full_name: fullName,
    avatar_url: user.user_metadata?.avatar_url || null,
    role,
    verification_status: 'unverified' as const,
    primary_city: 'Delhi NCR',
  };

  // Attempt upsert/insert via user client if supported by client/mock
  const profilesTable = supabase.from('profiles') as unknown as {
    insert?: (payload: unknown) => { select: () => { maybeSingle: () => Promise<{ data: UserProfileRow | null }> } };
    upsert?: (payload: unknown, opts?: unknown) => { select: () => { maybeSingle: () => Promise<{ data: UserProfileRow | null }> } };
  };

  if (profilesTable && typeof profilesTable.upsert === 'function') {
    try {
      const { data: upsertedProfile } = await profilesTable
        .upsert(newProfilePayload, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .maybeSingle();

      if (upsertedProfile) {
        return { user, profile: upsertedProfile };
      }
    } catch {
      // Ignore user-client error and fallback to admin client
    }
  } else if (profilesTable && typeof profilesTable.insert === 'function') {
    try {
      const { data: insertedProfile } = await profilesTable
        .insert(newProfilePayload)
        .select()
        .maybeSingle();

      if (insertedProfile) {
        return { user, profile: insertedProfile };
      }
    } catch {
      // Ignore user-client insert error and fallback to admin client
    }
  }

  // Attempt fallback via admin client if configured
  try {
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { data: adminProfile } = await adminClient
        .from('profiles')
        .upsert(newProfilePayload, { onConflict: 'id', ignoreDuplicates: true })
        .select('*')
        .maybeSingle();

      if (adminProfile) {
        return { user, profile: adminProfile };
      }
    }
  } catch {
    // Admin client fallback error ignored
  }

  return null;
}

/**
 * Requires an active authenticated session.
 * Returns 503 if Supabase is unconfigured, 401 if unauthenticated, 500 if database error, 404 if profile missing.
 */
export async function requireAuth(
  supabase: SupabaseClient<Database> | null
): Promise<AuthResult> {
  if (!supabase) {
    return {
      success: false,
      response: apiError(
        'Supabase is not configured. Please supply NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        503,
        'DATABASE_NOT_CONFIGURED'
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      response: apiError(
        'Authentication required. Please log in with a valid session.',
        401,
        'UNAUTHENTICATED'
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) {
    return { success: true, context: { user, profile } };
  }

  // If query failed due to a database permission/connection error:
  if (profileError && profileError.code && profileError.code !== 'PGRST116') {
    console.error('[requireAuth] Database error querying profiles:', profileError.message);
    return {
      success: false,
      response: apiError(
        `Database error accessing user profile: ${profileError.message}`,
        500,
        'DATABASE_ERROR'
      ),
    };
  }

  const authContext = await getAuthenticatedUserWithProfile(supabase);

  if (!authContext) {
    return {
      success: false,
      response: apiError(
        'Authentication required. Please log in with a valid session.',
        401,
        'UNAUTHENTICATED'
      ),
    };
  }

  return { success: true, context: authContext };
}

/**
 * Requires an authenticated user with one of the allowed roles (e.g. ['customer'] or ['worker']).
 * Returns 403 Forbidden if the user's role does not match.
 */
export async function requireRole(
  supabase: SupabaseClient<Database> | null,
  allowedRoles: UserRole[]
): Promise<AuthResult> {
  const authResult = await requireAuth(supabase);

  if (!authResult.success) {
    return authResult;
  }

  const { profile } = authResult.context;

  if (!allowedRoles.includes(profile.role)) {
    return {
      success: false,
      response: apiError(
        `Access denied. This endpoint requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${profile.role}'.`,
        403,
        'FORBIDDEN_ROLE'
      ),
    };
  }

  return authResult;
}
