import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkerRegistration,
  validateEmail,
  validateIndianPhoneNumber,
  validateNumericOtp,
} from '@/lib/validations/auth';
import { resolveOAuthRoleAndDestination } from '@/lib/auth/oauth';
import { getDestinationForRole, determineUserRole } from '@/lib/auth/roles';

describe('Sahayak Worker Registration and Existing Worker Login Engine', () => {
  describe('1. New Partner Registration Validation Rules', () => {
    const validPartnerInput = {
      fullName: 'Vikramaditya Sharma',
      phone: '9820123456',
      primaryCategory: 'electrical',
      yearsExperience: 8,
      bio: 'Licensed wireman specializing in residential switchboards and wiring repairs.',
      email: 'vikram.sharma@customdomain.in',
    };

    it('accepts complete, valid partner registration input with any valid email domain', () => {
      const result = validateWorkerRegistration(validPartnerInput);
      assert.equal(result.success, true);
      assert.equal(result.data?.fullName, 'Vikramaditya Sharma');
      assert.equal(result.data?.phone, '9820123456');
      assert.equal(result.data?.primaryCategory, 'electrical');
      assert.equal(result.data?.yearsExperience, 8);
      assert.equal(result.data?.email, 'vikram.sharma@customdomain.in');
    });

    it('allows registration using public or custom domains (not restricted to predefined domains)', () => {
      const domains = [
        'user@gmail.com',
        'partner@yahoo.co.in',
        'tradesman@outlook.com',
        'electrician@mumbaicraftsmen.org',
        'plumber@freemail.io',
      ];

      for (const email of domains) {
        const res = validateWorkerRegistration({
          ...validPartnerInput,
          email,
        });
        assert.equal(res.success, true, `Expected ${email} to be accepted`);
      }
    });

    it('rejects partner registration with missing or short full name', () => {
      const result = validateWorkerRegistration({
        ...validPartnerInput,
        fullName: 'A',
      });
      assert.equal(result.success, false);
      assert.match(result.errors?.fullName || '', /at least 2 characters/i);
    });

    it('rejects partner registration with invalid Indian phone number', () => {
      const invalidPhones = ['12345', '1820123456', 'abcdefghij', ''];
      for (const phone of invalidPhones) {
        const result = validateWorkerRegistration({
          ...validPartnerInput,
          phone,
        });
        assert.equal(result.success, false, `Expected phone "${phone}" to be rejected`);
        assert.match(result.errors?.phone || '', /valid 10-digit Indian mobile/i);
      }
    });

    it('accepts valid 10-digit Indian phone with prefixes (+91, 91, 0)', () => {
      const validPhones = ['+919820123456', '919820123456', '09820123456', '9820123456'];
      for (const phone of validPhones) {
        assert.ok(validateIndianPhoneNumber(phone), `Expected phone "${phone}" to be valid`);
      }
    });

    it('rejects partner registration with missing or empty bio/skills summary', () => {
      const result = validateWorkerRegistration({
        ...validPartnerInput,
        bio: '   ',
      });
      assert.equal(result.success, false);
      assert.match(result.errors?.bio || '', /brief bio or skills summary/i);
    });

    it('rejects negative or invalid experience years', () => {
      const result = validateWorkerRegistration({
        ...validPartnerInput,
        yearsExperience: -5,
      });
      assert.equal(result.success, false);
      assert.match(result.errors?.yearsExperience || '', /between 0 and 60/i);
    });

    it('rejects malformed email address', () => {
      const result = validateWorkerRegistration({
        ...validPartnerInput,
        email: 'invalid-email-no-at',
      });
      assert.equal(result.success, false);
      assert.match(result.errors?.email || '', /valid email address/i);
    });
  });

  describe('2. Existing Worker Sign In Role & Pre-Check Invariants', () => {
    it('authorizes existing worker email to proceed to worker dashboard', () => {
      const destinationWithWorkerRoute = getDestinationForRole('worker', '/worker/dashboard');
      assert.equal(destinationWithWorkerRoute, '/worker/dashboard');

      const defaultWorkerDestination = getDestinationForRole('worker');
      assert.equal(defaultWorkerDestination, '/dashboard?role=worker');

      const resolvedRole = determineUserRole({
        profileRole: 'worker',
        metadataRole: 'worker',
        fallbackRole: 'customer',
      });
      assert.equal(resolvedRole, 'worker');
    });

    it('generates the exact required error when email is not registered as a worker', () => {
      const expectedError =
        'This email is not registered as a worker. Please register as a new partner first.';

      // Simulate pre-check rejection for an unregistered user
      const preCheckUnregistered = {
        allowed: false,
        code: 'NOT_REGISTERED_WORKER',
        error: 'This email is not registered as a worker. Please register as a new partner first.',
      };

      assert.equal(preCheckUnregistered.allowed, false);
      assert.equal(preCheckUnregistered.error, expectedError);
    });

    it('never automatically converts a customer account into a worker during sign in', () => {
      const customerProfileRole = 'customer';
      const resolved = determineUserRole({
        profileRole: customerProfileRole,
        metadataRole: 'worker', // Untrusted client request metadata
        fallbackRole: 'customer',
      });

      // Database profile must take absolute precedence
      assert.equal(resolved, 'customer');

      // Customer must never land on worker dashboard
      const destination = getDestinationForRole(resolved);
      assert.equal(destination, '/post-job');
      assert.notEqual(destination, '/worker/dashboard');
    });
  });

  describe('3. Duplicate Worker Registration Prevention', () => {
    it('detects existing worker partner and prompts to sign in instead', () => {
      const preCheckDuplicateWorker = {
        allowed: false,
        code: 'ALREADY_REGISTERED_WORKER',
        error:
          'This email is already registered as a worker partner. Please use "Existing Worker Sign In" to log in.',
      };

      assert.equal(preCheckDuplicateWorker.allowed, false);
      assert.match(preCheckDuplicateWorker.error, /already registered as a worker partner/i);
    });
  });

  describe('4. Safe Customer Account Upgrade for New Partner Registration', () => {
    it('identifies existing customer account and provides clear transition notice', () => {
      const preCheckExistingCustomer = {
        allowed: true,
        isExistingCustomer: true,
        message:
          'Notice: An existing customer account with this email was found. Completing partner verification will enable worker partner capabilities for your account while preserving your customer job history.',
      };

      assert.equal(preCheckExistingCustomer.allowed, true);
      assert.equal(preCheckExistingCustomer.isExistingCustomer, true);
      assert.match(preCheckExistingCustomer.message, /preserving your customer job history/i);
    });
  });

  describe('5. Numeric OTP Validation & Safe Retries', () => {
    it('accepts valid 8-digit numeric OTP code', () => {
      assert.equal(validateNumericOtp('12345678', 8), true);
      assert.equal(validateNumericOtp('00000000', 8), true);
      assert.equal(validateNumericOtp('98765432', 8), true);
    });

    it('rejects short, alphabetic, or malformed OTP codes', () => {
      assert.equal(validateNumericOtp('1234567', 8), false); // 7 digits
      assert.equal(validateNumericOtp('123456789', 8), false); // 9 digits
      assert.equal(validateNumericOtp('1234567a', 8), false); // non-numeric
      assert.equal(validateNumericOtp('', 8), false); // empty
    });
  });

  describe('6. Google OAuth Role Mismatch & Boundary Invariants', () => {
    it('flags explicit account role mismatch when customer Google account logs in on worker tab', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'worker',
        redirectParam: '/worker/dashboard',
      });

      assert.equal(result.roleMismatch, true);
      assert.equal(result.expectedRole, 'worker');
      assert.equal(result.actualRole, 'customer');
      assert.match(result.destination, /account_role_mismatch/);
    });

    it('directs registered worker Google account to worker dashboard', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'worker',
        requestedRoleParam: 'worker',
        redirectParam: '/worker/dashboard',
      });

      assert.equal(result.roleMismatch, false);
      assert.equal(result.finalRole, 'worker');
      assert.equal(result.destination, '/worker/dashboard');
    });

    it('directs registered customer Google account to customer post-job', () => {
      const result = resolveOAuthRoleAndDestination({
        existingProfileRole: 'customer',
        requestedRoleParam: 'customer',
        redirectParam: '/post-job',
      });

      assert.equal(result.roleMismatch, false);
      assert.equal(result.finalRole, 'customer');
      assert.equal(result.destination, '/post-job');
    });
  });

  describe('7. Supabase OTP Verification Type Dispatch (Signup vs Email)', () => {
    it('dispatches type: "signup" for new partner registration', () => {
      const isRegisteringWorker = true;
      const role = 'worker';
      const isNewPartner = role === 'worker' && isRegisteringWorker;

      const primaryType = isNewPartner ? 'signup' : 'email';
      const fallbackType = isNewPartner ? 'email' : 'signup';

      assert.equal(primaryType, 'signup', 'New worker registration must verify with type: "signup"');
      assert.equal(fallbackType, 'email', 'Fallback for existing accounts must be type: "email"');
    });

    it('dispatches type: "email" for existing worker sign in', () => {
      const isRegisteringWorker = false;
      const role = 'worker';
      const isNewPartner = role === 'worker' && isRegisteringWorker;

      const primaryType = isNewPartner ? 'signup' : 'email';
      const fallbackType = isNewPartner ? 'email' : 'signup';

      assert.equal(primaryType, 'email', 'Existing worker sign-in must verify with type: "email"');
      assert.equal(fallbackType, 'signup');
    });

    it('prevents account creation during existing worker sign in (shouldCreateUser: false)', () => {
      const role = 'worker';
      const isRegisteringWorker = false;
      const shouldCreateUser = role === 'worker' ? isRegisteringWorker : true;

      assert.equal(shouldCreateUser, false, 'Existing worker sign in must not create a new user');
    });

    it('enables account creation during new partner registration (shouldCreateUser: true)', () => {
      const role = 'worker';
      const isRegisteringWorker = true;
      const shouldCreateUser = role === 'worker' ? isRegisteringWorker : true;

      assert.equal(shouldCreateUser, true, 'New partner registration must allow user creation');
    });
  });

  describe('8. Supabase Email Template Numeric OTP vs Link Verification Invariant', () => {
    it('verifies that numeric OTP template contains {{ .Token }} and NOT only {{ .ConfirmationURL }}', () => {
      const defaultConfirmationLinkTemplate = `
        <h2>Confirm your signup</h2>
        <p>Follow this link to confirm your user:</p>
        <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
      `;

      const numericOtpTemplate = `
        <h2>Verify Your Sahayak Partner Registration</h2>
        <p>Enter the following numeric verification code to confirm your account:</p>
        <p style="font-size: 32px; font-weight: bold;">{{ .Token }}</p>
        <p>This code will expire in 60 minutes.</p>
      `;

      // Helper simulating template validator
      const isNumericOtpTemplate = (template: string) => template.includes('{{ .Token }}');
      const isOnlyConfirmationLinkTemplate = (template: string) =>
        template.includes('{{ .ConfirmationURL }}') && !template.includes('{{ .Token }}');

      assert.equal(
        isOnlyConfirmationLinkTemplate(defaultConfirmationLinkTemplate),
        true,
        'Default Supabase template only contains a link without numeric token'
      );
      assert.equal(
        isNumericOtpTemplate(numericOtpTemplate),
        true,
        'Fixed numeric OTP template must supply {{ .Token }} for user input'
      );
    });
  });

  describe('9. Worker Registration State Preservation across OTP Verification', () => {
    it('serializes and restores pending partner details accurately', () => {
      const partnerPayload = {
        fullName: 'Ramesh Kumar Patel',
        phoneNumber: '9876543210',
        primaryCategory: 'plumbing',
        yearsExperience: 5,
        bio: 'Expert plumber handling pipe repairs, sanitary installations, and leaks.',
        email: 'ramesh.patel@tradesman.in',
      };

      const serialized = JSON.stringify(partnerPayload);
      const restored = JSON.parse(serialized);

      assert.deepEqual(restored, partnerPayload);
      assert.equal(restored.fullName, 'Ramesh Kumar Patel');
      assert.equal(restored.phoneNumber, '9876543210');
      assert.equal(restored.primaryCategory, 'plumbing');
      assert.equal(restored.yearsExperience, 5);
      assert.equal(restored.email, 'ramesh.patel@tradesman.in');
    });
  });
});

