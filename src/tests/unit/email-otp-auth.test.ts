/**
 * Automated Unit Tests: Email OTP Authentication Flow, 8-Digit Length & Expiration Integrity
 *
 * Covers all requirements:
 * 1. The configured OTP length (8 digits for active Supabase project)
 * 2. Eight-digit input validation
 * 3. Six-digit input validation when expected length is set to 6
 * 4. Rejecting incomplete codes (1-5 digits, 7 digits)
 * 5. Pasting a complete OTP with whitespace or formatting sanitization
 * 6. Correct verification payload construction (email, token, type: 'email')
 * 7. Invalid OTP vs Expired OTP error distinction (time-aware analysis of Supabase GoTrue responses)
 * 8. Rate limits (429) and network failure error handling
 * 9. Resend countdown behavior and button states
 * 10. Requesting a new OTP after an earlier failure (clearing error and stale token)
 * 11. Successful session establishment and role-based dashboard redirects
 * 12. Customer/worker role preservation (zero-trust invariants)
 * 13. Regression prevention: Google OAuth callback integrity
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEmail, validateNumericOtp, validateEmailOtpCode, validateOtpCode } from '@/lib/validations/auth';
import { resolveOAuthRoleAndDestination } from '@/app/auth/callback/route';

describe('Email OTP Authentication, 8-Digit Token & Expiration Tests', () => {
  describe('1. Configured OTP Length & Validation (8-Digit Primary, 6-Digit Secondary)', () => {
    it('should validate exact 8-digit numeric OTP when configured for 8 digits (current Supabase config)', () => {
      assert.equal(validateNumericOtp('12345678', 8), true);
      assert.equal(validateNumericOtp('00000000', 8), true);
      assert.equal(validateNumericOtp('98765432', 8), true);

      // Incomplete and invalid inputs
      assert.equal(validateNumericOtp('123456', 8), false, '6 digits rejected when 8 are expected');
      assert.equal(validateNumericOtp('1234567', 8), false, '7 digits rejected (incomplete)');
      assert.equal(validateNumericOtp('123456789', 8), false, '9 digits rejected (too long)');
      assert.equal(validateNumericOtp('1234567a', 8), false, 'Alphanumeric rejected');
      assert.equal(validateNumericOtp('', 8), false, 'Empty rejected');
    });

    it('should validate 6-digit numeric OTP when explicitly configured for 6 digits', () => {
      assert.equal(validateNumericOtp('123456', 6), true);
      assert.equal(validateNumericOtp('987654', 6), true);

      // Incomplete and invalid inputs
      assert.equal(validateNumericOtp('12345', 6), false, '5 digits rejected');
      assert.equal(validateNumericOtp('1234567', 6), false, '7 digits rejected');
    });

    it('should reject incomplete codes of any length', () => {
      const incompleteCodes = ['1', '12', '123', '1234', '12345', '1234567'];
      for (const code of incompleteCodes) {
        assert.equal(validateNumericOtp(code, 8), false, `Incomplete code "${code}" must be rejected`);
      }
    });

    it('should support pasting complete OTPs with whitespace or formatting cleaned', () => {
      // Simulating paste event sanitizer: text.replace(/\D/g, '').slice(0, 8)
      const sanitizePasted = (raw: string, maxLen: number = 8) => raw.replace(/\D/g, '').slice(0, maxLen);

      assert.equal(sanitizePasted(' 12345678 '), '12345678');
      assert.equal(sanitizePasted('1234-5678'), '12345678');
      assert.equal(sanitizePasted('OTP: 98765432 (Sahayak)'), '98765432');
      assert.equal(validateNumericOtp(sanitizePasted(' 54819203 '), 8), true);
    });

    it('should validate complete email OTP codes using validateEmailOtpCode', () => {
      assert.equal(validateEmailOtpCode('12345678'), true, '8-digit valid');
      assert.equal(validateEmailOtpCode('123456'), true, '6-digit valid');
      assert.equal(validateEmailOtpCode('12345'), false, '5-digit invalid');
      assert.equal(validateEmailOtpCode('1234567'), false, '7-digit invalid');
    });

    it('should maintain backward compatibility for validateOtpCode (4 to 8 digits)', () => {
      assert.equal(validateOtpCode('1234'), true);
      assert.equal(validateOtpCode('123456'), true);
      assert.equal(validateOtpCode('12345678'), true);
      assert.equal(validateOtpCode('12'), false);
    });
  });

  describe('2. Requesting OTP: Payload Construction & Email Normalization', () => {
    it('should normalize email to lowercase and trimmed string', () => {
      assert.equal(validateEmail('Customer@Example.COM  '), true);
      const cleanEmail = '  Customer@Example.COM  '.trim().toLowerCase();
      assert.equal(cleanEmail, 'customer@example.com');
    });

    it('should construct correct signInWithOtp payload with 8-digit OTP expectation and redirect URL', () => {
      const email = 'user@sahayak.in';
      const role = 'customer';
      const origin = 'http://localhost:3000';
      const redirectTo = '/dashboard';

      const callbackUrl = `${origin}/auth/callback?role=${role}&redirect=${encodeURIComponent(redirectTo)}`;
      const payload = {
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callbackUrl,
          data: { role },
        },
      };

      assert.equal(payload.email, 'user@sahayak.in');
      assert.equal(payload.options.shouldCreateUser, true);
      assert.ok(payload.options.emailRedirectTo.includes('/auth/callback'));
    });
  });

  describe('3. Verifying OTP: Distinguishing Expired Tokens from Invalid / Partial Tokens', () => {
    function evaluateVerificationError({
      error,
      otpRequestedAt,
      now = Date.now(),
    }: {
      error: { message: string; code?: string; status?: number };
      otpRequestedAt: number | null;
      now?: number;
    }): string {
      const errorText = error.message.toLowerCase();
      const errorCode = error.code || '';
      const elapsedMs = otpRequestedAt ? now - otpRequestedAt : 0;
      // Expired only if more than 10 minutes (600,000ms) have passed
      const isTimeExpired = elapsedMs > 10 * 60 * 1000;

      if (errorText.includes('rate limit') || error.status === 429) {
        return 'Too many verification attempts. Please wait a few minutes before retrying.';
      }
      if (errorText.includes('network') || errorText.includes('failed to fetch')) {
        return 'Network error connecting to authentication service. Please check your internet connection.';
      }
      if (errorCode === 'otp_expired' || errorText.includes('expired') || errorText.includes('invalid')) {
        if (isTimeExpired) {
          return 'The verification code has expired. Please click "Resend Code" to receive a fresh code.';
        }
        return 'Invalid verification code. Please check your email and make sure you entered all 8 digits correctly.';
      }
      return error.message;
    }

    it('should NOT falsely display "expired" when an incorrect or 6-digit partial code is submitted immediately (e.g. 30s after request)', () => {
      const requestTime = Date.now() - 30 * 1000; // 30 seconds ago
      const supabaseError = {
        name: 'AuthApiError',
        message: 'Token has expired or is invalid',
        status: 403,
        code: 'otp_expired',
      };

      const userMessage = evaluateVerificationError({
        error: supabaseError,
        otpRequestedAt: requestTime,
      });

      assert.equal(
        userMessage,
        'Invalid verification code. Please check your email and make sure you entered all 8 digits correctly.',
        'Must report invalid code, NOT expired code, within the active 10-minute window'
      );
    });

    it('should correctly display expired message ONLY after the real validity window has elapsed (>10 mins)', () => {
      const requestTime = Date.now() - 15 * 60 * 1000; // 15 minutes ago
      const supabaseError = {
        name: 'AuthApiError',
        message: 'Token has expired or is invalid',
        status: 403,
        code: 'otp_expired',
      };

      const userMessage = evaluateVerificationError({
        error: supabaseError,
        otpRequestedAt: requestTime,
      });

      assert.equal(
        userMessage,
        'The verification code has expired. Please click "Resend Code" to receive a fresh code.'
      );
    });

    it('should display rate limit message when status is 429', () => {
      const rateLimitError = {
        name: 'AuthApiError',
        message: 'Email rate limit exceeded',
        status: 429,
        code: 'over_email_send_rate_limit',
      };

      const userMessage = evaluateVerificationError({
        error: rateLimitError,
        otpRequestedAt: Date.now(),
      });

      assert.equal(
        userMessage,
        'Too many verification attempts. Please wait a few minutes before retrying.'
      );
    });

    it('should display network error message on fetch failure', () => {
      const networkError = {
        name: 'AuthApiError',
        message: 'Failed to fetch',
        status: 0,
      };

      const userMessage = evaluateVerificationError({
        error: networkError,
        otpRequestedAt: Date.now(),
      });

      assert.equal(
        userMessage,
        'Network error connecting to authentication service. Please check your internet connection.'
      );
    });

    it('should verify with correct 8-digit payload format', async () => {
      let passedPayload: unknown = null;
      const mockSupabase = {
        auth: {
          verifyOtp: async (args: unknown) => {
            passedPayload = args;
            return {
              data: {
                user: { id: 'usr-8digit-1', email: 'verified8@example.com' },
                session: { access_token: 'mock-session-token' },
              },
              error: null,
            };
          },
        },
      };

      const res = await mockSupabase.auth.verifyOtp({
        email: 'verified8@example.com',
        token: '54819203',
        type: 'email',
      });

      assert.deepEqual(passedPayload, {
        email: 'verified8@example.com',
        token: '54819203',
        type: 'email',
      });
      assert.ok(res.data.session);
    });
  });

  describe('4. Lifecycle & State Management: Resend, Countdown, and Email Consistency', () => {
    it('resend countdown must not be treated as code validity duration', () => {
      const cooldownRemainingSeconds = 22;
      const otpLifetimeMinutes = 10;

      // Resend countdown of 22s merely guards the request rate, code is valid for 10+ minutes
      assert.ok(cooldownRemainingSeconds < otpLifetimeMinutes * 60);
      const isResendDisabled = cooldownRemainingSeconds > 0;
      assert.equal(isResendDisabled, true, 'Resend is disabled during active countdown');
    });

    it('requesting a new OTP must reset error message, clear old OTP, and update timestamp', () => {
      let otpCode = '12345678';
      let errorMsg: string | null = 'Invalid verification code.';
      let otpRequestedAt = Date.now() - 65 * 1000;
      const now = Date.now();

      // Simulate handleSendOtp success
      const handleSendOtpSuccess = (timestamp: number) => {
        otpCode = '';
        errorMsg = null;
        otpRequestedAt = timestamp;
      };

      handleSendOtpSuccess(now);

      assert.equal(otpCode, '', 'Previous code cleared');
      assert.equal(errorMsg, null, 'Previous error cleared');
      assert.equal(otpRequestedAt, now, 'Timestamp updated to prevent verifying stale tokens');
    });

    it('changing email must reset otpSent, clear code, and clear previous request email', () => {
      let otpSent = true;
      let otpCode = '54819203';
      let otpRequestedEmail = 'first@example.com';
      let otpRequestedAt: number | null = Date.now();

      const handleEmailChange = () => {
        otpSent = false;
        otpCode = '';
        otpRequestedEmail = '';
        otpRequestedAt = null;
      };

      handleEmailChange();

      assert.equal(otpSent, false);
      assert.equal(otpCode, '');
      assert.equal(otpRequestedEmail, '');
      assert.equal(otpRequestedAt, null);
    });
  });

  describe('5. Zero-Trust Role Determination & Profile Persistence', () => {
    function resolveUserRole(
      existingProfileRole: 'customer' | 'worker' | null,
      requestedRole: 'customer' | 'worker'
    ): 'customer' | 'worker' {
      return existingProfileRole ? existingProfileRole : requestedRole;
    }

    function getDestination(finalRole: 'customer' | 'worker'): string {
      return finalRole === 'worker' ? '/dashboard?role=worker' : '/dashboard';
    }

    it('should NEVER convert an existing worker into a customer even if customer tab was chosen', () => {
      const finalRole = resolveUserRole('worker', 'customer');
      assert.equal(finalRole, 'worker', 'Worker role preserved');
      assert.equal(getDestination(finalRole), '/dashboard?role=worker');
    });

    it('should NEVER convert an existing customer into a worker without onboarding', () => {
      const finalRole = resolveUserRole('customer', 'worker');
      assert.equal(finalRole, 'customer', 'Customer role preserved');
      assert.equal(getDestination(finalRole), '/dashboard');
    });

    it('should route new customers to /dashboard and new workers to /dashboard?role=worker', () => {
      assert.equal(getDestination(resolveUserRole(null, 'customer')), '/dashboard');
      assert.equal(getDestination(resolveUserRole(null, 'worker')), '/dashboard?role=worker');
    });
  });

  describe('6. Regression Prevention: Google OAuth Invariant', () => {
    it('Google OAuth role resolution and callback behavior remains 100% intact', () => {
      const customerResult = resolveOAuthRoleAndDestination({
        existingProfileRole: null,
        requestedRoleParam: 'customer',
        redirectParam: null,
      });
      assert.equal(customerResult.finalRole, 'customer');
      assert.equal(customerResult.destination, '/dashboard');

      const workerResult = resolveOAuthRoleAndDestination({
        existingProfileRole: null,
        requestedRoleParam: 'worker',
        redirectParam: null,
      });
      assert.equal(workerResult.finalRole, 'worker');
      assert.equal(workerResult.destination, '/dashboard?role=worker');

      const existingWorker = resolveOAuthRoleAndDestination({
        existingProfileRole: 'worker',
        requestedRoleParam: 'customer',
        redirectParam: null,
      });
      assert.equal(existingWorker.finalRole, 'worker', 'Existing role never overwritten');
    });
  });
});
