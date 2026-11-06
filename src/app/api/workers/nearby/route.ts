/**
 * Worker Discovery API: GET /api/workers/nearby
 * Executes PostGIS geospatial queries to discover approved local professionals.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { WorkersService } from '@/lib/services/workers.service';
import { PricingService } from '@/lib/services/pricing.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusStr = searchParams.get('radius');
    const category = searchParams.get('category');
    const limitStr = searchParams.get('limit');
    const jobId = searchParams.get('jobId');

    if (!latStr || !lngStr) {
      return apiError(
        'Both "lat" (latitude) and "lng" (longitude) query parameters are required.',
        400,
        'MISSING_COORDINATES'
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || lat < 6 || lat > 38) {
      return apiError(
        'Latitude must be a valid number within India geographic bounds (6 to 38).',
        400,
        'INVALID_LATITUDE'
      );
    }

    if (isNaN(lng) || lng < 68 || lng > 98) {
      return apiError(
        'Longitude must be a valid number within India geographic bounds (68 to 98).',
        400,
        'INVALID_LONGITUDE'
      );
    }

    // Radius in meters: default 10 km (10000m), min 500m, max 50 km (50000m)
    const radiusMeters = Math.min(
      50000,
      Math.max(500, radiusStr ? parseInt(radiusStr, 10) : 10000)
    );

    // Limit: default 20, max 50
    const limit = Math.min(50, Math.max(1, limitStr ? parseInt(limitStr, 10) : 20));

    const supabase = await getSupabaseServerClient();

    if (!supabase) {
      return apiError(
        'Database connection not configured. Please supply Supabase environment variables.',
        503,
        'DATABASE_NOT_CONFIGURED'
      );
    }

    const workers = await WorkersService.queryNearbyWorkers(supabase, {
      originLat: lat,
      originLng: lng,
      radiusMeters,
      categoryFilter: category ? category.toLowerCase().trim() : null,
      maxResults: limit,
    });

    // If jobId is provided, retrieve the job and existing bids to calculate exact quotes
    let targetJob: {
      id?: string | null;
      category?: string | null;
      title?: string | null;
      description?: string | null;
      urgency?: string | null;
      estimated_min_price_inr?: number | null;
      estimated_max_price_inr?: number | null;
      estimated_budget_inr?: number | null;
      city?: string | null;
    } | null = null;
    const jobBidsMap = new Map<string, number>();

    if (jobId) {
      const { data: jobRow } = await supabase
        .from('jobs')
        .select('id, category, title, description, urgency, city, estimated_min_price_inr, estimated_max_price_inr, estimated_budget_inr')
        .eq('id', jobId)
        .maybeSingle();

      if (jobRow) {
        targetJob = jobRow;
        const { data: existingBids } = await supabase
          .from('bids')
          .select('worker_id, offered_amount_inr, status')
          .eq('job_id', jobId);

        if (existingBids && Array.isArray(existingBids)) {
          for (const b of existingBids) {
            jobBidsMap.set(b.worker_id, b.offered_amount_inr);
          }
        }
      }
    }

    // Query real persisted reviews for each returned worker
    let enrichedWorkers = workers as Array<typeof workers[number] & {
      review_count: number;
      average_rating: number | null;
      quote_inr?: number | null;
      fair_price_min_inr?: number | null;
      fair_price_max_inr?: number | null;
    }>;

    if (workers.length > 0) {
      const allWorkerIds = Array.from(new Set(workers.map((w) => w.worker_id).filter(Boolean)));

      const { data: reviews } = await supabase
        .from('reviews')
        .select('worker_id, rating, rating_overall')
        .in('worker_id', allWorkerIds);

      const reviewStatsMap = new Map<string, { count: number; avgRating: number }>();
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

      enrichedWorkers = workers.map((w) => {
        const stats = reviewStatsMap.get(w.worker_id);
        const isRealWorker = w.worker_source === 'real' || !w.is_demo;
        let avgRating = stats ? stats.avgRating : null;
        let reviewCount = stats ? stats.count : 0;

        // Demo workers retain their simulated reputation score; real workers preserve authentic 0-review state
        if (!isRealWorker && !stats && w.reputation_score) {
          avgRating = Number(w.reputation_score);
          reviewCount = Number(w.total_completed_jobs || 12);
        }

        let quoteInr: number | null = null;
        let fairMin: number | null = null;
        let fairMax: number | null = null;

        if (targetJob) {
          const fairRange = PricingService.getJobFairPriceRange(targetJob);
          fairMin = fairRange.minPriceInr;
          fairMax = fairRange.maxPriceInr;

          const existingBid = jobBidsMap.get(w.worker_id);
          const quoteResult = PricingService.calculateWorkerQuoteForJob(
            {
              worker_id: w.worker_id,
              full_name: w.full_name,
              years_experience: w.years_experience,
              reputation_score: w.reputation_score,
              average_rating: avgRating,
              distance_meters: w.distance_meters,
              hourly_rate_inr: w.hourly_rate_inr,
              fixed_rate_estimate_inr: w.fixed_rate_estimate_inr,
              existing_bid_inr: existingBid,
            },
            targetJob
          );
          quoteInr = quoteResult.quoteInr;
        } else if (category) {
          const genericJob = {
            category,
            title: `${category} Service`,
            urgency: 'standard',
          };
          const quoteResult = PricingService.calculateWorkerQuoteForJob(
            {
              worker_id: w.worker_id,
              full_name: w.full_name,
              years_experience: w.years_experience,
              reputation_score: w.reputation_score,
              average_rating: avgRating,
              distance_meters: w.distance_meters,
              hourly_rate_inr: w.hourly_rate_inr,
              fixed_rate_estimate_inr: w.fixed_rate_estimate_inr,
            },
            genericJob
          );
          quoteInr = quoteResult.quoteInr;
          fairMin = quoteResult.minPriceInr;
          fairMax = quoteResult.maxPriceInr;
        }

        return {
          ...w,
          review_count: reviewCount,
          average_rating: avgRating,
          quote_inr: quoteInr,
          fair_price_min_inr: fairMin,
          fair_price_max_inr: fairMax,
        };
      });
    }

    return apiSuccess({
      workers: enrichedWorkers,
      searchCenter: { latitude: lat, longitude: lng },
      radiusMeters,
      totalReturned: enrichedWorkers.length,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/workers/nearby] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
