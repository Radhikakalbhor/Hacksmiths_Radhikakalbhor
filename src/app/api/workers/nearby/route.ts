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

    return apiSuccess({
      workers,
      searchCenter: { latitude: lat, longitude: lng },
      radiusMeters,
      totalReturned: workers.length,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/workers/nearby] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
