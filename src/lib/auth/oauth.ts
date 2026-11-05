import { UserRole } from '@/types/database.types';

/**
 * Pure function to resolve role and redirect destination securely.
 * Enforces zero-trust:
 * 1. Existing database roles are NEVER overwritten.
 * 2. New users can only be 'customer' or 'worker' (privilege escalation to 'admin' blocked).
 * 3. Redirect destinations are strictly role-bounded and open redirects prevented.
 * 4. Customers are redirected directly to /post-job; workers to /dashboard?role=worker.
 */
export function resolveOAuthRoleAndDestination({
  existingProfileRole,
  requestedRoleParam,
  redirectParam,
}: {
  existingProfileRole: UserRole | null | undefined;
  requestedRoleParam: string | null;
  redirectParam: string | null;
}): { finalRole: UserRole; isNewUser: boolean; destination: string } {
  let finalRole: UserRole;
  const isNewUser = !existingProfileRole;

  if (existingProfileRole) {
    // CRITICAL SECURITY RULE: NEVER overwrite an existing user's role through an OAuth callback.
    finalRole = existingProfileRole;
  } else {
    // New user registration: Sanitize requested role. Only 'customer' or 'worker' are permitted.
    finalRole = requestedRoleParam === 'worker' ? 'worker' : 'customer';
  }

  // Secure Redirect Destination: Customers land directly on /post-job, workers on worker dashboard
  let destination = finalRole === 'worker' ? '/dashboard?role=worker' : '/post-job';

  // If a safe internal redirect parameter was provided and doesn't contradict role boundaries
  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    if (finalRole === 'customer') {
      // Customers should never be redirected to /dashboard or worker views
      if (
        redirectParam === '/dashboard' ||
        redirectParam.startsWith('/dashboard?') ||
        redirectParam.includes('role=worker')
      ) {
        destination = '/post-job';
      } else {
        destination = redirectParam;
      }
    } else if (finalRole === 'worker') {
      destination = redirectParam;
    }
  }

  return { finalRole, isNewUser, destination };
}

