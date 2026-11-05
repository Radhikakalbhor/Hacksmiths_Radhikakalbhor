import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from '@/lib/services/pricing.service';
import { JobsService } from '@/lib/services/jobs.service';

describe('Individual Worker-Specific Pricing & Bidding Logic', () => {
  const applianceRepairJob = {
    id: 'job-appliance-repair-washing-machine',
    category: 'appliance_repair',
    title: 'Front Load Washing Machine Drum Noise & Drain Issue',
    description: 'Washing machine makes loud grinding noise on spin cycle and fails to drain water completely.',
    urgency: 'standard',
    city: 'Mumbai',
    estimated_min_price_inr: 790,
    estimated_max_price_inr: 1160,
    estimated_budget_inr: 930,
  };

  const candidateWorkers = [
    {
      id: 'worker-1-alok',
      user_id: 'user-alok',
      full_name: 'Alok Pandey',
      experience_years: 3,
      rating: 4.2,
      hourly_rate_inr: 450,
      fixed_rate_estimate_inr: 500,
      distance_km: 1.2,
    },
    {
      id: 'worker-2-deepak',
      user_id: 'user-deepak',
      full_name: 'Deepak Nair',
      experience_years: 5,
      rating: 4.6,
      hourly_rate_inr: 480,
      fixed_rate_estimate_inr: 550,
      distance_km: 2.5,
    },
    {
      id: 'worker-3-vikram',
      user_id: 'user-vikram',
      full_name: 'Vikram Patel',
      experience_years: 8,
      rating: 4.8,
      hourly_rate_inr: 550,
      fixed_rate_estimate_inr: 600,
      distance_km: 3.8,
    },
    {
      id: 'worker-4-sachin',
      user_id: 'user-sachin',
      full_name: 'Sachin Tawde',
      experience_years: 12,
      rating: 4.95,
      hourly_rate_inr: 650,
      fixed_rate_estimate_inr: 700,
      distance_km: 5.0,
    },
    {
      id: 'worker-5-nilesh',
      user_id: 'user-nilesh',
      full_name: 'Nilesh Jadhav',
      experience_years: 15,
      rating: 4.9,
      hourly_rate_inr: 700,
      fixed_rate_estimate_inr: 750,
      distance_km: 4.2,
    },
  ];

  describe('1. Individual Worker-Specific Quotes within Fair Price Range', () => {
    it('generates individual quotes for multiple workers within fair range ₹790–₹1,160 without defaulting to minimum', () => {
      const results = candidateWorkers.map((w) =>
        PricingService.calculateWorkerQuoteForJob(w, applianceRepairJob)
      );

      const quotes = results.map((r) => r.quoteInr);

      // Verify every quote is strictly within [790, 1160]
      for (const quote of quotes) {
        assert.ok(
          quote >= 790 && quote <= 1160,
          `Quote ₹${quote} must be between ₹790 and ₹1,160`
        );
      }

      // Verify quotes are not all identical and do NOT all collapse to the minimum ₹790
      const uniqueQuotes = new Set(quotes);
      assert.ok(
        uniqueQuotes.size >= 4,
        `Expected at least 4 distinct quotes among 5 diverse workers, got ${uniqueQuotes.size}: [${quotes.join(', ')}]`
      );

      const countAtMinimum = quotes.filter((q) => q === 790).length;
      assert.ok(
        countAtMinimum <= 1,
        `Too many workers defaulted to minimum ₹790. Count: ${countAtMinimum}`
      );
    });

    it('produces realistic commercial increments (multiples of ₹5 or ₹10)', () => {
      for (const worker of candidateWorkers) {
        const result = PricingService.calculateWorkerQuoteForJob(worker, applianceRepairJob);
        assert.equal(
          result.quoteInr % 5,
          0,
          `Quote ₹${result.quoteInr} should be in clean commercial increments (multiple of 5)`
        );
      }
    });
  });

  describe('2. Deterministic & Stable Quote Calculation', () => {
    it('produces identical quote across multiple invocations for identical worker and job', () => {
      const worker = candidateWorkers[1];
      const res1 = PricingService.calculateWorkerQuoteForJob(worker, applianceRepairJob);
      const res2 = PricingService.calculateWorkerQuoteForJob(worker, applianceRepairJob);
      const res3 = PricingService.calculateWorkerQuoteForJob(worker, applianceRepairJob);

      assert.equal(res1.quoteInr, res2.quoteInr);
      assert.equal(res2.quoteInr, res3.quoteInr);
      assert.equal(res1.minPriceInr, 790);
      assert.equal(res1.maxPriceInr, 1160);
    });

    it('JobsService.calculateWorkerJobQuote delegates consistently', () => {
      const worker = candidateWorkers[2];
      const direct = PricingService.calculateWorkerQuoteForJob(worker, applianceRepairJob);
      const viaService = JobsService.calculateWorkerJobQuote(worker, applianceRepairJob);

      assert.equal(direct.quoteInr, viaService.quoteInr);
      assert.equal(direct.minPriceInr, viaService.minPriceInr);
      assert.equal(direct.maxPriceInr, viaService.maxPriceInr);
    });
  });

  describe('3. Experience and Rating Influence on Fair Quotes', () => {
    it('senior veteran technician (15 yrs, 4.9 rating) quotes higher than entry technician (3 yrs, 4.2 rating)', () => {
      const juniorWorker = candidateWorkers[0]; // Alok (3 yrs, 4.2)
      const masterWorker = candidateWorkers[4]; // Nilesh (15 yrs, 4.9)

      const juniorQuote = PricingService.calculateWorkerQuoteForJob(juniorWorker, applianceRepairJob).quoteInr;
      const masterQuote = PricingService.calculateWorkerQuoteForJob(masterWorker, applianceRepairJob).quoteInr;

      assert.ok(
        masterQuote > juniorQuote,
        `Master technician quote ₹${masterQuote} should exceed junior quote ₹${juniorQuote}`
      );
      assert.ok(juniorQuote >= 790, 'Junior quote must still respect fair minimum ₹790');
      assert.ok(masterQuote <= 1160, 'Master quote must still respect fair maximum ₹1,160');
    });
  });

  describe('4. Preservation of Existing Valid Bids', () => {
    it('respects pre-existing valid bid when placed by worker', () => {
      const workerWithBid = {
        ...candidateWorkers[0],
        existing_bid_inr: 880,
      };

      const result = PricingService.calculateWorkerQuoteForJob(workerWithBid, applianceRepairJob);
      assert.equal(result.quoteInr, 880, 'Should honor existing valid bid amount of ₹880');
      assert.equal(result.isExistingBid, true);
    });

    it('recalculates bounded quote if existing bid is invalid or outside fair range', () => {
      const workerWithInvalidBid = {
        ...candidateWorkers[0],
        existing_bid_inr: 2500, // Way above 1160
      };

      const result = PricingService.calculateWorkerQuoteForJob(workerWithInvalidBid, applianceRepairJob);
      assert.ok(
        result.quoteInr >= 790 && result.quoteInr <= 1160,
        `Recalculated quote ₹${result.quoteInr} must be bounded within ₹790–₹1,160`
      );
      assert.notEqual(result.quoteInr, 2500);
      assert.equal(result.isExistingBid, false);
    });
  });

  describe('5. Distinct Separation Between Budget, Range, and Worker Quotes', () => {
    it('preserves distinction between fair range, customer budget, and individual quotes', () => {
      const range = PricingService.getJobFairPriceRange(applianceRepairJob);
      assert.equal(range.minPriceInr, 790);
      assert.equal(range.maxPriceInr, 1160);

      const customerBudget = applianceRepairJob.estimated_budget_inr;
      assert.equal(customerBudget, 930);

      // Verify quotes differ from the customer's initial budget
      const quotes = candidateWorkers.map((w) =>
        PricingService.calculateWorkerQuoteForJob(w, applianceRepairJob).quoteInr
      );
      const differingFromBudget = quotes.filter((q) => q !== customerBudget);
      assert.ok(
        differingFromBudget.length >= 3,
        'Quotes should represent worker-specific bids, not simply echo the customer budget'
      );
    });
  });

  describe('6. Category Invariance across Different Services', () => {
    it('correctly calculates bounded worker quotes for Plumbing job (₹300–₹450)', () => {
      const plumbingJob = {
        id: 'job-plumbing-tap',
        category: 'plumbing',
        estimated_min_price_inr: 300,
        estimated_max_price_inr: 450,
        estimated_budget_inr: 360,
      };

      for (const worker of candidateWorkers) {
        const quote = PricingService.calculateWorkerQuoteForJob(worker, plumbingJob).quoteInr;
        assert.ok(
          quote >= 300 && quote <= 450,
          `Plumbing quote ₹${quote} must be inside ₹300–₹450`
        );
      }
    });

    it('correctly calculates bounded worker quotes for Deep Cleaning job (₹1,200–₹1,800)', () => {
      const cleaningJob = {
        id: 'job-cleaning-bhk',
        category: 'cleaning',
        estimated_min_price_inr: 1200,
        estimated_max_price_inr: 1800,
        estimated_budget_inr: 1450,
      };

      for (const worker of candidateWorkers) {
        const quote = PricingService.calculateWorkerQuoteForJob(worker, cleaningJob).quoteInr;
        assert.ok(
          quote >= 1200 && quote <= 1800,
          `Cleaning quote ₹${quote} must be inside ₹1,200–₹1,800`
        );
      }
    });
  });
});
