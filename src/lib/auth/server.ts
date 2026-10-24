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

/**
 * Resolves the authenticated user and their verified database profile.
 * Never trusts client headers or body payloads for identity.
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

  if (profileError || !profile) {
    return null;
  }

  return { user, profile };
}

/**
 * Requires an active authenticated session.
 * Returns 503 if Supabase is unconfigured, 401 if unauthenticated, 404 if profile missing.
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
