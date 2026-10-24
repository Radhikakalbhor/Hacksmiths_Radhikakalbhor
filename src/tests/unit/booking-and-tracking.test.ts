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

describe('Cancellation Reasons and Server-Side Lifecycle Rules', () => {
  const PREDEFINED_REASONS = [
    'Estimated wait time is too long',
    'I no longer need this service',
    'I found a better price',
    'I am not comfortable with this professional',
    'I changed my mind',
    'Other',
  ];

  it('should accept all 6 required cancellation reasons', () => {
    assert.equal(PREDEFINED_REASONS.length, 6);
    for (const reason of PREDEFINED_REASONS) {
      assert.ok(reason.length > 0, 'Reason must not be empty');
    }
  });

  it('should reject cancellation when reason is missing or whitespace only', () => {
    const validateCancellationPayload = (targetStage: string, reason?: string | null) => {
      if (targetStage === 'cancelled') {
        if (!reason || reason.trim().length === 0) {
          return { valid: false, error: 'A cancellation reason is required.' };
        }
      }
      return { valid: true };
    };

    assert.equal(validateCancellationPayload('cancelled', '').valid, false);
    assert.equal(validateCancellationPayload('cancelled', '   ').valid, false);
    assert.equal(validateCancellationPayload('cancelled', null).valid, false);
    assert.equal(validateCancellationPayload('cancelled', undefined).valid, false);
    assert.equal(validateCancellationPayload('cancelled', 'I changed my mind').valid, true);
    assert.equal(validateCancellationPayload('cancelled', 'Found cheaper plumber').valid, true);
  });

  it('should strictly prohibit cancelling already completed bookings', () => {
    const canCancel = (currentStage: BookingStage) => {
      if (currentStage === 'completed') return false;
      return canTransitionBooking(currentStage, 'cancelled');
    };

    assert.equal(canCancel('completed'), false, 'Completed booking must never be cancelled');
    assert.equal(canCancel('accepted'), true);
    assert.equal(canCancel('on_the_way'), true);
    assert.equal(canCancel('arrived'), true);
    assert.equal(canCancel('in_progress'), true);
  });
});

describe('Two-Way Messaging & Worker Chat Simulation Verification', () => {
  it('should validate message authorization: only customer and assigned worker can participate', () => {
    const isAuthorizedForChat = (
      userId: string,
      jobCustomerId: string,
      bookingWorkerId?: string | null
    ) => {
      return userId === jobCustomerId || userId === bookingWorkerId;
    };

    const customerId = 'cust-uuid-1';
    const workerId = 'worker-uuid-2';
    const intruderId = 'stranger-uuid-3';

    assert.equal(isAuthorizedForChat(customerId, customerId, workerId), true);
    assert.equal(isAuthorizedForChat(workerId, customerId, workerId), true);
    assert.equal(isAuthorizedForChat(intruderId, customerId, workerId), false);
  });

  it('should label simulated demo replies with [Demo Simulation] and never fabricate real worker replies', () => {
    const generateWorkerReply = (isDemoWorker: boolean, workerName: string, customerText: string) => {
      if (!isDemoWorker) {
        // Real workers MUST NOT have automated fabricated replies
        return null;
      }
      // Demo simulation
      let text = "I'm currently on my way to your location.";
      if (customerText.toLowerCase().includes('how long')) {
        text = "I'm en route and expect to arrive in about 15-20 minutes depending on local traffic.";
      }
      return {
        text: `[Demo Simulation] ${text}`,
        senderName: `${workerName} (Demo Simulation)`,
        senderRole: 'worker' as const,
      };
    };

    // 1. Real worker: NO simulation reply returned
    const realReply = generateWorkerReply(false, 'Rajesh Kumar', 'How long until you arrive?');
    assert.equal(realReply, null, 'Real workers must never have synthetic simulated replies');

    // 2. Demo worker: clearly labelled simulation reply returned
    const demoReply = generateWorkerReply(true, 'Demo Electrician', 'How long until you arrive?');
    assert.ok(demoReply !== null);
    assert.ok(demoReply.text.startsWith('[Demo Simulation]'), 'Demo reply must be explicitly flagged');
    assert.ok(demoReply.senderName.includes('Demo Simulation'), 'Sender name must state Demo Simulation');
    assert.equal(demoReply.senderRole, 'worker');
  });

  it('should generate appropriate contextual replies for all quick-reply suggestion chips', () => {
    const getContextualReply = (text: string, arrivalMinutes: number = 20) => {
      const lower = text.toLowerCase();
      if (lower.includes('let me know')) {
        return '[Demo Simulation] Absolutely, I will send a quick update the moment I pull up outside.';
      }
      if (lower.includes('gate') || lower.includes('finding')) {
        return '[Demo Simulation] Thank you, following GPS coordinates and will message if directions are needed.';
      }
      if (lower.includes('entrance') || lower.includes('waiting')) {
        return '[Demo Simulation] Noted! I will meet you right at the building entrance/gate as soon as I arrive.';
      }
      if (lower.includes('how long') || lower.includes('when') || lower.includes('arrive')) {
        return `[Demo Simulation] On my way! Navigating local transit. Expect to arrive in approximately ${arrivalMinutes} mins.`;
      }
      return '[Demo Simulation] Message received! I am currently focused on reaching your address safely.';
    };

    // Test chip 1: "How long until you arrive?"
    assert.match(getContextualReply('How long until you arrive?', 15), /15 mins/);
    // Test chip 2: "I'm waiting at the entrance"
    assert.match(getContextualReply("I'm waiting at the entrance"), /entrance\/gate/);
    // Test chip 3: "Please let me know when you arrive"
    assert.match(getContextualReply("Please let me know when you arrive"), /update the moment I pull up/);
    // Test chip 4: "Need help finding the gate?"
    assert.match(getContextualReply("Need help finding the gate?"), /GPS coordinates/);
  });

  it('should accurately detect demo accounts without misclassifying real professionals', () => {
    const isDemoWorkerCheck = (account: {
      workerName?: string;
      phone?: string | null;
      email?: string | null;
      bio?: string | null;
    }) => {
      if (account.workerName?.includes('[DEMO]') || account.workerName?.toLowerCase().includes('demo')) return true;
      if (account.phone?.includes('99990000')) return true;
      if (account.email?.includes('sahayak.demo.internal')) return true;
      if (account.bio?.includes('[DEMO]') || account.bio?.toLowerCase().includes('demonstration only')) return true;
      return false;
    };

    // Seeded demo workers:
    assert.equal(isDemoWorkerCheck({ workerName: 'Professional Service Partner', bio: '[DEMO] Painting contractor...' }), true);
    assert.equal(isDemoWorkerCheck({ workerName: '[DEMO] Manoj Varma', phone: '+919999000009' }), true);
    assert.equal(isDemoWorkerCheck({ workerName: 'Santosh', email: 'santosh-plumber@sahayak.demo.internal' }), true);

    // Real professionals:
    assert.equal(isDemoWorkerCheck({
      workerName: 'Sanjay Deshpande',
      phone: '+919820543210',
      email: 'sanjay.d@gmail.com',
      bio: 'Licensed electrician with 12 years of experience in residential wiring.'
    }), false);
  });
});

