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

    const rawCategory = categoryFilter ? categoryFilter.toLowerCase().trim() : null;
    let dbCategoryFilter: string | null = rawCategory;
    const isMaidSearch = rawCategory === 'maid' || rawCategory === 'house_help' || rawCategory === 'house help';
    const isOtherSearch = rawCategory === 'other' || rawCategory === 'custom';

    if (isMaidSearch) {
      dbCategoryFilter = 'cleaning';
    } else if (isOtherSearch) {
      dbCategoryFilter = null;
    }

    const { data, error } = await supabase.rpc('find_nearby_workers', {
      origin_lat: originLat,
      origin_lng: originLng,
      radius_meters: radiusMeters,
      category_filter: dbCategoryFilter,
      max_results: maxResults * 2,
    });

    if (error) {
      console.error('[WorkersService] Error querying nearby workers:', error.message);
      return [];
    }

    let results = (data as NearbyWorker[]) ?? [];

    if (isMaidSearch) {
      // Prioritize dedicated house help / maid specialists
      results = results.sort((a, b) => {
        const aIsMaid = Array.isArray(a.skills) && a.skills.some((s) => s.toLowerCase().includes('maid') || s.toLowerCase().includes('house help') || s.toLowerCase().includes('housekeeping'));
        const bIsMaid = Array.isArray(b.skills) && b.skills.some((s) => s.toLowerCase().includes('maid') || s.toLowerCase().includes('house help') || s.toLowerCase().includes('housekeeping'));
        if (aIsMaid && !bIsMaid) return -1;
        if (!aIsMaid && bIsMaid) return 1;
        return (a.distance_meters || 0) - (b.distance_meters || 0);
      });
    } else if (rawCategory === 'cleaning') {
      // Prioritize deep cleaning specialists
      results = results.sort((a, b) => {
        const aIsDeepClean = Array.isArray(a.skills) && a.skills.some((s) => s.toLowerCase().includes('deep') || s.toLowerCase().includes('degreasing') || s.toLowerCase().includes('scrubbing'));
        const bIsDeepClean = Array.isArray(b.skills) && b.skills.some((s) => s.toLowerCase().includes('deep') || s.toLowerCase().includes('degreasing') || s.toLowerCase().includes('scrubbing'));
        if (aIsDeepClean && !bIsDeepClean) return -1;
        if (!aIsDeepClean && bIsDeepClean) return 1;
        return (a.distance_meters || 0) - (b.distance_meters || 0);
      });
    } else if (isOtherSearch) {
      // Prioritize specialized custom / other / handyman services
      results = results.sort((a, b) => {
        const aIsOther = Array.isArray(a.skills) && a.skills.some((s) => s.toLowerCase().includes('other') || s.toLowerCase().includes('pest') || s.toLowerCase().includes('handyman') || s.toLowerCase().includes('pet'));
        const bIsOther = Array.isArray(b.skills) && b.skills.some((s) => s.toLowerCase().includes('other') || s.toLowerCase().includes('pest') || s.toLowerCase().includes('handyman') || s.toLowerCase().includes('pet'));
        if (aIsOther && !bIsOther) return -1;
        if (!aIsOther && bIsOther) return 1;
        return (a.distance_meters || 0) - (b.distance_meters || 0);
      });
    }

    return results.slice(0, maxResults);
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
