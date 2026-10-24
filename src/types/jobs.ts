/**
 * Sahayak Job & Service Specifications
 * Strict typing for job postings, statuses, and life-cycle transitions.
 */

export type PredefinedServiceCategory =
  | 'plumbing'
  | 'electrical'
  | 'cleaning'
  | 'painting'
  | 'maid'
  | 'cooking'
  | 'carpentry'
  | 'appliance_repair';

export type ServiceCategory = PredefinedServiceCategory | 'other' | (string & {});

export type JobStatus =
  | 'draft'
  | 'posted'
  | 'bidding_open'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed'
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

export type JobUrgency = 'standard' | 'same_day' | 'urgent' | 'emergency';

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
  customCategoryName?: string;
  title: string;
  description?: string;
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
  draft: ['posted', 'cancelled', 'POSTED', 'CANCELLED'],
  posted: ['bidding_open', 'cancelled', 'assigned', 'BIDDING_OPEN', 'CANCELLED', 'ASSIGNED'],
  bidding_open: ['assigned', 'cancelled', 'ASSIGNED', 'CANCELLED'],
  assigned: ['in_progress', 'cancelled', 'disputed', 'IN_PROGRESS', 'CANCELLED', 'DISPUTED', 'OTP_START_VERIFIED'],
  in_progress: ['completed', 'disputed', 'COMPLETED', 'DISPUTED'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled', 'COMPLETED', 'CANCELLED'],
  DRAFT: ['POSTED', 'CANCELLED'],
  POSTED: ['BIDDING_OPEN', 'CANCELLED', 'ASSIGNED', 'assigned'],
  BIDDING_OPEN: ['ASSIGNED', 'CANCELLED', 'assigned'],
  ASSIGNED: ['OTP_START_VERIFIED', 'CANCELLED', 'DISPUTED', 'IN_PROGRESS', 'in_progress'],
  OTP_START_VERIFIED: ['IN_PROGRESS'],
  IN_PROGRESS: ['OTP_COMPLETION_VERIFIED', 'DISPUTED', 'COMPLETED', 'completed'],
  OTP_COMPLETION_VERIFIED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return (VALID_JOB_TRANSITIONS[from] as readonly JobStatus[] | undefined)?.includes(to) ?? false;
}
