/**
 * Worker Profile & Onboarding Validations
 */

import { ValidationResult } from './auth';

export interface WorkerOnboardingInput {
  primaryCategory: string;
  skills: string[];
  yearsExperience: number;
  serviceRadiusKm: number;
  hourlyRateInr?: number;
}

export function validateWorkerOnboarding(
  input: WorkerOnboardingInput
): ValidationResult<WorkerOnboardingInput> {
  const errors: Record<string, string> = {};

  if (!input.primaryCategory) {
    errors.primaryCategory = 'Primary trade/skill category is required.';
  }

  if (!Array.isArray(input.skills) || input.skills.length === 0) {
    errors.skills = 'Select at least one skill capability.';
  }

  if (input.yearsExperience < 0 || input.yearsExperience > 60) {
    errors.yearsExperience = 'Years of experience must be between 0 and 60.';
  }

  if (input.serviceRadiusKm < 1 || input.serviceRadiusKm > 50) {
    errors.serviceRadiusKm = 'Service radius must be between 1 km and 50 km.';
  }

  if (input.hourlyRateInr !== undefined && input.hourlyRateInr < 50) {
    errors.hourlyRateInr = 'Minimum hourly rate benchmark starts at ₹50.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}
