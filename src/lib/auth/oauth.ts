import { UserRole } from '@/types/database.types';
import { getDestinationForRole } from '@/lib/auth/roles';

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
 * 2. New users can only be 'customer' or 'worker' (privilege escalation to 'admin' blocked).
 * 3. Redirect destinations are strictly role-bounded and open redirects prevented.
 * 4. Customers are redirected directly to /post-job; workers to /dashboard?role=worker.
 * 5. Workers must NEVER be redirected to /post-job.
 * 6. Explicit Account Role Mismatch Detection: If a user explicitly requested worker login
 *    (e.g. selected "Worker / Partner" tab), but the authenticated database profile is a Customer,
 *    we flag roleMismatch: true and redirect to /login with an explanatory error, NEVER silently
 *    dumping the user onto the customer /post-job page.
 */
export function resolveOAuthRoleAndDestination({
  existingProfileRole,
  requestedRoleParam,
  redirectParam,
}: {
  existingProfileRole: UserRole | null | undefined;
  requestedRoleParam: string | null;
  redirectParam: string | null;
}): OAuthResolutionResult {
  let finalRole: UserRole;
  const isNewUser = !existingProfileRole;
  let roleMismatch = false;
  let expectedRole: UserRole | undefined;
  let actualRole: UserRole | undefined;

  if (existingProfileRole) {
    // CRITICAL SECURITY RULE: NEVER overwrite an existing user's role through an OAuth callback.
    finalRole = existingProfileRole;

    // Check for explicit role mismatch: User tried to sign in as Worker, but profile is Customer
    if (requestedRoleParam === 'worker' && existingProfileRole === 'customer') {
      roleMismatch = true;
      expectedRole = 'worker';
      actualRole = 'customer';
    }
  } else {
    // New user registration: Sanitize requested role. Only 'customer' or 'worker' are permitted.
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

  // Strictly role-bounded destination
  const destination = getDestinationForRole(finalRole, redirectParam);

  return {
    finalRole,
    isNewUser,
    roleMismatch: false,
    destination,
  };
}
