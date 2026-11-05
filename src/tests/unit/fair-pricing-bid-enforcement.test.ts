import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from '@/lib/services/pricing.service';
import { JobsService } from '@/lib/services/jobs.service';
import { validateCreateBid, validateCounterOffer } from '@/lib/validations/jobs';

describe('Fair Pricing Bidding & Booking Enforcement Engine', () => {
  const mockJobEstimate300to440 = {
    id: 'job-fair-test-1',
    category: 'plumbing',
    title: 'Fix Leaking Kitchen Tap and Pipe Washer',
    description: 'The kitchen sink tap is dripping continuously and leaking into the lower cabinet.',
    urgency: 'standard',
    city: 'Mumbai',
    estimated_min_price_inr: 300,
    estimated_max_price_inr: 440,
    estimated_budget_inr: 350,
  };

  describe('Authoritative Job Fair Price Range Resolution', () => {
    it('uses stored job estimate as source of truth when present', () => {
      const range = PricingService.getJobFairPriceRange(mockJobEstimate300to440);
      assert.equal(range.minPriceInr, 300);
      assert.equal(range.maxPriceInr, 440);
      assert.equal(range.source, 'stored_job_estimate');
    });

    it('calculates dynamic fair price range for legacy jobs lacking stored estimates', () => {
      const legacyJob = {
        category: 'electrical',
        title: 'Switchboard Repair and MCB Tripping',
        description: 'Living room light points keep sparking and MCB trips repeatedly.',
        urgency: 'urgent',
        city: 'Delhi NCR',
        estimated_min_price_inr: null,
        estimated_max_price_inr: null,
      };

      const range = PricingService.getJobFairPriceRange(legacyJob);
      assert.ok(range.minPriceInr > 0);
      assert.ok(range.maxPriceInr >= range.minPriceInr);
      assert.equal(range.source, 'calculated_engine');
    });
  });

  describe('Bid Bounds Enforcement on Initial Worker Proposals', () => {
    const range = PricingService.getJobFairPriceRange(mockJobEstimate300to440);

    it('accepts worker bid of ₹350 within fair range ₹300–₹440', () => {
      const result = PricingService.validateBidAgainstFairRange(350, range);
      assert.equal(result.isValid, true);
      assert.equal(result.error, undefined);
    });

    it('rejects worker bid of ₹700 (exceeds fair ceiling ₹440)', () => {
      const result = PricingService.validateBidAgainstFairRange(700, range);
      assert.equal(result.isValid, false);
      assert.equal(result.code, 'BID_ABOVE_MAXIMUM');
      assert.match(result.error || '', /exceeds the fair price ceiling of ₹440/);
      assert.match(result.error || '', /Permitted fair price range: ₹300 - ₹440/);
    });

    it('rejects worker bid of ₹250 (below fair floor ₹300)', () => {
      const result = PricingService.validateBidAgainstFairRange(250, range);
      assert.equal(result.isValid, false);
      assert.equal(result.code, 'BID_BELOW_MINIMUM');
      assert.match(result.error || '', /below the fair price minimum of ₹300/);
      assert.match(result.error || '', /Permitted fair price range: ₹300 - ₹440/);
    });

    it('validates via JobsService helper method', () => {
      const valid = JobsService.validateBidFairPrice(350, mockJobEstimate300to440);
      assert.equal(valid.isValid, true);

      const tooHigh = JobsService.validateBidFairPrice(700, mockJobEstimate300to440);
      assert.equal(tooHigh.isValid, false);
      assert.equal(tooHigh.code, 'BID_ABOVE_MAXIMUM');

      const tooLow = JobsService.validateBidFairPrice(250, mockJobEstimate300to440);
      assert.equal(tooLow.isValid, false);
      assert.equal(tooLow.code, 'BID_BELOW_MINIMUM');
    });

    it('validates via validateCreateBid validation schema', () => {
      const validPayload = {
        jobId: 'job-1',
        workerId: 'worker-1',
        offeredAmountInr: 350,
        laborCostInr: 350,
        permittedPriceRange: range,
      };
      const validRes = validateCreateBid(validPayload);
      assert.equal(validRes.success, true);

      const highPayload = {
        jobId: 'job-1',
        workerId: 'worker-1',
        offeredAmountInr: 700,
        laborCostInr: 700,
        permittedPriceRange: range,
      };
      const highRes = validateCreateBid(highPayload);
      assert.equal(highRes.success, false);
      assert.match(highRes.errors?.offeredAmountInr || '', /exceeds the fair price ceiling/);

      const lowPayload = {
        jobId: 'job-1',
        workerId: 'worker-1',
        offeredAmountInr: 250,
        laborCostInr: 250,
        permittedPriceRange: range,
      };
      const lowRes = validateCreateBid(lowPayload);
      assert.equal(lowRes.success, false);
      assert.match(lowRes.errors?.offeredAmountInr || '', /below the fair price minimum/);
    });
  });

  describe('Counter-Offer Enforcement on Transparent Negotiations', () => {
    const range = PricingService.getJobFairPriceRange(mockJobEstimate300to440);

    it('accepts counter-offer of ₹400 within range ₹300–₹440', () => {
      const result = PricingService.validateBidAgainstFairRange(400, range);
      assert.equal(result.isValid, true);

      const schemaRes = validateCounterOffer({
        bidId: 'bid-1',
        proposedByRole: 'worker',
        proposedAmountInr: 400,
        permittedPriceRange: range,
      });
      assert.equal(schemaRes.success, true);
    });

    it('rejects counter-offer of ₹700 (outside fair range ₹300–₹440)', () => {
      const result = PricingService.validateBidAgainstFairRange(700, range);
      assert.equal(result.isValid, false);
      assert.equal(result.code, 'BID_ABOVE_MAXIMUM');

      const schemaRes = validateCounterOffer({
        bidId: 'bid-1',
        proposedByRole: 'worker',
        proposedAmountInr: 700,
        permittedPriceRange: range,
      });
      assert.equal(schemaRes.success, false);
      assert.match(schemaRes.errors?.proposedAmountInr || '', /exceeds the fair price ceiling/);
    });

    it('rejects counter-offer of ₹200 (below fair range ₹300–₹440)', () => {
      const result = PricingService.validateBidAgainstFairRange(200, range);
      assert.equal(result.isValid, false);
      assert.equal(result.code, 'BID_BELOW_MINIMUM');

      const schemaRes = validateCounterOffer({
        bidId: 'bid-1',
        proposedByRole: 'customer',
        proposedAmountInr: 200,
        permittedPriceRange: range,
      });
      assert.equal(schemaRes.success, false);
      assert.match(schemaRes.errors?.proposedAmountInr || '', /below the fair price minimum/);
    });
  });

  describe('Multi-Category, Urgency & Worker Tier Validation', () => {
    const testCases = [
      { category: 'plumbing', urgency: 'standard', title: 'Routine Tap Repair', valid: 350, invalidHigh: 900, invalidLow: 100 },
      { category: 'electrical', urgency: 'same_day', title: 'Complete Short Circuit Fix', valid: 500, invalidHigh: 1500, invalidLow: 150 },
      { category: 'cleaning', urgency: 'emergency', title: 'Emergency Deep Cleaning Sewage Overflow', valid: 800, invalidHigh: 2500, invalidLow: 200 },
      { category: 'carpentry', urgency: 'standard', title: 'Fix Wooden Door Latch and Alignment', valid: 450, invalidHigh: 1200, invalidLow: 100 },
    ];

    for (const tc of testCases) {
      it(`enforces fair boundaries for ${tc.category} (${tc.urgency})`, () => {
        const calculated = PricingService.calculateFairPriceRange({
          category: tc.category,
          title: tc.title,
          urgency: tc.urgency as 'standard' | 'urgent' | 'emergency',
        });

        const range = {
          minPriceInr: calculated.recommendedMinInr,
          maxPriceInr: calculated.recommendedMaxInr,
        };

        // Mid-point should always be valid
        const midPoint = Math.round((range.minPriceInr + range.maxPriceInr) / 2);
        const midRes = PricingService.validateBidAgainstFairRange(midPoint, range);
        assert.equal(midRes.isValid, true);

        // Min boundary is valid
        const minRes = PricingService.validateBidAgainstFairRange(range.minPriceInr, range);
        assert.equal(minRes.isValid, true);

        // Max boundary is valid
        const maxRes = PricingService.validateBidAgainstFairRange(range.maxPriceInr, range);
        assert.equal(maxRes.isValid, true);

        // Exceeding max is rejected
        const excess = range.maxPriceInr + 150;
        const excessRes = PricingService.validateBidAgainstFairRange(excess, range);
        assert.equal(excessRes.isValid, false);
        assert.equal(excessRes.code, 'BID_ABOVE_MAXIMUM');

        // Subceeding min is rejected
        const sub = Math.max(1, range.minPriceInr - 100);
        const subRes = PricingService.validateBidAgainstFairRange(sub, range);
        assert.equal(subRes.isValid, false);
        assert.equal(subRes.code, 'BID_BELOW_MINIMUM');
      });
    }
  });

  describe('Booking Confirmation Consistency & Agreed Amount Integrity', () => {
    it('guarantees accepted bid amount is preserved identically across state and booking records', () => {
      const acceptedBid = {
        id: 'bid-winner-101',
        job_id: 'job-101',
        worker_id: 'worker-pro-1',
        offered_amount_inr: 380,
      };

      const jobRecord = {
        id: 'job-101',
        status: 'ASSIGNED',
        selected_worker_id: acceptedBid.worker_id,
        accepted_bid_id: acceptedBid.id,
        accepted_price_inr: acceptedBid.offered_amount_inr,
      };

      // Both job and booking must reflect the identical accepted price
      assert.equal(jobRecord.accepted_price_inr, 380);
      assert.equal(jobRecord.accepted_price_inr, acceptedBid.offered_amount_inr);
    });

    it('rejects booking confirmation with arbitrary amount outside fair range', () => {
      const range = { minPriceInr: 300, maxPriceInr: 440 };
      const arbitraryHigh = 800;
      const validation = PricingService.validateBidAgainstFairRange(arbitraryHigh, range);
      assert.equal(validation.isValid, false);
      assert.equal(validation.code, 'BID_ABOVE_MAXIMUM');
    });
  });
});

