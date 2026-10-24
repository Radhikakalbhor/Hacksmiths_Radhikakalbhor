/**
 * Worker Discovery API: GET /api/workers/nearby
 * Executes PostGIS geospatial queries to discover approved local professionals.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { WorkersService } from '@/lib/services/workers.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusStr = searchParams.get('radius');
    const category = searchParams.get('category');
    const limitStr = searchParams.get('limit');

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

    // Query real persisted reviews for each returned worker
    let enrichedWorkers = workers as Array<typeof workers[number] & { review_count: number; average_rating: number | null }>;
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
        return {
          ...w,
          review_count: stats ? stats.count : 0,
          average_rating: stats ? stats.avgRating : null,
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
