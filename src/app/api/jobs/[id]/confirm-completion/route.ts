/**
 * Job Completion Confirmation API: POST /api/jobs/[id]/confirm-completion
 * Customer (or Admin) confirms job completion, releasing pending earnings atomically to worker wallet.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { WalletService } from '@/lib/services/wallet.service';
import { BookingService } from '@/lib/services/booking.service';
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
    const authResult = await requireAuth(supabase);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user, profile } = authResult.context;

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

    // Must be job customer or admin
    if (job.customer_id !== user.id && profile.role !== 'admin') {
      return apiError('Only the customer who requested this service or an administrator can confirm completion.', 403, 'FORBIDDEN');
    }

    if (!job.selected_worker_id) {
      return apiError('Cannot complete a job with no assigned worker.', 400, 'NO_WORKER');
    }

    const ai = (job.ai_details && typeof job.ai_details === 'object' ? job.ai_details : {}) as Record<string, unknown>;
    const booking = (ai.booking as BookingState) || null;

    // Update booking stage to completed if not already completed
    if (booking?.stage !== 'completed') {
      await BookingService.updateBookingStage(supabase!, jobId, job, 'completed');
    }

    // Atomically release earnings to worker wallet
    const releaseResult = await WalletService.creditJobEarningsToWallet(supabase!, jobId);

    if (!releaseResult.success) {
      return apiError(releaseResult.error || 'Failed to release worker payment.', 500, 'PAYMENT_RELEASE_FAILED');
    }

    // Send completion confirmed notification to worker
    await NotificationService.sendNotification(supabase!, {
      workerId: job.selected_worker_id,
      type: 'COMPLETION_CONFIRMED',
      title: 'Job Completed: ' + job.title,
      message: `The customer has confirmed completion! ₹${releaseResult.netEarningInr} has been credited to your available wallet balance.`,
      jobId,
      metadata: {
        gross: releaseResult.grossAmountInr,
        commission: releaseResult.commissionAmountInr,
        net: releaseResult.netEarningInr,
      },
    });

    return apiSuccess({
      success: true,
      message: 'Job completed and payment successfully released to worker wallet.',
      breakdown: {
        grossAmountInr: releaseResult.grossAmountInr,
        commissionAmountInr: releaseResult.commissionAmountInr,
        netEarningInr: releaseResult.netEarningInr,
        newAvailableBalanceInr: releaseResult.newAvailableBalanceInr,
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[POST /api/jobs/[id]/confirm-completion] Error:', error);
    return apiError('Internal server error.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

