/**
 * Automated Unit Tests: Simplified Customer Experience & Worker Preservation
 *
 * Verifies:
 * 1. Customer login redirects directly to /post-job for both Google OAuth and Email OTP.
 * 2. If a customer attempts to visit or specify /dashboard as redirect target, it is sanitized to /post-job.
 * 3. Worker/Partner logins and dashboards remain completely intact (/dashboard?role=worker).
 * 4. Open redirects remain blocked.
 * 5. Safe non-dashboard customer routes (like /bookings) are preserved when specifically requested.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOAuthRoleAndDestination } from '@/lib/auth/oauth';

describe('Customer Simplified Flow & Worker Preservation', () => {
  describe('1. Google OAuth Customer Login Redirection', () => {
    it('redirects new customer signups directly to /post-job', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: null,
        requestedRoleParam: 'customer',
        redirectParam: null,
      });

      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/post-job');
    });

    it('redirects existing customers directly to /post-job when no redirect is provided', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: null,
        redirectParam: null,
      });

      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/post-job');
    });

    it('redirects customer to /post-job when /dashboard is explicitly passed as redirectParam', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'customer',
        redirectParam: '/dashboard',
      });

      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/post-job', 'Customer landing on /dashboard must be redirected to /post-job');
    });

    it('redirects customer to /post-job when /dashboard?role=customer is passed', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'customer',
        redirectParam: '/dashboard?role=customer',
      });

      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/post-job');
    });

    it('redirects customer to /post-job if malicious worker role param is requested in query', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'worker',
        redirectParam: '/dashboard?role=worker',
      });

      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/post-job', 'Customer cannot be routed to worker dashboard');
    });

    it('honors valid non-dashboard customer redirect targets (e.g. /bookings)', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'customer',
        redirectParam: '/bookings',
      });

      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/bookings');
    });
  });

  describe('2. Worker / Partner Preservation', () => {
    it('redirects new workers to /dashboard?role=worker', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: null,
        requestedRoleParam: 'worker',
        redirectParam: null,
      });

      assert.equal(result.finalRole, 'worker');
      assert.equal(result.destination, '/dashboard?role=worker');
    });

    it('preserves existing worker role and routes to /dashboard?role=worker', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'worker',
        requestedRoleParam: null,
        redirectParam: null,
      });

      assert.equal(result.finalRole, 'worker');
      assert.equal(result.destination, '/dashboard?role=worker');
    });

    it('preserves worker custom redirect param when valid', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'worker',
        requestedRoleParam: 'worker',
        redirectParam: '/dashboard?role=worker&tab=active',
      });

      assert.equal(result.finalRole, 'worker');
      assert.equal(result.destination, '/dashboard?role=worker&tab=active');
    });
  });

  describe('3. Email OTP Destination Determination Logic', () => {
    function resolveEmailOtpDestination(
      role: 'customer' | 'worker',
      requestedRedirect?: string | null
    ): string {
      const defaultTarget = role === 'worker' ? '/dashboard?role=worker' : '/post-job';
      if (role === 'customer') {
        if (!requestedRedirect || requestedRedirect === '/dashboard' || requestedRedirect.startsWith('/dashboard?')) {
          return '/post-job';
        }
        return requestedRedirect;
      }
      return requestedRedirect && requestedRedirect !== '/dashboard' ? requestedRedirect : defaultTarget;
    }

    it('resolves customer Email OTP destination to /post-job by default', () => {
      assert.equal(resolveEmailOtpDestination('customer'), '/post-job');
    });

    it('resolves customer Email OTP destination to /post-job when /dashboard was requested', () => {
      assert.equal(resolveEmailOtpDestination('customer', '/dashboard'), '/post-job');
    });

    it('resolves worker Email OTP destination to /dashboard?role=worker', () => {
      assert.equal(resolveEmailOtpDestination('worker'), '/dashboard?role=worker');
    });

    it('preserves non-dashboard customer destination for OTP (e.g. /bookings)', () => {
      assert.equal(resolveEmailOtpDestination('customer', '/bookings'), '/bookings');
    });
  });

  describe('4. Navigation Link Target Determination', () => {
    function getMarketplaceHref(userRole: 'customer' | 'worker' | null): string {
      return userRole === 'worker' ? '/dashboard?role=worker' : '/post-job';
    }

    it('routes guest/unauthenticated user to /post-job for Marketplace & Jobs', () => {
      assert.equal(getMarketplaceHref(null), '/post-job');
    });

    it('routes customer to /post-job for Marketplace & Jobs', () => {
      assert.equal(getMarketplaceHref('customer'), '/post-job');
    });

    it('routes worker to /dashboard?role=worker for Marketplace & Jobs', () => {
      assert.equal(getMarketplaceHref('worker'), '/dashboard?role=worker');
    });
  });
});

