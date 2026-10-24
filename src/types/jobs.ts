/**
 * Sahayak Job & Service Specifications
 * Strict typing for job postings, statuses, and life-cycle transitions.
 */

export type ServiceCategory =
  | 'plumbing'
  | 'electrical'
  | 'cleaning'
  | 'painting'
  | 'maid'
  | 'cooking'
  | 'carpentry'
  | 'appliance_repair';

export type JobStatus =
  | 'DRAFT'
  | 'POSTED'
  | 'BIDDING_OPEN'
  | 'ASSIGNED'
  | 'OTP_START_VERIFIED'
  | 'IN_PROGRESS'
  | 'OTP_COMPLETION_VERIFIED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type JobUrgency = 'standard' | 'same_day' | 'emergency';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  addressLine: string;
  landmark?: string;
  city: string;
  pincode: string;
}

export interface JobAttachment {
  id: string;
  type: 'image' | 'audio_voice_note';
  url: string;
  transcription?: string; // AI voice note transcription
  mimeType: string;
  sizeBytes: number;
}

export interface JobPost {
  id: string;
  customerId: string;
  category: ServiceCategory;
  title: string;
  description: string;
  urgency: JobUrgency;
  location: GeoLocation;
  estimatedBudgetInr?: number;
  benchmarkPriceInr?: number;
  status: JobStatus;
  selectedWorkerId?: string;
  acceptedBidId?: string;
  attachments: JobAttachment[];
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Valid state transitions for a Job's life cycle.
 */
export const VALID_JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  DRAFT: ['POSTED', 'CANCELLED'],
  POSTED: ['BIDDING_OPEN', 'CANCELLED'],
  BIDDING_OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['OTP_START_VERIFIED', 'CANCELLED', 'DISPUTED'],
  OTP_START_VERIFIED: ['IN_PROGRESS'],
  IN_PROGRESS: ['OTP_COMPLETION_VERIFIED', 'DISPUTED'],
  OTP_COMPLETION_VERIFIED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
} as const;

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return VALID_JOB_TRANSITIONS[from]?.includes(to) ?? false;
}
