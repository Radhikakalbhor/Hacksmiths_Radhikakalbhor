/**
 * Automated Unit Tests: Fair Pricing Engine API (/api/pricing/estimate)
 * Verifies server-side route behavior, request validation, fallback behavior
 * when Gemini API is unconfigured/unavailable, and response integrity.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pricing/estimate/route';

describe('Fair Pricing Engine API Endpoint (POST /api/pricing/estimate)', () => {
  it('should return a fair price estimation with breakdown and explanation', async () => {
    const req = new NextRequest('http://localhost:3000/api/pricing/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'electrical',
        title: 'Ceiling fan making strange humming sound',
        description: 'Motor hums but blades do not spin. Need capacitor check.',
        urgency: 'same_day',
        userBudget: 400,
        city: 'Delhi NCR',
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data);

    const data = json.data;
    assert.ok(data.recommendedMinInr > 0);
    assert.ok(data.recommendedMaxInr >= data.recommendedMinInr);
    assert.ok(data.suggestedBudgetInr >= data.recommendedMinInr);

    // Breakdown components check
    assert.ok(data.breakdown.baseLabourInr > 0);
    assert.ok(data.breakdown.complexityMultiplier >= 1.0);
    assert.equal(data.breakdown.urgencyMultiplier, 1.15); // same_day
    assert.ok(data.explanation.length > 0);
    assert.ok(data.budgetValidation);
  });

  it('should provide fallback estimation when description is omitted', async () => {
    const req = new NextRequest('http://localhost:3000/api/pricing/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'plumbing',
        title: 'Tap leaking',
        urgency: 'standard',
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.recommendedMinInr > 0);
    assert.equal(json.data.complexity, 'simple');
  });

  it('should handle budget below minimum with isBelowMinimum flag', async () => {
    const req = new NextRequest('http://localhost:3000/api/pricing/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'cleaning',
        title: 'Full 3BHK deep cleaning after move out',
        description: 'Need complete deep clean including balconies and 3 bathrooms',
        urgency: 'emergency',
        userBudget: 150, // Extremely low budget for 3BHK deep clean
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.budgetValidation.status, 'BELOW_MINIMUM');
    assert.equal(json.data.budgetValidation.isBelowMinimum, true);
    assert.ok(json.data.budgetValidation.suggestedMinimumBudgetInr > 150);
  });
});

