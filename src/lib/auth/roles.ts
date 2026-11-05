/**
 * Centralized Role Resolution & Destination Router
 * Single source of truth for role boundaries across Sahayak.
 *
 * Rules:
 * 1. Customer:
 *    - Always lands on /post-job.
 *    - Never lands on /worker/*, /worker/dashboard, or /dashboard.
 *    - Safe customer sub-paths (e.g. /bookings, /my-jobs, /booking-history, /services, /safety) are preserved if explicitly requested.
 * 2. Worker:
 *    - Always lands on the worker dashboard (/worker/dashboard or /dashboard?role=worker).
 *    - Never lands on /post-job or customer booking management (/bookings, /my-jobs).
 *    - Any redirect to customer flows is strictly sanitized to /worker/dashboard.
 * 3. Admin:
 *    - Lands on authorized dashboard (/worker/dashboard?admin=true or /dashboard?role=worker&admin=true).
 */

import { UserRole } from '@/types/database.types';

export interface RoleResolutionOptions {
  profileRole?: UserRole | string | null;
  metadataRole?: string | null;
  fallbackRole?: UserRole;
}

/**
 * Determines the authoritative user role.
 * Database profile role takes precedence over user metadata.
 */
export function determineUserRole({
  profileRole,
  metadataRole,
  fallbackRole = 'customer',
}: RoleResolutionOptions): UserRole {
  // 1. Authoritative: Database profile role
  if (profileRole === 'admin' || profileRole === 'worker' || profileRole === 'customer') {
    return profileRole;
  }

  // 2. Secondary: Authenticated user metadata
  if (metadataRole === 'admin' || metadataRole === 'worker' || metadataRole === 'customer') {
    return metadataRole;
  }

  return fallbackRole;
}

/**
 * Checks whether a given path is a worker-only route.
 */
export function isWorkerOnlyRoute(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard?') ||
    pathname.startsWith('/worker') ||
    pathname.includes('role=worker')
  );
}

/**
 * Checks whether a given path is a customer-only route.
 */
export function isCustomerOnlyRoute(pathname: string): boolean {
  return (
    pathname === '/post-job' ||
    pathname.startsWith('/post-job') ||
    pathname === '/bookings' ||
    pathname.startsWith('/bookings') ||
    pathname === '/my-jobs' ||
    pathname === '/booking-history'
  );
}

/**
 * Resolves the strictly role-bounded destination URL.
 * Sanitizes open redirects and cross-role boundary breaches.
 */
export function getDestinationForRole(
  role: UserRole,
  requestedRedirect?: string | null
): string {
  const isSafeInternal =
    requestedRedirect &&
    typeof requestedRedirect === 'string' &&
    requestedRedirect.startsWith('/') &&
    !requestedRedirect.startsWith('//');

  if (role === 'customer') {
    if (isSafeInternal) {
      // Prevent customer from accessing worker routes or bare /dashboard
      if (isWorkerOnlyRoute(requestedRedirect)) {
        return '/post-job';
      }
      return requestedRedirect;
    }
    return '/post-job';
  }

  if (role === 'worker') {
    if (isSafeInternal) {
      // Workers must NEVER be redirected to /post-job or customer booking flows
      if (isCustomerOnlyRoute(requestedRedirect)) {
        return '/dashboard?role=worker';
      }
      // Preserve safe worker paths
      if (requestedRedirect === '/dashboard' || requestedRedirect.startsWith('/dashboard')) {
        return requestedRedirect;
      }
      if (requestedRedirect.startsWith('/worker')) {
        return requestedRedirect;
      }
      return requestedRedirect;
    }
    return '/dashboard?role=worker';
  }

  if (role === 'admin') {
    if (isSafeInternal && !isCustomerOnlyRoute(requestedRedirect)) {
      return requestedRedirect;
    }
    return '/dashboard?role=worker&admin=true';
  }

  return '/post-job';
}
