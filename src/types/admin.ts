/**
 * Sahayak Admin Panel Types & Data Interfaces
 * Strict TypeScript models for Dashboard, Moderation, Auditing, and Safety Console.
 */

export interface AdminKpiTrend {
  value: number;
  changePercentage: number;
  isPositive: boolean;
}

export interface AdminDashboardKpis {
  totalCustomers: AdminKpiTrend;
  totalWorkers: AdminKpiTrend;
  activeJobs: AdminKpiTrend;
  completedJobs: AdminKpiTrend;
  totalGmvInr: AdminKpiTrend;
  averageRating: AdminKpiTrend;
  pendingVerifications: AdminKpiTrend;
  openSosIncidents: AdminKpiTrend;
}

export interface DailyJobStat {
  date: string;
  posted: number;
  completed: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  color: string;
}

export interface AreaDemandStat {
  pincode: string;
  locality: string;
  jobCount: number;
}

export interface WorkerLeaderboardItem {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  primaryCategory: string;
  reputationScore: number;
  totalCompletedJobs: number;
  primaryCity: string;
}

export interface ActivityFeedItem {
  id: string;
  type: 'signup' | 'job' | 'dispute' | 'sos';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AnomalyAlert {
  id: string;
  type: 'PRICE_ANOMALY' | 'HIGH_CANCELLATION_WORKER' | 'CHRONIC_CANCELLER_CUSTOMER';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  targetId: string;
  targetType: 'job' | 'user' | 'bid';
  createdAt: string;
}

export interface AdminDashboardStats {
  kpis: AdminDashboardKpis;
  dailyStats: DailyJobStat[];
  categoryDistribution: CategoryDistribution[];
  statusDistribution: StatusDistribution[];
  topAreas: AreaDemandStat[];
  anomalies: AnomalyAlert[];
  leaderboard: WorkerLeaderboardItem[];
  recentActivity: ActivityFeedItem[];
  feed?: ActivityFeedItem[];
}

export interface VerificationDocument {
  id: string;
  workerId: string;
  workerName?: string;
  workerPhone?: string;
  workerCategory?: string;
  docType: 'AADHAAR' | 'PAN' | 'DRIVING_LICENSE' | 'POLICE_VERIFICATION' | 'TRADE_CERTIFICATE';
  fileUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface DisputeRecord {
  id: string;
  jobId: string;
  jobTitle?: string;
  raisedBy: string;
  raisedByName?: string;
  raisedByRole?: 'customer' | 'worker';
  againstUser: string;
  againstUserName?: string;
  reason: string;
  evidence: {
    notes?: string;
    files?: string[];
    jobStatus?: string;
    otpState?: string;
    amount?: number;
    [key: string]: unknown;
  };
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  resolution?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface SosIncidentRecord {
  id: string;
  jobId?: string | null;
  jobTitle?: string | null;
  triggeredBy: string;
  triggeredByName: string;
  triggeredByPhone: string;
  triggeredByRole: 'customer' | 'worker';
  otherPartyName?: string;
  otherPartyPhone?: string;
  severity: 'URGENT_EMERGENCY' | 'SAFETY_CHECK' | 'DISPUTE_ESCALATION';
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';
  locationPoint?: {
    lat: number;
    lng: number;
    address?: string;
  } | null;
  trustedContacts?: Array<{ name: string; phone: string; relationship?: string }>;
  notes: string | null;
  handledBy?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface ReviewFlagRecord {
  id: string;
  reviewId: string;
  workerId: string;
  workerName: string;
  customerId: string;
  customerName: string;
  rating: number;
  reviewComment: string;
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
  reviewedBy?: string | null;
  createdAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  adminEmail?: string;
  adminName?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MicroMarketPriceBenchmark {
  id: string;
  category: string;
  city: string;
  minPriceInr: number;
  typicalPriceInr: number;
  maxPriceInr: number;
  avgAcceptedBidInr?: number;
  updatedAt: string;
}

export interface SupportedCategoryArea {
  id: string;
  code: string;
  name: string;
  iconName: string;
  isEnabled: boolean;
  supportedCities: string[];
  supportedPincodes: string[];
  defaultRadiusKm: number;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'CUSTOMERS' | 'WORKERS' | 'CITY';
  city?: string | null;
  createdBy?: string;
  createdAt: string;
}

export interface AiJobLog {
  id: string;
  jobId?: string | null;
  inputType: 'text' | 'voice' | 'image';
  rawInput: string;
  generatedScope: {
    title?: string;
    category?: string;
    suggestedBudgetInr?: number;
    durationEstimate?: string;
    materialsRequired?: string[];
    [key: string]: unknown;
  };
  feedback: 'up' | 'down' | null;
  createdAt: string;
}
