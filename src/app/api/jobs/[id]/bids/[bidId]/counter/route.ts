/**
 * Counter-Offer API: POST /api/jobs/[id]/bids/[bidId]/counter
 * Supports transparent negotiations while preserving historical counter-offer audits.
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bidId: string }> }
) {
  try {
    const { id: jobId, bidId } = await params;

    if (!jobId || !bidId) {
      return apiError('Job ID and Bid ID parameters are required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient();
    const authResult = await requireAuth(supabase);

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

    const payload = body as { proposedAmountInr?: number; message?: string };

    if (
      typeof payload.proposedAmountInr !== 'number' ||
      payload.proposedAmountInr <= 0
    ) {
      return apiError(
        'Proposed counter-offer amount must be a number greater than zero.',
        400,
        'INVALID_AMOUNT'
      );
    }

    if (payload.message && payload.message.length > 300) {
      return apiError(
        'Counter-offer message cannot exceed 300 characters.',
        400,
        'MESSAGE_TOO_LONG'
      );
    }

    // Retrieve target job
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('id, customer_id, status')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    if (!['POSTED', 'BIDDING_OPEN'].includes(job.status)) {
      return apiError(
        `Cannot negotiate on a job that is not open for bidding. Current status: '${job.status}'.`,
        409,
        'JOB_NOT_OPEN'
      );
    }

    // Retrieve target bid
    const { data: bid, error: bidError } = await supabase!
      .from('bids')
      .select('*')
      .eq('id', bidId)
      .eq('job_id', jobId)
      .maybeSingle();

    if (bidError || !bid) {
      return apiError('Bid not found for this job.', 404, 'NOT_FOUND');
    }

    if (bid.status !== 'PENDING') {
      return apiError(
        `Cannot counter a bid with status '${bid.status}'. Only PENDING bids can be negotiated.`,
        409,
        'BID_NOT_PENDING'
      );
    }

    // Verify authorization: caller must be either the owning customer or the bidding worker
    const isCustomer = job.customer_id === user.id;
    const isWorker = bid.worker_id === user.id;

    if (!isCustomer && !isWorker) {
      return apiError(
        'Access denied: You must be either the job customer or the bidding worker to submit a counter-offer.',
        403,
        'FORBIDDEN'
      );
    }

    const proposedByRole = isCustomer ? 'customer' : 'worker';

    // Parse existing counter_offers history array
    const existingHistory = Array.isArray(bid.counter_offers) ? bid.counter_offers : [];

    const newCounterEntry = {
      id: crypto.randomUUID(),
      proposedByRole,
      proposedByUserId: user.id,
      previousAmountInr: bid.offered_amount_inr,
      proposedAmountInr: payload.proposedAmountInr,
      message: payload.message?.trim() ?? null,
      createdAt: new Date().toISOString(),
    };

    const updatedHistory = [...existingHistory, newCounterEntry];

    // Atomically persist updated offer amount and historical audit trail
    const { data: updatedBid, error: updateError } = await supabase!
      .from('bids')
      .update({
        offered_amount_inr: payload.proposedAmountInr,
        counter_offers: updatedHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bidId)
      .select('*')
      .single();

    if (updateError) {
      console.error('[POST /api/jobs/[id]/bids/[bidId]/counter] Update error:', updateError.message);
      return apiError('Failed to update counter-offer in database.', 500, 'DATABASE_ERROR');
    }

    return apiSuccess({
      bid: updatedBid,
      newCounterOffer: newCounterEntry,
      totalNegotiationRounds: updatedHistory.length,
    });
  } catch (error) {
    console.error('[POST /api/jobs/[id]/bids/[bidId]/counter] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
