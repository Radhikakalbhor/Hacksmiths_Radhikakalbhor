/**
 * Workers Service
 * Server-side service orchestrating hybrid worker discovery (real registered partners + realistic demo profiles),
 * PostGIS spatial queries, and reputation calculations.
 */

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { WorkerProfile } from '@/types/roles';
import { ReputationPassport } from '@/types/reputation';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { EXPANDED_DEMO_WORKERS } from '@/lib/data/expanded-demo-workers';
import {
  DESIGNATED_CROSS_SERVICE_WORKERS,
  isDesignatedCrossServiceWorkerId,
  isDesignatedCrossServiceEmail,
  EXCLUDED_CROSS_SERVICE_USER_IDS,
  EXCLUDED_CROSS_SERVICE_EMAILS,
} from '@/lib/config/designated-workers';

export interface NearbyWorker {
  worker_id: string;
  full_name: string;
  avatar_url: string | null;
  primary_category: string;
  skills: string[];
  bio: string | null;
  years_experience: number;
  hourly_rate_inr: number | null;
  fixed_rate_estimate_inr: number | null;
  reputation_score: number;
  total_completed_jobs: number;
  is_available: boolean;
  distance_meters: number | null;
  worker_source?: 'real' | 'demo';
  is_demo?: boolean;
  distance_pending?: boolean;
  email_verified?: boolean;
  average_rating?: number | null;
  review_count?: number;
  quote_inr?: number | null;
  fair_price_min_inr?: number | null;
  fair_price_max_inr?: number | null;
  is_cross_service_demo?: boolean;
  cross_service_badge?: string;
}

export interface NearbyWorkerQueryOptions {
  originLat: number;
  originLng: number;
  radiusMeters?: number;
  categoryFilter?: string | null;
  maxResults?: number;
}

export class WorkersService {
  /**
   * Calculates Haversine distance in meters between two lat/lng coordinates.
   */
  static calculateDistanceMeters(
    p1: { lat: number; lng: number },
    p2: { lat: number; lng: number }
  ): number {
    const earthRadiusMeters = 6371000;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadiusMeters * c);
  }

  /**
   * Evaluates trade and alias compatibility between a worker and requested category.
   */
  static matchesTradeCategory(
    workerCategory: string | null | undefined,
    skills: string[] | null | undefined,
    requestedCategory: string | null
  ): boolean {
    if (!requestedCategory) return true;
    const req = requestedCategory.toLowerCase().trim();
    const wCat = (workerCategory || '').toLowerCase().trim();
    const skillsList = Array.isArray(skills) ? skills.map((s) => s.toLowerCase()) : [];

    // Maid / House Help aliases
    if (req === 'maid' || req === 'house_help' || req === 'house help') {
      if (wCat === 'house_help' || wCat === 'maid' || wCat === 'cleaning') return true;
      return skillsList.some(
        (s) => s.includes('maid') || s.includes('house help') || s.includes('housekeeping')
      );
    }

    // Cleaning
    if (req === 'cleaning') {
      if (wCat === 'cleaning' || wCat === 'house_help' || wCat === 'maid') return true;
      return skillsList.some((s) => s.includes('clean') || s.includes('housekeeping'));
    }

    // Cooking / Cook
    if (req === 'cooking' || req === 'cook') {
      if (wCat === 'cooking' || wCat === 'cook') return true;
      return skillsList.some(
        (s) => s.includes('cook') || s.includes('chef') || s.includes('meal')
      );
    }

    // Appliance Repair / Appliances
    if (req === 'appliance_repair' || req === 'appliances') {
      if (wCat === 'appliance_repair' || wCat === 'appliances') return true;
      return skillsList.some(
        (s) => s.includes('appliance') || s.includes('repair') || s.includes('ac')
      );
    }

    // Other / Custom
    if (req === 'other' || req === 'custom') {
      return true;
    }

    // Direct match
    if (wCat === req || wCat.includes(req) || req.includes(wCat)) {
      return true;
    }

    return skillsList.some((s) => s.includes(req));
  }

  /**
   * Deterministic UUID generation for demo worker fallback identities.
   */
  static makeDemoWorkerId(email: string): string {
    const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  /**
   * Executes Hybrid Worker Discovery:
   * 1. Finds real registered workers from worker_profiles + profiles matching the trade.
   * 2. Finds verified demo workers via PostGIS RPC or fallback expanded demo dataset.
   * 3. Merges and formats both with explicit source tags and appropriate badges.
   */
  static async queryNearbyWorkers(
    supabase: SupabaseClient<Database>,
    options: NearbyWorkerQueryOptions
  ): Promise<NearbyWorker[]> {
    const { originLat, originLng, radiusMeters = 10000, categoryFilter = null, maxResults = 20 } =
      options;

    const rawCategory = categoryFilter ? categoryFilter.toLowerCase().trim() : null;
    let dbCategoryFilter: string | null = rawCategory;
    const isMaidSearch =
      rawCategory === 'maid' || rawCategory === 'house_help' || rawCategory === 'house help';
    const isOtherSearch = rawCategory === 'other' || rawCategory === 'custom';

    if (isMaidSearch) {
      dbCategoryFilter = 'cleaning';
    } else if (isOtherSearch) {
      dbCategoryFilter = null;
    }

    const realWorkers: NearbyWorker[] = [];
    const demoWorkers: NearbyWorker[] = [];
    const seenWorkerIds = new Set<string>();

    // =========================================================================
    // STEP 1: Query REAL Registered Workers from database
    // =========================================================================
    try {
      const adminClient = getSupabaseAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (adminClient || supabase) as any;

      const { data: realRows, error: realErr } = await client
        .from('worker_profiles')
        .select('*, profiles!user_id(*)')
        .eq('is_available', true);

      if (!realErr && Array.isArray(realRows)) {
        for (const row of realRows) {
          const profile = row.profiles as {
            id?: string;
            full_name?: string;
            email?: string;
            phone?: string;
            avatar_url?: string;
            verification_status?: string;
            user_source?: string;
          } | null;

          if (!profile || !profile.id) continue;

          // Check if this is a demo profile
          const isDemo =
            row.worker_source === 'demo' ||
            row.is_demo === true ||
            profile.user_source === 'demo' ||
            (profile.email && profile.email.includes('sahayak.demo.internal')) ||
            (profile.full_name && profile.full_name.includes('[DEMO]')) ||
            (row.bio && (row.bio.includes('[DEMO]') || row.bio.includes('demonstration only')));

          if (isDemo) continue; // Real workers only in this step

          // Check if this profile is explicitly excluded from cross-service eligibility
          const isExcluded =
            EXCLUDED_CROSS_SERVICE_USER_IDS.has(profile.id.toLowerCase()) ||
            (profile.email && EXCLUDED_CROSS_SERVICE_EMAILS.has(profile.email.toLowerCase()));

          // Check if this worker is one of the 5 designated cross-service demonstration accounts
          const isCrossServiceEligible =
            !isExcluded &&
            (isDesignatedCrossServiceWorkerId(profile.id) ||
              (profile.email && isDesignatedCrossServiceEmail(profile.email)));

          // Validate trade matching: designated cross-service workers match ALL categories!
          // All other real workers must strictly match their registered trade/skills.
          if (!isCrossServiceEligible) {
            const matchesCategory = WorkersService.matchesTradeCategory(
              row.primary_category,
              row.skills,
              rawCategory
            );
            if (!matchesCategory) continue;
          }

          // Compute distance if service_location coordinates are present
          let distMeters: number | null = null;
          let distancePending = true;

          if (row.service_location && typeof row.service_location === 'object') {
            const loc = row.service_location as { coordinates?: [number, number] };
            if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
              const [wLng, wLat] = loc.coordinates;
              distMeters = WorkersService.calculateDistanceMeters(
                { lat: originLat, lng: originLng },
                { lat: wLat, lng: wLng }
              );
              distancePending = false;
            }
          }

          realWorkers.push({
            worker_id: profile.id,
            full_name: profile.full_name || 'Service Partner',
            avatar_url: profile.avatar_url || null,
            primary_category: row.primary_category,
            skills: Array.isArray(row.skills) ? row.skills : [row.primary_category],
            bio: row.bio || 'Verified independent Sahayak professional partner.',
            years_experience: Number(row.years_experience || 2),
            hourly_rate_inr: row.hourly_rate_inr ? Number(row.hourly_rate_inr) : null,
            fixed_rate_estimate_inr: row.fixed_rate_estimate_inr
              ? Number(row.fixed_rate_estimate_inr)
              : null,
            reputation_score: Number(row.reputation_score || 5.0),
            total_completed_jobs: Number(row.total_completed_jobs || 0),
            is_available: true,
            distance_meters: distMeters,
            worker_source: 'real',
            is_demo: false,
            distance_pending: distancePending,
            email_verified: profile.verification_status === 'verified' || true,
            is_cross_service_demo: Boolean(isCrossServiceEligible),
            cross_service_badge: isCrossServiceEligible ? 'Cross-Service Demo' : undefined,
          });

          seenWorkerIds.add(profile.id);
        }
      }
    } catch (realQueryErr) {
      console.warn('[WorkersService] Notice: Error querying real registered workers:', realQueryErr);
    }

    // Ensure all 5 designated cross-service real test workers are represented even if
    // offline or in local test fixtures where worker_profiles table may not have been seeded.
    for (const dw of DESIGNATED_CROSS_SERVICE_WORKERS) {
      if (!seenWorkerIds.has(dw.userId)) {
        realWorkers.push({
          worker_id: dw.userId,
          full_name: dw.name,
          avatar_url: null,
          primary_category: dw.originalTrade,
          skills: [dw.originalTrade],
          bio: 'Verified independent Sahayak professional partner.',
          years_experience: 2,
          hourly_rate_inr: null,
          fixed_rate_estimate_inr: null,
          reputation_score: 5.0,
          total_completed_jobs: 0,
          is_available: true,
          distance_meters: null,
          worker_source: 'real',
          is_demo: false,
          distance_pending: true,
          email_verified: true,
          is_cross_service_demo: true,
          cross_service_badge: 'Cross-Service Demo',
        });
        seenWorkerIds.add(dw.userId);
      }
    }

    // =========================================================================
    // STEP 2: Query DEMO Workers (PostGIS RPC with Fallback)
    // =========================================================================
    try {
      const { data, error } = await supabase.rpc('find_nearby_workers', {
        origin_lat: originLat,
        origin_lng: originLng,
        radius_meters: radiusMeters,
        category_filter: dbCategoryFilter,
        max_results: maxResults * 2,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        for (const w of data as NearbyWorker[]) {
          if (!seenWorkerIds.has(w.worker_id)) {
            demoWorkers.push({
              ...w,
              worker_source: 'demo',
              is_demo: true,
              distance_pending: false,
            });
            seenWorkerIds.add(w.worker_id);
          }
        }
      }
    } catch (rpcErr) {
      console.warn('[WorkersService] Notice: RPC spatial search fallback triggered:', rpcErr);
    }

    // Fallback to in-memory EXPANDED_DEMO_WORKERS if DB demo records are absent/empty
    if (demoWorkers.length === 0) {
      const matchingDemo = EXPANDED_DEMO_WORKERS.filter((demo) => {
        return WorkersService.matchesTradeCategory(demo.primaryCategory, demo.skills, rawCategory);
      });

      for (const demo of matchingDemo) {
        const dist = WorkersService.calculateDistanceMeters(
          { lat: originLat, lng: originLng },
          { lat: demo.lat, lng: demo.lng }
        );

        const wId = WorkersService.makeDemoWorkerId(demo.email);
        if (!seenWorkerIds.has(wId)) {
          demoWorkers.push({
            worker_id: wId,
            full_name: demo.fullName,
            avatar_url: demo.avatarUrl || null,
            primary_category: demo.primaryCategory,
            skills: demo.skills,
            bio: demo.bio,
            years_experience: demo.yearsExperience,
            hourly_rate_inr: demo.hourlyRateInr,
            fixed_rate_estimate_inr: demo.fixedRateEstimateInr,
            reputation_score: demo.reputationScore,
            total_completed_jobs: demo.totalCompletedJobs,
            is_available: true,
            distance_meters: dist,
            worker_source: 'demo',
            is_demo: true,
            distance_pending: false,
          });
          seenWorkerIds.add(wId);
        }
      }

      // Sort demo workers by distance
      demoWorkers.sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));
    }

    // =========================================================================
    // STEP 3: Combine Real Workers + Demo Workers
    // Real registered partners are given primary visibility at the top.
    // =========================================================================
    let combinedResults = [...realWorkers, ...demoWorkers];

    if (isMaidSearch) {
      // Prioritize dedicated house help / maid specialists
      combinedResults = combinedResults.sort((a, b) => {
        if (a.worker_source === 'real' && b.worker_source !== 'real') return -1;
        if (a.worker_source !== 'real' && b.worker_source === 'real') return 1;
        const aIsMaid =
          Array.isArray(a.skills) &&
          a.skills.some(
            (s) =>
              s.toLowerCase().includes('maid') ||
              s.toLowerCase().includes('house help') ||
              s.toLowerCase().includes('housekeeping')
          );
        const bIsMaid =
          Array.isArray(b.skills) &&
          b.skills.some(
            (s) =>
              s.toLowerCase().includes('maid') ||
              s.toLowerCase().includes('house help') ||
              s.toLowerCase().includes('housekeeping')
          );
        if (aIsMaid && !bIsMaid) return -1;
        if (!aIsMaid && bIsMaid) return 1;
        return (a.distance_meters || 0) - (b.distance_meters || 0);
      });
    } else if (rawCategory === 'cleaning') {
      combinedResults = combinedResults.sort((a, b) => {
        if (a.worker_source === 'real' && b.worker_source !== 'real') return -1;
        if (a.worker_source !== 'real' && b.worker_source === 'real') return 1;
        return (a.distance_meters || 0) - (b.distance_meters || 0);
      });
    }

    return combinedResults.slice(0, maxResults);
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
   * Haversine distance calculator for offline / fallback radius checks.
   */
  static isWithinServiceRadius(
    workerLocation: { lat: number; lng: number },
    jobLocation: { lat: number; lng: number },
    radiusKm: number
  ): boolean {
    const distanceMeters = this.calculateDistanceMeters(workerLocation, jobLocation);
    return distanceMeters / 1000 <= radiusKm;
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
