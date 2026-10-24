/**
 * Supabase Privileged Admin Client
 * SECURITY: This module must ONLY run in a server runtime (Node.js).
 * Never import or execute this file in client-side components.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export function getSupabaseAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'SECURITY CRITICAL: getSupabaseAdminClient() was called in a client/browser environment.'
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
