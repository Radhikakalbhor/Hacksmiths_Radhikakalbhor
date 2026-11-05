/**
 * Accept Bid API: POST /api/jobs/[id]/accept-bid
 * Atomically accepts a winning worker bid, assigns the job, and rejects competing bids.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { PricingService } from '@/lib/services/pricing.service';

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

    const payload = body as { bidId?: string };

    if (!payload.bidId || typeof payload.bidId !== 'string' || payload.bidId.trim().length === 0) {
      return apiError('A valid "bidId" is required in request body.', 400, 'MISSING_BID_ID');
    }

    const bidId = payload.bidId.trim();

    // Verify bid exists and complies with Fair Pricing bounds before acceptance
    const { data: targetJob } = await supabase!
      .from('jobs')
      .select('id, category, title, description, urgency, city, estimated_min_price_inr, estimated_max_price_inr, estimated_budget_inr')
      .eq('id', jobId)
      .maybeSingle();

    const { data: targetBid } = await supabase!
      .from('bids')
      .select('id, offered_amount_inr, status')
      .eq('id', bidId)
      .eq('job_id', jobId)
      .maybeSingle();

    if (targetJob && targetBid) {
      const fairRange = PricingService.getJobFairPriceRange(targetJob);
      const priceValidation = PricingService.validateBidAgainstFairRange(
        targetBid.offered_amount_inr,
        fairRange
      );

      if (!priceValidation.isValid) {
        return apiError(
          `Cannot accept bid: ${priceValidation.error}`,
          400,
          'BID_OUTSIDE_FAIR_RANGE',
          {
            offeredAmountInr: targetBid.offered_amount_inr,
            permittedMinPriceInr: fairRange.minPriceInr,
            permittedMaxPriceInr: fairRange.maxPriceInr,
          }
        );
      }
    }

    // Call the database function accept_job_bid for transaction-safe, atomic execution with row-level locks
    const { data: result, error: rpcError } = await supabase!.rpc('accept_job_bid', {
      p_job_id: jobId,
      p_bid_id: bidId,
      p_customer_id: user.id,
    });

    if (rpcError) {
      console.error('[POST /api/jobs/[id]/accept-bid] RPC error:', rpcError.message);
      return apiError('Database transaction failed while accepting bid.', 500, 'DATABASE_ERROR', rpcError.message);
    }

    const responseData = result as {
      success: boolean;
      code?: string;
      error?: string;
      job_id?: string;
      bid_id?: string;
      worker_id?: string;
      accepted_price_inr?: number;
      status?: string;
    };

    if (!responseData || !responseData.success) {
      const statusCode =
        responseData?.code === 'NOT_FOUND'
          ? 404
          : responseData?.code === 'FORBIDDEN'
          ? 403
          : responseData?.code === 'CONFLICT'
          ? 409
          : 400;

      return apiError(
        responseData?.error ?? 'Failed to accept bid.',
        statusCode,
        responseData?.code ?? 'BID_ACCEPTANCE_FAILED'
      );
    }

    return apiSuccess({
      message: 'Bid accepted successfully and job assigned.',
      assignment: {
        jobId: responseData.job_id,
        bidId: responseData.bid_id,
        workerId: responseData.worker_id,
        acceptedPriceInr: responseData.accepted_price_inr,
        status: responseData.status,
      },
    });
  } catch (error) {
    console.error('[POST /api/jobs/[id]/accept-bid] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
