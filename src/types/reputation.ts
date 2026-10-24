/**
 * Sahayak Worker Reputation Passport
 * Portable trust credentials, verified skills, and on-time performance metrics.
 */

export interface SkillBadge {
  id: string;
  category: string;
  badgeName: string;
  issuer: 'Sahayak_Verified' | 'Trade_Guild' | 'Customer_Endorsed';
  awardedAt: string;
  verificationEvidenceUrl?: string;
}

export interface WorkerReview {
  id: string;
  jobId: string;
  workerId: string;
  customerId: string;
  customerName: string;
  rating: number; // 1 to 5
  punctualityScore: number; // 1 to 5
  workmanshipScore: number; // 1 to 5
  cleanlinessScore: number; // 1 to 5
  reviewText?: string;
  createdAt: string;
}

export interface ReputationPassport {
  workerId: string;
  overallRating: number;
  totalRatingsCount: number;
  completionRatePercentage: number;
  onTimeArrivalPercentage: number;
  disputeFreeJobsRatio: number;
  verifiedBadges: SkillBadge[];
  verifiedKyc: boolean;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'SAHAYAK_MASTER';
  memberSince: string;
}
