/**
 * Automated Unit Tests: Pricing Benchmark & Savings Calculations
 * Tests fair price matrix comparisons and legacy aggregator fee evaluations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from '@/lib/services/pricing.service';
import { PriceBenchmark } from '@/types/bids';

describe('Pricing Benchmark Service', () => {
  const sampleBenchmark: PriceBenchmark = {
    category: 'plumbing',
    city: 'Delhi NCR',
    microMarketArea: 'Dwarka Sector 11',
    minPriceInr: 250,
    medianPriceInr: 350,
    maxPriceInr: 500,
    sampleSize: 42,
    currency: 'INR',
    lastCalculatedAt: new Date().toISOString(),
  };

  it('should classify bids below minimum as BELOW_AVERAGE', () => {
    const evaluation = PricingService.evaluateBidAgainstBenchmark(200, sampleBenchmark);
    assert.equal(evaluation, 'BELOW_AVERAGE');
  });

  it('should classify bids within range as FAIR_MARKET', () => {
    const evaluationAtMin = PricingService.evaluateBidAgainstBenchmark(250, sampleBenchmark);
    const evaluationAtMedian = PricingService.evaluateBidAgainstBenchmark(350, sampleBenchmark);
    const evaluationAtMax = PricingService.evaluateBidAgainstBenchmark(500, sampleBenchmark);

    assert.equal(evaluationAtMin, 'FAIR_MARKET');
    assert.equal(evaluationAtMedian, 'FAIR_MARKET');
    assert.equal(evaluationAtMax, 'FAIR_MARKET');
  });

  it('should classify bids above maximum as ABOVE_AVERAGE', () => {
    const evaluation = PricingService.evaluateBidAgainstBenchmark(650, sampleBenchmark);
    assert.equal(evaluation, 'ABOVE_AVERAGE');
  });

  it('should calculate savings against legacy aggregator 35% commission correctly', () => {
    const { legacyAggregatorPriceInr, savingsInr, savingsPercentage } =
      PricingService.calculateSavingsVsAggregator(1000, 1.35);

    assert.equal(legacyAggregatorPriceInr, 1350);
    assert.equal(savingsInr, 350);
    assert.equal(savingsPercentage, 26); // 350 / 1350 = 25.9% -> 26%
  });
});
