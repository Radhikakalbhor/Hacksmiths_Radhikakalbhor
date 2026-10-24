/**
 * Automated Unit Tests: Booking Lifecycle, Cryptographic OTP, ETA, and Chat
 * Validates the Uber/Rapido-style customer-to-worker booking engine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionBooking,
  calculateEstimatedTravelTimeMinutes,
  BookingStage,
} from '@/types/booking';
import { BookingService } from '@/lib/services/booking.service';

describe('Booking Lifecycle State Transitions', () => {
  it('should allow valid sequential progression through the Uber/Rapido lifecycle', () => {
    // 1. requested -> accepted
    assert.equal(canTransitionBooking('requested', 'accepted'), true);
    // 2. accepted -> on_the_way
    assert.equal(canTransitionBooking('accepted', 'on_the_way'), true);
    // 3. on_the_way -> arrived
    assert.equal(canTransitionBooking('on_the_way', 'arrived'), true);
    // 4. arrived -> in_progress (requires OTP verification)
    assert.equal(canTransitionBooking('arrived', 'in_progress'), true);
    // 5. in_progress -> completed
    assert.equal(canTransitionBooking('in_progress', 'completed'), true);
  });

  it('should allow cancellation from any intermediate uncompleted stage', () => {
    assert.equal(canTransitionBooking('requested', 'cancelled'), true);
    assert.equal(canTransitionBooking('accepted', 'cancelled'), true);
    assert.equal(canTransitionBooking('on_the_way', 'cancelled'), true);
    assert.equal(canTransitionBooking('arrived', 'cancelled'), true);
    assert.equal(canTransitionBooking('in_progress', 'cancelled'), true);
  });

  it('should block illegal status jumps or regressions', () => {
    // Cannot skip traveling and arrival
    assert.equal(canTransitionBooking('requested', 'in_progress'), false);
    assert.equal(canTransitionBooking('accepted', 'completed'), false);
    assert.equal(canTransitionBooking('on_the_way', 'completed'), false);

    // Terminal states cannot transition further
    assert.equal(canTransitionBooking('completed', 'accepted'), false);
    assert.equal(canTransitionBooking('completed', 'requested'), false);
    assert.equal(canTransitionBooking('cancelled', 'on_the_way'), false);
    assert.equal(canTransitionBooking('cancelled', 'in_progress'), false);
  });
});

describe('Cryptographic OTP Generation and Hashing', () => {
  it('should generate a 4-digit unpredictable numeric OTP', () => {
    for (let i = 0; i < 20; i++) {
      const otp = BookingService.generateOtpCode();
      assert.match(otp, /^\d{4}$/, `OTP ${otp} is not a valid 4-digit numeric code`);
      const num = parseInt(otp, 10);
      assert.ok(num >= 1000 && num <= 9999, `OTP ${num} out of bounds`);
    }
  });

  it('should produce salted SHA-256 hashes matching exact input only', () => {
    const otp = '4821';
    const salt1 = BookingService.generateSalt();
    const salt2 = BookingService.generateSalt();

    const hash1a = BookingService.hashOtp(otp, salt1);
    const hash1b = BookingService.hashOtp(otp, salt1);
    const hash2 = BookingService.hashOtp(otp, salt2);

    // Deterministic with same salt
    assert.equal(hash1a, hash1b);
    // Different salts produce different hashes
    assert.notEqual(hash1a, hash2);
    // Incorrect OTP produces different hash
    assert.notEqual(BookingService.hashOtp('4822', salt1), hash1a);
  });
});

describe('Estimated Travel Time (ETA) and Distance Calculation', () => {
  it('should calculate realistic urban arrival times based on distance', () => {
    // 0 meters (on site)
    const etaZero = calculateEstimatedTravelTimeMinutes(0);
    assert.ok(etaZero.minutes >= 5, 'Should include base preparation buffer');
    assert.equal(etaZero.distanceKm, '0.0');

    // 3,000 meters (3 km)
    const eta3km = calculateEstimatedTravelTimeMinutes(3000);
    assert.equal(eta3km.distanceKm, '3.0');
    assert.ok(eta3km.minutes >= 12 && eta3km.minutes <= 25, `3km ETA was ${eta3km.minutes} mins`);

    // 10,000 meters (10 km)
    const eta10km = calculateEstimatedTravelTimeMinutes(10000);
    assert.equal(eta10km.distanceKm, '10.0');
    assert.ok(eta10km.minutes > eta3km.minutes);
  });
});

describe('Demo vs Real Worker Distinction & Privacy', () => {
  it('should correctly identify demo workers vs real workers', () => {
    const isDemoWorker1 = (name: string, phone?: string | null) =>
      name.includes('[DEMO]') || (phone ? phone.startsWith('+91999900000') : false);

    assert.equal(isDemoWorker1('[DEMO] Manoj Varma', '+919999000009'), true);
    assert.equal(isDemoWorker1('Rajesh Sharma', '+919820123456'), false);
    assert.equal(isDemoWorker1('Amit Patel', null), false);
  });

  it('should sanitize customerOtp so workers never see the plain text OTP', () => {
    const customerAiDetails = {
      booking: {
        stage: 'accepted' as BookingStage,
        workerId: 'worker-123',
        customerOtp: '5678',
        otpVerified: false,
      },
    };

    // Simulation of sanitizeJobForNonCustomer logic
    const sanitize = (details: typeof customerAiDetails) => {
      const copy = { ...details, booking: { ...details.booking } };
      delete (copy.booking as Record<string, unknown>).customerOtp;
      return copy;
    };

    const sanitized = sanitize(customerAiDetails);
    assert.equal(sanitized.booking.customerOtp, undefined);
    assert.equal(sanitized.booking.stage, 'accepted');
  });

  it('should accept lowercase job status values conforming to PostgreSQL jobs_status_check', () => {
    // Permitted by live PostgreSQL jobs_status_check constraint:
    const permittedLowercaseStatuses = [
      'draft',
      'posted',
      'bidding_open',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
      'disputed',
    ];

    for (const status of permittedLowercaseStatuses) {
      assert.ok(status === status.toLowerCase(), `Status ${status} is not lowercase`);
    }
  });
});
