/**
 * Job Posting & Bidding Validation Schemas
 * Type-safe input validation for service requests, bids, and counter-offers.
 */

import { ServiceCategory, JobUrgency } from '@/types/jobs';
import { ValidationResult } from './auth';

const VALID_CATEGORIES: ServiceCategory[] = [
  'plumbing',
  'electrical',
  'cleaning',
  'painting',
  'maid',
  'cooking',
  'carpentry',
  'appliance_repair',
];

export interface CreateJobInput {
  category: ServiceCategory;
  customCategoryName?: string;
  title: string;
  description?: string;
  urgency: JobUrgency;
  latitude: number;
  longitude: number;
  addressLine: string;
  landmark?: string;
  city: string;
  pincode: string;
  estimatedBudgetInr?: number;
  estimatedMinPriceInr?: number;
  estimatedMaxPriceInr?: number;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  photoUrls?: string[];
}

const VALID_URGENCIES: JobUrgency[] = ['standard', 'same_day', 'urgent', 'emergency'];

export function validateCreateJob(input: CreateJobInput): ValidationResult<CreateJobInput> {
  const errors: Record<string, string> = {};

  const isPredefined = VALID_CATEGORIES.includes(input.category as (typeof VALID_CATEGORIES)[number]);
  const isOther = input.category === 'other' || input.category === 'custom';

  if (!isPredefined && !isOther) {
    errors.category = 'Invalid service category selected.';
  }

  if (input.urgency && !VALID_URGENCIES.includes(input.urgency)) {
    errors.urgency = 'Invalid urgency level selected.';
  }

  if (isOther && (!input.customCategoryName || input.customCategoryName.trim().length < 2)) {
    errors.customCategoryName = 'Please specify the custom service name (at least 2 characters).';
  }

  if (!input.title || input.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters.';
  }

  // Description is optional; if provided, must not be just whitespace
  if (input.description !== undefined && input.description.length > 0 && input.description.trim().length === 0) {
    errors.description = 'Description cannot be only whitespace.';
  }

  if (typeof input.latitude !== 'number' || input.latitude < 6 || input.latitude > 38) {
    errors.latitude = 'Latitude must be within valid geographic bounds for India.';
  }

  if (typeof input.longitude !== 'number' || input.longitude < 68 || input.longitude > 98) {
    errors.longitude = 'Longitude must be within valid geographic bounds for India.';
  }

  if (!input.addressLine || input.addressLine.trim().length < 5) {
    errors.addressLine = 'Street address is required.';
  }

  if (!/^\d{6}$/.test(input.pincode?.trim() ?? '')) {
    errors.pincode = 'Pincode must be a 6-digit Indian postal code.';
  }

  if (input.estimatedBudgetInr !== undefined && input.estimatedBudgetInr <= 0) {
    errors.estimatedBudgetInr = 'Budget must be greater than zero.';
  }

  if (input.estimatedMinPriceInr !== undefined && input.estimatedMinPriceInr < 0) {
    errors.estimatedMinPriceInr = 'Minimum price cannot be negative.';
  }

  if (
    input.estimatedMinPriceInr !== undefined &&
    input.estimatedMaxPriceInr !== undefined &&
    input.estimatedMaxPriceInr < input.estimatedMinPriceInr
  ) {
    errors.estimatedMaxPriceInr = 'Maximum price cannot be less than minimum price.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface CreateBidInput {
  jobId: string;
  workerId: string;
  offeredAmountInr: number;
  laborCostInr: number;
  materialsEstimateInr?: number;
  visitationFeeInr?: number;
  note?: string;
}

export function validateCreateBid(input: CreateBidInput): ValidationResult<CreateBidInput> {
  const errors: Record<string, string> = {};

  if (!input.jobId || input.jobId.trim().length === 0) {
    errors.jobId = 'Target Job ID is required.';
  }

  if (!input.workerId || input.workerId.trim().length === 0) {
    errors.workerId = 'Worker ID is required.';
  }

  if (typeof input.offeredAmountInr !== 'number' || input.offeredAmountInr <= 0) {
    errors.offeredAmountInr = 'Total offered amount must be greater than zero.';
  }

  if (typeof input.laborCostInr !== 'number' || input.laborCostInr < 0) {
    errors.laborCostInr = 'Labor cost must be zero or positive.';
  }

  if (input.materialsEstimateInr !== undefined && input.materialsEstimateInr < 0) {
    errors.materialsEstimateInr = 'Materials estimate cannot be negative.';
  }

  if (input.visitationFeeInr !== undefined && input.visitationFeeInr < 0) {
    errors.visitationFeeInr = 'Visitation fee cannot be negative.';
  }

  if (input.note && input.note.length > 500) {
    errors.note = 'Note must not exceed 500 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface CounterOfferInput {
  bidId: string;
  proposedByRole: 'customer' | 'worker';
  proposedAmountInr: number;
  message?: string;
}

export function validateCounterOffer(
  input: CounterOfferInput
): ValidationResult<CounterOfferInput> {
  const errors: Record<string, string> = {};

  if (!input.bidId) {
    errors.bidId = 'Bid ID is required.';
  }

  if (!['customer', 'worker'].includes(input.proposedByRole)) {
    errors.proposedByRole = 'Role must be customer or worker.';
  }

  if (typeof input.proposedAmountInr !== 'number' || input.proposedAmountInr <= 0) {
    errors.proposedAmountInr = 'Counter-offer amount must be greater than zero.';
  }

  if (input.message && input.message.length > 300) {
    errors.message = 'Counter-offer message must not exceed 300 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}
