import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  determineUserRole,
  isWorkerOnlyRoute,
  isCustomerOnlyRoute,
  getDestinationForRole,
} from '@/lib/auth/roles';

describe('Sahayak Customer & Worker Role-Based Separation', () => {
  describe('Route Classification & Boundaries', () => {
    it('accurately identifies customer-only routes', () => {
      assert.strictEqual(isCustomerOnlyRoute('/post-job'), true);
      assert.strictEqual(isCustomerOnlyRoute('/post-job/step-2'), true);
      assert.strictEqual(isCustomerOnlyRoute('/bookings'), true);
      assert.strictEqual(isCustomerOnlyRoute('/bookings/123'), true);
      assert.strictEqual(isCustomerOnlyRoute('/my-jobs'), true);
      assert.strictEqual(isCustomerOnlyRoute('/booking-history'), true);

      // Worker routes should not be customer routes
      assert.strictEqual(isCustomerOnlyRoute('/worker/dashboard'), false);
      assert.strictEqual(isCustomerOnlyRoute('/worker/jobs'), false);
      assert.strictEqual(isCustomerOnlyRoute('/worker/wallet'), false);
      assert.strictEqual(isCustomerOnlyRoute('/dashboard'), false);
    });

    it('accurately identifies worker-only routes', () => {
      assert.strictEqual(isWorkerOnlyRoute('/worker/dashboard'), true);
      assert.strictEqual(isWorkerOnlyRoute('/worker/jobs'), true);
      assert.strictEqual(isWorkerOnlyRoute('/worker/wallet'), true);
      assert.strictEqual(isWorkerOnlyRoute('/worker/earnings'), true);
      assert.strictEqual(isWorkerOnlyRoute('/worker/transactions'), true);
      assert.strictEqual(isWorkerOnlyRoute('/worker/reputation'), true);
      assert.strictEqual(isWorkerOnlyRoute('/worker/profile'), true);
      assert.strictEqual(isWorkerOnlyRoute('/worker/skills'), true);
      assert.strictEqual(isWorkerOnlyRoute('/dashboard'), true);
      assert.strictEqual(isWorkerOnlyRoute('/dashboard?role=worker'), true);

      // Customer routes should not be worker routes
      assert.strictEqual(isWorkerOnlyRoute('/post-job'), false);
      assert.strictEqual(isWorkerOnlyRoute('/bookings'), false);
      assert.strictEqual(isWorkerOnlyRoute('/my-jobs'), false);
    });
  });

  describe('Strict Cross-Role Navigation Enforcement', () => {
    it('redirects customer away from all worker routes and admin routes to /post-job', () => {
      assert.strictEqual(getDestinationForRole('customer', '/worker/dashboard'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/worker/jobs'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/worker/wallet'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/worker/earnings'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/worker/transactions'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/dashboard'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/dashboard?role=worker'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/admin'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/admin/users'), '/post-job');
    });

    it('preserves valid customer internal navigation', () => {
      assert.strictEqual(getDestinationForRole('customer', '/post-job'), '/post-job');
      assert.strictEqual(getDestinationForRole('customer', '/bookings'), '/bookings');
      assert.strictEqual(getDestinationForRole('customer', '/my-jobs'), '/my-jobs');
      assert.strictEqual(getDestinationForRole('customer', '/booking-history'), '/booking-history');
    });

    it('redirects worker away from all customer routes and admin routes to /dashboard?role=worker', () => {
      assert.strictEqual(getDestinationForRole('worker', '/post-job'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('worker', '/post-job?step=1'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('worker', '/bookings'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('worker', '/my-jobs'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('worker', '/booking-history'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('worker', '/admin'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('worker', '/admin/verification'), '/dashboard?role=worker');
    });

    it('enforces admin destination and handles suspended admin safely', () => {
      assert.strictEqual(getDestinationForRole('admin'), '/admin');
      assert.strictEqual(getDestinationForRole('admin', '/admin/settings'), '/admin/settings');
      assert.strictEqual(getDestinationForRole('admin', '/post-job'), '/admin');
      assert.strictEqual(getDestinationForRole('admin', null, { isSuspended: true }), '/login?error=account_suspended');
      assert.strictEqual(getDestinationForRole('admin', '/admin', { isSuspended: true }), '/login?error=account_suspended');
    });

    it('preserves valid worker internal navigation', () => {
      assert.strictEqual(getDestinationForRole('worker', '/worker/dashboard'), '/worker/dashboard');
      assert.strictEqual(getDestinationForRole('worker', '/worker/jobs'), '/worker/jobs');
      assert.strictEqual(getDestinationForRole('worker', '/worker/wallet'), '/worker/wallet');
      assert.strictEqual(getDestinationForRole('worker', '/worker/transactions'), '/worker/transactions');
      assert.strictEqual(getDestinationForRole('worker', '/dashboard?role=worker'), '/dashboard?role=worker');
    });
  });

  describe('Authoritative Role Precedence & Safety', () => {
    it('gives absolute precedence to database profile role over metadata and client requests', () => {
      // Attacker metadata claims admin or customer, but DB profile is worker
      const role = determineUserRole({
        profileRole: 'worker',
        metadataRole: 'customer',
        fallbackRole: 'customer',
      });
      assert.strictEqual(role, 'worker');

      // Routing enforces worker destination regardless of spoofed metadata
      const dest = getDestinationForRole(role, '/post-job');
      assert.strictEqual(dest, '/dashboard?role=worker');
    });

    it('neutralizes open redirect attempts during role destination calculation', () => {
      assert.strictEqual(getDestinationForRole('customer', 'https://malicious.com'), '/post-job');
      assert.strictEqual(getDestinationForRole('worker', 'https://malicious.com'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('worker', '//malicious.com'), '/dashboard?role=worker');
      assert.strictEqual(getDestinationForRole('customer', 'javascript:alert(1)'), '/post-job');
    });
  });
});

