/**
 * Automated Unit Tests: OAuth Callback Role Preservation & Redirection
 * Verifies zero-trust handling:
 * 1. Existing customer profile role is never overwritten by query param manipulation.
 * 2. Existing worker profile role is never overwritten.
 * 3. Existing admin role is never downgraded or overwritten.
 * 4. New user registration prevents unauthorized privilege escalation to admin.
 * 5. Destination redirection respects role boundaries and blocks open redirects.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOAuthRoleAndDestination } from '@/app/auth/callback/route';

describe('OAuth Callback Role Preservation & Redirection', () => {
  it('should NOT overwrite existing customer role when role=worker is requested in query', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: 'customer',
      requestedRoleParam: 'worker', // Untrusted query param trying to claim worker
      redirectParam: '/dashboard?role=worker',
    });

    assert.equal(result.finalRole, 'customer', 'Customer role must be preserved');
    assert.equal(result.isNewUser, false);
    assert.equal(result.destination, '/dashboard', 'Customer must not be redirected to worker view');
  });

  it('should NOT overwrite existing worker role when role=customer is requested', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: 'worker',
      requestedRoleParam: 'customer',
      redirectParam: '/dashboard',
    });

    assert.equal(result.finalRole, 'worker', 'Worker role must be preserved');
    assert.equal(result.isNewUser, false);
    assert.equal(result.destination, '/dashboard', 'Requested safe internal dashboard path honored for worker');
  });

  it('should preserve existing admin role against query param tampering', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: 'admin',
      requestedRoleParam: 'customer',
      redirectParam: null,
    });

    assert.equal(result.finalRole, 'admin');
    assert.equal(result.isNewUser, false);
  });

  it('should reject privilege escalation to admin for brand new users and default to customer', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: null, // New user
      requestedRoleParam: 'admin', // Malicious attempt to self-grant admin
      redirectParam: null,
    });

    assert.equal(result.finalRole, 'customer', 'Admin role must be blocked for new OAuth sign-ups');
    assert.equal(result.isNewUser, true);
    assert.equal(result.destination, '/dashboard');
  });

  it('should assign worker role and route to worker marketplace for new worker sign-ups', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: null, // New user
      requestedRoleParam: 'worker',
      redirectParam: null,
    });

    assert.equal(result.finalRole, 'worker');
    assert.equal(result.isNewUser, true);
    assert.equal(result.destination, '/dashboard?role=worker');
  });

  it('should assign customer role and route to customer dashboard for new customer sign-ups', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: null, // New user
      requestedRoleParam: 'customer',
      redirectParam: null,
    });

    assert.equal(result.finalRole, 'customer');
    assert.equal(result.isNewUser, true);
    assert.equal(result.destination, '/dashboard');
  });

  it('should prevent open redirect attacks to external domains', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: null,
      requestedRoleParam: 'customer',
      redirectParam: 'https://malicious-phishing.com/steal-creds',
    });

    assert.equal(result.destination, '/dashboard', 'External URL must be ignored in favor of internal dashboard');
  });

  it('should prevent protocol-relative open redirect attacks', () => {
    const result = resolveOAuthRoleAndDestination({
      existingProfileRole: null,
      requestedRoleParam: 'customer',
      redirectParam: '//evil.com/phish',
    });

    assert.equal(result.destination, '/dashboard', 'Protocol-relative URL must be ignored');
  });
});
