import { UserRole } from '@/types/database.types';

/**
 * Pure function to resolve role and redirect destination securely.
 * Enforces zero-trust:
 * 1. Existing database roles are NEVER overwritten.
 * 2. New users can only be 'customer' or 'worker'.
 * 3. Redirect destinations are strictly role-bounded and open redirects prevented.
 * 4. Customers go to /post-job; workers go to /dashboard?role=worker.
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
    finalRole = existingProfileRole;
  } else {
    finalRole = requestedRoleParam === 'worker' ? 'worker' : 'customer';
  }

  let destination =
    finalRole === 'worker' ? '/dashboard?role=worker' : '/post-job';

  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    if (finalRole === 'customer') {
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