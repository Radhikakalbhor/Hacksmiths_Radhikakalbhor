/**
 * Worker Wallet, Transactions, Payouts, and Notifications Types
 */

export type TransactionType =
  | 'JOB_PAYOUT'
  | 'COMMISSION_DEDUCTION'
  | 'PENALTY_DEDUCTION'
  | 'WITHDRAWAL'
  | 'REFUND'
  | 'ADJUSTMENT';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface WalletTransaction {
  id: string;
  walletId: string;
  workerId: string;
  jobId?: string | null;
  transactionType: TransactionType;
  amountInr: number;
  balanceAfterInr: number;
  status: TransactionStatus;
  description: string;
  referenceId?: string | null;
  createdAt: string;
}

export interface WorkerWallet {
  id: string;
  workerId: string;
  availableBalanceInr: number;
  pendingBalanceInr: number;
  totalEarnedInr: number;
  totalWithdrawnInr: number;
  totalDeductionsInr: number;
  createdAt: string;
  updatedAt: string;
}

export type PayoutMethodType = 'UPI' | 'BANK_ACCOUNT';

export interface WorkerPayoutMethod {
  id: string;
  workerId: string;
  methodType: PayoutMethodType;
  accountHolderName: string;
  upiId?: string | null;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  ifscCode?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';

export interface WithdrawalRequest {
  id: string;
  workerId: string;
  walletId: string;
  amountInr: number;
  payoutMethodType: PayoutMethodType;
  payoutDetails: Record<string, unknown>;
  status: WithdrawalStatus;
  adminNotes?: string | null;
  payoutReference?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type JobPaymentStatus =
  | 'HELD_IN_ESCROW'
  | 'PENDING_RELEASE'
  | 'RELEASED_TO_WALLET'
  | 'REFUNDED'
  | 'DISPUTED';

export interface JobPayment {
  id: string;
  jobId: string;
  customerId: string;
  workerId: string;
  grossAmountInr: number;
  commissionRatePercent: number;
  commissionAmountInr: number;
  workerNetEarningInr: number;
  paymentStatus: JobPaymentStatus;
  releasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkerNotificationType =
  | 'NEW_OFFER'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'UPCOMING_REMINDER'
  | 'COMPLETION_CONFIRMED'
  | 'PAYMENT_CREDITED'
  | 'WITHDRAWAL_STATUS'
  | 'SYSTEM';

export interface WorkerNotification {
  id: string;
  workerId: string;
  type: WorkerNotificationType;
  title: string;
  message: string;
  jobId?: string | null;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformSettings {
  commissionRatePercent: number;
  cancellationTimeLimitMinutes: number;
  cancellationPolicy: {
    maxFreeCancellations: number;
    penaltyInr: number;
  };
}

export interface JobEarningsBreakdown {
  jobId: string;
  jobTitle: string;
  customerName?: string;
  completedAt?: string;
  grossAmountInr: number;
  commissionRatePercent: number;
  commissionAmountInr: number;
  approvedDeductionsInr: number;
  workerNetEarningInr: number;
  paymentStatus: JobPaymentStatus;
  releasedAt?: string | null;
}

export type WorkerJobCategory = 'upcoming' | 'pending' | 'accepted' | 'rejected';

