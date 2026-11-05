/**
 * Sahayak Role Definitions & Permissions
 * Supports Customer, Worker, and Admin access levels.
 */

export type UserRole = 'customer' | 'worker' | 'admin' | 'ADMIN';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'suspended';

export interface UserProfile {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  primaryCity: string;
  isSuspended?: boolean;
  suspendedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfile extends UserProfile {
  role: 'customer';
  defaultPincode?: string;
  trustedContactsCount: number;
}

export interface WorkerProfile extends UserProfile {
  role: 'worker';
  primaryCategory: string;
  skills: string[];
  bio?: string;
  yearsExperience: number;
  serviceRadiusKm: number;
  hourlyRateInr?: number;
  fixedRateEstimateInr?: number;
  isAvailable: boolean;
  governmentIdVerified: boolean;
  backgroundCheckVerified: boolean;
  reputationScore: number; // 0.0 to 5.0
  totalCompletedJobs: number;
}

export interface AdminProfile extends UserProfile {
  role: 'admin' | 'ADMIN';
  permissions?: string[];
}
