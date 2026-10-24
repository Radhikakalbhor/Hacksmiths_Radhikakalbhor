/**
 * Auth & Onboarding Validation Schemas
 * Standardized validation for phone numbers, OTP codes, and profile details.
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export function validateIndianPhoneNumber(phone: string): boolean {
  // Indian 10-digit mobile number format (optionally prefixed with +91, 91, or 0)
  const cleaned = phone.replace(/[\s\-()]/g, '');
  const indianPhoneRegex = /^(?:(?:\+91|91|0))?[6-9]\d{9}$/;
  return indianPhoneRegex.test(cleaned);
}

export function validateEmail(email: string): boolean {
  // Standard RFC-compliant email format check
  const cleaned = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned);
}

export function validateNumericOtp(code: string, expectedLength: number = 8): boolean {
  // Validates exact configured numeric digit length (8 digits by default for this Supabase project, or 6 if configured)
  const cleaned = code.trim();
  if (expectedLength === 8) {
    return /^\d{8}$/.test(cleaned);
  }
  if (expectedLength === 6) {
    return /^\d{6}$/.test(cleaned);
  }
  return /^(?:\d{6}|\d{8})$/.test(cleaned);
}

export function validateEmailOtpCode(code: string): boolean {
  // Validates that the OTP code is a valid complete Supabase numeric token (6 or 8 digits)
  return /^(?:\d{6}|\d{8})$/.test(code.trim());
}

export function validateOtpCode(code: string): boolean {
  // 4 to 8 digit numeric code for general backward compatibility
  return /^\d{4,8}$/.test(code.trim());
}

export function validateCustomerSignup(input: {
  fullName: string;
  phone: string;
  city: string;
}): ValidationResult<typeof input> {
  const errors: Record<string, string> = {};

  if (!input.fullName || input.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }

  if (!input.phone || !validateIndianPhoneNumber(input.phone)) {
    errors.phone = 'Please provide a valid 10-digit Indian mobile number.';
  }

  if (!input.city || input.city.trim().length < 2) {
    errors.city = 'Please specify your primary city or town.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}
