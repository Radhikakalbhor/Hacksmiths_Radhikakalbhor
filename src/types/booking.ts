/**
 * Booking Lifecycle, OTP, and Travel Estimation Types
 */

export type BookingStage =
  | 'requested'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface BookingState {
  stage: BookingStage;
  stageUpdatedAt: string;
  workerId: string;
  workerName: string;
  workerCategory: string;
  workerRating: number;
  workerExperience: number;
  workerAvatarUrl?: string | null;
  workerPhone?: string | null;
  isDemoWorker: boolean;
  agreedPriceInr: number;
  estimatedArrivalMinutes?: number;
  simulatedSecondsRemaining?: number;
  currentWorkerCoords?: { lat: number; lng: number } | null;
  customerOtp?: string;
  otpVerified: boolean;
  verifiedAt?: string | null;
  cancellationReason?: string | null;
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  senderRole: 'customer' | 'worker' | 'system';
  senderName: string;
  text: string;
  createdAt: string;
  isRead?: boolean;
}

export const VALID_BOOKING_TRANSITIONS: Record<BookingStage, readonly BookingStage[]> = {
  requested: ['accepted', 'cancelled'],
  accepted: ['on_the_way', 'cancelled'],
  on_the_way: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
} as const;

export function canTransitionBooking(from: BookingStage, to: BookingStage): boolean {
  return VALID_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Calculates realistic travel time (in minutes) based on geodesic distance in meters
 * and average urban city speed (default: 20 km/h in dense Indian metros).
 */
export function calculateEstimatedTravelTimeMinutes(
  distanceMeters: number,
  averageSpeedKmH = 20
): { minutes: number; distanceKm: string; label: string } {
  const distanceKm = distanceMeters / 1000;
  // Base time = (distance / speed) * 60 + 5 minutes buffer for parking / traffic signals
  const rawMinutes = Math.round((distanceKm / averageSpeedKmH) * 60 + 5);
  const minutes = Math.max(5, Math.min(120, rawMinutes));
  return {
    minutes,
    distanceKm: distanceKm.toFixed(1),
    label: `${minutes} mins (${distanceKm.toFixed(1)} km)`,
  };
}
