/**
 * Centralized Role Resolution & Destination Router
 * Single source of truth for role boundaries across Sahayak.
 *
 * Rules:
 * 1. Customer:
 *    - Always lands on /post-job.
 *    - Never lands on /worker/*, /worker/dashboard, /dashboard, or /admin*.
 *    - Safe customer sub-paths (e.g. /bookings, /my-jobs, /booking-history, /services, /safety) are preserved if explicitly requested.
 * 2. Worker:
 *    - Always lands on the worker dashboard (/worker/dashboard or /dashboard?role=worker).
 *    - Never lands on /post-job, customer booking management (/bookings, /my-jobs), or /admin*.
 *    - Any redirect to customer flows is strictly sanitized to /worker/dashboard.
 * 3. Admin:
 *    - Always lands on authorized admin operations console (/admin).
 *    - Safe /admin* sub-paths (e.g. /admin/verification, /admin/users, /admin/settings) are preserved.
 *    - Suspended admin accounts are strictly redirected to /login?error=account_suspended.
 */

import { UserRole } from '@/types/database.types';

export interface RoleResolutionOptions {
  profileRole?: UserRole | string | null;
  metadataRole?: string | null;
  fallbackRole?: UserRole;
}

export interface DestinationOptions {
  isSuspended?: boolean;
}

/**
 * Normalizes a role string to lowercase UserRole ('customer' | 'worker' | 'admin').
 */
export function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const lower = role.trim().toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'worker') return 'worker';
  if (lower === 'customer') return 'customer';
  return null;
}

/**
 * Determines the authoritative user role.
 * Database profile role takes precedence over user metadata.
 * Always returns lowercase 'customer', 'worker', or 'admin'.
 */
export function determineUserRole({
  profileRole,
  metadataRole,
  fallbackRole = 'customer',
}: RoleResolutionOptions): UserRole {
  // 1. Authoritative: Database profile role
  const normProfile = normalizeRole(profileRole);
  if (normProfile) {
    return normProfile;
  }

  // 2. Secondary: Authenticated user metadata
  const normMetadata = normalizeRole(metadataRole);
  if (normMetadata) {
    return normMetadata;
  }

  return fallbackRole;
}

/**
 * Checks whether a given path is an admin route.
 */
export function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/admin?');
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
 * 
 * Invariants:
 * - Customer: defaults to /post-job. Cannot target /admin* or worker routes.
 * - Worker: defaults to /dashboard?role=worker. Cannot target /admin* or customer routes.
 * - Admin: defaults to /admin. Safe /admin* targets are respected. Suspended admin goes to /login?error=account_suspended.
 * - Respects safe relative redirect query param only (must start with '/' and not '//' or '/\').
 */
export function getDestinationForRole(
  role: UserRole | string,
  requestedRedirect?: string | null,
  options?: DestinationOptions | boolean
): string {
  const normalizedRole = normalizeRole(role) || 'customer';
  const isSuspended =
    typeof options === 'boolean'
      ? options
      : Boolean(options && typeof options === 'object' && options.isSuspended);

  const isSafeInternal =
    typeof requestedRedirect === 'string' &&
    requestedRedirect.startsWith('/') &&
    !requestedRedirect.startsWith('//') &&
    !requestedRedirect.startsWith('/\\') &&
    !requestedRedirect.toLowerCase().startsWith('/javascript:');

  if (normalizedRole === 'customer') {
    if (isSafeInternal) {
      // Prevent customer from accessing admin routes
      if (isAdminRoute(requestedRedirect)) {
        return '/post-job';
      }
      // Prevent customer from accessing worker routes or bare /dashboard
      if (isWorkerOnlyRoute(requestedRedirect)) {
        return '/post-job';
      }
      return requestedRedirect;
    }
    return '/post-job';
  }

  if (normalizedRole === 'worker') {
    if (isSafeInternal) {
      // Prevent worker from accessing admin routes
      if (isAdminRoute(requestedRedirect)) {
        return '/dashboard?role=worker';
      }
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

  if (normalizedRole === 'admin') {
    if (isSuspended) {
      return '/login?error=account_suspended';
    }
    if (isSafeInternal) {
      // Preserve safe admin routes (e.g. /admin, /admin/verification, /admin/users, /admin/settings)
      if (isAdminRoute(requestedRedirect)) {
        return requestedRedirect;
      }
      // Admins are redirected away from customer-only routes to /admin
      if (isCustomerOnlyRoute(requestedRedirect)) {
        return '/admin';
      }
      return requestedRedirect;
    }
    return '/admin';
  }

  return '/post-job';
}
