/**
 * Direct Worker Booking API: POST /api/jobs/[id]/book-now
 * Initiates an instant customer-to-worker booking for a specific posted job.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingService } from '@/lib/services/booking.service';
import { calculateEstimatedTravelTimeMinutes, BookingState } from '@/types/booking';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['customer']);

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

    const payload = body as {
      workerId?: string;
      offeredPriceInr?: number;
      distanceMeters?: number;
    };

    if (!payload.workerId || typeof payload.workerId !== 'string') {
      return apiError('A valid "workerId" is required for direct booking.', 400, 'MISSING_WORKER_ID');
    }

    const workerId = payload.workerId.trim();

    // 1. Fetch Job and verify ownership
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    if (job.customer_id !== user.id) {
      return apiError('Unauthorized: You can only book workers for your own service requests.', 403, 'FORBIDDEN');
    }

    const normalizedStatus = (job.status as string).toUpperCase();
    if (normalizedStatus !== 'POSTED' && normalizedStatus !== 'BIDDING_OPEN') {
      return apiError(
        `Job is not open for booking. Current status: ${job.status}`,
        409,
        'JOB_NOT_OPEN'
      );
    }

    // 2. Fetch Worker Profile
    const { data: workerProfile, error: workerError } = await supabase!
      .from('worker_profiles')
      .select('*, profiles!user_id(*)')
      .eq('user_id', workerId)
      .maybeSingle();

    // Fallback query if joined differently:
    let workerName = 'Professional Service Partner';
    let workerPhone: string | null = null;
    let workerAvatar: string | null = null;
    let workerRating = 5.0;
    let workerExp = 3;
    let workerCategory = job.category;
    let isDemoWorker = false;

    if (workerProfile) {
      workerRating = Number(workerProfile.reputation_score || 5.0);
      workerExp = Number(workerProfile.years_experience || 3);
      workerCategory = workerProfile.primary_category || job.category;
      if (workerProfile.profiles) {
        const p = workerProfile.profiles as { full_name?: string; phone?: string; avatar_url?: string };
        workerName = p.full_name || workerName;
        workerPhone = p.phone || null;
        workerAvatar = p.avatar_url || null;
      }
    } else {
      // Query profile directly
      const { data: p } = await supabase!.from('profiles').select('*').eq('id', workerId).maybeSingle();
      if (p) {
        workerName = p.full_name || workerName;
        workerPhone = p.phone || null;
        workerAvatar = p.avatar_url || null;
      }
    }

    if (workerName.includes('[DEMO]') || (workerPhone && workerPhone.includes('99990000'))) {
      isDemoWorker = true;
    }

    // 3. Determine agreed price (from payload, job estimate, or worker rates)
    const agreedPrice =
      payload.offeredPriceInr ||
      job.estimated_min_price_inr ||
      workerProfile?.fixed_rate_estimate_inr ||
      workerProfile?.hourly_rate_inr ||
      450;

    // 4. Calculate Travel Time and ETA
    const distanceMeters = payload.distanceMeters || 2500;
    const travelCalc = calculateEstimatedTravelTimeMinutes(distanceMeters);

    // 5. Generate secure arrival OTP and persist hash
    const { plainOtp, expiresAt } = await BookingService.provisionJobStartOtp(supabase!, jobId);

    // 6. Build persistent booking state
    const bookingState: BookingState = {
      stage: 'accepted',
      stageUpdatedAt: new Date().toISOString(),
      workerId,
      workerName,
      workerCategory,
      workerRating,
      workerExperience: workerExp,
      workerAvatarUrl: workerAvatar,
      workerPhone,
      isDemoWorker,
      agreedPriceInr: Number(agreedPrice),
      estimatedArrivalMinutes: travelCalc.minutes,
      simulatedSecondsRemaining: isDemoWorker ? travelCalc.minutes * 60 : undefined,
      currentWorkerCoords: null,
      customerOtp: plainOtp,
      otpVerified: false,
    };

    // 7. Update Job atomically: assign worker, record price, update ai_details
    const rawAi = (job as { ai_details?: unknown }).ai_details;
    const aiDetails = (rawAi && typeof rawAi === 'object' ? rawAi : {}) as Record<string, unknown>;

    const { error: updateError } = await supabase!
      .from('jobs')
      .update({
        status: 'assigned',
        selected_worker_id: workerId,
        accepted_price_inr: agreedPrice,
        ai_details: {
          ...aiDetails,
          booking: bookingState,
        } as any,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[POST /api/jobs/[id]/book-now] Update error:', updateError.message);
      return apiError('Failed to record booking.', 500, 'DATABASE_ERROR', updateError.message);
    }

    return apiSuccess({
      message: 'Booking confirmed successfully. Worker has been dispatched.',
      booking: bookingState,
      startOtp: plainOtp, // Provided strictly to the authorized customer
      otpExpiresAt: expiresAt,
      travelEstimate: travelCalc,
    }, 201);
  } catch (error) {
    console.error('[POST /api/jobs/[id]/book-now] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
