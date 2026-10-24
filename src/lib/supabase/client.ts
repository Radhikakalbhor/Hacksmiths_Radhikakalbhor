/**
 * Supabase Browser Client Utility
 * Safely initializes the Supabase client for client-side components using publishable/anon keys.
 */

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return null or log warning during local setup without valid env
    return null;
  }

  if (!client) {
    client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return client;
}

export const getSupabaseClient = getSupabaseBrowserClient;

