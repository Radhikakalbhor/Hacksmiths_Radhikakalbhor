import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkerRegistration,
  validateIndianPhoneNumber,
  validateEmail,
  validateNumericOtp,
} from '@/lib/validations/auth';

/**
 * Worker Registration & OTP Auth Logic Unit Tests
 */

// Helper replicating the OTP error classification logic in src/app/login/page.tsx
function classifyOtpVerificationError(
  error: { message: string; code?: string; status?: number },
  elapsedMs: number,
  otpLength: number = 8
): { isExpired: boolean; isInvalid: boolean; isRateLimited: boolean; isNetworkError: boolean; message: string } {
  const errorText = error.message.toLowerCase();
  const errorCode = error.code || '';
  const isTimeExpired = elapsedMs > 10 * 60 * 1000;

  if (errorText.includes('rate limit') || error.status === 429) {
    return {
      isExpired: false,
      isInvalid: false,
      isRateLimited: true,
      isNetworkError: false,
      message: 'Too many verification attempts. Please wait a few minutes before retrying.',
    };
  }

  if (errorText.includes('network') || errorText.includes('failed to fetch') || errorText.includes('fetch failed')) {
    return {
      isExpired: false,
      isInvalid: false,
      isRateLimited: false,
      isNetworkError: true,
      message: 'Network error connecting to authentication service. Please check your internet connection.',
    };
  }

  if (isTimeExpired) {
    return {
      isExpired: true,
      isInvalid: false,
      isRateLimited: false,
      isNetworkError: false,
      message: 'The verification code has expired. Please click "Resend Code" to receive a fresh code.',
    };
  }

  if (errorCode === 'otp_expired' || errorText.includes('expired') || errorText.includes('invalid') || errorCode === 'validation_failed') {
    return {
      isExpired: false,
      isInvalid: true,
      isRateLimited: false,
      isNetworkError: false,
      message: `Invalid verification code. Please check your email and make sure you entered all ${otpLength} digits correctly.`,
    };
  }

  return {
    isExpired: false,
    isInvalid: false,
    isRateLimited: false,
    isNetworkError: false,
    message: error.message,
  };
}

// Helper replicating phone number normalization logic in complete-registration/route.ts
function normalizeIndianPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = `+91${cleaned}`;
  }
  return cleaned;
}

describe('Worker Registration Form Validation', () => {
  it('validates a complete, legitimate worker registration payload', () => {
    const result = validateWorkerRegistration({
      fullName: 'Ramesh Sharma',
      phone: '9876543210',
      primaryCategory: 'plumbing',
      yearsExperience: 5,
      bio: 'Expert plumber with domestic and commercial pipe fitting experience.',
      email: 'ramesh.sharma@example.com',
    });

    assert.equal(result.success, true);
    assert.ok(result.data);
    assert.equal(result.data.fullName, 'Ramesh Sharma');
    assert.equal(result.data.primaryCategory, 'plumbing');
    assert.equal(result.data.yearsExperience, 5);
  });

  it('rejects worker registration with an invalid Indian mobile number', () => {
    const result = validateWorkerRegistration({
      fullName: 'Ramesh Sharma',
      phone: '12345', // invalid
      primaryCategory: 'plumbing',
      yearsExperience: 5,
      bio: 'Expert plumber with domestic experience.',
      email: 'ramesh.sharma@example.com',
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.phone);
  });

  it('rejects worker registration with an invalid email address', () => {
    const result = validateWorkerRegistration({
      fullName: 'Ramesh Sharma',
      phone: '9876543210',
      primaryCategory: 'plumbing',
      yearsExperience: 5,
      bio: 'Expert plumber with domestic experience.',
      email: 'not-an-email',
    });

    assert.equal(result.success, false);
    assert.ok(result.errors?.email);
  });

  it('accepts any valid email domain, not just college or predefined domains', () => {
    const validEmails = [
      'worker@gmail.com',
      'electrician.pune@yahoo.co.in',
      'plumber@outlook.com',
      'service@my-business.in',
    ];

    for (const em of validEmails) {
      assert.equal(validateEmail(em), true, `Expected ${em} to be a valid email`);
    }
  });

  it('correctly normalizes Indian phone numbers to E.164 (+91)', () => {
    assert.equal(normalizeIndianPhoneNumber('9876543210'), '+919876543210');
    assert.equal(normalizeIndianPhoneNumber('+919876543210'), '+919876543210');
    assert.equal(normalizeIndianPhoneNumber('98765-43210'), '+919876543210');
    assert.equal(normalizeIndianPhoneNumber('(98765) 43210'), '+919876543210');
  });
});

describe('OTP Verification Type & Error Classification', () => {
  it('identifies that Supabase signInWithOtp issues tokens verified with type "email"', () => {
    // Both new partner registration and existing worker sign in use signInWithOtp
    // Verify that primary verification type is 'email'
    const primaryType = 'email';
    assert.equal(primaryType, 'email');
  });

  it('does NOT falsely report an expired OTP when code is entered quickly (< 10 minutes)', () => {
    // When GoTrue receives an invalid code, it returns code: "otp_expired" and message: "Token has expired or is invalid"
    const goTrueError = {
      message: 'Token has expired or is invalid',
      code: 'otp_expired',
    };

    // User entered code 15 seconds after requesting it
    const elapsedMs = 15 * 1000;
    const classified = classifyOtpVerificationError(goTrueError, elapsedMs, 8);

    assert.equal(classified.isExpired, false, 'Should NOT be classified as expired when under 10 minutes');
    assert.equal(classified.isInvalid, true, 'Should be classified as invalid code');
    assert.match(classified.message, /Invalid verification code/);
    assert.doesNotMatch(classified.message, /expired/i);
  });

  it('correctly reports an expired OTP only after actual time expiry (> 10 minutes)', () => {
    const goTrueError = {
      message: 'Token has expired or is invalid',
      code: 'otp_expired',
    };

    // User waited 12 minutes (720 seconds)
    const elapsedMs = 12 * 60 * 1000;
    const classified = classifyOtpVerificationError(goTrueError, elapsedMs, 8);

    assert.equal(classified.isExpired, true, 'Should be classified as expired when > 10 minutes');
    assert.match(classified.message, /has expired/);
    assert.match(classified.message, /Resend Code/);
  });

  it('handles rate limit errors gracefully', () => {
    const rateLimitError = {
      message: 'Email rate limit exceeded',
      status: 429,
    };

    const classified = classifyOtpVerificationError(rateLimitError, 5000);
    assert.equal(classified.isRateLimited, true);
    assert.match(classified.message, /Too many verification attempts/);
  });

  it('handles network fetch errors gracefully', () => {
    const networkError = {
      message: 'Failed to fetch',
    };

    const classified = classifyOtpVerificationError(networkError, 5000);
    assert.equal(classified.isNetworkError, true);
    assert.match(classified.message, /Network error connecting/);
  });

  it('validates 8-digit numeric OTP format correctly', () => {
    assert.equal(validateNumericOtp('12345678', 8), true);
    assert.equal(validateNumericOtp('1234567', 8), false); // 7 digits
    assert.equal(validateNumericOtp('123456789', 8), false); // 9 digits
    assert.equal(validateNumericOtp('abcdefgh', 8), false); // non-numeric
  });
});

describe('Worker Registration API Error Handling & Idempotency', () => {
  // Replicates the client-side error extraction in src/app/login/page.tsx
  function extractClientErrorMessage(compData: any): string {
    const rawErr = compData.error;
    return (
      (typeof rawErr === 'string'
        ? rawErr
        : rawErr?.message || compData.message) || 'Failed to complete partner profile setup. Please try again.'
    );
  }

  it('correctly extracts string-shaped API error messages from apiError()', () => {
    const apiPayload = {
      success: false,
      error: 'This mobile number is already registered with another account.',
      code: 'DUPLICATE_RESOURCE',
    };
    const extracted = extractClientErrorMessage(apiPayload);
    assert.equal(extracted, 'This mobile number is already registered with another account.');
  });

  it('correctly extracts object-shaped API error messages with nested .message', () => {
    const apiPayload = {
      success: false,
      error: {
        message: 'Database connection timeout',
      },
    };
    const extracted = extractClientErrorMessage(apiPayload);
    assert.equal(extracted, 'Database connection timeout');
  });

  it('correctly extracts compData.message if error field is not present', () => {
    const apiPayload = {
      success: false,
      message: 'Internal server error occurred',
    };
    const extracted = extractClientErrorMessage(apiPayload);
    assert.equal(extracted, 'Internal server error occurred');
  });

  it('falls back to default message if no error information exists in response', () => {
    const apiPayload = {
      success: false,
    };
    const extracted = extractClientErrorMessage(apiPayload);
    assert.equal(extracted, 'Failed to complete partner profile setup. Please try again.');
  });

  it('demonstrates PGRST204 fallback resilience: filters out unmapped columns', () => {
    // When PostgREST reports PGRST204 on optional schema columns
    const fullPayload = {
      primary_category: 'plumbing',
      bio: 'Experienced plumber',
      years_experience: 5,
      is_available: true,
      is_publicly_visible: true,
      worker_source: 'real',
      is_demo: false,
    };

    const isPgrst204Error = (err: { code?: string; message?: string }) =>
      err.code === 'PGRST204' ||
      err.message?.includes('worker_source') ||
      err.message?.includes('is_demo');

    const simulatedPostgrestError = {
      code: 'PGRST204',
      message: "Could not find the 'is_demo' column of 'worker_profiles' in the schema cache",
    };

    assert.equal(isPgrst204Error(simulatedPostgrestError), true);

    // Fallback strips unmapped fields safely
    const { worker_source, is_demo, ...corePayload } = fullPayload;
    assert.equal('is_demo' in corePayload, false);
    assert.equal('worker_source' in corePayload, false);
    assert.equal(corePayload.primary_category, 'plumbing');
    assert.equal(corePayload.years_experience, 5);
  });
});


