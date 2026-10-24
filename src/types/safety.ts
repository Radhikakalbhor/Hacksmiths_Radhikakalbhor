/**
 * Sahayak Trust & Safety Protocols
 * Types for OTP verification, emergency SOS alerts, and trusted contacts.
 */

export type OtpType = 'JOB_START' | 'JOB_COMPLETION';

export interface OtpVerificationRecord {
  id: string;
  jobId: string;
  otpType: OtpType;
  generatedForRole: 'customer';
  isVerified: boolean;
  verifiedAt?: string;
  expiresAt: string;
}

export type SosAlertSeverity = 'URGENT_EMERGENCY' | 'SAFETY_CHECK' | 'DISPUTE_ESCALATION';

export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  notifyOnJobStart: boolean;
  notifyOnSos: boolean;
  createdAt: string;
}

export interface SosEvent {
  id: string;
  triggeredByUserId: string;
  jobId?: string;
  severity: SosAlertSeverity;
  currentLatitude?: number;
  currentLongitude?: number;
  audioRecordingUrl?: string;
  status: 'TRIGGERED' | 'DISPATCHED' | 'RESOLVED' | 'FALSE_ALARM';
  resolvedNotes?: string;
  createdAt: string;
}
