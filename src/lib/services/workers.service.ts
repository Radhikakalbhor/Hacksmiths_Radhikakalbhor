/**
 * Workers Service
 * Server-side service orchestrating worker discovery, PostGIS queries, and reputation calculations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { WorkerProfile } from '@/types/roles';
import { ReputationPassport } from '@/types/reputation';

export type NearbyWorker =
  Database['public']['Functions']['find_nearby_workers']['Returns'][number];

export interface NearbyWorkerQueryOptions {
  originLat: number;
  originLng: number;
  radiusMeters?: number;
  categoryFilter?: string | null;
  maxResults?: number;
}

export class WorkersService {
  /**
   * Executes PostGIS spatial search via the find_nearby_workers database function.
   */
  static async queryNearbyWorkers(
    supabase: SupabaseClient<Database>,
    options: NearbyWorkerQueryOptions
  ): Promise<NearbyWorker[]> {
    const { originLat, originLng, radiusMeters = 10000, categoryFilter = null, maxResults = 20 } =
      options;

    const { data, error } = await supabase.rpc('find_nearby_workers', {
      origin_lat: originLat,
      origin_lng: originLng,
      radius_meters: radiusMeters,
      category_filter: categoryFilter,
      max_results: maxResults,
    });

    if (error) {
      console.error('[WorkersService] Error querying nearby workers:', error.message);
      return [];
    }

    return (data as NearbyWorker[]) ?? [];
  }

  /**
   * Calculates overall tier based on completed jobs and rating.
   */
  static calculateReputationTier(
    rating: number,
    completedJobs: number
  ): ReputationPassport['tier'] {
    if (completedJobs >= 50 && rating >= 4.8) return 'SAHAYAK_MASTER';
    if (completedJobs >= 25 && rating >= 4.5) return 'GOLD';
    if (completedJobs >= 10 && rating >= 4.0) return 'SILVER';
    return 'BRONZE';
  }

  /**
   * Haversine distance calculator for offline / fallback checks.
   */
  static isWithinServiceRadius(
    workerLocation: { lat: number; lng: number },
    jobLocation: { lat: number; lng: number },
    radiusKm: number
  ): boolean {
    const earthRadiusKm = 6371;
    const dLat = ((jobLocation.lat - workerLocation.lat) * Math.PI) / 180;
    const dLng = ((jobLocation.lng - workerLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((workerLocation.lat * Math.PI) / 180) *
        Math.cos((jobLocation.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadiusKm * c;
    return distance <= radiusKm;
  }

  /**
   * Assesses whether a worker has achieved necessary verification and reputation for emergency bookings.
   */
  static isWorkerEligibleForEmergencyJobs(worker: WorkerProfile): boolean {
    return (
      worker.governmentIdVerified &&
      worker.backgroundCheckVerified &&
      worker.reputationScore >= 4.5 &&
      worker.totalCompletedJobs >= 5
    );
  }
}
