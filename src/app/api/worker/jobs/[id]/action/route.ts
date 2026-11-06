/**
 * Worker Job Actions API: POST /api/worker/jobs/[id]/action
 * Allows worker to accept, reject, or cancel job requests with cancellation policy enforcement.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingService } from '@/lib/services/booking.service';
import { WalletService } from '@/lib/services/wallet.service';
import { NotificationService } from '@/lib/services/notification.service';
import { BookingState } from '@/types/booking';

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
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON payload.', 400, 'BAD_REQUEST');
    }

    const payload = body as {
      action?: 'accept' | 'reject' | 'cancel';
      reason?: string;
    };

    if (!payload.action || !['accept', 'reject', 'cancel'].includes(payload.action)) {
      return apiError('Action must be one of: accept, reject, cancel.', 400, 'INVALID_ACTION');
    }

    const admin = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (admin || supabase) as any;

    // Fetch Job
    const { data: job, error: jobErr } = await client
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    const ai = (job.ai_details && typeof job.ai_details === 'object' ? job.ai_details : {}) as Record<string, unknown>;
    const booking = (ai.booking as BookingState) || null;

    // Verify worker association
    const isAssignedWorker = job.selected_worker_id === user.id || booking?.workerId === user.id;
    if (!isAssignedWorker) {
      // Check if worker has an open bid
      const { data: bid } = await client
        .from('bids')
        .select('*')
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .maybeSingle();

      if (!bid) {
        return apiError('You are not authorized to act on this job.', 403, 'FORBIDDEN');
      }
    }

    // 1. ACTION: ACCEPT
    if (payload.action === 'accept') {
      if (job.status === 'completed' || job.status === 'cancelled') {
        return apiError(`Cannot accept a job with status '${job.status}'.`, 400, 'INVALID_STATE');
      }

      // Generate start OTP for the customer if not already present
      let plainOtp = booking?.customerOtp;
      if (!plainOtp) {
        try {
          const otpResult = await BookingService.provisionJobStartOtp(client, jobId);
          plainOtp = otpResult.plainOtp;
        } catch (otpErr) {
          console.warn('[Worker Job Action] Notice: Could not provision Start OTP:', otpErr);
        }
      }

      // Persist authoritative acceptance timestamp; prevent duplicate acceptance calls from resetting the clock
      const acceptedAt = booking?.accepted_at || new Date().toISOString();

      const updatedBooking: BookingState = {
        ...(booking || {
          workerId: user.id,
          workerName: 'Assigned Worker',
          workerCategory: job.category,
          workerRating: 4.8,
          workerExperience: 3,
          isDemoWorker: false,
          agreedPriceInr: job.accepted_price_inr || job.estimated_budget_inr || 500,
          otpVerified: false,
        }),
        stage: 'accepted',
        stageUpdatedAt: new Date().toISOString(),
        accepted_at: acceptedAt,
        customerOtp: plainOtp,
      };

      await client
        .from('jobs')
        .update({
          status: 'assigned',
          selected_worker_id: user.id,
          ai_details: {
            ...ai,
            booking: updatedBooking,
          },
        })
        .eq('id', jobId);

      await NotificationService.sendNotification(supabase!, {
        workerId: user.id,
        type: 'OFFER_ACCEPTED',
        title: 'Job Confirmed: ' + job.title,
        message: 'You have accepted the job offer. Check the Upcoming tab for scheduled details.',
        jobId,
      });

      // Also notify customer of acceptance
      if (job.customer_id) {
        try {
          await client.from('notifications').insert({
            user_id: job.customer_id,
            type: 'OFFER_ACCEPTED',
            title: 'Booking Accepted by Worker Partner!',
            message: `${updatedBooking.workerName || 'Your worker partner'} accepted your booking request for ${job.category}.`,
            data: { jobId, workerId: user.id },
          });
        } catch (notifErr) {
          console.warn('[Worker Job Action] Notice: customer notification:', notifErr);
        }
      }

      return apiSuccess({ success: true, status: 'accepted' });
    }

    // 2. ACTION: REJECT
    if (payload.action === 'reject') {
      const reason = payload.reason || 'Worker unavailable';
      const rejectedAt = booking?.rejected_at || new Date().toISOString();

      const updatedBooking: BookingState = {
        ...(booking || {
          workerId: user.id,
          workerName: 'Worker',
          workerCategory: job.category,
          workerRating: 4.8,
          workerExperience: 3,
          isDemoWorker: false,
          agreedPriceInr: job.accepted_price_inr || 500,
          otpVerified: false,
        }),
        stage: 'cancelled',
        stageUpdatedAt: new Date().toISOString(),
        rejected_at: rejectedAt,
        cancellationReason: reason,
        simulatedSecondsRemaining: 0,
      };

      await client
        .from('jobs')
        .update({
          status: 'posted',
          selected_worker_id: null,
          ai_details: {
            ...ai,
            booking: updatedBooking,
          },
        })
        .eq('id', jobId);

      // If there was a bid, mark it rejected
      await client
        .from('bids')
        .update({ status: 'REJECTED' })
        .eq('job_id', jobId)
        .eq('worker_id', user.id);

      await NotificationService.sendNotification(supabase!, {
        workerId: user.id,
        type: 'OFFER_REJECTED',
        title: 'Offer Declined: ' + job.title,
        message: `You declined this job offer (Reason: ${reason}).`,
        jobId,
      });

      // Also notify customer of rejection
      if (job.customer_id) {
        try {
          await client.from('notifications').insert({
            user_id: job.customer_id,
            type: 'OFFER_REJECTED',
            title: 'Booking Request Declined',
            message: `The worker partner was unable to accept your request (${reason}). Please select another professional partner.`,
            data: { jobId, workerId: user.id },
          });
        } catch (notifErr) {
          console.warn('[Worker Job Action] Notice: customer rejection notification:', notifErr);
        }
      }

      return apiSuccess({ success: true, status: 'rejected' });
    }

    // 3. ACTION: CANCEL
    if (payload.action === 'cancel') {
      if (!payload.reason || !payload.reason.trim()) {
        return apiError('A cancellation reason is required.', 400, 'MISSING_REASON');
      }

      // Prevent cancellation after job is already completed
      if (job.status === 'completed' || booking?.stage === 'completed') {
        return apiError('Cannot cancel a completed service job.', 400, 'ALREADY_COMPLETED');
      }

      // Policy check: If work is already in_progress, cancellation requires special review
      if (booking?.stage === 'in_progress') {
        return apiError(
          'Work is already marked in-progress with verified OTP. Please complete the job or contact customer support for emergency dispute resolution.',
          400,
          'IN_PROGRESS_LOCK'
        );
      }

      // Check cancellation time limit policy
      const settings = await WalletService.getPlatformSettings(supabase!);
      if (job.scheduled_date && job.scheduled_time_slot) {
        try {
          const scheduledDatetimeStr = `${job.scheduled_date} ${job.scheduled_time_slot.split('-')[0].trim()}`;
          const scheduledTimestamp = Date.parse(scheduledDatetimeStr);
          if (!isNaN(scheduledTimestamp)) {
            const timeDiffMinutes = (scheduledTimestamp - Date.now()) / (1000 * 60);
            if (timeDiffMinutes > 0 && timeDiffMinutes < settings.cancellationTimeLimitMinutes) {
              console.warn(`[Worker Job Action] Late cancellation warning: ${timeDiffMinutes.toFixed(0)} mins before schedule`);
            }
          }
        } catch {
          // Ignore parsing error
        }
      }

      const transitionResult = await BookingService.updateBookingStage(
        supabase!,
        jobId,
        job,
        'cancelled',
        payload.reason.trim()
      );

      if (!transitionResult.success) {
        return apiError(transitionResult.error || 'Failed to cancel job.', 400, 'TRANSITION_ERROR');
      }

      await NotificationService.sendNotification(supabase!, {
        workerId: user.id,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled: ' + job.title,
        message: `You cancelled this booking. Reason: ${payload.reason.trim()}`,
        jobId,
      });

      return apiSuccess({ success: true, status: 'cancelled' });
    }

    return apiError('Unhandled action.', 400, 'BAD_REQUEST');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[POST /api/worker/jobs/[id]/action] Error:', error);
    return apiError('Failed to process worker job action.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

