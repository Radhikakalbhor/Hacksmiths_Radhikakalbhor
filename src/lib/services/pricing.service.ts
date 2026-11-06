/**
 * Pricing Benchmark & Fair Pricing Engine Service
 *
 * Centralizes fair local price calculations, transparent rule-based estimations,
 * complexity & urgency adjustments, and bid evaluations against fair market norms.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { PriceBenchmark } from '@/types/bids';
import { JobUrgency } from '@/types/jobs';
import {
  TaskComplexity,
  SERVICE_PRICING_CONFIGS,
  URGENCY_MULTIPLIERS,
  getCategoryPricingConfig,
} from '@/lib/config/pricing-config';

export type BenchmarkRow = Database['public']['Tables']['price_benchmarks']['Row'];
export type BenchmarkEvaluation = 'BELOW_AVERAGE' | 'FAIR_MARKET' | 'ABOVE_AVERAGE';
export type FairPriceLabel = 'Below Range' | 'Fair Price' | 'Above Range' | 'Benchmark unavailable';

export function getFairPriceLabel(evaluation: BenchmarkEvaluation | null | undefined): FairPriceLabel {
  if (!evaluation) return 'Benchmark unavailable';
  if (evaluation === 'BELOW_AVERAGE') return 'Below Range';
  if (evaluation === 'FAIR_MARKET') return 'Fair Price';
  if (evaluation === 'ABOVE_AVERAGE') return 'Above Range';
  return 'Benchmark unavailable';
}

export type BudgetValidationStatus = 'NOT_ENTERED' | 'BELOW_MINIMUM' | 'FAIR_MARKET' | 'PREMIUM';

export interface BudgetValidationResult {
  status: BudgetValidationStatus;
  message: string;
  isBelowMinimum: boolean;
  suggestedMinimumBudgetInr?: number;
}

export interface PricingBreakdown {
  minimumFairChargeInr: number;
  baseLabourInr: number;
  complexityMultiplier: number;
  complexityLevel: TaskComplexity;
  adjustedLabourInr: number;
  estimatedMaterialsInr: number;
  urgencyMultiplier: number;
  urgencyLabel: string;
  urgencyFeeNotice: string;
  subtotalPreUrgencyInr: number;
  finalFairMedianInr: number;
}

export interface FairPricingEngineRequest {
  category: string;
  title: string;
  description?: string;
  urgency: JobUrgency;
  userBudget?: number | null;
  city?: string;
  complexityOverride?: TaskComplexity;
  includeMaterialsOverride?: boolean;
}

export interface FairPricingEngineResult {
  recommendedMinInr: number;
  recommendedMaxInr: number;
  suggestedBudgetInr: number;
  complexity: TaskComplexity;
  materialsEstimated: boolean;
  breakdown: PricingBreakdown;
  explanation: string;
  budgetValidation: BudgetValidationResult;
  modelConfidence: 'rule_based' | 'ai_assisted';
  aiAssessment?: {
    provider: 'groq' | 'gemini' | 'rule_based';
    detectedProblem?: string;
    briefAnalysis?: string;
    modelUsed?: string;
  };
}

export class PricingService {
  static getFairPriceLabel = getFairPriceLabel;

  /**
   * Assesses whether a worker bid is competitive against the local micro-market benchmark.
   */
  static evaluateBidAgainstBenchmark(
    totalBidInr: number,
    benchmark: PriceBenchmark | BenchmarkRow | null | undefined
  ): BenchmarkEvaluation | null {
    if (!benchmark) return null;
    const min = 'minPriceInr' in benchmark ? benchmark.minPriceInr : benchmark.min_price_inr;
    const max = 'maxPriceInr' in benchmark ? benchmark.maxPriceInr : benchmark.max_price_inr;

    if (totalBidInr < min) {
      return 'BELOW_AVERAGE';
    }
    if (totalBidInr > max) {
      return 'ABOVE_AVERAGE';
    }
    return 'FAIR_MARKET';
  }

  /**
   * Calculates customer savings compared against local median price benchmark.
   * Never returns misleading zero or negative savings.
   */
  static calculateBenchmarkSavings(
    acceptedPriceInr: number,
    benchmarkMedianInr: number | null | undefined
  ): { savingsInr: number; medianBenchmarkInr: number } | null {
    if (!benchmarkMedianInr || typeof benchmarkMedianInr !== 'number' || benchmarkMedianInr <= 0) return null;
    if (!acceptedPriceInr || typeof acceptedPriceInr !== 'number' || acceptedPriceInr <= 0 || isNaN(acceptedPriceInr)) return null;
    const diff = Math.round(benchmarkMedianInr - acceptedPriceInr);
    if (diff <= 0) return null;
    return {
      savingsInr: diff,
      medianBenchmarkInr: benchmarkMedianInr,
    };
  }

  /**
   * Transparent rule-based classifier detecting task complexity and materials requirement
   * from the job title and problem description.
   * Runs completely client/server side without needing an external AI call.
   */
  static detectComplexityAndMaterials(
    category: string,
    title: string,
    description?: string
  ): { complexity: TaskComplexity; materialsLikely: boolean; reason: string } {
    const config = getCategoryPricingConfig(category);
    const combinedText = `${title || ''} ${description || ''}`.toLowerCase();

    // Check for complex keywords
    const matchesComplex = config.keywordsComplex.some((k) => combinedText.includes(k.toLowerCase()));
    // Check for moderate keywords
    const matchesModerate = config.keywordsModerate.some((k) => combinedText.includes(k.toLowerCase()));
    // Check for simple keywords
    const matchesSimple = config.keywordsSimple.some((k) => combinedText.includes(k.toLowerCase()));

    // Check for materials/parts keywords
    const materialsLikely = config.typicalMaterialsInr > 0 &&
      config.keywordsMaterialsLikely.some((k) => combinedText.includes(k.toLowerCase()));

    let complexity: TaskComplexity = 'simple';
    let reason = 'Standard routine task based on task title.';

    if (matchesComplex) {
      complexity = 'complex';
      reason = 'High-complexity task requiring extensive labor, specialized diagnostic effort, or multi-stage work.';
    } else if (matchesModerate) {
      complexity = 'moderate';
      reason = 'Moderate repair requiring diagnosis, standard parts replacement, or dedicated fixture servicing.';
    } else if (matchesSimple) {
      complexity = 'simple';
      reason = 'Standard straightforward inspection or minor routine adjustment.';
    } else {
      // Default fallback heuristics based on length and details
      if ((description && description.length > 80) || (title && title.split(' ').length >= 6)) {
        complexity = 'moderate';
        reason = 'Standard multi-step repair based on detailed problem scope.';
      } else {
        complexity = 'simple';
        reason = 'Routine service request with standard labor requirements.';
      }
    }

    return { complexity, materialsLikely, reason };
  }

  /**
   * Validates a customer's entered budget against the recommended fair price floor.
   */
  static validateCustomerBudget(
    userBudget: number | null | undefined,
    recommendedMinInr: number,
    recommendedMaxInr: number
  ): BudgetValidationResult {
    if (userBudget == null || isNaN(userBudget) || userBudget <= 0) {
      return {
        status: 'NOT_ENTERED',
        message: 'Enter a budget or select the suggested fair price.',
        isBelowMinimum: false,
      };
    }

    if (userBudget < recommendedMinInr) {
      return {
        status: 'BELOW_MINIMUM',
        message: `Your entered budget (₹${userBudget}) is below the minimum fair estimate (₹${recommendedMinInr}). Skilled professionals in your area may not accept this request or may bid higher.`,
        isBelowMinimum: true,
        suggestedMinimumBudgetInr: recommendedMinInr,
      };
    }

    if (userBudget > recommendedMaxInr * 1.3) {
      return {
        status: 'PREMIUM',
        message: `Your budget (₹${userBudget}) is above typical market rates. Verified top-rated pros are likely to accept promptly.`,
        isBelowMinimum: false,
      };
    }

    return {
      status: 'FAIR_MARKET',
      message: `Your budget (₹${userBudget}) is aligned with fair market rates (₹${recommendedMinInr} – ₹${recommendedMaxInr}).`,
      isBelowMinimum: false,
    };
  }

  /**
   * Centralized Fair Pricing Engine:
   * Rule-based formula:
   *   Pre-Urgency = max(MinCharge, BaseLabour * ComplexityMultiplier + EstimatedMaterials)
   *   Final Fair Median = Pre-Urgency * UrgencyMultiplier
   *   Recommended Min = max(MinCharge, round(FinalMedian * 0.85))
   *   Recommended Max = round(FinalMedian * 1.25)
   *
   * Pure, deterministic, verifiable. AI never independently invents final prices.
   */
  static calculateFairPriceRange(request: FairPricingEngineRequest): FairPricingEngineResult {
    const config = getCategoryPricingConfig(request.category);
    const urgencyMeta = URGENCY_MULTIPLIERS[request.urgency] || URGENCY_MULTIPLIERS.standard;

    // Detect complexity and materials if not explicitly overridden by AI/caller
    let complexity: TaskComplexity;
    let materialsLikely: boolean;
    let rationale = '';

    if (request.complexityOverride) {
      complexity = request.complexityOverride;
      materialsLikely = request.includeMaterialsOverride ?? false;
      rationale = `Complexity assessed as ${complexity} by AI assistant.`;
    } else {
      const detected = this.detectComplexityAndMaterials(
        request.category,
        request.title,
        request.description
      );
      complexity = detected.complexity;
      materialsLikely = detected.materialsLikely;
      rationale = detected.reason;
    }

    const complexityMultiplier = config.complexityMultipliers[complexity];
    const adjustedLabour = Math.round(config.baseLabourInr * complexityMultiplier);
    const materialsCost = materialsLikely ? config.typicalMaterialsInr : 0;

    // Calculate pre-urgency cost with minimum fair charge floor
    const subtotalPreUrgency = Math.max(
      config.minimumFairChargeInr,
      adjustedLabour + materialsCost
    );

    // Apply urgency adjustment
    const finalMedianExact = subtotalPreUrgency * urgencyMeta.multiplier;
    // Round to clean 10s for customer readability (e.g. 450, 480, 520)
    const finalFairMedianInr = Math.round(finalMedianExact / 10) * 10;

    // Calculate recommended range (±15-25% band around fair median)
    const rawMin = Math.round((finalFairMedianInr * 0.85) / 10) * 10;
    const recommendedMinInr = Math.max(config.minimumFairChargeInr, rawMin);
    const recommendedMaxInr = Math.max(
      recommendedMinInr + 50,
      Math.round((finalFairMedianInr * 1.25) / 10) * 10
    );

    const suggestedBudgetInr = finalFairMedianInr;

    // Format transparent explanation
    const partsExplanation: string[] = [
      `Base ${config.displayName} labor is ₹${config.baseLabourInr}.`,
      `${complexity.toUpperCase()} complexity adjustment (×${complexityMultiplier.toFixed(2)}) yields ₹${adjustedLabour} labor.`,
    ];
    if (materialsCost > 0) {
      partsExplanation.push(`Includes estimated common replacement parts allowance of ₹${materialsCost}.`);
    }
    if (urgencyMeta.multiplier > 1.0) {
      partsExplanation.push(`${urgencyMeta.label} urgency adds ${urgencyMeta.feeNotice}.`);
    }
    partsExplanation.push(`Floor minimum inspection fee is ₹${config.minimumFairChargeInr}.`);

    const explanation = partsExplanation.join(' ');

    const breakdown: PricingBreakdown = {
      minimumFairChargeInr: config.minimumFairChargeInr,
      baseLabourInr: config.baseLabourInr,
      complexityMultiplier,
      complexityLevel: complexity,
      adjustedLabourInr: adjustedLabour,
      estimatedMaterialsInr: materialsCost,
      urgencyMultiplier: urgencyMeta.multiplier,
      urgencyLabel: urgencyMeta.label,
      urgencyFeeNotice: urgencyMeta.feeNotice,
      subtotalPreUrgencyInr: subtotalPreUrgency,
      finalFairMedianInr,
    };

    const budgetValidation = this.validateCustomerBudget(
      request.userBudget,
      recommendedMinInr,
      recommendedMaxInr
    );

    return {
      recommendedMinInr,
      recommendedMaxInr,
      suggestedBudgetInr,
      complexity,
      materialsEstimated: materialsLikely,
      breakdown,
      explanation,
      budgetValidation,
      modelConfidence: request.complexityOverride ? 'ai_assisted' : 'rule_based',
    };
  }

  /**
   * Scores and ranks eligible bids using a transparent combination of
   * price fairness (up to 50 pts), worker proximity (up to 30 pts),
   * and worker experience/rating (up to 20 pts).
   */
  static scoreBidForRecommendation(
    offeredAmountInr: number,
    distanceKm: number | null | undefined,
    benchmark: BenchmarkRow | PriceBenchmark | null | undefined,
    workerExperienceYears = 0,
    workerRating: number | null = null
  ): { score: number; reason: string } {
    let priceScore = 35;
    let priceReason = 'Competitive bid';

    const minPrice = benchmark
      ? 'minPriceInr' in benchmark
        ? benchmark.minPriceInr
        : benchmark.min_price_inr
      : null;
    const maxPrice = benchmark
      ? 'maxPriceInr' in benchmark
        ? benchmark.maxPriceInr
        : benchmark.max_price_inr
      : null;

    if (minPrice != null && maxPrice != null) {
      if (offeredAmountInr >= minPrice && offeredAmountInr <= maxPrice) {
        priceScore = 50;
        priceReason = `Fair price (₹${offeredAmountInr} within local range ₹${minPrice} - ₹${maxPrice})`;
      } else if (offeredAmountInr < minPrice) {
        priceScore = 45;
        priceReason = `Below typical range (budget-friendly at ₹${offeredAmountInr})`;
      } else {
        const excessRatio = (offeredAmountInr - maxPrice) / maxPrice;
        priceScore = Math.max(10, Math.round(40 - excessRatio * 40));
        priceReason = `Above typical range of ₹${maxPrice}`;
      }
    }

    // Distance score: 0 to 30 points
    let distScore = 20; // default when distance is unknown
    let distReason = '';
    if (typeof distanceKm === 'number' && !isNaN(distanceKm)) {
      if (distanceKm <= 3) {
        distScore = 30;
        distReason = `closest proximity (${distanceKm.toFixed(1)} km away)`;
      } else if (distanceKm <= 7) {
        distScore = 25;
        distReason = `nearby (${distanceKm.toFixed(1)} km away)`;
      } else if (distanceKm <= 15) {
        distScore = 18;
        distReason = `${distanceKm.toFixed(1)} km away`;
      } else {
        distScore = 10;
        distReason = `${distanceKm.toFixed(1)} km away`;
      }
    }

    // Experience & Rating score: 0 to 20 points
    let expScore = 12;
    if (workerRating && workerRating >= 4.7) {
      expScore += 6;
    } else if (workerRating && workerRating >= 4.0) {
      expScore += 3;
    }
    if (workerExperienceYears >= 5) {
      expScore += 2;
    }
    expScore = Math.min(20, expScore);

    const totalScore = priceScore + distScore + expScore;

    // Reason synthesis
    let reason = priceReason;
    if (distReason) {
      reason += ` and ${distReason}`;
    }
    if (workerRating && workerRating >= 4.5) {
      reason += ` with ${workerRating.toFixed(1)} star rating`;
    }

    return { score: totalScore, reason };
  }

  /**
   * Fetches the local price benchmark record for a specific trade and micro-market area.
   */
  static async fetchBenchmarkForArea(
    supabase: SupabaseClient<Database>,
    category: string,
    city: string,
    microMarketArea: string
  ): Promise<BenchmarkRow | null> {
    const catLower = category.toLowerCase().trim();
    const cityPrefix = (city || 'Mumbai').split(' ')[0];

    // 1. Direct exact or substring match if microMarketArea is short
    if (microMarketArea && microMarketArea.trim().length > 0 && microMarketArea.trim().length < 30) {
      const { data } = await supabase
        .from('price_benchmarks')
        .select('*')
        .eq('category', catLower)
        .ilike('city', `%${cityPrefix}%`)
        .ilike('micro_market_area', `%${microMarketArea.trim()}%`)
        .order('sample_size', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) return data;
    }

    // 2. Keyword match: check individual locality tokens
    if (microMarketArea) {
      const tokens = microMarketArea
        .split(/[,.\s/]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4);

      for (const token of tokens) {
        const { data } = await supabase
          .from('price_benchmarks')
          .select('*')
          .eq('category', catLower)
          .ilike('city', `%${cityPrefix}%`)
          .ilike('micro_market_area', `%${token}%`)
          .order('sample_size', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) return data;
      }
    }

    // 3. City-level default benchmark fallback
    const { data: defaultCityBenchmark } = await supabase
      .from('price_benchmarks')
      .select('*')
      .eq('category', catLower)
      .ilike('city', `%${cityPrefix}%`)
      .order('sample_size', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (defaultCityBenchmark) return defaultCityBenchmark;

    // 4. Global category benchmark fallback
    const { data: globalBenchmark } = await supabase
      .from('price_benchmarks')
      .select('*')
      .eq('category', catLower)
      .order('sample_size', { ascending: false })
      .limit(1)
      .maybeSingle();

    return globalBenchmark ?? null;
  }

  /**
   * Fetches all price benchmarks for a specific category within a city.
   */
  static async fetchBenchmarksByCategory(
    supabase: SupabaseClient<Database>,
    category: string,
    city = 'Delhi NCR'
  ): Promise<BenchmarkRow[]> {
    const { data, error } = await supabase
      .from('price_benchmarks')
      .select('*')
      .eq('category', category.toLowerCase())
      .eq('city', city)
      .order('median_price_inr', { ascending: true });

    if (error) {
      console.error('[PricingService] Error fetching benchmarks by category:', error.message);
      return [];
    }

    return data ?? [];
  }

  /**
   * Calculates illustrative customer savings compared to legacy app aggregator commissions (25-35%).
   */
  static calculateSavingsVsAggregator(
    medianPriceInr: number,
    aggregatorMarkupMultiplier = 1.35
  ): { legacyAggregatorPriceInr: number; savingsInr: number; savingsPercentage: number } {
    const legacyAggregatorPriceInr = Math.round(medianPriceInr * aggregatorMarkupMultiplier);
    const savingsInr = legacyAggregatorPriceInr - medianPriceInr;
    const savingsPercentage = Math.round((savingsInr / legacyAggregatorPriceInr) * 100);

    return { legacyAggregatorPriceInr, savingsInr, savingsPercentage };
  }

  /**
   * Resolves the authoritative fair price range for a specific job.
   * Priority:
   * 1. Stored job estimate on the job record (estimated_min_price_inr and estimated_max_price_inr).
   * 2. Calculated dynamically via calculateFairPriceRange if fields are null or incomplete.
   * Never relies on hardcoded global price ranges. Preserves category, complexity, urgency, and materials.
   */
  static getJobFairPriceRange(job: {
    category?: string | null;
    title?: string | null;
    description?: string | null;
    urgency?: string | null;
    estimated_min_price_inr?: number | null;
    estimated_max_price_inr?: number | null;
    estimated_budget_inr?: number | null;
    city?: string | null;
  }): { minPriceInr: number; maxPriceInr: number; source: 'stored_job_estimate' | 'calculated_engine' } {
    const minVal = job?.estimated_min_price_inr;
    const maxVal = job?.estimated_max_price_inr;

    const hasStoredMin = typeof minVal === 'number' && !isNaN(minVal) && minVal > 0;
    const hasStoredMax = typeof maxVal === 'number' && !isNaN(maxVal) && maxVal > 0;

    if (hasStoredMin && hasStoredMax) {
      const min = Math.round(minVal);
      const max = Math.max(min, Math.round(maxVal));
      return { minPriceInr: min, maxPriceInr: max, source: 'stored_job_estimate' };
    }

    // Dynamic calculation fallback if stored estimate is incomplete or null
    let urgency: JobUrgency = 'standard';
    const rawUrgency = (job?.urgency || '').toLowerCase().trim();
    if (rawUrgency === 'same_day' || rawUrgency === 'urgent') {
      urgency = 'urgent';
    } else if (rawUrgency === 'emergency') {
      urgency = 'emergency';
    }

    const calculated = this.calculateFairPriceRange({
      category: job?.category || 'plumbing',
      title: job?.title || 'General Service',
      description: job?.description || undefined,
      urgency,
      userBudget: job?.estimated_budget_inr || undefined,
      city: job?.city || undefined,
    });

    const min = hasStoredMin ? Math.round(minVal) : calculated.recommendedMinInr;
    const max = hasStoredMax ? Math.round(maxVal) : Math.max(min, calculated.recommendedMaxInr);

    return { minPriceInr: min, maxPriceInr: max, source: 'calculated_engine' };
  }

  /**
   * Enforces fair pricing bounds for worker bids, counter-offers, and bookings.
   * Returns validation result with clear error messaging.
   */
  static validateBidAgainstFairRange(
    offeredAmountInr: number,
    range: { minPriceInr: number; maxPriceInr: number }
  ): {
    isValid: boolean;
    error?: string;
    code?: 'BID_BELOW_MINIMUM' | 'BID_ABOVE_MAXIMUM' | 'INVALID_AMOUNT';
    minPriceInr: number;
    maxPriceInr: number;
  } {
    if (typeof offeredAmountInr !== 'number' || isNaN(offeredAmountInr) || offeredAmountInr <= 0) {
      return {
        isValid: false,
        error: 'Offered amount must be a number greater than zero.',
        code: 'INVALID_AMOUNT',
        minPriceInr: range.minPriceInr,
        maxPriceInr: range.maxPriceInr,
      };
    }

    const roundedAmount = Math.round(offeredAmountInr);

    if (roundedAmount < range.minPriceInr) {
      return {
        isValid: false,
        error: `Bid amount ₹${roundedAmount} is below the fair price minimum of ₹${range.minPriceInr} for this job. Permitted fair price range: ₹${range.minPriceInr} - ₹${range.maxPriceInr}.`,
        code: 'BID_BELOW_MINIMUM',
        minPriceInr: range.minPriceInr,
        maxPriceInr: range.maxPriceInr,
      };
    }

    if (roundedAmount > range.maxPriceInr) {
      return {
        isValid: false,
        error: `Bid amount ₹${roundedAmount} exceeds the fair price ceiling of ₹${range.maxPriceInr} for this job. Permitted fair price range: ₹${range.minPriceInr} - ₹${range.maxPriceInr}.`,
        code: 'BID_ABOVE_MAXIMUM',
        minPriceInr: range.minPriceInr,
        maxPriceInr: range.maxPriceInr,
      };
    }

    return {
      isValid: true,
      minPriceInr: range.minPriceInr,
      maxPriceInr: range.maxPriceInr,
    };
  }

  /**
   * Generates an individual, realistic, and stable service quote for a worker on a specific job.
   * Ensures varied bids across multiple workers within the job's calculated fair price range.
   * Guarantees stability across page refreshes via deterministic hashing.
   */
  static calculateWorkerQuoteForJob(
    worker: {
      worker_id?: string | null;
      id?: string | null;
      user_id?: string | null;
      full_name?: string | null;
      years_experience?: number | null;
      reputation_score?: number | null;
      average_rating?: number | null;
      distance_meters?: number | null;
      hourly_rate_inr?: number | null;
      fixed_rate_estimate_inr?: number | null;
      existing_bid_inr?: number | null;
    },
    job: {
      id?: string | null;
      category?: string | null;
      title?: string | null;
      description?: string | null;
      urgency?: string | null;
      estimated_min_price_inr?: number | null;
      estimated_max_price_inr?: number | null;
      estimated_budget_inr?: number | null;
      city?: string | null;
    }
  ): {
    quoteInr: number;
    minPriceInr: number;
    maxPriceInr: number;
    isExistingBid: boolean;
    breakdown: {
      experienceFactor: number;
      reputationFactor: number;
      distanceFactor: number;
      urgencyFactor: number;
      baseRatio: number;
    };
  } {
    const fairRange = this.getJobFairPriceRange(job);
    const minPrice = fairRange.minPriceInr;
    const maxPrice = fairRange.maxPriceInr;
    const spread = maxPrice - minPrice;

    // If worker already has an authoritative existing bid within fair range, respect it exactly
    if (
      typeof worker.existing_bid_inr === 'number' &&
      !isNaN(worker.existing_bid_inr) &&
      worker.existing_bid_inr >= minPrice &&
      worker.existing_bid_inr <= maxPrice
    ) {
      return {
        quoteInr: Math.round(worker.existing_bid_inr),
        minPriceInr: minPrice,
        maxPriceInr: maxPrice,
        isExistingBid: true,
        breakdown: {
          experienceFactor: 0,
          reputationFactor: 0,
          distanceFactor: 0,
          urgencyFactor: 0,
          baseRatio: spread > 0 ? (worker.existing_bid_inr - minPrice) / spread : 0.5,
        },
      };
    }

    if (spread <= 0) {
      return {
        quoteInr: minPrice,
        minPriceInr: minPrice,
        maxPriceInr: maxPrice,
        isExistingBid: false,
        breakdown: {
          experienceFactor: 0,
          reputationFactor: 0,
          distanceFactor: 0,
          urgencyFactor: 0,
          baseRatio: 0,
        },
      };
    }

    // 1. Experience Factor: normalized 1 to 15 years -> [0, 1]
    const exp = typeof worker.years_experience === 'number' && !isNaN(worker.years_experience)
      ? worker.years_experience
      : 5;
    const experienceFactor = Math.min(1, Math.max(0, (exp - 1) / 14));

    // 2. Reputation / Rating Factor: normalized 4.0 to 5.0 -> [0, 1]
    const rating = typeof worker.average_rating === 'number' && !isNaN(worker.average_rating) && worker.average_rating > 0
      ? worker.average_rating
      : typeof worker.reputation_score === 'number' && !isNaN(worker.reputation_score) && worker.reputation_score > 0
      ? worker.reputation_score
      : 4.6;
    const reputationFactor = Math.min(1, Math.max(0, (rating - 4.0) / 1.0));

    // 3. Distance Factor: normalized 0.5km to 15km -> [0, 1]
    const distMeters = typeof worker.distance_meters === 'number' && !isNaN(worker.distance_meters)
      ? worker.distance_meters
      : 2500;
    const distKm = distMeters / 1000;
    const distanceFactor = Math.min(1, Math.max(0, (distKm - 0.5) / 14.5));

    // 4. Urgency Factor
    const rawUrgency = (job.urgency || '').toLowerCase().trim();
    const urgencyFactor = rawUrgency === 'emergency' ? 0.8 : rawUrgency === 'same_day' || rawUrgency === 'urgent' ? 0.5 : 0.2;

    // 5. Deterministic Hash Jitter: gives natural variance across workers
    const workerKey = worker.worker_id || worker.id || worker.user_id || worker.full_name || 'worker';
    const jobKey = job.id || job.title || 'job';
    const seedStr = `${jobKey}_${workerKey}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const hashUnit = (Math.abs(hash) % 1000) / 1000; // [0, 1)
    const jitter = (hashUnit - 0.5) * 0.24; // [-0.12, +0.12]

    // 6. Weighted composition:
    // Base floor at 12% above minimum, weighted by experience (26%), rating (24%), distance (14%), urgency (10%), plus jitter
    let baseRatio = 0.12 + (
      experienceFactor * 0.26 +
      reputationFactor * 0.24 +
      distanceFactor * 0.14 +
      urgencyFactor * 0.10 +
      jitter
    );

    // Clamp ratio strictly to [0.08, 0.92] so quotes naturally span the fair range without hitting the exact boundary
    baseRatio = Math.min(0.92, Math.max(0.08, baseRatio));

    // 7. Calculate raw quote and round to clean commercial increment (₹10 or ₹5)
    const rawQuote = minPrice + baseRatio * spread;
    const roundStep = spread > 250 ? 10 : 5;
    let roundedQuote = Math.round(rawQuote / roundStep) * roundStep;

    // 8. Strict boundary clamp to fair range
    if (roundedQuote < minPrice) {
      roundedQuote = Math.min(maxPrice, Math.ceil(minPrice / roundStep) * roundStep);
    }
    if (roundedQuote > maxPrice) {
      roundedQuote = Math.max(minPrice, Math.floor(maxPrice / roundStep) * roundStep);
    }

    return {
      quoteInr: roundedQuote,
      minPriceInr: minPrice,
      maxPriceInr: maxPrice,
      isExistingBid: false,
      breakdown: {
        experienceFactor,
        reputationFactor,
        distanceFactor,
        urgencyFactor,
        baseRatio,
      },
    };
  }
}
