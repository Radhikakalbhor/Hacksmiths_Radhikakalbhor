/**
 * Sahayak Role-Based Route Protection & Session Refresh Middleware
 * Enforces strict role boundary separation at the Edge / Network level.
 *
 * Rules:
 * 1. Admin Pages (/admin/*):
 *    - Unauthenticated -> /login?redirect=/admin/*
 *    - Authenticated non-admin or suspended -> /
 *    - Authenticated Admin -> Allow through
 * 2. Worker Pages (/worker/*, /dashboard):
 *    - Unauthenticated -> /login?role=worker
 *    - Authenticated Customer -> /post-job
 *    - Authenticated Worker/Admin -> Allow through
 * 3. Customer Pages (/post-job, /bookings, /my-jobs, /booking-history):
 *    - Authenticated Worker -> /worker/dashboard
 * 4. Public Pages (/, /login, /services, /fair-pricing, /safety, /auth/callback):
 *    - Allowed through without restriction
 * 5. API Routes (/api/*):
 *    - Delegated to route handlers (preserves JSON error responses)
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Database } from '@/types/database.types';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;

  // Skip API routes and Next.js internal paths
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return response;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname.startsWith('/admin')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // Create authenticated Supabase client for session cookie refreshment
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Check active session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. ADMIN ROUTE PROTECTION
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const userRole = String(user.user_metadata?.role || '').toLowerCase();
    if (userRole !== 'admin') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_suspended')
        .eq('id', user.id)
        .maybeSingle();

      const profileRole = String(profile?.role || '').toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (profileRole !== 'admin' || (profile as any)?.is_suspended) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return response;
  }

  const isWorkerRoute =
    pathname === '/dashboard' ||
    pathname.startsWith('/worker');

  const isCustomerRoute =
    pathname === '/post-job' ||
    pathname === '/bookings' ||
    pathname === '/my-jobs' ||
    pathname === '/booking-history';

  // 2. WORKER ROUTE PROTECTION
  if (isWorkerRoute) {
    if (!user) {
      // Unauthenticated visitor -> Redirect to worker login
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('role', 'worker');
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Resolve authoritative role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role || (user.user_metadata?.role as string) || 'customer';

    if (role === 'customer') {
      // Customer attempting to access worker portal -> Strictly redirect to /post-job
      return NextResponse.redirect(new URL('/post-job', request.url));
    }

    return response;
  }

  // 3. CUSTOMER ROUTE PROTECTION
  if (isCustomerRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role || (user.user_metadata?.role as string);

    if (role === 'worker') {
      // Worker attempting to access customer routes -> Strictly redirect to /worker/dashboard
      return NextResponse.redirect(new URL('/worker/dashboard', request.url));
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images and public static files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
};
