/**
 * Admin Panel Input Validation Schemas
 * Type-safe verification, moderation, dispute resolution, and benchmark rules.
 */

import { ValidationResult } from './auth';

export interface WorkerVerificationInput {
  workerId: string;
  decision: 'APPROVE' | 'REJECT' | 'NEEDS_INFO';
  reason?: string;
  documentIds?: string[];
}

export function validateWorkerVerification(
  input: WorkerVerificationInput
): ValidationResult<WorkerVerificationInput> {
  const errors: Record<string, string> = {};

  if (!input.workerId || input.workerId.trim().length === 0) {
    errors.workerId = 'Worker ID is required.';
  }

  if (!['APPROVE', 'REJECT', 'NEEDS_INFO'].includes(input.decision)) {
    errors.decision = 'Invalid verification decision. Must be APPROVE, REJECT, or NEEDS_INFO.';
  }

  if (input.decision !== 'APPROVE' && (!input.reason || input.reason.trim().length < 5)) {
    errors.reason = 'A detailed reason (at least 5 characters) is required when rejecting or requesting info.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface UserModerationInput {
  userId: string;
  action: 'SUSPEND' | 'REACTIVATE' | 'BAN';
  reason: string;
}

export function validateUserModeration(
  input: UserModerationInput
): ValidationResult<UserModerationInput> {
  const errors: Record<string, string> = {};

  if (!input.userId || input.userId.trim().length === 0) {
    errors.userId = 'User ID is required.';
  }

  if (!['SUSPEND', 'REACTIVATE', 'BAN'].includes(input.action)) {
    errors.action = 'Invalid moderation action. Must be SUSPEND, REACTIVATE, or BAN.';
  }

  if (!input.reason || input.reason.trim().length < 5) {
    errors.reason = 'An audit reason of at least 5 characters is strictly required.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface JobModerationInput {
  jobId: string;
  action: 'FORCE_CANCEL' | 'FLAG';
  reason: string;
}

export function validateJobModeration(
  input: JobModerationInput
): ValidationResult<JobModerationInput> {
  const errors: Record<string, string> = {};

  if (!input.jobId || input.jobId.trim().length === 0) {
    errors.jobId = 'Job ID is required.';
  }

  if (!['FORCE_CANCEL', 'FLAG'].includes(input.action)) {
    errors.action = 'Invalid job action. Must be FORCE_CANCEL or FLAG.';
  }

  if (!input.reason || input.reason.trim().length < 5) {
    errors.reason = 'An audit reason of at least 5 characters is required.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface DisputeResolutionInput {
  disputeId: string;
  resolutionType: 'REFUND' | 'WARN' | 'SUSPEND' | 'DISMISS';
  resolutionNotes: string;
}

export function validateDisputeResolution(
  input: DisputeResolutionInput
): ValidationResult<DisputeResolutionInput> {
  const errors: Record<string, string> = {};

  if (!input.disputeId || input.disputeId.trim().length === 0) {
    errors.disputeId = 'Dispute ID is required.';
  }

  if (!['REFUND', 'WARN', 'SUSPEND', 'DISMISS'].includes(input.resolutionType)) {
    errors.resolutionType = 'Invalid resolution type. Must be REFUND, WARN, SUSPEND, or DISMISS.';
  }

  if (!input.resolutionNotes || input.resolutionNotes.trim().length < 10) {
    errors.resolutionNotes = 'A comprehensive written resolution note (at least 10 characters) is required.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface PriceBenchmarkInput {
  id?: string;
  category: string;
  city: string;
  minPriceInr: number;
  typicalPriceInr: number;
  maxPriceInr: number;
}

export function validatePriceBenchmark(
  input: PriceBenchmarkInput
): ValidationResult<PriceBenchmarkInput> {
  const errors: Record<string, string> = {};

  if (!input.category || input.category.trim().length === 0) {
    errors.category = 'Service category is required.';
  }

  if (!input.city || input.city.trim().length === 0) {
    errors.city = 'City is required.';
  }

  if (typeof input.minPriceInr !== 'number' || input.minPriceInr <= 0) {
    errors.minPriceInr = 'Minimum price must be greater than zero.';
  }

  if (typeof input.typicalPriceInr !== 'number' || input.typicalPriceInr <= 0) {
    errors.typicalPriceInr = 'Typical price must be greater than zero.';
  }

  if (typeof input.maxPriceInr !== 'number' || input.maxPriceInr <= 0) {
    errors.maxPriceInr = 'Maximum price must be greater than zero.';
  }

  if (input.minPriceInr > input.typicalPriceInr) {
    errors.typicalPriceInr = 'Typical price cannot be lower than minimum price.';
  }

  if (input.typicalPriceInr > input.maxPriceInr) {
    errors.maxPriceInr = 'Maximum price cannot be lower than typical price.';
  }

  if (input.minPriceInr > input.maxPriceInr) {
    errors.priceRange = 'Minimum price cannot exceed maximum price.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: 'ALL' | 'CUSTOMERS' | 'WORKERS' | 'CITY';
  city?: string;
}

export function validateAnnouncement(
  input: AnnouncementInput
): ValidationResult<AnnouncementInput> {
  const errors: Record<string, string> = {};

  if (!input.title || input.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters.';
  }

  if (!input.body || input.body.trim().length < 5) {
    errors.body = 'Announcement body must be at least 5 characters.';
  }

  if (!['ALL', 'CUSTOMERS', 'WORKERS', 'CITY'].includes(input.audience)) {
    errors.audience = 'Audience must be ALL, CUSTOMERS, WORKERS, or CITY.';
  }

  if (input.audience === 'CITY' && (!input.city || input.city.trim().length < 2)) {
    errors.city = 'City name is required when audience is set to CITY.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

export interface SosActionInput {
  incidentId: string;
  action: 'ACKNOWLEDGE' | 'ESCALATE' | 'RESOLVE';
  notes?: string;
}

export function validateSosAction(
  input: SosActionInput
): ValidationResult<SosActionInput> {
  const errors: Record<string, string> = {};

  if (!input.incidentId || input.incidentId.trim().length === 0) {
    errors.incidentId = 'Incident ID is required.';
  }

  if (!['ACKNOWLEDGE', 'ESCALATE', 'RESOLVE'].includes(input.action)) {
    errors.action = 'Action must be ACKNOWLEDGE, ESCALATE, or RESOLVE.';
  }

  if (input.action === 'RESOLVE' && (!input.notes || input.notes.trim().length < 5)) {
    errors.notes = 'Resolution notes of at least 5 characters are required.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}

