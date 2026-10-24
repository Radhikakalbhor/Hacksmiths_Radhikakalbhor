/**
 * Automated Unit Tests: Demo Seed Schema & Constraint Preflight Validation
 * Exercises the preflight validation engine against all historical database failures
 * and validates the production demo seed payload.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSeedPayload,
  PERMITTED_CATEGORIES,
  PERMITTED_INITIAL_JOB_STATUSES,
  PERMITTED_INITIAL_BID_STATUSES,
} from '../../../scripts/seed-validation.mjs';

interface SeedCustomer {
  email: string;
  phone: string;
  fullName: string;
  role: string;
  city: string;
  [key: string]: unknown;
}

interface SeedWorker {
  email: string;
  phone: string;
  fullName: string;
  primaryCategory: string;
  skills: string[];
  bio: string;
  yearsExperience: number;
  serviceRadiusKm: number;
  hourlyRateInr: number;
  fixedRateEstimateInr: number;
  reputationScore: number;
  totalCompletedJobs: number;
  locality: string;
  lat: number;
  lng: number;
  governmentIdVerified: boolean;
  backgroundCheckVerified: boolean;
  [key: string]: unknown;
}

interface SeedBenchmark {
  id: string;
  category: string;
  city: string;
  micro_market_area: string;
  min_price_inr?: number;
  median_price_inr?: number;
  max_price_inr?: number;
  sample_size: number;
  [key: string]: unknown;
}

interface SeedJob {
  status: string;
  category: string;
  pincode: string;
  estimated_min_price_inr: number | null;
  estimated_max_price_inr: number | null;
  accepted_bid_id: string | null;
  accepted_price_inr: number | null;
  [key: string]: unknown;
}

interface SeedBid {
  status: string;
  offered_amount_inr: number;
  proposed_amount?: number;
  labor_cost_inr: number;
  materials_estimate_inr: number;
  visitation_fee_inr: number;
  note?: string;
  notes?: string;
  [key: string]: unknown;
}

interface SeedReview {
  rating: number;
  review_text: string;
  [key: string]: unknown;
}

interface SeedPayload {
  demoCustomer: SeedCustomer;
  demoWorkers: SeedWorker[];
  priceBenchmarks: SeedBenchmark[];
  sampleJob: SeedJob;
  sampleBid: SeedBid;
  sampleReview: SeedReview | null;
}

function getBaselineValidPayload(): SeedPayload {
  return {
    demoCustomer: {
      email: 'demo-customer@sahayak.demo.internal',
      phone: '+919999000099',
      fullName: '[DEMO] Ananya Deshmukh',
      role: 'customer',
      city: 'Mumbai',
    },
    demoWorkers: [
      {
        email: 'ramesh-plumber@sahayak.demo.internal',
        phone: '+919999000001',
        fullName: '[DEMO] Ramesh Kumar',
        primaryCategory: 'plumbing',
        skills: ['Pipe Fitting', 'Tap Repair'],
        bio: '[DEMO] Master plumber in Bandra.',
        yearsExperience: 8,
        serviceRadiusKm: 12.0,
        hourlyRateInr: 350.0,
        fixedRateEstimateInr: 500.0,
        reputationScore: 4.9,
        totalCompletedJobs: 42,
        locality: 'Bandra West',
        lat: 19.0596,
        lng: 72.8295,
        governmentIdVerified: false,
        backgroundCheckVerified: false,
      },
    ],
    priceBenchmarks: [
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        category: 'plumbing',
        city: 'Mumbai',
        micro_market_area: 'Bandra & Western Suburbs',
        min_price_inr: 250,
        median_price_inr: 450,
        max_price_inr: 750,
        sample_size: 48,
      },
    ],
    sampleJob: {
      status: 'posted',
      category: 'plumbing',
      pincode: '400050',
      estimated_min_price_inr: 400.0,
      estimated_max_price_inr: 600.0,
      accepted_bid_id: null,
      accepted_price_inr: null,
    },
    sampleBid: {
      status: 'submitted',
      offered_amount_inr: 450.0,
      proposed_amount: 450.0,
      labor_cost_inr: 350.0,
      materials_estimate_inr: 100.0,
      visitation_fee_inr: 0.0,
      note: 'Can visit within 45 minutes.',
    },
    sampleReview: null,
  };
}

describe('Demo Seed Preflight Validation & Historical Failure Regressions', () => {
  it('passes on a baseline valid payload', () => {
    const payload = getBaselineValidPayload();
    const result = validateSeedPayload(payload);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  // Historical Failure 1: worker_profiles_primary_category_check
  it('catches invalid worker category violating worker_profiles_primary_category_check', () => {
    const payload = getBaselineValidPayload();
    payload.demoWorkers[0].primaryCategory = 'maid'; // Invalid legacy category

    const result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("Invalid primary_category 'maid'")),
      `Expected error about primary_category 'maid', got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 2: price_benchmarks.min_price NOT NULL and ordering
  it('catches missing min_price or invalid pricing order (min <= median <= max)', () => {
    const payload = getBaselineValidPayload();
    delete payload.priceBenchmarks[0].min_price_inr;

    let result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('min_price must be >= 0')),
      `Expected min_price error, got: ${result.errors.join('; ')}`
    );

    // Median lower than min
    const invalidOrderPayload = getBaselineValidPayload();
    invalidOrderPayload.priceBenchmarks[0].min_price_inr = 500;
    invalidOrderPayload.priceBenchmarks[0].median_price_inr = 300;
    result = validateSeedPayload(invalidOrderPayload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('median_price (300) must be >= min_price (500)')),
      `Expected median >= min error, got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 3: uq_price_benchmark_category_locality duplicate key
  it('catches duplicate (category, locality) violating uq_price_benchmark_category_locality', () => {
    const payload = getBaselineValidPayload();
    payload.priceBenchmarks.push({
      id: 'b0000000-0000-0000-0000-000000000002',
      category: 'plumbing',
      city: 'Mumbai',
      micro_market_area: 'Bandra & Western Suburbs', // duplicate category + locality
      min_price_inr: 250,
      median_price_inr: 450,
      max_price_inr: 750,
      sample_size: 20,
    });

    const result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('uq_price_benchmark_category_locality')),
      `Expected unique constraint error, got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 4: price_benchmarks_category_check
  it('catches invalid benchmark category violating price_benchmarks_category_check', () => {
    const payload = getBaselineValidPayload();
    payload.priceBenchmarks[0].category = 'maid'; // Invalid category

    const result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("Invalid benchmark category 'maid'")),
      `Expected benchmark category error, got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 5: jobs_status_check
  it('catches invalid job status violating jobs_status_check', () => {
    const payload = getBaselineValidPayload();
    payload.sampleJob.status = 'COMPLETED'; // Cannot insert directly as COMPLETED

    const result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('jobs_status_check')),
      `Expected jobs_status_check error, got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 6: Missing bids.notes column (schema uses singular 'note')
  it('catches deprecated plural notes column in bids payload', () => {
    const payload = getBaselineValidPayload();
    payload.sampleBid.notes = 'Plural notes column';

    const result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("invalid plural 'notes' column")),
      `Expected singular note error, got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 7: bids.proposed_amount NOT NULL constraint
  it('catches missing or mismatched proposed_amount in bids payload', () => {
    const payload = getBaselineValidPayload();
    delete payload.sampleBid.proposed_amount;

    let result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('proposed_amount must be populated')),
      `Expected proposed_amount error, got: ${result.errors.join('; ')}`
    );

    const mismatchPayload = getBaselineValidPayload();
    mismatchPayload.sampleBid.proposed_amount = 550.0;
    mismatchPayload.sampleBid.offered_amount_inr = 450.0;
    result = validateSeedPayload(mismatchPayload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('must match offered_amount_inr')),
      `Expected amount consistency error, got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 8: bids_status_check
  it('catches invalid bid status violating bids_status_check', () => {
    const payload = getBaselineValidPayload();
    payload.sampleBid.status = 'ACCEPTED'; // Cannot insert directly as ACCEPTED on initial post

    const result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('bids_status_check')),
      `Expected bids_status_check error, got: ${result.errors.join('; ')}`
    );
  });

  // Historical Failure 9: Job lifecycle consistency (no review on POSTED job, no accepted bid id)
  it('blocks reviews on unfinished jobs in POSTED status', () => {
    const payload = getBaselineValidPayload();
    payload.sampleReview = {
      rating: 5,
      review_text: 'Premature review',
    };

    const result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('Lifecycle violation: Cannot attach a customer review')),
      `Expected lifecycle review error, got: ${result.errors.join('; ')}`
    );
  });

  it('blocks accepted_bid_id or accepted_price_inr on POSTED jobs', () => {
    const payload = getBaselineValidPayload();
    payload.sampleJob.accepted_bid_id = 'd0000000-0000-0000-0000-000000000201';

    let result = validateSeedPayload(payload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('must not set accepted_bid_id')),
      `Expected accepted_bid_id error, got: ${result.errors.join('; ')}`
    );

    const pricePayload = getBaselineValidPayload();
    pricePayload.sampleJob.accepted_price_inr = 450.0;
    result = validateSeedPayload(pricePayload);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('accepted_price_inr must be null')),
      `Expected accepted_price_inr error, got: ${result.errors.join('; ')}`
    );
  });

  // Constants integrity
  it('validates permitted database categories and status constants', () => {
    assert.deepEqual(PERMITTED_CATEGORIES, [
      'plumbing',
      'electrical',
      'cleaning',
      'carpentry',
      'painting',
      'appliance_repair',
      'cooking',
    ]);
    assert.deepEqual(PERMITTED_INITIAL_JOB_STATUSES, ['posted', 'POSTED']);
    assert.deepEqual(PERMITTED_INITIAL_BID_STATUSES, ['submitted', 'PENDING', 'pending']);
  });
});
