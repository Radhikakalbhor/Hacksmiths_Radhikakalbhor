import { UserRole } from '@/types/database.types';
import { getDestinationForRole, normalizeRole } from '@/lib/auth/roles';

export interface OAuthResolutionResult {
  finalRole: UserRole;
  isNewUser: boolean;
  destination: string;
  roleMismatch: boolean;
  expectedRole?: UserRole;
  actualRole?: UserRole;
}

/**
 * Pure function to resolve role and redirect destination securely.
 * Enforces zero-trust:
 * 1. Existing database roles are NEVER overwritten.
 * 2. New users can only be 'customer' or 'worker'.
 * 3. Redirect destinations are strictly role-bounded and open redirects prevented.
 * 4. Customers are redirected directly to /post-job; workers to /dashboard?role=worker; admins to /admin.
 * 5. Workers and customers must NEVER be redirected to /admin*.
 * 6. Explicit Account Role Mismatch Detection: If a user explicitly requested worker login
 *    (e.g. selected "Worker / Partner" tab), but the authenticated database profile is a Customer,
 *    we flag roleMismatch: true and redirect to /login with an explanatory error, NEVER silently
 *    dumping the user onto the customer /post-job page.
 * 7. Suspended admins are redirected to /login?error=account_suspended.
 */
export function resolveOAuthRoleAndDestination({
  existingProfileRole,
  requestedRoleParam,
  redirectParam,
  isSuspended,
}: {
  existingProfileRole: UserRole | string | null | undefined;
  requestedRoleParam: string | null;
  redirectParam: string | null;
  isSuspended?: boolean;
}): OAuthResolutionResult {
  let finalRole: UserRole;
  const normalizedExisting = normalizeRole(existingProfileRole);
  const isNewUser = !normalizedExisting;
  let roleMismatch = false;
  let expectedRole: UserRole | undefined;
  let actualRole: UserRole | undefined;

  if (normalizedExisting) {
    finalRole = normalizedExisting;

    // Check for explicit role mismatch: User tried to sign in as Worker, but profile is Customer
    if (requestedRoleParam === 'worker' && normalizedExisting === 'customer') {
      roleMismatch = true;
      expectedRole = 'worker';
      actualRole = 'customer';
    }
  } else {
    finalRole = requestedRoleParam === 'worker' ? 'worker' : 'customer';
  }

  // If role mismatch occurred, redirect back to login with explanatory parameters
  if (roleMismatch) {
    return {
      finalRole,
      isNewUser: false,
      roleMismatch: true,
      expectedRole,
      actualRole,
      destination: `/login?error=account_role_mismatch&expected=worker&actual=customer`,
    };
  }

  // Strictly role-bounded destination (respects admin, worker, customer invariants & suspended states)
  const destination = getDestinationForRole(finalRole, redirectParam, { isSuspended });

  return {
    finalRole,
    isNewUser,
    roleMismatch: false,
    destination,
  };
}
