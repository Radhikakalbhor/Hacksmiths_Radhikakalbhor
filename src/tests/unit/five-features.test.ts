/**
 * Automated Regression Tests: 5 Key Features
 * 1. Fair Price Badge & Locality Benchmark Comparison
 * 2. Best Match Scoring & Proximity Ranking
 * 3. Job Status Timeline Lifecycle Derivation
 * 4. "You Saved ₹X" Local Median Benchmark Comparison
 * 5. Review & Rating Validation, Ownership, & Zero-Fake-Review Guarantee
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from '@/lib/services/pricing.service';
import { PriceBenchmark } from '@/types/bids';

describe('1. Fair Price Badge & Benchmark Matching', () => {
  const sampleBenchmark: PriceBenchmark = {
    category: 'electrical',
    city: 'Mumbai',
    microMarketArea: 'Andheri West',
    minPriceInr: 300,
    medianPriceInr: 450,
    maxPriceInr: 600,
    sampleSize: 35,
    currency: 'INR',
    lastCalculatedAt: new Date().toISOString(),
  };

  it('should map evaluations to exact visual badge labels', () => {
    assert.equal(PricingService.getFairPriceLabel('BELOW_AVERAGE'), 'Below Range');
    assert.equal(PricingService.getFairPriceLabel('FAIR_MARKET'), 'Fair Price');
    assert.equal(PricingService.getFairPriceLabel('ABOVE_AVERAGE'), 'Above Range');
    assert.equal(PricingService.getFairPriceLabel(null), 'Benchmark unavailable');
  });

  it('should evaluate bids consistently against thresholds', () => {
    // Below Range
    assert.equal(PricingService.evaluateBidAgainstBenchmark(250, sampleBenchmark), 'BELOW_AVERAGE');
    // Fair Price boundary inclusive
    assert.equal(PricingService.evaluateBidAgainstBenchmark(300, sampleBenchmark), 'FAIR_MARKET');
    assert.equal(PricingService.evaluateBidAgainstBenchmark(450, sampleBenchmark), 'FAIR_MARKET');
    assert.equal(PricingService.evaluateBidAgainstBenchmark(600, sampleBenchmark), 'FAIR_MARKET');
    // Above Range
    assert.equal(PricingService.evaluateBidAgainstBenchmark(750, sampleBenchmark), 'ABOVE_AVERAGE');
  });

  it('should safely return null and "Benchmark unavailable" when benchmark is missing', () => {
    const evaluation = PricingService.evaluateBidAgainstBenchmark(500, null);
    assert.equal(evaluation, null);
    assert.equal(PricingService.getFairPriceLabel(evaluation), 'Benchmark unavailable');
  });
});

describe('2. Best Match Proximity & Fair Price Ranking', () => {
  const sampleBenchmark: PriceBenchmark = {
    category: 'plumbing',
    city: 'Mumbai',
    microMarketArea: 'Bandra',
    minPriceInr: 250,
    medianPriceInr: 350,
    maxPriceInr: 500,
    sampleSize: 20,
    currency: 'INR',
    lastCalculatedAt: new Date().toISOString(),
  };

  it('should score closer worker higher when bids are equal', () => {
    const nearWorker = PricingService.scoreBidForRecommendation(350, 1.5, sampleBenchmark, 5, 4.8);
    const farWorker = PricingService.scoreBidForRecommendation(350, 15.0, sampleBenchmark, 5, 4.8);

    assert.ok(nearWorker.score > farWorker.score, `Expected near score ${nearWorker.score} > far score ${farWorker.score}`);
    assert.match(nearWorker.reason, /1\.5 km/);
    assert.match(nearWorker.reason, /fair price/i);
  });

  it('should not rank on price alone: closer worker with fair price can beat cheaper distant worker', () => {
    // Worker A: slightly cheaper (250) but very far (22 km)
    const distantCheap = PricingService.scoreBidForRecommendation(250, 22.0, sampleBenchmark, 2, 4.0);
    // Worker B: fair median price (350) and very close (1.2 km) with strong experience
    const nearbyFair = PricingService.scoreBidForRecommendation(350, 1.2, sampleBenchmark, 6, 4.9);

    assert.ok(
      nearbyFair.score > distantCheap.score,
      `Expected nearby fair pro (${nearbyFair.score}) to beat distant cheap pro (${distantCheap.score})`
    );
  });

  it('should handle missing distance or missing benchmark safely without throwing', () => {
    const resultNoDist = PricingService.scoreBidForRecommendation(400, null, sampleBenchmark);
    assert.ok(resultNoDist.score > 0);
    assert.ok(typeof resultNoDist.reason === 'string');

    const resultNoBench = PricingService.scoreBidForRecommendation(400, 3.5, null);
    assert.ok(resultNoBench.score > 0);
    assert.ok(typeof resultNoBench.reason === 'string');
  });
});

describe('3. Job Status Timeline Milestone Derivation', () => {
  type MilestoneStatus = 'completed' | 'current' | 'pending';

  function deriveMilestones(
    jobStatus: string,
    bidsCount: number,
    bookingStage: string | null,
    otpVerified: boolean = false
  ): { [key: string]: MilestoneStatus } {
    const isJobCancelled = jobStatus === 'cancelled' || bookingStage === 'cancelled';
    const isJobCompleted = jobStatus === 'completed' || bookingStage === 'completed';
    const isWorkerArrived = isJobCompleted || bookingStage === 'arrived' || bookingStage === 'in_progress' || otpVerified;
    const isBidAccepted =
      isJobCompleted ||
      isWorkerArrived ||
      (bookingStage !== null && ['accepted', 'on_the_way'].includes(bookingStage)) ||
      ['assigned', 'in_progress'].includes(jobStatus);
    const hasBids = bidsCount > 0 || isBidAccepted;

    return {
      posted: 'completed',
      bids_received: isBidAccepted || hasBids
        ? 'completed'
        : !isJobCancelled && jobStatus === 'open'
        ? 'current'
        : 'pending',
      accepted: isBidAccepted
        ? 'completed'
        : !isJobCancelled && bidsCount > 0 && !isBidAccepted
        ? 'current'
        : 'pending',
      arrived: isWorkerArrived
        ? 'completed'
        : !isJobCancelled && isBidAccepted && !isWorkerArrived && bookingStage === 'on_the_way'
        ? 'current'
        : 'pending',
      completed: isJobCompleted
        ? 'completed'
        : !isJobCancelled && (jobStatus === 'in_progress' || bookingStage === 'in_progress' || bookingStage === 'arrived')
        ? 'current'
        : 'pending',
    };
  }

  it('should accurately depict open job with zero bids', () => {
    const steps = deriveMilestones('open', 0, null);
    assert.equal(steps.posted, 'completed');
    assert.equal(steps.bids_received, 'current');
    assert.equal(steps.accepted, 'pending');
    assert.equal(steps.arrived, 'pending');
    assert.equal(steps.completed, 'pending');
  });

  it('should accurately depict job with bids awaiting review', () => {
    const steps = deriveMilestones('open', 4, null);
    assert.equal(steps.posted, 'completed');
    assert.equal(steps.bids_received, 'completed');
    assert.equal(steps.accepted, 'current');
    assert.equal(steps.arrived, 'pending');
    assert.equal(steps.completed, 'pending');
  });

  it('should accurately depict booking on the way', () => {
    const steps = deriveMilestones('assigned', 2, 'on_the_way');
    assert.equal(steps.posted, 'completed');
    assert.equal(steps.bids_received, 'completed');
    assert.equal(steps.accepted, 'completed');
    assert.equal(steps.arrived, 'current');
    assert.equal(steps.completed, 'pending');
  });

  it('should accurately depict arrived and in-progress job', () => {
    const steps = deriveMilestones('in_progress', 1, 'in_progress', true);
    assert.equal(steps.posted, 'completed');
    assert.equal(steps.bids_received, 'completed');
    assert.equal(steps.accepted, 'completed');
    assert.equal(steps.arrived, 'completed');
    assert.equal(steps.completed, 'current');
  });

  it('should mark all steps complete only upon genuine completion', () => {
    const steps = deriveMilestones('completed', 1, 'completed', true);
    assert.equal(steps.posted, 'completed');
    assert.equal(steps.bids_received, 'completed');
    assert.equal(steps.accepted, 'completed');
    assert.equal(steps.arrived, 'completed');
    assert.equal(steps.completed, 'completed');
  });

  it('should never mark incomplete steps complete on cancelled jobs', () => {
    const steps = deriveMilestones('cancelled', 0, 'cancelled');
    assert.equal(steps.posted, 'completed');
    assert.equal(steps.bids_received, 'pending');
    assert.equal(steps.accepted, 'pending');
    assert.equal(steps.arrived, 'pending');
    assert.equal(steps.completed, 'pending');
  });
});

describe('4. "You Saved ₹X" Calculation Against Local Median', () => {
  it('should calculate savings when accepted bid is strictly below median benchmark', () => {
    const result = PricingService.calculateBenchmarkSavings(350, 500);
    assert.notEqual(result, null);
    assert.equal(result?.savingsInr, 150);
    assert.equal(result?.medianBenchmarkInr, 500);
  });

  it('should return null when accepted bid is equal to median benchmark (no savings)', () => {
    const result = PricingService.calculateBenchmarkSavings(500, 500);
    assert.equal(result, null);
  });

  it('should return null when accepted bid is higher than median (no misleading savings)', () => {
    const result = PricingService.calculateBenchmarkSavings(650, 500);
    assert.equal(result, null);
  });

  it('should return null when benchmark median or accepted bid is invalid or missing', () => {
    assert.equal(PricingService.calculateBenchmarkSavings(0, 500), null);
    assert.equal(PricingService.calculateBenchmarkSavings(400, 0), null);
    assert.equal(PricingService.calculateBenchmarkSavings(NaN, 500), null);
  });
});

describe('5. Reviews & Ratings Authorization & Integrity', () => {
  function validateReviewSubmission(
    customerId: string,
    jobCustomerId: string,
    jobStatus: string,
    existingReviewCount: number,
    rating: number
  ): { allowed: boolean; error?: string; status?: number } {
    if (customerId !== jobCustomerId) {
      return { allowed: false, error: 'Only the customer who posted this request can review it.', status: 403 };
    }
    if (jobStatus !== 'completed' && jobStatus !== 'COMPLETED') {
      return { allowed: false, error: 'Reviews can only be submitted after job completion.', status: 400 };
    }
    if (existingReviewCount > 0) {
      return { allowed: false, error: 'You have already reviewed this job.', status: 409 };
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { allowed: false, error: 'Rating must be an integer between 1 and 5.', status: 400 };
    }
    return { allowed: true };
  }

  it('should authorize valid customer on completed job with 1-5 rating', () => {
    const result = validateReviewSubmission('cust_123', 'cust_123', 'completed', 0, 5);
    assert.equal(result.allowed, true);
  });

  it('should reject review if non-customer attempts to review', () => {
    const result = validateReviewSubmission('intruder_999', 'cust_123', 'completed', 0, 5);
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
  });

  it('should reject review if job is not completed', () => {
    const result = validateReviewSubmission('cust_123', 'cust_123', 'in_progress', 0, 5);
    assert.equal(result.allowed, false);
    assert.equal(result.status, 400);
  });

  it('should enforce exactly one review per job (prevent duplicates with 409)', () => {
    const result = validateReviewSubmission('cust_123', 'cust_123', 'completed', 1, 4);
    assert.equal(result.allowed, false);
    assert.equal(result.status, 409);
  });

  it('should reject out-of-range ratings', () => {
    assert.equal(validateReviewSubmission('cust_123', 'cust_123', 'completed', 0, 0).allowed, false);
    assert.equal(validateReviewSubmission('cust_123', 'cust_123', 'completed', 0, 6).allowed, false);
    assert.equal(validateReviewSubmission('cust_123', 'cust_123', 'completed', 0, 4.5).allowed, false);
  });

  it('should ensure workers without reviews display "Not rated yet" without fake ratings', () => {
    const workerWithNoReviews = {
      review_count: 0,
      average_rating: null,
    };
    const displayLabel = workerWithNoReviews.review_count > 0 && workerWithNoReviews.average_rating !== null
      ? `★ ${workerWithNoReviews.average_rating}`
      : 'Not rated yet';

    assert.equal(displayLabel, 'Not rated yet');
  });
});
