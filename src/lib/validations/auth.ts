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

export function validateWorkerRegistration(input: {
  fullName: string;
  phone: string;
  primaryCategory: string;
  yearsExperience: number | string;
  bio?: string;
  email: string;
}): ValidationResult<{
  fullName: string;
  phone: string;
  primaryCategory: string;
  yearsExperience: number;
  bio: string;
  email: string;
}> {
  const errors: Record<string, string> = {};

  if (!input.fullName || input.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }

  if (!input.phone || !validateIndianPhoneNumber(input.phone)) {
    errors.phone = 'Please provide a valid 10-digit Indian mobile number.';
  }

  if (!input.primaryCategory || input.primaryCategory.trim().length === 0) {
    errors.primaryCategory = 'Please select a primary trade category.';
  }

  const expNum =
    typeof input.yearsExperience === 'number'
      ? input.yearsExperience
      : parseInt(String(input.yearsExperience || '0'), 10);
  if (isNaN(expNum) || expNum < 0 || expNum > 60) {
    errors.yearsExperience = 'Years of experience must be between 0 and 60.';
  }

  if (!input.bio || input.bio.trim().length < 5) {
    errors.bio = 'Please provide a brief bio or skills summary (at least 5 characters).';
  }

  if (!input.email || !validateEmail(input.email)) {
    errors.email = 'Please provide a valid email address.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      primaryCategory: input.primaryCategory.trim().toLowerCase(),
      yearsExperience: expNum,
      bio: input.bio ? input.bio.trim() : '',
      email: input.email.trim().toLowerCase(),
    },
  };
}
