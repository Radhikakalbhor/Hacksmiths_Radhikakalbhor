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

export function validateOtpCode(code: string): boolean {
  // 4 to 6 digit numeric code
  return /^\d{4,6}$/.test(code.trim());
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
