/**
 * Bids API: POST /api/jobs/[id]/bids and GET /api/jobs/[id]/bids
 * Manages worker bidding and role-scoped bid inspection.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole, requireAuth } from '@/lib/auth/server';
import { validateCreateBid } from '@/lib/validations/jobs';
import { JobsService } from '@/lib/services/jobs.service';
import { PricingService, getFairPriceLabel } from '@/lib/services/pricing.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient();
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON payload in request body.', 400, 'BAD_REQUEST');
    }

    // Verify the target job exists and is open for bidding
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('[POST /api/jobs/[id]/bids] Job query error:', jobError.message);
      return apiError('Database error retrieving job.', 500, 'DATABASE_ERROR');
    }

    if (!job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    // 1. Prevent self-bidding
    if (job.customer_id === user.id) {
      return apiError('Workers cannot bid on jobs they created.', 400, 'SELF_BIDDING_DISALLOWED');
    }

    // 2. Prevent bids on closed, assigned, or cancelled jobs
    if (!['POSTED', 'BIDDING_OPEN'].includes(job.status)) {
      return apiError(
        `Job is not open for bidding. Current status: '${job.status}'.`,
        409,
        'JOB_NOT_OPEN_FOR_BIDS'
      );
    }

    // Validate the bid input with worker ID guaranteed from session
    const bidPayloadInput = {
      ...(typeof body === 'object' && body !== null ? body : {}),
      jobId,
      workerId: user.id,
    };

    const validation = validateCreateBid(bidPayloadInput as Parameters<typeof validateCreateBid>[0]);

    if (!validation.success || !validation.data) {
      return apiError('Validation failed for bid submission.', 400, 'VALIDATION_ERROR', validation.errors);
    }

    const validatedBid = validation.data;

    // 3. Prevent duplicate active bids
    const { data: existingBid } = await supabase!
      .from('bids')
      .select('id, status')
      .eq('job_id', jobId)
      .eq('worker_id', user.id)
      .maybeSingle();

    if (existingBid && existingBid.status === 'PENDING') {
      return apiError(
        'You have already submitted an active pending bid for this job. You may counter-offer or wait for customer response.',
        409,
        'DUPLICATE_ACTIVE_BID'
      );
    }

    const bidInsert = JobsService.prepareBidInsert(validatedBid);

    let insertedBid;

    if (existingBid && ['WITHDRAWN', 'REJECTED'].includes(existingBid.status)) {
      // Re-activate previously withdrawn/rejected bid with new pricing
      const { data: updated, error: updateError } = await supabase!
        .from('bids')
        .update({
          offered_amount_inr: bidInsert.offered_amount_inr,
          labor_cost_inr: bidInsert.labor_cost_inr,
          materials_estimate_inr: bidInsert.materials_estimate_inr,
          visitation_fee_inr: bidInsert.visitation_fee_inr,
          note: bidInsert.note,
          status: 'PENDING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBid.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('[POST /api/jobs/[id]/bids] Re-activate error:', updateError.message);
        return apiError('Failed to submit updated bid.', 500, 'DATABASE_ERROR');
      }

      insertedBid = updated;
    } else {
      const { data: created, error: insertError } = await supabase!
        .from('bids')
        .insert(bidInsert)
        .select('*')
        .single();

      if (insertError) {
        console.error('[POST /api/jobs/[id]/bids] Insert error:', insertError.message);
        return apiError('Failed to place bid in database.', 500, 'DATABASE_ERROR', insertError.message);
      }

      insertedBid = created;
    }

    // Transition job from POSTED to BIDDING_OPEN if this is the first bid
    if (job.status === 'POSTED') {
      await supabase!
        .from('jobs')
        .update({ status: 'BIDDING_OPEN', updated_at: new Date().toISOString() })
        .eq('id', jobId);
    }

    // Benchmark comparison evaluation
    let benchmarkComparison = null;
    const benchmark = await PricingService.fetchBenchmarkForArea(
      supabase!,
      job.category,
      job.city,
      job.address_line
    );

    if (benchmark) {
      const evaluation = PricingService.evaluateBidAgainstBenchmark(
        insertedBid.offered_amount_inr,
        benchmark
      );
      benchmarkComparison = {
        evaluation,
        benchmarkMedianInr: benchmark.median_price_inr,
        benchmarkRangeInr: [benchmark.min_price_inr, benchmark.max_price_inr],
      };
    }

    return apiSuccess(
      {
        bid: insertedBid,
        benchmarkComparison,
      },
      201
    );
  } catch (error) {
    console.error('[POST /api/jobs/[id]/bids] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient();
    const authResult = await requireAuth(supabase);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user, profile } = authResult.context;

    // Verify job exists
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('id, customer_id, status, category, city, address_line, location_point')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    const isCustomerOwner = job.customer_id === user.id;
    const isAdmin = profile.role === 'admin';
    const isWorker = profile.role === 'worker';

    // 1. Customer or Admin: Can view all bids with worker public summary & benchmark comparison
    if (isCustomerOwner || isAdmin) {
      const { data: bids, error: bidsError } = await supabase!
        .from('bids')
        .select(`
          id,
          job_id,
          worker_id,
          offered_amount_inr,
          labor_cost_inr,
          materials_estimate_inr,
          visitation_fee_inr,
          note,
          counter_offers,
          status,
          created_at,
          worker:profiles!bids_worker_id_fkey(
            id,
            full_name,
            avatar_url,
            primary_city
          )
        `)
        .eq('job_id', jobId)
        .order('offered_amount_inr', { ascending: true });

      if (bidsError) {
        console.error('[GET /api/jobs/[id]/bids] Error:', bidsError.message);
        return apiError('Failed to fetch bids for job.', 500, 'DATABASE_ERROR');
      }

      // Fetch matching price benchmark for this job's category and location
      const benchmark = await PricingService.fetchBenchmarkForArea(
        supabase!,
        job.category,
        job.city,
        job.address_line
      );

      // Collect worker IDs to query worker profiles and reviews
      const workerIds = (bids ?? []).map((b) => b.worker_id).filter(Boolean);

      // Query worker_profiles
      let workerProfilesMap = new Map<string, { id: string; user_id: string; service_location?: unknown; years_experience?: number; reputation_score?: number }>();
      if (workerIds.length > 0) {
        const { data: workerProfiles } = await supabase!
          .from('worker_profiles')
          .select('id, user_id, service_location, years_experience, reputation_score')
          .or(`user_id.in.(${workerIds.join(',')}),id.in.(${workerIds.join(',')})`);

        if (workerProfiles && Array.isArray(workerProfiles)) {
          for (const wp of workerProfiles) {
            workerProfilesMap.set(wp.user_id, wp);
            workerProfilesMap.set(wp.id, wp);
          }
        }
      }

      // Query reviews for bidding workers to calculate real rating & review count
      const reviewStatsMap = new Map<string, { count: number; avgRating: number }>();
      if (workerIds.length > 0) {
        const targetWorkerProfileIds = Array.from(workerProfilesMap.values()).map((wp) => wp.id);
        const allIdsToSearch = Array.from(new Set([...workerIds, ...targetWorkerProfileIds]));
        const { data: reviews } = await supabase!
          .from('reviews')
          .select('worker_id, rating, rating_overall')
          .in('worker_id', allIdsToSearch);

        if (reviews && Array.isArray(reviews)) {
          const sums = new Map<string, { total: number; count: number }>();
          for (const rev of reviews) {
            const rVal = rev.rating_overall || rev.rating || 5;
            const current = sums.get(rev.worker_id) || { total: 0, count: 0 };
            current.total += rVal;
            current.count += 1;
            sums.set(rev.worker_id, current);
          }
          for (const [wId, agg] of sums.entries()) {
            reviewStatsMap.set(wId, {
              count: agg.count,
              avgRating: Math.round((agg.total / agg.count) * 10) / 10,
            });
          }
        }
      }

      // Job coordinates
      const parseCoords = (loc: unknown): { lat: number; lng: number } | null => {
        if (!loc) return null;
        if (typeof loc === 'string') {
          const match = loc.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
          if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
        } else if (typeof loc === 'object' && loc !== null && 'coordinates' in loc) {
          const c = (loc as { coordinates: number[] }).coordinates;
          if (Array.isArray(c) && c.length >= 2) return { lng: c[0], lat: c[1] };
        }
        return null;
      };

      const jobCoords = parseCoords(job.location_point);

      const calculateDistKm = (c1: { lat: number; lng: number } | null, c2: { lat: number; lng: number } | null): number | null => {
        if (!c1 || !c2) return null;
        const R = 6371;
        const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
        const dLon = ((c2.lng - c1.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((c1.lat * Math.PI) / 180) *
            Math.cos((c2.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
      };

      // Enrich bids with Fair Price and recommendation scoring
      type EnrichedBidType = NonNullable<typeof bids>[number] & {
        fair_price_evaluation: 'BELOW_AVERAGE' | 'FAIR_MARKET' | 'ABOVE_AVERAGE' | null;
        fair_price_label: 'Below Range' | 'Fair Price' | 'Above Range' | 'Benchmark unavailable';
        match_score: number;
        is_best_match: boolean;
        recommendation_reason: string | null;
        worker_distance_km: number | null;
        worker_review_count: number;
        worker_average_rating: number | null;
      };

      const rawEnriched: EnrichedBidType[] = (bids ?? []).map((b) => {
        const wp = workerProfilesMap.get(b.worker_id);
        const workerCoords = wp ? parseCoords(wp.service_location) : null;
        const distKm = calculateDistKm(jobCoords, workerCoords);

        const revStats = reviewStatsMap.get(b.worker_id) || (wp ? reviewStatsMap.get(wp.id) : null);
        const avgRating = revStats ? revStats.avgRating : null;
        const reviewCount = revStats ? revStats.count : 0;
        const expYears = wp?.years_experience || 0;

        const evaluation = PricingService.evaluateBidAgainstBenchmark(b.offered_amount_inr, benchmark);
        const label = getFairPriceLabel(evaluation);

        const { score, reason } = PricingService.scoreBidForRecommendation(
          b.offered_amount_inr,
          distKm,
          benchmark,
          expYears,
          avgRating
        );

        return {
          ...b,
          fair_price_evaluation: evaluation,
          fair_price_label: label,
          match_score: score,
          is_best_match: false,
          recommendation_reason: reason,
          worker_distance_km: distKm,
          worker_review_count: reviewCount,
          worker_average_rating: avgRating,
        };
      });

      // Find highest-scoring eligible (PENDING) bid to label as "Best Match"
      const eligibleBids = rawEnriched.filter((b) => b.status === 'PENDING');
      if (eligibleBids.length > 0) {
        eligibleBids.sort((a, b) => b.match_score - a.match_score);
        const best = eligibleBids[0];
        for (const item of rawEnriched) {
          if (item.id === best.id) {
            item.is_best_match = true;
          }
        }
      }

      return apiSuccess({
        jobId,
        benchmark: benchmark
          ? {
              category: benchmark.category,
              city: benchmark.city,
              microMarketArea: benchmark.micro_market_area,
              minPriceInr: benchmark.min_price_inr,
              medianPriceInr: benchmark.median_price_inr,
              maxPriceInr: benchmark.max_price_inr,
            }
          : null,
        bids: rawEnriched,
        totalBids: rawEnriched.length,
      });
    }

    // 2. Worker: Can only view their own bid (never competitor bids or contact details)
    if (isWorker) {
      const { data: myBid, error: myBidError } = await supabase!
        .from('bids')
        .select('*')
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .maybeSingle();

      if (myBidError) {
        console.error('[GET /api/jobs/[id]/bids] Worker bid query error:', myBidError.message);
        return apiError('Failed to fetch bid.', 500, 'DATABASE_ERROR');
      }

      return apiSuccess({
        jobId,
        myBid: myBid ?? null,
      });
    }

    return apiError('Access denied: You are not authorized to view bids for this job.', 403, 'FORBIDDEN');
  } catch (error) {
    console.error('[GET /api/jobs/[id]/bids] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
