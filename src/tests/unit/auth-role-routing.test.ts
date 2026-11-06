/**
 * Automated Unit Tests: Sahayak Worker & Customer Role-Based Routing & Protection
 *
 * Verifies the authoritative role determination and destination routing rules:
 * 1. CUSTOMER:
 *    - Google Login -> /post-job
 *    - Email OTP Login -> /post-job
 *    - Manual access to /dashboard -> strictly redirected to /post-job
 *    - Preserves safe customer routes like /bookings
 * 2. WORKER / PARTNER:
 *    - Existing Worker Google Login -> worker dashboard (/dashboard?role=worker or /dashboard)
 *    - Existing Worker Email OTP Login -> worker dashboard (/dashboard?role=worker)
 *    - New Worker Google Registration -> /dashboard?role=worker
 *    - New Worker Email OTP Registration -> /dashboard?role=worker
 *    - Manual or accidental access to /post-job -> strictly redirected to /dashboard?role=worker
 * 3. ADMIN:
 *    - Admin Login -> /dashboard?role=worker&admin=true
 * 4. SECURITY & PRECEDENCE:
 *    - Database profile role overrides user_metadata and query parameters
 *    - Open redirects and malicious cross-role redirects are blocked
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determineUserRole, getDestinationForRole } from '@/lib/auth/roles';
import { resolveOAuthRoleAndDestination } from '@/lib/auth/oauth';

describe('Sahayak Authentication & Role-Based Dashboard Routing', () => {
  describe('Authoritative Role Determination (determineUserRole)', () => {
    it('prioritizes database profile role over metadata and fallback', () => {
      const role = determineUserRole({
        profileRole: 'worker',
        metadataRole: 'customer',
        fallbackRole: 'customer',
      });
      assert.equal(role, 'worker', 'Database profile role must be authoritative');
    });

    it('falls back to metadataRole when database profile role is missing (new signup)', () => {
      const role = determineUserRole({
        profileRole: null,
        metadataRole: 'worker',
        fallbackRole: 'customer',
      });
      assert.equal(role, 'worker', 'Metadata role honored for new registrations');
    });

    it('falls back to fallbackRole when both profile and metadata roles are absent or invalid', () => {
      const role = determineUserRole({
        profileRole: null,
        metadataRole: null,
        fallbackRole: 'customer',
      });
      assert.equal(role, 'customer', 'Must default to customer');
    });

    it('protects against unknown or invalid role strings', () => {
      const role = determineUserRole({
        profileRole: 'superadmin',
        metadataRole: 'hacker',
        fallbackRole: 'customer',
      });
      assert.equal(role, 'customer', 'Unknown roles must fall back safely to customer');
    });
  });

  describe('Customer Routing & Route Protection', () => {
    it('redirects Customer Google login to /post-job', () => {
      const dest = getDestinationForRole('customer');
      assert.equal(dest, '/post-job', 'Customer default destination must be /post-job');
    });

    it('redirects Customer Email OTP login to /post-job', () => {
      const role = determineUserRole({ profileRole: 'customer' });
      const dest = getDestinationForRole(role, '/post-job');
      assert.equal(dest, '/post-job');
    });

    it('blocks Customer from accessing bare /dashboard and redirects to /post-job', () => {
      const dest = getDestinationForRole('customer', '/dashboard');
      assert.equal(dest, '/post-job', 'Customer attempting to access /dashboard must land on /post-job');
    });

    it('blocks Customer from accessing /dashboard?role=worker and redirects to /post-job', () => {
      const dest = getDestinationForRole('customer', '/dashboard?role=worker');
      assert.equal(dest, '/post-job', 'Customer attempting to access worker dashboard must land on /post-job');
    });

    it('preserves valid customer internal pages like /bookings', () => {
      const dest = getDestinationForRole('customer', '/bookings');
      assert.equal(dest, '/bookings', 'Safe customer pages must be preserved');
    });

    it('sanitizes external / open redirect attempts for customer', () => {
      const dest = getDestinationForRole('customer', 'https://malicious-site.com');
      assert.equal(dest, '/post-job', 'External URLs must be rejected');
    });
  });

  describe('Worker / Partner Routing & Route Protection', () => {
    it('redirects existing Worker to /dashboard?role=worker by default', () => {
      const role = determineUserRole({ profileRole: 'worker' });
      const dest = getDestinationForRole(role);
      assert.equal(dest, '/dashboard?role=worker');
    });

    it('strictly intercepts Worker navigating to /post-job and redirects to worker dashboard', () => {
      const dest = getDestinationForRole('worker', '/post-job');
      assert.equal(dest, '/dashboard?role=worker', 'Worker must NEVER land on customer /post-job');
    });

    it('strictly intercepts Worker navigating to /post-job sub-paths and redirects to worker dashboard', () => {
      const dest = getDestinationForRole('worker', '/post-job?category=plumbing');
      assert.equal(dest, '/dashboard?role=worker', 'Worker must NEVER land on customer /post-job with query params');
    });

    it('preserves safe worker internal routes such as /dashboard', () => {
      const dest = getDestinationForRole('worker', '/dashboard');
      assert.equal(dest, '/dashboard', 'Worker dashboard path must be allowed');
    });

    it('preserves safe worker internal routes such as /dashboard?role=worker', () => {
      const dest = getDestinationForRole('worker', '/dashboard?role=worker');
      assert.equal(dest, '/dashboard?role=worker');
    });

    it('sanitizes external / protocol-relative redirects for worker', () => {
      const dest = getDestinationForRole('worker', '//evil.com/phish');
      assert.equal(dest, '/dashboard?role=worker', 'Protocol-relative URLs must be rejected');
    });
  });

  describe('New Worker & Customer Registration Flow', () => {
    it('routes New Worker Google Registration to /dashboard?role=worker', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: null,
        requestedRoleParam: 'worker',
        redirectParam: null,
      });
      assert.equal(result.finalRole, 'worker');
      assert.equal(result.isNewUser, true);
      assert.equal(result.destination, '/dashboard?role=worker');
    });

    it('routes New Worker Email OTP Registration to /dashboard?role=worker', () => {
      const role = determineUserRole({
        profileRole: null,
        metadataRole: 'worker',
        fallbackRole: 'worker',
      });
      const dest = getDestinationForRole(role);
      assert.equal(role, 'worker');
      assert.equal(dest, '/dashboard?role=worker');
    });

    it('routes New Customer Google Registration to /post-job', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: null,
        requestedRoleParam: 'customer',
        redirectParam: null,
      });
      assert.equal(result.finalRole, 'customer');
      assert.equal(result.isNewUser, true);
      assert.equal(result.destination, '/post-job');
    });

    it('routes New Customer Email OTP Registration to /post-job', () => {
      const role = determineUserRole({
        profileRole: null,
        metadataRole: 'customer',
        fallbackRole: 'customer',
      });
      const dest = getDestinationForRole(role);
      assert.equal(role, 'customer');
      assert.equal(dest, '/post-job');
    });
  });

  describe('Admin Routing & Role Protection', () => {
    it('routes Admin to /admin by default', () => {
      const dest = getDestinationForRole('admin');
      assert.equal(dest, '/admin');
    });

    it('redirects Admin away from /post-job to authorized admin console /admin', () => {
      const dest = getDestinationForRole('admin', '/post-job');
      assert.equal(dest, '/admin');
    });

    it('allows Admin to navigate to internal management routes (/admin/settings, /admin/verification)', () => {
      const destSettings = getDestinationForRole('admin', '/admin/settings');
      assert.equal(destSettings, '/admin/settings');

      const destVerification = getDestinationForRole('admin', '/admin/verification');
      assert.equal(destVerification, '/admin/verification');
    });

    it('blocks Customer from navigating to /admin* routes and redirects to /post-job', () => {
      const destAdmin = getDestinationForRole('customer', '/admin');
      assert.equal(destAdmin, '/post-job');

      const destAdminUsers = getDestinationForRole('customer', '/admin/users');
      assert.equal(destAdminUsers, '/post-job');
    });

    it('blocks Worker from navigating to /admin* routes and redirects to /dashboard?role=worker', () => {
      const destAdmin = getDestinationForRole('worker', '/admin');
      assert.equal(destAdmin, '/dashboard?role=worker');

      const destAdminVerify = getDestinationForRole('worker', '/admin/verification');
      assert.equal(destAdminVerify, '/dashboard?role=worker');
    });

    it('sanitizes open redirects and protocol-relative URLs for Admin to /admin', () => {
      const destOpen = getDestinationForRole('admin', 'https://malicious.com');
      assert.equal(destOpen, '/admin');

      const destProto = getDestinationForRole('admin', '//evil.com');
      assert.equal(destProto, '/admin');

      const destSlash = getDestinationForRole('admin', '/\\evil.com');
      assert.equal(destSlash, '/admin');
    });

    it('redirects Suspended Admin accounts to /login?error=account_suspended', () => {
      const destDefault = getDestinationForRole('admin', null, { isSuspended: true });
      assert.equal(destDefault, '/login?error=account_suspended');

      const destAdmin = getDestinationForRole('admin', '/admin', { isSuspended: true });
      assert.equal(destAdmin, '/login?error=account_suspended');

      const destSubpath = getDestinationForRole('admin', '/admin/users', true);
      assert.equal(destSubpath, '/login?error=account_suspended');
    });

    it('resolves active Admin OAuth login to /admin', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'admin',
        requestedRoleParam: null,
        redirectParam: null,
      });
      assert.equal(result.finalRole, 'admin');
      assert.equal(result.roleMismatch, false);
      assert.equal(result.destination, '/admin');
    });

    it('resolves active Admin OAuth login with safe /admin subpath redirect', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'admin',
        requestedRoleParam: null,
        redirectParam: '/admin/audit-log',
      });
      assert.equal(result.finalRole, 'admin');
      assert.equal(result.destination, '/admin/audit-log');
    });

    it('resolves Suspended Admin OAuth login to /login?error=account_suspended', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'admin',
        requestedRoleParam: null,
        redirectParam: '/admin',
        isSuspended: true,
      });
      assert.equal(result.finalRole, 'admin');
      assert.equal(result.destination, '/login?error=account_suspended');
    });
  });

  describe('Zero-Trust Query Parameter Tampering Resilience', () => {
    it('prevents existing customer from claiming worker dashboard by passing role=worker query and flags roleMismatch', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'worker',
        redirectParam: '/dashboard?role=worker',
      });
      assert.equal(result.finalRole, 'customer', 'Customer role must be preserved');
      assert.equal(result.roleMismatch, true, 'Account-role mismatch must be flagged');
      assert.equal(
        result.destination,
        '/login?error=account_role_mismatch&expected=worker&actual=customer',
        'Customer attempting worker login must be redirected to /login with explanation, not silently to /post-job'
      );
    });

    it('prevents existing worker from being demoted or diverted to customer /post-job', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'worker',
        requestedRoleParam: 'customer',
        redirectParam: '/post-job',
      });
      assert.equal(result.finalRole, 'worker');
      assert.equal(result.destination, '/dashboard?role=worker', 'Worker must not be routed to /post-job');
    });
  });

  describe('Comprehensive Lifecycle Scenarios (Section 6 Requirements)', () => {
    it('Scenario 1: Existing Worker + Google OAuth round trip routes to Worker Dashboard', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'worker',
        requestedRoleParam: 'worker',
        redirectParam: '/dashboard?role=worker',
      });
      assert.equal(result.finalRole, 'worker');
      assert.equal(result.roleMismatch, false);
      assert.equal(result.destination, '/dashboard?role=worker');
    });

    it('Scenario 2: Existing Worker + Email OTP round trip routes to Worker Dashboard', () => {
      const role = determineUserRole({
        profileRole: 'worker',
        metadataRole: 'worker',
        fallbackRole: 'customer',
      });
      const dest = getDestinationForRole(role, '/dashboard?role=worker');
      assert.equal(role, 'worker');
      assert.equal(dest, '/dashboard?role=worker');
    });

    it('Scenario 3: New Worker + Google Registration routes to Worker Dashboard', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: null, // New user
        requestedRoleParam: 'worker',
        redirectParam: null,
      });
      assert.equal(result.finalRole, 'worker');
      assert.equal(result.isNewUser, true);
      assert.equal(result.destination, '/dashboard?role=worker');
    });

    it('Scenario 4: New Worker + Email OTP Registration routes to Worker Dashboard', () => {
      const role = determineUserRole({
        profileRole: null,
        metadataRole: 'worker',
        fallbackRole: 'worker',
      });
      const dest = getDestinationForRole(role);
      assert.equal(role, 'worker');
      assert.equal(dest, '/dashboard?role=worker');
    });

    it('Scenario 5: Customer + Google Login routes strictly to /post-job', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'customer',
        redirectParam: '/post-job',
      });
      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/post-job');
    });

    it('Scenario 6: Customer + Email OTP Login routes strictly to /post-job', () => {
      const role = determineUserRole({
        profileRole: 'customer',
        metadataRole: 'customer',
      });
      const dest = getDestinationForRole(role);
      assert.equal(role, 'customer');
      assert.equal(dest, '/post-job');
    });

    it('Scenario 7: Existing Worker with mismatched auth metadata (metadata says customer) still resolves to Worker', () => {
      const role = determineUserRole({
        profileRole: 'worker', // DB profile is authoritative
        metadataRole: 'customer', // Mismatched or outdated metadata
      });
      assert.equal(role, 'worker', 'Database profile role must override conflicting auth metadata');
      const dest = getDestinationForRole(role, '/post-job');
      assert.equal(dest, '/dashboard?role=worker', 'Worker must never be routed to /post-job');
    });

    it('Scenario 8: Callback redirect sanitization blocks open redirects and script injections', () => {
      const maliciousRedirects = [
        'https://evil.com/phish',
        'http://attacker.com',
        '//evil.com',
        'javascript:alert(1)',
      ];
      for (const badUrl of maliciousRedirects) {
        const dest = getDestinationForRole('worker', badUrl);
        assert.equal(dest, '/dashboard?role=worker', `Malicious redirect "${badUrl}" must be sanitized`);
      }
    });

    it('Scenario 9: Customer direct access to /dashboard is intercepted and routed to /post-job', () => {
      const dest = getDestinationForRole('customer', '/dashboard');
      assert.equal(dest, '/post-job');
      const destWorkerQuery = getDestinationForRole('customer', '/dashboard?role=worker');
      assert.equal(destWorkerQuery, '/post-job');
    });

    it('Scenario 10: Worker direct access to /post-job is intercepted and routed to /dashboard?role=worker', () => {
      const dest = getDestinationForRole('worker', '/post-job');
      assert.equal(dest, '/dashboard?role=worker');
      const destQuery = getDestinationForRole('worker', '/post-job?category=cleaning');
      assert.equal(destQuery, '/dashboard?role=worker');
    });
  });
});

