/**
 * Pricing Benchmark Service
 * Calculates fair local price distributions and evaluates bids against market norms.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { PriceBenchmark } from '@/types/bids';

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
      reason += ` with ${workerRating.toFixed(1)}★ rating`;
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

    // 2. Keyword match: check individual locality tokens (e.g. "Bandra", "Dadar", "Powai", "Andheri", "Worli")
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
}
