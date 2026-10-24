/**
 * Booking Lifecycle & Status API: PATCH /api/jobs/[id]/booking-status
 * Allows worker or customer to transition booking milestones (e.g. on_the_way, arrived, in_progress, completed, cancelled).
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingService } from '@/lib/services/booking.service';
import { BookingStage } from '@/types/booking';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireAuth(supabase);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user, profile } = authResult.context;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON payload in request body.', 400, 'BAD_REQUEST');
    }

    const payload = body as {
      targetStage?: BookingStage;
      otpCode?: string;
      cancellationReason?: string;
    };

    if (!payload.targetStage) {
      return apiError('targetStage is required.', 400, 'MISSING_STAGE');
    }

    // 1. Fetch Job
    const { data: job, error: jobErr } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    const isCustomer = job.customer_id === user.id;
    const isWorker = job.selected_worker_id === user.id || profile.role === 'worker';

    if (!isCustomer && !isWorker && profile.role !== 'admin') {
      return apiError('Unauthorized: You are not a counterparty to this booking.', 403, 'FORBIDDEN');
    }

    // Role-specific stage permission guards
    if (payload.targetStage === 'cancelled') {
      // Both customer and worker can cancel before completion
    } else if (['on_the_way', 'arrived'].includes(payload.targetStage)) {
      if (!isWorker && profile.role !== 'admin') {
        return apiError('Only the assigned worker can update transit status.', 403, 'FORBIDDEN');
      }
    } else if (payload.targetStage === 'in_progress') {
      // In_progress requires verifying the arrival OTP!
      if (!payload.otpCode) {
        return apiError('The 4-digit arrival OTP provided by the customer is required to start work.', 400, 'OTP_REQUIRED');
      }

      const otpResult = await BookingService.verifyJobStartOtp(supabase!, jobId, payload.otpCode);
      if (!otpResult.success) {
        return apiError(otpResult.error || 'Invalid OTP code.', 400, 'INVALID_OTP', {
          remainingAttempts: otpResult.remainingAttempts,
        });
      }
    }

    // 2. Perform atomic stage update
    const updateResult = await BookingService.updateBookingStage(
      supabase!,
      jobId,
      job,
      payload.targetStage,
      payload.cancellationReason
    );

    if (!updateResult.success || !updateResult.booking) {
      return apiError(updateResult.error || 'Failed to update booking status.', 400, 'TRANSITION_ERROR');
    }

    return apiSuccess({
      message: `Booking stage successfully updated to '${payload.targetStage}'.`,
      booking: updateResult.booking,
    });
  } catch (error) {
    console.error('[PATCH /api/jobs/[id]/booking-status] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
