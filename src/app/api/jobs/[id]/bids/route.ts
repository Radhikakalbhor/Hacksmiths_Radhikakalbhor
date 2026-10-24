/**
 * Bids API: POST /api/jobs/[id]/bids and GET /api/jobs/[id]/bids
 * Manages worker bidding and role-scoped bid inspection.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole, requireAuth } from '@/lib/auth/server';
import { validateCreateBid } from '@/lib/validations/jobs';
import { JobsService } from '@/lib/services/jobs.service';
import { PricingService } from '@/lib/services/pricing.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient();
    const authResult = await requireRole(supabase, ['worker']);

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

    // Verify the target job exists and is open for bidding
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('[POST /api/jobs/[id]/bids] Job query error:', jobError.message);
      return apiError('Database error retrieving job.', 500, 'DATABASE_ERROR');
    }

    if (!job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    // 1. Prevent self-bidding
    if (job.customer_id === user.id) {
      return apiError('Workers cannot bid on jobs they created.', 400, 'SELF_BIDDING_DISALLOWED');
    }

    // 2. Prevent bids on closed, assigned, or cancelled jobs
    if (!['POSTED', 'BIDDING_OPEN'].includes(job.status)) {
      return apiError(
        `Job is not open for bidding. Current status: '${job.status}'.`,
        409,
        'JOB_NOT_OPEN_FOR_BIDS'
      );
    }

    // Validate the bid input with worker ID guaranteed from session
    const bidPayloadInput = {
      ...(typeof body === 'object' && body !== null ? body : {}),
      jobId,
      workerId: user.id,
    };

    const validation = validateCreateBid(bidPayloadInput as Parameters<typeof validateCreateBid>[0]);

    if (!validation.success || !validation.data) {
      return apiError('Validation failed for bid submission.', 400, 'VALIDATION_ERROR', validation.errors);
    }

    const validatedBid = validation.data;

    // 3. Prevent duplicate active bids
    const { data: existingBid } = await supabase!
      .from('bids')
      .select('id, status')
      .eq('job_id', jobId)
      .eq('worker_id', user.id)
      .maybeSingle();

    if (existingBid && existingBid.status === 'PENDING') {
      return apiError(
        'You have already submitted an active pending bid for this job. You may counter-offer or wait for customer response.',
        409,
        'DUPLICATE_ACTIVE_BID'
      );
    }

    const bidInsert = JobsService.prepareBidInsert(validatedBid);

    let insertedBid;

    if (existingBid && ['WITHDRAWN', 'REJECTED'].includes(existingBid.status)) {
      // Re-activate previously withdrawn/rejected bid with new pricing
      const { data: updated, error: updateError } = await supabase!
        .from('bids')
        .update({
          offered_amount_inr: bidInsert.offered_amount_inr,
          labor_cost_inr: bidInsert.labor_cost_inr,
          materials_estimate_inr: bidInsert.materials_estimate_inr,
          visitation_fee_inr: bidInsert.visitation_fee_inr,
          note: bidInsert.note,
          status: 'PENDING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBid.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('[POST /api/jobs/[id]/bids] Re-activate error:', updateError.message);
        return apiError('Failed to submit updated bid.', 500, 'DATABASE_ERROR');
      }

      insertedBid = updated;
    } else {
      const { data: created, error: insertError } = await supabase!
        .from('bids')
        .insert(bidInsert)
        .select('*')
        .single();

      if (insertError) {
        console.error('[POST /api/jobs/[id]/bids] Insert error:', insertError.message);
        return apiError('Failed to place bid in database.', 500, 'DATABASE_ERROR', insertError.message);
      }

      insertedBid = created;
    }

    // Transition job from POSTED to BIDDING_OPEN if this is the first bid
    if (job.status === 'POSTED') {
      await supabase!
        .from('jobs')
        .update({ status: 'BIDDING_OPEN', updated_at: new Date().toISOString() })
        .eq('id', jobId);
    }

    // Benchmark comparison evaluation
    let benchmarkComparison = null;
    const benchmark = await PricingService.fetchBenchmarkForArea(
      supabase!,
      job.category,
      job.city,
      job.address_line
    );

    if (benchmark) {
      const evaluation = PricingService.evaluateBidAgainstBenchmark(
        insertedBid.offered_amount_inr,
        benchmark
      );
      benchmarkComparison = {
        evaluation,
        benchmarkMedianInr: benchmark.median_price_inr,
        benchmarkRangeInr: [benchmark.min_price_inr, benchmark.max_price_inr],
      };
    }

    return apiSuccess(
      {
        bid: insertedBid,
        benchmarkComparison,
      },
      201
    );
  } catch (error) {
    console.error('[POST /api/jobs/[id]/bids] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient();
    const authResult = await requireAuth(supabase);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user, profile } = authResult.context;

    // Verify job exists
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('id, customer_id, status')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    const isCustomerOwner = job.customer_id === user.id;
    const isAdmin = profile.role === 'admin';
    const isWorker = profile.role === 'worker';

    // 1. Customer or Admin: Can view all bids with worker public summary
    if (isCustomerOwner || isAdmin) {
      const { data: bids, error: bidsError } = await supabase!
        .from('bids')
        .select(`
          id,
          job_id,
          worker_id,
          offered_amount_inr,
          labor_cost_inr,
          materials_estimate_inr,
          visitation_fee_inr,
          note,
          counter_offers,
          status,
          created_at,
          worker:profiles!bids_worker_id_fkey(
            id,
            full_name,
            avatar_url,
            primary_city
          )
        `)
        .eq('job_id', jobId)
        .order('offered_amount_inr', { ascending: true });

      if (bidsError) {
        console.error('[GET /api/jobs/[id]/bids] Error:', bidsError.message);
        return apiError('Failed to fetch bids for job.', 500, 'DATABASE_ERROR');
      }

      return apiSuccess({
        jobId,
        bids: bids ?? [],
        totalBids: bids?.length ?? 0,
      });
    }

    // 2. Worker: Can only view their own bid (never competitor bids or contact details)
    if (isWorker) {
      const { data: myBid, error: myBidError } = await supabase!
        .from('bids')
        .select('*')
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .maybeSingle();

      if (myBidError) {
        console.error('[GET /api/jobs/[id]/bids] Worker bid query error:', myBidError.message);
        return apiError('Failed to fetch bid.', 500, 'DATABASE_ERROR');
      }

      return apiSuccess({
        jobId,
        myBid: myBid ?? null,
      });
    }

    return apiError('Access denied: You are not authorized to view bids for this job.', 403, 'FORBIDDEN');
  } catch (error) {
    console.error('[GET /api/jobs/[id]/bids] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
