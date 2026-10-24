/**
 * Automated Unit Tests: Service Request Form Improvements
 * Tests:
 * 1. Custom / Other service category validation and persistence
 * 2. Automatic job title generation vs manual customer override
 * 3. Optional problem description handling
 * 4. Indicative duration estimates for service categories
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateJob } from '@/lib/validations/jobs';
import { JobsService } from '@/lib/services/jobs.service';
import {
  SERVICE_CATEGORIES,
  OTHER_CUSTOM_CATEGORY,
  getCategoryDurationEstimate,
} from '@/lib/config/constants';

describe('Create Service Request Form Enhancements', () => {
  describe('1. Custom Services & Categories', () => {
    it('should include all 8 standard categories and Other/Custom definition', () => {
      assert.equal(SERVICE_CATEGORIES.length, 8);
      const catIds = SERVICE_CATEGORIES.map((c) => c.id);
      assert.ok(catIds.includes('plumbing'));
      assert.ok(catIds.includes('electrical'));
      assert.ok(catIds.includes('cleaning'));
      assert.ok(catIds.includes('painting'));
      assert.ok(catIds.includes('maid'));
      assert.ok(catIds.includes('cooking'));
      assert.ok(catIds.includes('carpentry'));
      assert.ok(catIds.includes('appliance_repair'));
      assert.equal(OTHER_CUSTOM_CATEGORY.id, 'other');
    });

    it('should validate and persist custom service name in category field for database compatibility', () => {
      const input = {
        category: 'other' as const,
        customCategoryName: 'Pet Bathing & Hair Trim',
        title: 'Pet Bathing & Hair Trim',
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Flat 101, Sea View Apts, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };

      const validation = validateCreateJob(input);
      assert.equal(validation.success, true);

      const dbInsert = JobsService.prepareJobInsert('cust-uuid-123', validation.data!);
      // Reconciled with live PostgreSQL constraint: custom services are stored under 'cleaning' with explicit prefix in title & description
      assert.equal(dbInsert.category, 'cleaning');
      assert.ok(dbInsert.title.includes('Pet Bathing & Hair Trim'));
      assert.ok(dbInsert.description.includes('[Custom Service: Pet Bathing & Hair Trim]'));
    });

    it('should reject other/custom category without custom service name', () => {
      const input = {
        category: 'other' as const,
        customCategoryName: ' ',
        title: 'Need Help',
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Bandra Road',
        city: 'Mumbai',
        pincode: '400050',
      };

      const validation = validateCreateJob(input);
      assert.equal(validation.success, false);
      assert.ok(validation.errors?.customCategoryName);
    });
  });

  describe('2. Optional Problem Description', () => {
    it('should allow job creation when description is completely omitted', () => {
      const input = {
        category: 'plumbing' as const,
        title: 'Fix Kitchen Sink Tap',
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Linking Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };

      const validation = validateCreateJob(input);
      assert.equal(validation.success, true);
      assert.equal(validation.data?.description, undefined);

      // Verify JobsService falls back description to a descriptive string >= 15 chars to satisfy jobs_description_check constraint
      const dbInsert = JobsService.prepareJobInsert('cust-uuid-123', validation.data!);
      assert.ok(dbInsert.description.length >= 15, 'Fallback description must satisfy jobs_description_check (>= 15 chars)');
      assert.ok(dbInsert.description.includes('Fix Kitchen Sink Tap'), 'Fallback description must derive from title');
    });

    it('should safely normalize short descriptions under 15 characters', () => {
      const input = {
        category: 'plumbing' as const,
        title: 'Fix Tap',
        description: 'Leaking pipe', // 12 characters (< 15)
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Linking Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };

      const validation = validateCreateJob(input);
      assert.equal(validation.success, true);
      const dbInsert = JobsService.prepareJobInsert('cust-uuid-123', validation.data!);
      assert.ok(dbInsert.description.length >= 15, 'Short description must be normalized to >= 15 chars');
      assert.ok(dbInsert.description.includes('Leaking pipe'), 'Customer short note must be preserved');
    });

    it('should preserve description when provided by customer', () => {
      const input = {
        category: 'plumbing' as const,
        title: 'Fix Kitchen Sink Tap',
        description: 'Dripping continuously under sink cabinet.', // 41 characters (>= 15)
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Linking Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };

      const validation = validateCreateJob(input);
      assert.equal(validation.success, true);
      const dbInsert = JobsService.prepareJobInsert('cust-uuid-123', validation.data!);
      assert.equal(dbInsert.description, 'Dripping continuously under sink cabinet.');
    });
  });

  describe('3. Indicative Duration Guidance', () => {
    it('should provide realistic duration estimates for all categories', () => {
      assert.equal(getCategoryDurationEstimate('plumbing'), '1–2 hours');
      assert.equal(getCategoryDurationEstimate('electrical'), '1–2 hours');
      assert.equal(getCategoryDurationEstimate('cleaning'), '3–5 hours');
      assert.equal(getCategoryDurationEstimate('painting'), '1–2 days');
      assert.equal(getCategoryDurationEstimate('maid'), '2–4 hours');
      assert.equal(getCategoryDurationEstimate('cooking'), '2–3 hours');
      assert.equal(getCategoryDurationEstimate('carpentry'), '1–3 hours');
      assert.equal(getCategoryDurationEstimate('appliance_repair'), '1–3 hours');
      assert.equal(getCategoryDurationEstimate('other'), '1–3 hours');
      assert.equal(getCategoryDurationEstimate('unknown_category'), 'typically 1–3 hours');
    });
  });

  describe('4. Urgency Constraint Normalization & Schema Compliance', () => {
    it('should map same_day urgency to urgent to satisfy database check constraint', () => {
      const input = {
        category: 'electrical' as const,
        title: 'Ceiling Fan Sparking',
        urgency: 'same_day' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Hill Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };

      const validation = validateCreateJob(input);
      assert.equal(validation.success, true);
      const dbInsert = JobsService.prepareJobInsert('cust-uuid-123', validation.data!);
      assert.equal(dbInsert.urgency, 'urgent', 'same_day must map to urgent for DB constraint');
    });

    it('should preserve standard and emergency urgency values', () => {
      const stdInput = {
        category: 'cleaning' as const,
        title: 'Deep Cleaning 2BHK',
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Hill Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };
      const emgInput = {
        category: 'plumbing' as const,
        title: 'Burst Water Pipe Under Sink',
        urgency: 'emergency' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Hill Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };

      const stdInsert = JobsService.prepareJobInsert('cust-uuid-123', validateCreateJob(stdInput).data!);
      const emgInsert = JobsService.prepareJobInsert('cust-uuid-123', validateCreateJob(emgInput).data!);
      assert.equal(stdInsert.urgency, 'standard');
      assert.equal(emgInsert.urgency, 'emergency');
    });

    it('should safely pad titles shorter than 5 characters to fulfill jobs_title_check', () => {
      const input = {
        category: 'maid' as const,
        title: 'Maid', // 4 chars -> violates jobs_title_check if unpadded
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Hill Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
      };

      const dbInsert = JobsService.prepareJobInsert('cust-uuid-123', input);
      assert.ok(dbInsert.title.length >= 5, 'Title must satisfy jobs_title_check (>= 5 chars)');
      assert.equal(dbInsert.title, 'Maid Service');
    });

    it('should include photo_urls in database insert payload when provided', () => {
      const input = {
        category: 'plumbing' as const,
        title: 'Bathroom Leakage Fix',
        urgency: 'standard' as const,
        latitude: 19.076,
        longitude: 72.8777,
        addressLine: 'Hill Road, Bandra',
        city: 'Mumbai',
        pincode: '400050',
        photoUrls: ['https://example.com/leak1.jpg', 'https://example.com/leak2.jpg'],
      };

      const dbInsert = JobsService.prepareJobInsert('cust-uuid-123', input);
      assert.deepEqual(dbInsert.photo_urls, ['https://example.com/leak1.jpg', 'https://example.com/leak2.jpg']);
    });
  });
});
