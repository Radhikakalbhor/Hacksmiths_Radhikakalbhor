/**
 * Sahayak Bidding & Negotiation Types
 * Encapsulates worker bids, pricing breakdowns, counter-offers, and benchmark comparisons.
 */

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface PriceBreakdown {
  laborCostInr: number;
  estimatedMaterialCostInr?: number;
  visitationFeeInr: number;
  totalAmountInr: number;
}

export interface WorkerBid {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  workerAvatarUrl?: string;
  workerRating: number;
  workerDistanceKm: number;
  pricing: PriceBreakdown;
  note?: string;
  estimatedDurationHours?: number;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CounterOffer {
  id: string;
  bidId: string;
  jobId: string;
  proposedByRole: 'customer' | 'worker';
  proposedAmountInr: number;
  message?: string;
  isAccepted: boolean;
  createdAt: string;
}

export interface PriceBenchmark {
  category: string;
  city: string;
  microMarketArea: string;
  minPriceInr: number;
  medianPriceInr: number;
  maxPriceInr: number;
  sampleSize: number;
  currency: 'INR';
  lastCalculatedAt: string;
}
