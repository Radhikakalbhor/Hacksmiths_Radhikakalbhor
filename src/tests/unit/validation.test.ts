/**
 * Automated Unit Tests: Validation Rules
 * Tests input constraints for jobs, bids, counter-offers, and phone numbers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateJob,
  validateCreateBid,
  validateCounterOffer,
} from '@/lib/validations/jobs';
import { validateIndianPhoneNumber } from '@/lib/validations/auth';

describe('Job Validation', () => {
  it('should accept valid job input', () => {
    const validJob = {
      category: 'plumbing' as const,
      title: 'Fix Kitchen Sink Tap Leakage',
      description: 'The kitchen sink tap is continuously dripping and needs cartridge replacement.',
      urgency: 'standard' as const,
      latitude: 28.5921,
      longitude: 77.046,
      addressLine: 'Flat 402, Pocket 1, Sector 11',
      city: 'Delhi NCR',
      pincode: '110075',
      estimatedBudgetInr: 450,
      estimatedMinPriceInr: 300,
      estimatedMaxPriceInr: 600,
    };

    const result = validateCreateJob(validJob);
    assert.equal(result.success, true);
    assert.deepEqual(result.data, validJob);
  });

  it('should reject invalid category', () => {
    const invalidJob = {
      category: 'spaceship_repair' as unknown as Parameters<typeof validateCreateJob>[0]['category'],
      title: 'Fix Engine Block',
      description: 'Need repairs on the thruster valve.',
      urgency: 'standard' as const,
      latitude: 28.5,
      longitude: 77.0,
      addressLine: 'Sector 10',
      city: 'Delhi NCR',
      pincode: '110075',
    };

    const result = validateCreateJob(invalidJob);
    assert.equal(result.success, false);
    assert.ok(result.errors?.category);
  });

  it('should reject titles shorter than 5 characters', () => {
    const result = validateCreateJob({
      category: 'plumbing',
      title: 'Fix',
      description: 'A detailed description of the leaking pipe problem.',
      urgency: 'standard',
      latitude: 28.5,
      longitude: 77.0,
      addressLine: 'Sector 10',
      city: 'Delhi NCR',
      pincode: '110075',
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.title);
  });

  it('should reject descriptions shorter than 10 characters', () => {
    const result = validateCreateJob({
      category: 'electrical',
      title: 'Fan Installation',
      description: 'Too short',
      urgency: 'standard',
      latitude: 28.5,
      longitude: 77.0,
      addressLine: 'Sector 10',
      city: 'Delhi NCR',
      pincode: '110075',
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.description);
  });

  it('should reject geographic coordinates outside India bounds', () => {
    const resultLat = validateCreateJob({
      category: 'cleaning',
      title: 'Deep Clean Apartment',
      description: 'Complete 2BHK cleaning including bathrooms and kitchen.',
      urgency: 'standard',
      latitude: 51.5074, // London latitude
      longitude: 77.0,
      addressLine: 'Main Road',
      city: 'Delhi NCR',
      pincode: '110075',
    });

    assert.equal(resultLat.success, false);
    assert.ok(resultLat.errors?.latitude);

    const resultLng = validateCreateJob({
      category: 'cleaning',
      title: 'Deep Clean Apartment',
      description: 'Complete 2BHK cleaning including bathrooms and kitchen.',
      urgency: 'standard',
      latitude: 28.5,
      longitude: -0.1278, // London longitude
      addressLine: 'Main Road',
      city: 'Delhi NCR',
      pincode: '110075',
    });

    assert.equal(resultLng.success, false);
    assert.ok(resultLng.errors?.longitude);
  });

  it('should reject invalid Indian pincodes', () => {
    const result = validateCreateJob({
      category: 'painting',
      title: 'Single Room Wall Painting',
      description: 'Living room requires moisture treatment and double coat paint.',
      urgency: 'standard',
      latitude: 28.5,
      longitude: 77.0,
      addressLine: 'Sector 10',
      city: 'Delhi NCR',
      pincode: '1100', // Only 4 digits
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.pincode);
  });

  it('should reject when minimum price exceeds maximum price', () => {
    const result = validateCreateJob({
      category: 'painting',
      title: 'Single Room Wall Painting',
      description: 'Living room requires moisture treatment and double coat paint.',
      urgency: 'standard',
      latitude: 28.5,
      longitude: 77.0,
      addressLine: 'Sector 10',
      city: 'Delhi NCR',
      pincode: '110075',
      estimatedMinPriceInr: 1000,
      estimatedMaxPriceInr: 500,
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.estimatedMaxPriceInr);
  });
});

describe('Bidding Validation', () => {
  it('should accept valid bid input', () => {
    const validBid = {
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      workerId: '123e4567-e89b-12d3-a456-426614174001',
      offeredAmountInr: 350,
      laborCostInr: 300,
      materialsEstimateInr: 50,
      visitationFeeInr: 0,
      note: 'Can arrive in 30 minutes with required spare cartridge.',
    };

    const result = validateCreateBid(validBid);
    assert.equal(result.success, true);
    assert.deepEqual(result.data, validBid);
  });

  it('should reject zero or negative offered amount', () => {
    const result = validateCreateBid({
      jobId: 'job-1',
      workerId: 'worker-1',
      offeredAmountInr: 0,
      laborCostInr: 0,
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.offeredAmountInr);
  });

  it('should reject missing job or worker ID', () => {
    const result = validateCreateBid({
      jobId: '',
      workerId: '',
      offeredAmountInr: 300,
      laborCostInr: 300,
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.jobId);
    assert.ok(result.errors?.workerId);
  });
});

describe('Counter-Offer Validation', () => {
  it('should accept valid counter-offer', () => {
    const validCounter = {
      bidId: 'bid-123',
      proposedByRole: 'customer' as const,
      proposedAmountInr: 300,
      message: 'Can we settle on ₹300 for the labor?',
    };

    const result = validateCounterOffer(validCounter);
    assert.equal(result.success, true);
  });

  it('should reject counter-offer with negative amount', () => {
    const result = validateCounterOffer({
      bidId: 'bid-123',
      proposedByRole: 'customer',
      proposedAmountInr: -50,
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.proposedAmountInr);
  });

  it('should reject messages exceeding 300 characters', () => {
    const longMessage = 'A'.repeat(305);
    const result = validateCounterOffer({
      bidId: 'bid-123',
      proposedByRole: 'worker',
      proposedAmountInr: 400,
      message: longMessage,
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.message);
  });
});

describe('Phone Number Validation', () => {
  it('should accept valid Indian mobile numbers', () => {
    assert.equal(validateIndianPhoneNumber('9876543210'), true);
    assert.equal(validateIndianPhoneNumber('+919876543210'), true);
    assert.equal(validateIndianPhoneNumber('09876543210'), true);
  });

  it('should reject invalid mobile numbers', () => {
    assert.equal(validateIndianPhoneNumber('12345'), false);
    assert.equal(validateIndianPhoneNumber('2345678901'), false); // Starts with 2
    assert.equal(validateIndianPhoneNumber('abcdefghij'), false);
  });
});
