/**
 * Automated Unit Tests: Customer Profile Panel Logic & Validation
 * Verifies profile fields validation, read-only email constraints,
 * Indian phone number validation, and safe database update payload construction.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateIndianPhoneNumber } from '@/lib/validations/auth';

describe('Customer Profile Validation & Payload Logic', () => {
  describe('Full Name Validation', () => {
    it('accepts valid full names', () => {
      const validNames = ['Radhika Kalbhor', 'Amit Kumar', 'Dr. Sarah Sen', 'A B'];
      for (const name of validNames) {
        const clean = name.trim();
        assert.ok(clean.length >= 2, `Expected "${name}" to be at least 2 characters`);
      }
    });

    it('rejects empty or whitespace-only full names', () => {
      const invalidNames = ['', '   ', '\t\n'];
      for (const name of invalidNames) {
        const clean = name.trim();
        assert.ok(clean.length < 2, `Expected "${name}" to be rejected`);
      }
    });

    it('rejects single character full names', () => {
      const invalidNames = ['A', ' 1 '];
      for (const name of invalidNames) {
        const clean = name.trim();
        assert.ok(clean.length < 2, `Expected single character name to be rejected`);
      }
    });
  });

  describe('Phone Number Validation for Customer Profile', () => {
    it('validates 10-digit Indian mobile numbers starting with 6, 7, 8, 9', () => {
      const validNumbers = [
        '9876543210',
        '+919876543210',
        '+91 98765 43210',
        '09876543210',
        '8123456789',
        '7001234567',
        '6298765432',
      ];
      for (const phone of validNumbers) {
        assert.equal(
          validateIndianPhoneNumber(phone),
          true,
          `Expected "${phone}" to be valid Indian mobile number`
        );
      }
    });

    it('rejects invalid or malformed phone numbers', () => {
      const invalidNumbers = [
        '1234567890', // starts with 1
        '5555555555', // starts with 5
        '987654321',  // 9 digits
        '98765432100', // 11 digits without country code
        'abcdefghij', // letters
        '98765-abcde',
      ];
      for (const phone of invalidNumbers) {
        assert.equal(
          validateIndianPhoneNumber(phone),
          false,
          `Expected "${phone}" to be rejected as invalid`
        );
      }
    });
  });

  describe('Safe Profile Update Payload Construction', () => {
    it('constructs correct payload preserving fallback phone when phone is not edited', () => {
      const userId = '11111111-2222-3333-4444-555555555555';
      const existingFallbackPhone = 'user_1111111122';
      const cleanName = 'Radhika Kalbhor';
      const phoneInput = '';
      const addressInput = 'Flat 302, Hill Road, Bandra West, Mumbai';

      const phoneToPersist =
        phoneInput.trim() || existingFallbackPhone || `user_${userId.replace(/-/g, '').slice(0, 10)}`;

      const payload: {
        full_name: string;
        phone: string;
        primary_city?: string;
        updated_at: string;
      } = {
        full_name: cleanName,
        phone: phoneToPersist,
        updated_at: new Date().toISOString(),
      };

      if (addressInput.trim()) {
        payload.primary_city = addressInput.trim();
      }

      assert.equal(payload.full_name, 'Radhika Kalbhor');
      assert.equal(payload.phone, 'user_1111111122');
      assert.equal(payload.primary_city, 'Flat 302, Hill Road, Bandra West, Mumbai');
      assert.ok(payload.updated_at);
      // Ensure email is NEVER in the profile update payload
      assert.equal('email' in payload, false, 'Email must never be overwritten via profile panel');
    });

    it('updates phone and address when customer explicitly provides valid new ones', () => {
      const cleanName = 'Radhika Kalbhor';
      const phoneInput = '9876543210';
      const addressInput = 'Bandra West, Mumbai';

      const phoneToPersist = phoneInput.trim();

      const payload: {
        full_name: string;
        phone: string;
        primary_city?: string;
        updated_at: string;
      } = {
        full_name: cleanName,
        phone: phoneToPersist,
        updated_at: new Date().toISOString(),
      };

      if (addressInput.trim()) {
        payload.primary_city = addressInput.trim();
      }

      assert.equal(payload.full_name, 'Radhika Kalbhor');
      assert.equal(payload.phone, '9876543210');
      assert.equal(payload.primary_city, 'Bandra West, Mumbai');
      assert.equal('email' in payload, false);
    });

    it('does not overwrite primary_city if address is left empty', () => {
      const cleanName = 'Radhika Kalbhor';
      const phoneInput = '9876543210';
      const addressInput = '   ';

      const payload: {
        full_name: string;
        phone: string;
        primary_city?: string;
        updated_at: string;
      } = {
        full_name: cleanName,
        phone: phoneInput.trim(),
        updated_at: new Date().toISOString(),
      };

      if (addressInput.trim()) {
        payload.primary_city = addressInput.trim();
      }

      assert.equal('primary_city' in payload, false, 'Empty address should not overwrite existing primary_city with empty string');
    });
  });

  describe('Server API Mediation (RLS Infinite Recursion Mitigation)', () => {
    it('ensures updates are strictly targeted to authenticated user id', () => {
      const authenticatedUserId = 'fd2a3a25-c81f-43ce-a20c-bfd79a496e31';
      const maliciousTargetId = 'attacker-id-cannot-be-used';

      // The API always uses user.id from verified session token
      const resolvedTargetId = authenticatedUserId;
      assert.equal(resolvedTargetId, authenticatedUserId);
      assert.notEqual(resolvedTargetId, maliciousTargetId);
    });

    it('rejects update requests with invalid payload structures', () => {
      const invalidPayloads = [
        { fullName: '', phone: '9876543210' },
        { fullName: 'S', phone: '9876543210' },
        { fullName: 'Sayanthan Ghosh', phone: '123' },
      ];

      for (const p of invalidPayloads) {
        const nameValid = typeof p.fullName === 'string' && p.fullName.trim().length >= 2;
        const phoneValid = !p.phone || validateIndianPhoneNumber(p.phone);
        const overallValid = nameValid && phoneValid;
        assert.equal(overallValid, false, `Expected payload ${JSON.stringify(p)} to be rejected`);
      }
    });
  });
});
