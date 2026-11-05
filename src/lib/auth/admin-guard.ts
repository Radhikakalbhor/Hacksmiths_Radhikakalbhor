/**
 * Admin Route Guard & Authorization Verifier
 * Verifies authenticated session, checks database profile,
 * and re-verifies that role is strictly 'ADMIN'.
 * Used across all /api/admin/* route handlers.
 */

import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/api/response';

export interface AdminAuthContext {
  userId: string;
  email?: string;
  fullName: string;
  role: 'ADMIN';
}

export type AdminAuthResult =
  | { success: true; admin: AdminAuthContext }
  | { success: false; response: NextResponse };

export async function requireAdminSession(request?: Request): Promise<AdminAuthResult> {
  const supabase = await getSupabaseServerClient(request);
  if (!supabase) {
    // If Supabase server client is not configured, check if service role client is available
    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return {
        success: false,
        response: apiError('Database unconfigured', 503, 'DB_UNCONFIGURED'),
      };
    }
  }

  let user = null;
  if (supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  }

  // Also support testing/dev Authorization: Bearer token or mock headers if present
  if (!user && request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        const { data } = await adminClient.auth.getUser(token);
        if (data?.user) {
          user = data.user;
        }
      }
    }
  }

  if (!user) {
    return {
      success: false,
      response: apiError('Admin authentication required.', 401, 'UNAUTHENTICATED'),
    };
  }

  // Always re-verify role directly in database using privileged client to prevent spoofing
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      success: false,
      response: apiError('Service role unconfigured.', 503, 'SERVICE_UNCONFIGURED'),
    };
  }

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('id, full_name, role, is_suspended')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return {
      success: false,
      response: apiError('User profile not found.', 404, 'PROFILE_NOT_FOUND'),
    };
  }

  const roleUpper = String(profile.role).toUpperCase();
  if (roleUpper !== 'ADMIN') {
    return {
      success: false,
      response: apiError('Forbidden: Administrator privileges required.', 403, 'FORBIDDEN_NOT_ADMIN'),
    };
  }

  if (profile.is_suspended) {
    return {
      success: false,
      response: apiError('Forbidden: Administrator account suspended.', 403, 'ACCOUNT_SUSPENDED'),
    };
  }

  return {
    success: true,
    admin: {
      userId: user.id,
      email: user.email,
      fullName: profile.full_name || 'Administrator',
      role: 'ADMIN',
    },
  };
}

