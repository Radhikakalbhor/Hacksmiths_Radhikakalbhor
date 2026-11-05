/**
 * Automated Unit Tests: Pricing Benchmark & Fair Pricing Engine
 * Tests fair price matrix comparisons, centralized rule-based fair pricing calculations,
 * complexity adjustments, urgency surcharges, and customer budget validation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from '@/lib/services/pricing.service';
import { PriceBenchmark } from '@/types/bids';
import { SERVICE_PRICING_CONFIGS, TaskComplexity } from '@/lib/config/pricing-config';
import { ServiceCategory, JobUrgency } from '@/types/jobs';

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

describe('Centralized Fair Pricing Engine', () => {
  const allCategories: ServiceCategory[] = [
    'plumbing',
    'electrical',
    'cleaning',
    'painting',
    'maid',
    'cooking',
    'carpentry',
    'appliance_repair',
    'other',
  ];

  it('should support and calculate fair prices for every Sahayak service category', () => {
    for (const cat of allCategories) {
      const result = PricingService.calculateFairPriceRange({
        category: cat,
        title: `Routine ${cat} inspection and service`,
        description: 'Need basic inspection and assistance',
        urgency: 'standard',
      });

      assert.ok(result.recommendedMinInr > 0, `Category ${cat} should have recommendedMin > 0`);
      assert.ok(result.recommendedMaxInr >= result.recommendedMinInr, `Category ${cat} max should be >= min`);
      assert.ok(result.suggestedBudgetInr >= result.recommendedMinInr, `Category ${cat} suggested should be >= min`);
      assert.ok(result.breakdown.minimumFairChargeInr > 0, `Category ${cat} should have minimum fair charge`);
      assert.ok(result.explanation.length > 0, `Category ${cat} should include transparent explanation`);
    }
  });

  describe('Complexity & Multiplier Adjustments', () => {
    it('should detect simple vs complex task from keywords and adjust price accordingly', () => {
      // Simple plumbing task: tap washer
      const simple = PricingService.calculateFairPriceRange({
        category: 'plumbing',
        title: 'Bathroom tap washer loose dripping',
        urgency: 'standard',
      });

      // Complex plumbing task: main pipeline concealed renovation
      const complex = PricingService.calculateFairPriceRange({
        category: 'plumbing',
        title: 'Concealed pipe line leakage renovation and water tank replacement',
        urgency: 'standard',
      });

      assert.equal(simple.complexity, 'simple');
      assert.equal(complex.complexity, 'complex');
      assert.ok(
        complex.suggestedBudgetInr > simple.suggestedBudgetInr,
        'Complex task budget should be significantly higher than simple task'
      );
      assert.ok(
        complex.breakdown.adjustedLabourInr > simple.breakdown.adjustedLabourInr,
        'Complex task labor should be higher'
      );
    });

    it('should allow explicit complexity override (e.g. from server-side AI assessment)', () => {
      const result = PricingService.calculateFairPriceRange({
        category: 'electrical',
        title: 'Check switch',
        urgency: 'standard',
        complexityOverride: 'complex',
        includeMaterialsOverride: true,
      });

      assert.equal(result.complexity, 'complex');
      assert.equal(result.materialsEstimated, true);
      assert.equal(result.modelConfidence, 'ai_assisted');
      assert.ok(result.breakdown.estimatedMaterialsInr > 0);
    });
  });

  describe('Urgency Level Adjustments', () => {
    it('should apply appropriate surcharges for Standard, Same Day, and Emergency', () => {
      const standard = PricingService.calculateFairPriceRange({
        category: 'electrical',
        title: 'Ceiling fan capacitor repair',
        urgency: 'standard',
      });

      const sameDay = PricingService.calculateFairPriceRange({
        category: 'electrical',
        title: 'Ceiling fan capacitor repair',
        urgency: 'same_day',
      });

      const emergency = PricingService.calculateFairPriceRange({
        category: 'electrical',
        title: 'Ceiling fan capacitor repair',
        urgency: 'emergency',
      });

      assert.equal(standard.breakdown.urgencyMultiplier, 1.0);
      assert.equal(sameDay.breakdown.urgencyMultiplier, 1.15);
      assert.equal(emergency.breakdown.urgencyMultiplier, 1.30);

      assert.ok(
        sameDay.suggestedBudgetInr >= standard.suggestedBudgetInr,
        'Same Day should be >= Standard'
      );
      assert.ok(
        emergency.suggestedBudgetInr > sameDay.suggestedBudgetInr,
        'Emergency should be > Same Day'
      );
    });
  });

  describe('Customer Budget Validation', () => {
    it('should flag budget below recommended minimum as BELOW_MINIMUM with clear warning', () => {
      const result = PricingService.calculateFairPriceRange({
        category: 'plumbing',
        title: 'Kitchen sink pipe repair',
        urgency: 'standard',
        userBudget: 100, // Very low budget for plumbing
      });

      assert.equal(result.budgetValidation.status, 'BELOW_MINIMUM');
      assert.equal(result.budgetValidation.isBelowMinimum, true);
      assert.ok(result.budgetValidation.message.includes('below the minimum fair estimate'));
      assert.equal(result.budgetValidation.suggestedMinimumBudgetInr, result.recommendedMinInr);
    });

    it('should flag budget within range as FAIR_MARKET', () => {
      // First inspect the suggested fair budget for this task
      const baseline = PricingService.calculateFairPriceRange({
        category: 'plumbing',
        title: 'Kitchen sink pipe repair',
        urgency: 'standard',
      });

      const result = PricingService.calculateFairPriceRange({
        category: 'plumbing',
        title: 'Kitchen sink pipe repair',
        urgency: 'standard',
        userBudget: baseline.suggestedBudgetInr,
      });

      assert.equal(result.budgetValidation.status, 'FAIR_MARKET');
      assert.equal(result.budgetValidation.isBelowMinimum, false);
      assert.ok(result.budgetValidation.message.includes('aligned with fair market rates'));
    });

    it('should flag budget well above range as PREMIUM', () => {
      const result = PricingService.calculateFairPriceRange({
        category: 'plumbing',
        title: 'Kitchen sink pipe repair',
        urgency: 'standard',
        userBudget: 1500,
      });

      assert.equal(result.budgetValidation.status, 'PREMIUM');
      assert.ok(result.budgetValidation.message.includes('above typical market rates'));
    });

    it('should handle unentered / null / zero budget gracefully', () => {
      const unentered = PricingService.calculateFairPriceRange({
        category: 'carpentry',
        title: 'Door handle fix',
        urgency: 'standard',
        userBudget: null,
      });

      assert.equal(unentered.budgetValidation.status, 'NOT_ENTERED');
      assert.equal(unentered.budgetValidation.isBelowMinimum, false);
    });
  });

  describe('Missing Description & Fallback Resilience', () => {
    it('should handle omitted or empty problem description gracefully', () => {
      const result = PricingService.calculateFairPriceRange({
        category: 'cleaning',
        title: 'Sofa cleaning',
        description: undefined,
        urgency: 'standard',
      });

      assert.ok(result.recommendedMinInr > 0);
      assert.ok(result.suggestedBudgetInr > 0);
      assert.equal(result.complexity, 'simple');
    });

    it('should never produce negative or NaN prices', () => {
      const result = PricingService.calculateFairPriceRange({
        category: 'other',
        title: 'Quick help',
        urgency: 'standard',
        userBudget: -50,
      });

      assert.ok(!isNaN(result.recommendedMinInr));
      assert.ok(!isNaN(result.recommendedMaxInr));
      assert.ok(!isNaN(result.suggestedBudgetInr));
      assert.ok(result.recommendedMinInr >= SERVICE_PRICING_CONFIGS.other.minimumFairChargeInr);
    });
  });
});
