/**
 * Automated Unit Tests: Groq AI Integration in Sahayak Fair Pricing Engine
 * Tests structured JSON validation, complexity normalization, fallback resilience,
 * and rule-based pricing engine independence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGroqClassification,
  callGroqClassification,
  SUPPORTED_GROQ_MODELS,
} from '@/lib/services/groq-pricing.service';
import { PricingService } from '@/lib/services/pricing.service';

describe('Groq AI Structured Output Validation', () => {
  it('should validate and normalize standard valid Groq JSON response', () => {
    const raw = {
      serviceCategory: 'plumbing',
      detectedProblem: 'Angle valve leaking under wash basin',
      complexity: 'moderate',
      materialsLikely: true,
      briefAnalysis: 'Requires angle valve replacement and teflon tape sealing',
    };

    const validated = validateGroqClassification(raw, 'qwen/qwen3.8-27b');
    assert.ok(validated);
    assert.equal(validated.serviceCategory, 'plumbing');
    assert.equal(validated.detectedProblem, 'Angle valve leaking under wash basin');
    assert.equal(validated.complexity, 'moderate');
    assert.equal(validated.materialsLikely, true);
    assert.equal(validated.modelUsed, 'qwen/qwen3.8-27b');
  });

  it('should normalize alternative complexity representations (low/easy -> simple, hard/heavy -> complex)', () => {
    const easyRaw = { complexity: 'easy', materialsLikely: false };
    const validatedEasy = validateGroqClassification(easyRaw, 'qwen/qwen3.8-27b');
    assert.equal(validatedEasy?.complexity, 'simple');

    const minorRaw = { complexity: 'minor', materialsLikely: false };
    const validatedMinor = validateGroqClassification(minorRaw, 'qwen/qwen3.8-27b');
    assert.equal(validatedMinor?.complexity, 'simple');

    const heavyRaw = { complexity: 'heavy', materialsLikely: false };
    const validatedHeavy = validateGroqClassification(heavyRaw, 'qwen/qwen3.8-27b');
    assert.equal(validatedHeavy?.complexity, 'complex');

    const hardRaw = { complexity: 'hard', materialsLikely: false };
    const validatedHard = validateGroqClassification(hardRaw, 'qwen/qwen3.8-27b');
    assert.equal(validatedHard?.complexity, 'complex');
  });

  it('should handle materialsLikely when returned as string array of part names', () => {
    const arrayRaw = {
      complexity: 'moderate',
      materialsLikely: ['Washer', 'Cartridge', 'Teflon tape'],
    };

    const validated = validateGroqClassification(arrayRaw, 'qwen/qwen3.8-27b');
    assert.equal(validated?.materialsLikely, true);

    const emptyArrayRaw = {
      complexity: 'simple',
      materialsLikely: [],
    };
    const validatedEmpty = validateGroqClassification(emptyArrayRaw, 'qwen/qwen3.8-27b');
    assert.equal(validatedEmpty?.materialsLikely, false);
  });

  it('should gracefully handle malformed, non-object, or empty Groq responses', () => {
    assert.equal(validateGroqClassification(null, 'qwen/qwen3.8-27b'), null);
    assert.equal(validateGroqClassification('invalid string', 'qwen/qwen3.8-27b'), null);
    assert.equal(validateGroqClassification(12345, 'qwen/qwen3.8-27b'), null);

    const emptyObj = validateGroqClassification({}, 'qwen/qwen3.8-27b');
    assert.ok(emptyObj);
    assert.equal(emptyObj.complexity, 'moderate'); // Safe fallback
    assert.equal(emptyObj.materialsLikely, false);
    assert.ok(emptyObj.detectedProblem.length > 0);
  });
});

describe('Groq Models Configuration & Fallback Behavior', () => {
  it('should specify currently supported Groq models', () => {
    assert.ok(SUPPORTED_GROQ_MODELS.includes('qwen/qwen3.8-27b'));
    assert.ok(SUPPORTED_GROQ_MODELS.length >= 2);
  });

  it('should return null when GROQ_API_KEY is not set or empty', async () => {
    const originalKey = process.env.GROQ_API_KEY;
    try {
      delete process.env.GROQ_API_KEY;
      const result = await callGroqClassification('plumbing', 'tap leak');
      assert.equal(result, null);
    } finally {
      process.env.GROQ_API_KEY = originalKey;
    }
  });
});

describe('Rule-Based Pricing Independence & AI Guardrails', () => {
  it('RULE ENFORCEMENT: AI only parameterizes complexity and materials; pricing engine computes price', () => {
    const aiMock = {
      complexity: 'complex' as const,
      materialsLikely: true,
      detectedProblem: 'Concealed pipeline rupture in bathroom wall',
    };

    // Pass AI classification to rule-based engine
    const priceResult = PricingService.calculateFairPriceRange({
      category: 'plumbing',
      title: 'Water leaking in wall',
      urgency: 'emergency',
      complexityOverride: aiMock.complexity,
      includeMaterialsOverride: aiMock.materialsLikely,
    });

    // The pricing engine calculates price deterministically from configured base rates:
    // Plumbing base labor (300) * complex multiplier (2.0) = 600
    // Materials (150) = 750
    // Emergency surcharge (1.30) = 975 -> round to 980
    assert.equal(priceResult.complexity, 'complex');
    assert.equal(priceResult.materialsEstimated, true);
    assert.equal(priceResult.breakdown.adjustedLabourInr, 600);
    assert.equal(priceResult.breakdown.estimatedMaterialsInr, 150);
    assert.equal(priceResult.suggestedBudgetInr, 980);
    assert.equal(priceResult.modelConfidence, 'ai_assisted');
  });

  it('RULE ENFORCEMENT: If AI classification is missing or fails, pricing engine uses heuristic fallback without failing', () => {
    const fallbackResult = PricingService.calculateFairPriceRange({
      category: 'electrical',
      title: 'Burnt switchboard smelling smoke',
      urgency: 'standard',
    });

    assert.ok(fallbackResult.recommendedMinInr > 0);
    assert.ok(fallbackResult.recommendedMaxInr >= fallbackResult.recommendedMinInr);
    assert.equal(fallbackResult.modelConfidence, 'rule_based');
  });
});

