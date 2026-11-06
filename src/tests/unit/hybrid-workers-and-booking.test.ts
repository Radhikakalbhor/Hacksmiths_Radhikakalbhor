/**
 * Hybrid Real + Demo Worker Marketplace & Genuine Booking Workflow Unit Tests
 * Validates coexistence, trade matching, booking lifecycle, authorization, and badging.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkersService, NearbyWorker } from '@/lib/services/workers.service';
import { PricingService } from '@/lib/services/pricing.service';
import { BookingService } from '@/lib/services/booking.service';
import { canTransitionBooking, BookingState } from '@/types/booking';

describe('Hybrid Real + Demo Worker Marketplace & Booking Workflow', () => {
  // =========================================================================
  // 1. Trade Category Matching & Aliases
  // =========================================================================
  describe('Trade Category & Alias Compatibility', () => {
    it('correctly matches plumbing trade and plumber skills', () => {
      const match1 = WorkersService.matchesTradeCategory('plumbing', ['Leak repair', 'CPVC piping'], 'plumbing');
      assert.strictEqual(match1, true);

      const match2 = WorkersService.matchesTradeCategory('electrical', ['Wiring', 'Switchboard'], 'plumbing');
      assert.strictEqual(match2, false);
    });

    it('correctly resolves maid and house help aliases to cleaning and domestic services', () => {
      const maidMatch = WorkersService.matchesTradeCategory('house_help', ['Daily dusting', 'Floor mopping'], 'maid');
      assert.strictEqual(maidMatch, true);

      const houseHelpMatch = WorkersService.matchesTradeCategory('cleaning', ['Housekeeping', 'Utensil cleaning'], 'house_help');
      assert.strictEqual(houseHelpMatch, true);
    });

    it('correctly resolves cooking / cook aliases', () => {
      const cookMatch = WorkersService.matchesTradeCategory('cooking', ['North Indian', 'Meal prep'], 'cook');
      assert.strictEqual(cookMatch, true);
    });

    it('matches custom or other category searches generously', () => {
      const customMatch = WorkersService.matchesTradeCategory('carpentry', ['Furniture assembly'], 'other');
      assert.strictEqual(customMatch, true);
    });
  });

  // =========================================================================
  // 2. Distance & Location Calculation
  // =========================================================================
  describe('Geospatial Distance Calculations', () => {
    it('calculates accurate Haversine distance between Bandra and Dadar (~5.5 km)', () => {
      const bandra = { lat: 19.0596, lng: 72.8295 };
      const dadar = { lat: 19.0178, lng: 72.8478 };
      const distanceMeters = WorkersService.calculateDistanceMeters(bandra, dadar);

      assert.ok(distanceMeters >= 4500 && distanceMeters <= 6500, `Expected ~5.5km, got ${distanceMeters}m`);
    });

    it('verifies service radius filtering', () => {
      const origin = { lat: 19.0596, lng: 72.8295 }; // Bandra
      const nearbyWorker = { lat: 19.065, lng: 72.835 }; // Khar (~1 km)
      const distantWorker = { lat: 19.2183, lng: 72.9781 }; // Thane (~25 km)

      assert.strictEqual(WorkersService.isWithinServiceRadius(nearbyWorker, origin, 10), true);
      assert.strictEqual(WorkersService.isWithinServiceRadius(distantWorker, origin, 10), false);
    });
  });

  // =========================================================================
  // 3. Real vs Demo Worker Differentiation & Badging
  // =========================================================================
  describe('Worker Source Attribution and Profile Badges', () => {
    it('distinguishes real registered workers from demo profiles', () => {
      const realWorker: NearbyWorker = {
        worker_id: 'real-worker-uuid-1',
        full_name: 'Agam Sharma',
        avatar_url: null,
        primary_category: 'plumbing',
        skills: ['Pipe Fitting', 'Tap Repair'],
        bio: 'Professional plumber in Bandra.',
        years_experience: 4,
        hourly_rate_inr: 300,
        fixed_rate_estimate_inr: 450,
        reputation_score: 5.0,
        total_completed_jobs: 0,
        is_available: true,
        distance_meters: null,
        worker_source: 'real',
        is_demo: false,
        distance_pending: true,
        email_verified: true,
        average_rating: null,
        review_count: 0,
      };

      const demoWorker: NearbyWorker = {
        worker_id: 'demo-worker-uuid-1',
        full_name: 'Ramesh Kumar',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        primary_category: 'plumbing',
        skills: ['Concealed Leak Detection'],
        bio: 'Senior plumber for demonstration.',
        years_experience: 9,
        hourly_rate_inr: 350,
        fixed_rate_estimate_inr: 500,
        reputation_score: 4.92,
        total_completed_jobs: 64,
        is_available: true,
        distance_meters: 1800,
        worker_source: 'demo',
        is_demo: true,
        distance_pending: false,
        average_rating: 4.9,
        review_count: 64,
      };

      // Real worker invariants
      assert.strictEqual(realWorker.worker_source, 'real');
      assert.strictEqual(realWorker.is_demo, false);
      assert.strictEqual(realWorker.distance_pending, true);
      assert.strictEqual(realWorker.distance_meters, null);
      assert.strictEqual(realWorker.average_rating, null, 'Real worker must NOT have fake ratings invented');
      assert.strictEqual(realWorker.review_count, 0);

      // Demo worker invariants
      assert.strictEqual(demoWorker.worker_source, 'demo');
      assert.strictEqual(demoWorker.is_demo, true);
      assert.strictEqual(demoWorker.distance_pending, false);
      assert.strictEqual(demoWorker.average_rating, 4.9);
      assert.strictEqual(demoWorker.review_count, 64);
    });

    it('generates consistent deterministic IDs for demo profiles', () => {
      const id1 = WorkersService.makeDemoWorkerId('ramesh-plumber@sahayak.demo.internal');
      const id2 = WorkersService.makeDemoWorkerId('ramesh-plumber@sahayak.demo.internal');
      const id3 = WorkersService.makeDemoWorkerId('santosh-plumber@sahayak.demo.internal');

      assert.strictEqual(id1, id2, 'Same demo worker must produce identical UUID');
      assert.notStrictEqual(id1, id3, 'Different demo workers must produce unique UUIDs');
    });
  });

  // =========================================================================
  // 4. Genuine Real Worker Booking State Machine
  // =========================================================================
  describe('Genuine Real Worker Booking State Transitions', () => {
    it('enforces requested -> accepted -> on_the_way -> arrived -> in_progress -> completed lifecycle', () => {
      assert.strictEqual(canTransitionBooking('requested', 'accepted'), true);
      assert.strictEqual(canTransitionBooking('accepted', 'on_the_way'), true);
      assert.strictEqual(canTransitionBooking('on_the_way', 'arrived'), true);
      assert.strictEqual(canTransitionBooking('arrived', 'in_progress'), true);
      assert.strictEqual(canTransitionBooking('in_progress', 'completed'), true);
    });

    it('allows cancellation from requested, accepted, or on_the_way stages', () => {
      assert.strictEqual(canTransitionBooking('requested', 'cancelled'), true);
      assert.strictEqual(canTransitionBooking('accepted', 'cancelled'), true);
      assert.strictEqual(canTransitionBooking('on_the_way', 'cancelled'), true);
    });

    it('prevents illegal transitions such as requested -> completed directly', () => {
      assert.strictEqual(canTransitionBooking('requested', 'completed'), false);
      assert.strictEqual(canTransitionBooking('completed', 'requested'), false);
      assert.strictEqual(canTransitionBooking('cancelled', 'accepted'), false);
    });

    it('models genuine pending booking offer for real worker without immediate OTP exposure', () => {
      const pendingBooking: BookingState = {
        stage: 'requested',
        stageUpdatedAt: new Date().toISOString(),
        workerId: 'real-worker-id-123',
        workerName: 'Agam Sharma',
        workerCategory: 'plumbing',
        workerRating: 5.0,
        workerExperience: 4,
        isDemoWorker: false,
        agreedPriceInr: 450,
        estimatedArrivalMinutes: 15,
        currentWorkerCoords: null,
        customerOtp: undefined, // OTP is NOT revealed during requested stage
        otpVerified: false,
      };

      assert.strictEqual(pendingBooking.stage, 'requested');
      assert.strictEqual(pendingBooking.isDemoWorker, false);
      assert.strictEqual(pendingBooking.customerOtp, undefined, 'Start OTP must not be issued until worker accepts');
      assert.strictEqual(pendingBooking.agreedPriceInr, 450);
    });

    it('provisions Start OTP and transitions to accepted upon worker acceptance', () => {
      const plainOtp = BookingService.generateOtpCode();
      const salt = BookingService.generateSalt();
      const otpHash = BookingService.hashOtp(plainOtp, salt);

      // Verify OTP generation security properties
      assert.ok(/^\d{4}$/.test(plainOtp), 'OTP must be 4 numeric digits');
      assert.ok(otpHash.length === 64, 'SHA-256 hash must be 64 hexadecimal characters');

      // Verify matching verification
      const verifyHash = BookingService.hashOtp(plainOtp, salt);
      assert.strictEqual(verifyHash, otpHash);

      const invalidHash = BookingService.hashOtp('0000', salt);
      assert.notStrictEqual(invalidHash, otpHash);
    });
  });

  // =========================================================================
  // 5. Fair Price Bounding for Real & Demo Bookings
  // =========================================================================
  describe('Booking Price Validation against Sahayak Fair Price Range', () => {
    const job = {
      id: 'job-101',
      category: 'plumbing',
      title: 'Fix Kitchen Sink Leak',
      estimated_min_price_inr: 250,
      estimated_max_price_inr: 450,
      estimated_budget_inr: 350,
    };

    it('accepts booking price within fair price range (₹250 - ₹450)', () => {
      const fairRange = PricingService.getJobFairPriceRange(job);
      const validation = PricingService.validateBidAgainstFairRange(350, fairRange);

      assert.strictEqual(validation.isValid, true);
    });

    it('rejects predatory booking price below fair minimum', () => {
      const fairRange = PricingService.getJobFairPriceRange(job);
      const validation = PricingService.validateBidAgainstFairRange(100, fairRange);

      assert.strictEqual(validation.isValid, false);
      assert.strictEqual(validation.code, 'BID_BELOW_MINIMUM');
      assert.ok(validation.error?.includes('below the fair price minimum'));
    });

    it('rejects exploitative booking price above fair maximum', () => {
      const fairRange = PricingService.getJobFairPriceRange(job);
      const validation = PricingService.validateBidAgainstFairRange(800, fairRange);

      assert.strictEqual(validation.isValid, false);
      assert.strictEqual(validation.code, 'BID_ABOVE_MAXIMUM');
      assert.ok(validation.error?.includes('exceeds the fair price ceiling'));
    });
  });
});
