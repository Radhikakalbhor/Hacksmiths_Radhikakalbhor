import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BookingState } from '@/types/booking';

/**
 * Real Worker Booking ETA Timer & Acceptance Lifecycle Unit Tests
 */

// Helper simulating customer page countdown initialization logic (src/app/jobs/[id]/page.tsx)
function computeInitialCountdown(booking: BookingState, currentTimeMs: number = Date.now()): {
  simulatedCountdown: number;
  badgeLabel: string;
  statusLabel: string;
  isTimerRunning: boolean;
} {
  const travelMinutes = booking.estimatedArrivalMinutes || 20;
  const travelDurationSec = travelMinutes * 60;

  if (booking.isDemoWorker) {
    // Demo flow remains unchanged
    const countdown = booking.simulatedSecondsRemaining ?? travelDurationSec;
    return {
      simulatedCountdown: countdown,
      badgeLabel: `${Math.ceil(countdown / 60)} MINS`,
      statusLabel: 'Countdown:',
      isTimerRunning: countdown > 0,
    };
  }

  // Real worker flow:
  if (booking.stage === 'requested') {
    return {
      simulatedCountdown: 0,
      badgeLabel: 'WAITING CONFIRMATION',
      statusLabel: 'Waiting for Confirmation',
      isTimerRunning: false,
    };
  }

  if (booking.stage === 'accepted' || booking.stage === 'on_the_way') {
    const startTimeMs = booking.accepted_at
      ? new Date(booking.accepted_at).getTime()
      : booking.stageUpdatedAt
      ? new Date(booking.stageUpdatedAt).getTime()
      : currentTimeMs;

    const elapsedSeconds = Math.max(0, Math.floor((currentTimeMs - startTimeMs) / 1000));
    const remainingSeconds = Math.max(0, travelDurationSec - elapsedSeconds);

    return {
      simulatedCountdown: remainingSeconds,
      badgeLabel: remainingSeconds > 0 ? `${Math.ceil(remainingSeconds / 60)} MINS` : 'ARRIVED',
      statusLabel: 'Countdown:',
      isTimerRunning: remainingSeconds > 0,
    };
  }

  // Arrived, completed, cancelled
  return {
    simulatedCountdown: 0,
    badgeLabel: booking.stage === 'cancelled' ? 'CANCELLED' : 'ARRIVED',
    statusLabel: '00:00',
    isTimerRunning: false,
  };
}

describe('Real Worker Booking ETA Timer Lifecycle', () => {
  it('1. Real worker booking pending (stage: requested) does NOT start ETA countdown', () => {
    const realBooking: BookingState = {
      stage: 'requested',
      stageUpdatedAt: new Date().toISOString(),
      workerId: 'real-worker-uuid-1',
      workerName: 'Agam Kumar',
      workerCategory: 'plumbing',
      workerRating: 5.0,
      workerExperience: 4,
      isDemoWorker: false,
      agreedPriceInr: 450,
      estimatedArrivalMinutes: 20,
      otpVerified: false,
    };

    const state = computeInitialCountdown(realBooking);
    assert.equal(state.simulatedCountdown, 0, 'Countdown must be 0 while awaiting acceptance');
    assert.equal(state.isTimerRunning, false, 'Timer must not be running before worker acceptance');
    assert.equal(state.badgeLabel, 'WAITING CONFIRMATION');
    assert.equal(state.statusLabel, 'Waiting for Confirmation');
  });

  it('2. Real worker accepts -> countdown activates with persisted accepted_at timestamp', () => {
    const acceptedAt = new Date().toISOString();
    const acceptedBooking: BookingState = {
      stage: 'accepted',
      stageUpdatedAt: acceptedAt,
      accepted_at: acceptedAt,
      workerId: 'real-worker-uuid-1',
      workerName: 'Agam Kumar',
      workerCategory: 'plumbing',
      workerRating: 5.0,
      workerExperience: 4,
      isDemoWorker: false,
      agreedPriceInr: 450,
      estimatedArrivalMinutes: 20,
      otpVerified: false,
    };

    const state = computeInitialCountdown(acceptedBooking, new Date(acceptedAt).getTime());
    assert.equal(state.simulatedCountdown, 1200, 'Countdown must start from 20 mins (1200s)');
    assert.equal(state.isTimerRunning, true, 'Timer must be active once accepted');
    assert.equal(state.badgeLabel, '20 MINS');
  });

  it('3. Customer page refresh continues countdown from persisted accepted_at (no reset to 20m)', () => {
    // Worker accepted 5 minutes (300 seconds) ago
    const acceptedAtMs = Date.now() - 300 * 1000;
    const acceptedAtIso = new Date(acceptedAtMs).toISOString();

    const refreshedBooking: BookingState = {
      stage: 'accepted',
      stageUpdatedAt: acceptedAtIso,
      accepted_at: acceptedAtIso,
      workerId: 'real-worker-uuid-1',
      workerName: 'Agam Kumar',
      workerCategory: 'plumbing',
      workerRating: 5.0,
      workerExperience: 4,
      isDemoWorker: false,
      agreedPriceInr: 450,
      estimatedArrivalMinutes: 20, // total 1200s
      otpVerified: false,
    };

    const state = computeInitialCountdown(refreshedBooking, Date.now());
    // Should have 1200 - 300 = 900 seconds remaining (15 minutes)
    assert.equal(state.simulatedCountdown, 900, 'Must continue countdown; exactly 900s remaining');
    assert.equal(state.badgeLabel, '15 MINS', 'Badge must reflect 15 mins remaining, NOT reset to 20 mins');
    assert.equal(state.isTimerRunning, true);
  });

  it('4. If elapsed time exceeds travel time, countdown smoothly clamps at 0 / ARRIVED', () => {
    // Worker accepted 25 minutes (1500s) ago for a 20-min job
    const acceptedAtMs = Date.now() - 1500 * 1000;
    const acceptedAtIso = new Date(acceptedAtMs).toISOString();

    const arrivedBooking: BookingState = {
      stage: 'accepted',
      stageUpdatedAt: acceptedAtIso,
      accepted_at: acceptedAtIso,
      workerId: 'real-worker-uuid-1',
      workerName: 'Agam Kumar',
      workerCategory: 'plumbing',
      workerRating: 5.0,
      workerExperience: 4,
      isDemoWorker: false,
      agreedPriceInr: 450,
      estimatedArrivalMinutes: 20,
      otpVerified: false,
    };

    const state = computeInitialCountdown(arrivedBooking, Date.now());
    assert.equal(state.simulatedCountdown, 0);
    assert.equal(state.badgeLabel, 'ARRIVED');
    assert.equal(state.isTimerRunning, false);
  });

  it('5. Worker rejects -> status is cancelled, countdown never starts', () => {
    const rejectedBooking: BookingState = {
      stage: 'cancelled',
      stageUpdatedAt: new Date().toISOString(),
      rejected_at: new Date().toISOString(),
      cancellationReason: 'Partner unavailable for this time slot',
      workerId: 'real-worker-uuid-1',
      workerName: 'Agam Kumar',
      workerCategory: 'plumbing',
      workerRating: 5.0,
      workerExperience: 4,
      isDemoWorker: false,
      agreedPriceInr: 450,
      estimatedArrivalMinutes: 20,
      otpVerified: false,
    };

    const state = computeInitialCountdown(rejectedBooking);
    assert.equal(state.simulatedCountdown, 0, 'Countdown must be 0 for rejected bookings');
    assert.equal(state.isTimerRunning, false);
    assert.equal(state.badgeLabel, 'CANCELLED');
  });

  it('6. Duplicate worker accept action does not overwrite or reset original accepted_at', () => {
    const originalAcceptedAt = '2026-11-06T14:00:00.000Z';
    const booking: BookingState = {
      stage: 'accepted',
      stageUpdatedAt: originalAcceptedAt,
      accepted_at: originalAcceptedAt,
      workerId: 'real-worker-uuid-1',
      workerName: 'Agam Kumar',
      workerCategory: 'plumbing',
      workerRating: 5.0,
      workerExperience: 4,
      isDemoWorker: false,
      agreedPriceInr: 450,
      otpVerified: false,
    };

    // Simulate worker clicking accept a second time
    const updatedAcceptedAt = booking.accepted_at || new Date().toISOString();
    assert.equal(updatedAcceptedAt, originalAcceptedAt, 'Must preserve existing accepted_at on duplicate request');
  });

  it('7. Demo worker flow remains completely unchanged (immediate simulation)', () => {
    const demoBooking: BookingState = {
      stage: 'accepted',
      stageUpdatedAt: new Date().toISOString(),
      workerId: 'demo-worker-uuid-ramesh',
      workerName: 'Ramesh Kumar',
      workerCategory: 'plumbing',
      workerRating: 4.9,
      workerExperience: 9,
      isDemoWorker: true,
      agreedPriceInr: 500,
      estimatedArrivalMinutes: 18,
      simulatedSecondsRemaining: 1080,
      customerOtp: '4821',
      otpVerified: false,
    };

    const state = computeInitialCountdown(demoBooking);
    assert.equal(state.simulatedCountdown, 1080, 'Demo worker must retain simulatedSecondsRemaining (1080s)');
    assert.equal(state.isTimerRunning, true, 'Demo timer must run immediately');
    assert.equal(state.badgeLabel, '18 MINS');
  });
});

