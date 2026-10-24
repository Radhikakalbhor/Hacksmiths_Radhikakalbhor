/**
 * Sahayak Demo Seed Preflight Validation
 * Local schema-rule validation matching Supabase PostgreSQL constraints
 * before any database operations are executed.
 */

export const PERMITTED_CATEGORIES = Object.freeze([
  'plumbing',
  'electrical',
  'cleaning',
  'carpentry',
  'painting',
  'appliance_repair',
  'cooking',
]);

export const PERMITTED_INITIAL_JOB_STATUSES = Object.freeze(['posted', 'POSTED']);
export const PERMITTED_INITIAL_BID_STATUSES = Object.freeze(['submitted', 'PENDING', 'pending']);

/**
 * Validates the demo seed payload against database constraints and business rules.
 * @param {Object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSeedPayload(payload) {
  const errors = [];

  const { demoCustomer, demoWorkers, priceBenchmarks, sampleJob, sampleBid, sampleReview } = payload;

  // 1. Customer Validation
  if (!demoCustomer) {
    errors.push('Customer payload is missing.');
  } else {
    if (!demoCustomer.email || !demoCustomer.email.includes('@')) {
      errors.push(`Customer email is invalid: ${demoCustomer.email}`);
    }
    if (!demoCustomer.fullName || demoCustomer.fullName.trim().length === 0) {
      errors.push('Customer full name is required.');
    }
    if (demoCustomer.role !== 'customer') {
      errors.push(`Customer role must be 'customer', got: ${demoCustomer.role}`);
    }
    if (!demoCustomer.phone || !demoCustomer.phone.startsWith('+91')) {
      errors.push(`Customer phone must be an Indian format number, got: ${demoCustomer.phone}`);
    }
  }

  // 2. Workers Validation (all 12 workers)
  if (!Array.isArray(demoWorkers) || demoWorkers.length === 0) {
    errors.push('Workers payload is missing or empty.');
  } else {
    const seenEmails = new Set();
    const seenPhones = new Set();

    demoWorkers.forEach((w, idx) => {
      const label = w.fullName || `Worker #${idx + 1}`;

      // Check category against worker_profiles_primary_category_check
      if (!PERMITTED_CATEGORIES.includes(w.primaryCategory)) {
        errors.push(`[${label}] Invalid primary_category '${w.primaryCategory}'. Permitted: ${PERMITTED_CATEGORIES.join(', ')}`);
      }

      // Check unique constraints
      if (seenEmails.has(w.email.toLowerCase())) {
        errors.push(`Duplicate worker email detected: ${w.email}`);
      }
      seenEmails.add(w.email.toLowerCase());

      if (seenPhones.has(w.phone)) {
        errors.push(`Duplicate worker phone detected: ${w.phone}`);
      }
      seenPhones.add(w.phone);

      // Check verification flags (MUST be false for fictional workers)
      if (w.governmentIdVerified !== false) {
        errors.push(`[${label}] governmentIdVerified must be false for fictional workers.`);
      }
      if (w.backgroundCheckVerified !== false) {
        errors.push(`[${label}] backgroundCheckVerified must be false for fictional workers.`);
      }

      // Check numeric bounds
      if (typeof w.yearsExperience !== 'number' || w.yearsExperience < 0) {
        errors.push(`[${label}] yearsExperience must be >= 0.`);
      }
      if (typeof w.serviceRadiusKm !== 'number' || w.serviceRadiusKm <= 0) {
        errors.push(`[${label}] serviceRadiusKm must be > 0.`);
      }
      if (typeof w.hourlyRateInr !== 'number' || w.hourlyRateInr < 0) {
        errors.push(`[${label}] hourlyRateInr must be >= 0.`);
      }
      if (typeof w.fixedRateEstimateInr !== 'number' || w.fixedRateEstimateInr < 0) {
        errors.push(`[${label}] fixedRateEstimateInr must be >= 0.`);
      }
      if (typeof w.reputationScore !== 'number' || w.reputationScore < 0 || w.reputationScore > 5) {
        errors.push(`[${label}] reputationScore must be between 0.0 and 5.0.`);
      }
      if (typeof w.totalCompletedJobs !== 'number' || w.totalCompletedJobs < 0) {
        errors.push(`[${label}] totalCompletedJobs must be >= 0.`);
      }

      // Coordinates bounds (India)
      if (typeof w.lat !== 'number' || w.lat < 8 || w.lat > 38) {
        errors.push(`[${label}] Latitude ${w.lat} is out of India bounds.`);
      }
      if (typeof w.lng !== 'number' || w.lng < 68 || w.lng > 98) {
        errors.push(`[${label}] Longitude ${w.lng} is out of India bounds.`);
      }
    });
  }

  // 3. Price Benchmarks Validation (all 19 benchmarks)
  if (!Array.isArray(priceBenchmarks) || priceBenchmarks.length === 0) {
    errors.push('Price benchmarks payload is missing or empty.');
  } else {
    const seenCategoryLocality = new Set();

    priceBenchmarks.forEach((bm, idx) => {
      const label = `${bm.category} / ${bm.micro_market_area || bm.locality} (#${idx + 1})`;

      // Check category against price_benchmarks_category_check
      if (!PERMITTED_CATEGORIES.includes(bm.category)) {
        errors.push(`[${label}] Invalid benchmark category '${bm.category}'. Permitted: ${PERMITTED_CATEGORIES.join(', ')}`);
      }

      // Required price checks: min <= median <= max
      const min = bm.min_price_inr ?? bm.min_price;
      const median = bm.median_price_inr ?? bm.median_price;
      const max = bm.max_price_inr ?? bm.max_price;

      if (typeof min !== 'number' || min < 0) {
        errors.push(`[${label}] min_price must be >= 0, got: ${min}`);
      }
      if (typeof median !== 'number' || median < min) {
        errors.push(`[${label}] median_price (${median}) must be >= min_price (${min})`);
      }
      if (typeof max !== 'number' || max < median) {
        errors.push(`[${label}] max_price (${max}) must be >= median_price (${median})`);
      }

      // Unique constraint check: uq_price_benchmark_category_locality (category, locality)
      const locKey = `${bm.category}:${(bm.locality || bm.micro_market_area || '').toLowerCase()}`;
      if (seenCategoryLocality.has(locKey)) {
        errors.push(`Duplicate benchmark for category and locality violates uq_price_benchmark_category_locality: ${locKey}`);
      }
      seenCategoryLocality.add(locKey);
    });
  }

  // 4. Sample Job Validation
  if (sampleJob) {
    if (!PERMITTED_INITIAL_JOB_STATUSES.includes(sampleJob.status)) {
      errors.push(`Sample job status '${sampleJob.status}' violates jobs_status_check. Permitted initial status: ${PERMITTED_INITIAL_JOB_STATUSES.join(', ')}`);
    }
    if (!PERMITTED_CATEGORIES.includes(sampleJob.category)) {
      errors.push(`Sample job category '${sampleJob.category}' is not a permitted category.`);
    }
    if (!sampleJob.pincode || !/^[0-9]{6}$/.test(sampleJob.pincode)) {
      errors.push(`Sample job pincode '${sampleJob.pincode}' does not match 6-digit check constraint.`);
    }
    if (sampleJob.accepted_bid_id != null) {
      errors.push('Sample job must not set accepted_bid_id while in initial POSTED status.');
    }
    if (sampleJob.accepted_price_inr != null) {
      errors.push('Sample job accepted_price_inr must be null while no bid is accepted.');
    }
    if (
      sampleJob.estimated_min_price_inr != null &&
      sampleJob.estimated_max_price_inr != null &&
      sampleJob.estimated_max_price_inr < sampleJob.estimated_min_price_inr
    ) {
      errors.push('Sample job estimated_max_price_inr must be >= estimated_min_price_inr.');
    }
  }

  // 5. Sample Bid Validation
  if (sampleBid) {
    if (!PERMITTED_INITIAL_BID_STATUSES.includes(sampleBid.status)) {
      errors.push(`Sample bid status '${sampleBid.status}' violates bids_status_check. Permitted initial status: ${PERMITTED_INITIAL_BID_STATUSES.join(', ')}`);
    }
    if (typeof sampleBid.offered_amount_inr !== 'number' || sampleBid.offered_amount_inr <= 0) {
      errors.push(`Sample bid offered_amount_inr must be > 0, got: ${sampleBid.offered_amount_inr}`);
    }
    // Must satisfy required legacy NOT NULL proposed_amount
    if (typeof sampleBid.proposed_amount !== 'number' || sampleBid.proposed_amount <= 0) {
      errors.push(`Sample bid proposed_amount must be populated with a valid number > 0, got: ${sampleBid.proposed_amount}`);
    }
    if (sampleBid.proposed_amount !== sampleBid.offered_amount_inr) {
      errors.push(`Sample bid proposed_amount (${sampleBid.proposed_amount}) must match offered_amount_inr (${sampleBid.offered_amount_inr}) for internal consistency.`);
    }
    if ('notes' in sampleBid) {
      errors.push(`Sample bid has invalid plural 'notes' column. Schema uses singular 'note'.`);
    }
    if (typeof sampleBid.labor_cost_inr !== 'number' || sampleBid.labor_cost_inr < 0) {
      errors.push('Sample bid labor_cost_inr must be >= 0.');
    }
    if (typeof sampleBid.materials_estimate_inr !== 'number' || sampleBid.materials_estimate_inr < 0) {
      errors.push('Sample bid materials_estimate_inr must be >= 0.');
    }
  }

  // 6. Lifecycle Consistency
  if (sampleJob && (sampleJob.status === 'POSTED' || sampleJob.status === 'posted')) {
    if (sampleReview) {
      errors.push('Lifecycle violation: Cannot attach a customer review to an open/unfinished job in posted status.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
