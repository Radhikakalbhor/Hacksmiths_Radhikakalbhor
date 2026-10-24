/**
 * Pricing Benchmark Service
 * Calculates fair local price distributions and evaluates bids against market norms.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { PriceBenchmark } from '@/types/bids';

export type BenchmarkRow = Database['public']['Tables']['price_benchmarks']['Row'];
export type BenchmarkEvaluation = 'BELOW_AVERAGE' | 'FAIR_MARKET' | 'ABOVE_AVERAGE';

export class PricingService {
  /**
   * Assesses whether a worker bid is competitive against the local micro-market benchmark.
   */
  static evaluateBidAgainstBenchmark(
    totalBidInr: number,
    benchmark: PriceBenchmark | BenchmarkRow
  ): BenchmarkEvaluation {
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
   * Fetches the local price benchmark record for a specific trade and micro-market area.
   */
  static async fetchBenchmarkForArea(
    supabase: SupabaseClient<Database>,
    category: string,
    city: string,
    microMarketArea: string
  ): Promise<BenchmarkRow | null> {
    const { data, error } = await supabase
      .from('price_benchmarks')
      .select('*')
      .eq('category', category.toLowerCase())
      .eq('city', city)
      .ilike('micro_market_area', `%${microMarketArea}%`)
      .order('sample_size', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[PricingService] Error fetching benchmark:', error.message);
      return null;
    }

    return data;
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
