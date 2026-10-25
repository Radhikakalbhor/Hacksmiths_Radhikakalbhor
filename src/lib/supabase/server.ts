/**
 * Supabase Server Client Utility
 * Server-side Supabase client for Server Components, Server Actions, and Route Handlers.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { Database } from '@/types/database.types';

export async function getSupabaseServerClient(request?: Request | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const authHeader = request ? request.headers.get('authorization') : null;

  // When request context is available (e.g. Route Handlers), read cookies from request context directly
  const nextRequest = request && 'cookies' in request ? (request as NextRequest) : null;

  if (nextRequest) {
    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      },
      cookies: {
        getAll() {
          return nextRequest.cookies.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value }) =>
              nextRequest.cookies.set(name, value)
            );
          } catch {
            // Cannot write cookies to incoming request; middleware handles refresh
          }
        },
      },
    });
  }

  // Fallback to next/headers cookies() for Server Components
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

