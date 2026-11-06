/**
 * Direct Worker Booking API: POST /api/jobs/[id]/book-now
 * Initiates an instant customer-to-worker booking for a specific posted job.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingService } from '@/lib/services/booking.service';
import { PricingService } from '@/lib/services/pricing.service';
import { NotificationService } from '@/lib/services/notification.service';
import { calculateEstimatedTravelTimeMinutes, BookingState } from '@/types/booking';
import { isDesignatedCrossServiceWorkerId } from '@/lib/config/designated-workers';

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
      workerName?: string;
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

    // 2. Fetch Worker Profile using privileged admin client to avoid RLS block on profiles table
    const adminClient = getSupabaseAdminClient();
    const serverClient = adminClient || supabase!;

    const { data: workerProfile } = await serverClient
      .from('worker_profiles')
      .select('*, profiles!user_id(*)')
      .eq('user_id', workerId)
      .maybeSingle();

    let workerName = payload.workerName || 'Professional Service Partner';
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

      if (workerProfile.worker_source === 'demo' || workerProfile.is_demo === true) {
        isDemoWorker = true;
      }
      if (workerProfile.worker_source === 'real' || workerProfile.is_demo === false) {
        isDemoWorker = false;
      }

      if (workerProfile.bio && (workerProfile.bio.includes('[DEMO]') || workerProfile.bio.toLowerCase().includes('demonstration only'))) {
        isDemoWorker = true;
      }

      if (workerProfile.profiles) {
        const p = workerProfile.profiles as { full_name?: string; phone?: string; avatar_url?: string; email?: string; user_source?: string };
        workerName = p.full_name || workerName;
        workerPhone = p.phone || null;
        workerAvatar = p.avatar_url || null;
        if (p.email?.includes('sahayak.demo.internal')) {
          isDemoWorker = true;
        }
        if (p.user_source === 'real') {
          isDemoWorker = false;
        }
      }
    }

    // Direct profile lookup fallback if joined profiles were null
    if (adminClient && (!workerProfile || !workerProfile.profiles)) {
      const { data: p } = await adminClient.from('profiles').select('*').eq('id', workerId).maybeSingle();
      if (p) {
        workerName = p.full_name || workerName;
        workerPhone = p.phone || null;
        workerAvatar = p.avatar_url || null;
        if (p.email?.includes('sahayak.demo.internal')) {
          isDemoWorker = true;
        }
        if (p.user_source === 'real') {
          isDemoWorker = false;
        }
      }
    }

    if (
      workerName.includes('[DEMO]') ||
      workerName.toLowerCase().includes('demo') ||
      (workerPhone && workerPhone.includes('99990000'))
    ) {
      isDemoWorker = true;
    }

    // Explicitly guarantee real booking workflow for designated cross-service workers
    if (isDesignatedCrossServiceWorkerId(workerId)) {
      isDemoWorker = false;
      // Save the customer's actual requested service category
      workerCategory = job.category;
    }

    const cleanWorkerName = workerName.replace(/^\[DEMO\]\s*/i, '').replace(/^DEMO\s*[-–—]\s*/i, '').trim();

    // 3. Determine agreed price within the authoritative fair price range
    const fairRange = PricingService.getJobFairPriceRange(job);

    let requestedPrice = payload.offeredPriceInr;
    if (requestedPrice != null) {
      const validation = PricingService.validateBidAgainstFairRange(requestedPrice, fairRange);
      if (!validation.isValid) {
        return apiError(
          `Booking amount ₹${requestedPrice} is outside the permitted fair price range of ₹${fairRange.minPriceInr} - ₹${fairRange.maxPriceInr} for this job.`,
          400,
          'BOOKING_PRICE_OUTSIDE_FAIR_RANGE',
          {
            requestedPriceInr: requestedPrice,
            permittedMinPriceInr: fairRange.minPriceInr,
            permittedMaxPriceInr: fairRange.maxPriceInr,
          }
        );
      }
    }

    let agreedPrice: number;
    if (requestedPrice != null) {
      agreedPrice = Math.round(requestedPrice);
    } else {
      // Determine selected worker's individual quote instead of falling back to minimum price
      const workerQuote = PricingService.calculateWorkerQuoteForJob(
        {
          worker_id: workerId,
          years_experience: workerExp,
          reputation_score: workerRating,
          hourly_rate_inr: workerProfile?.hourly_rate_inr ?? null,
          fixed_rate_estimate_inr: workerProfile?.fixed_rate_estimate_inr ?? null,
          distance_meters: payload.distanceMeters ?? 2500,
        },
        job
      );
      agreedPrice = workerQuote.quoteInr;
    }

    // 4. Calculate Travel Time and ETA
    const distanceMeters = payload.distanceMeters || 2500;
    const travelCalc = calculateEstimatedTravelTimeMinutes(distanceMeters);

    // 5. Build persistent booking state based on whether worker is Real vs Demo
    let plainOtp: string | undefined;
    let expiresAt: string | undefined;

    if (isDemoWorker) {
      // Demo worker instant auto-dispatch: generate start OTP immediately
      const otpRes = await BookingService.provisionJobStartOtp(supabase!, jobId);
      plainOtp = otpRes.plainOtp;
      expiresAt = otpRes.expiresAt;
    }

    const bookingState: BookingState = {
      stage: isDemoWorker ? 'accepted' : 'requested',
      stageUpdatedAt: new Date().toISOString(),
      accepted_at: isDemoWorker ? new Date().toISOString() : null,
      workerId,
      workerName: cleanWorkerName,
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

    // 6. Update Job atomically: assign worker, record price, update ai_details
    const rawAi = (job as { ai_details?: unknown }).ai_details;
    const aiDetails = (rawAi && typeof rawAi === 'object' ? rawAi : {}) as Record<string, unknown>;

    const nextJobStatus = isDemoWorker ? 'assigned' : 'posted';

    const { error: updateError } = await supabase!
      .from('jobs')
      .update({
        status: nextJobStatus,
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

    // 7. If Real Worker, create an in-app notification for the partner
    if (!isDemoWorker) {
      try {
        await NotificationService.sendNotification(supabase!, {
          workerId,
          type: 'NEW_OFFER',
          title: 'New Service Booking Request',
          message: `A homeowner has requested your service for ${job.category} at ₹${agreedPrice}. View Pending Offers to respond.`,
          jobId,
          metadata: { customerId: user.id, agreedPriceInr: agreedPrice },
        });
      } catch (notifErr) {
        console.warn('[book-now] Notification notice:', notifErr);
      }

      return apiSuccess(
        {
          message: 'Booking request sent to professional partner. Awaiting partner acceptance.',
          booking: bookingState,
          travelEstimate: travelCalc,
        },
        201
      );
    }

    return apiSuccess(
      {
        message: 'Booking confirmed successfully. Worker has been dispatched.',
        booking: bookingState,
        startOtp: plainOtp,
        otpExpiresAt: expiresAt,
        travelEstimate: travelCalc,
      },
      201
    );
  } catch (error) {
    console.error('[POST /api/jobs/[id]/book-now] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
