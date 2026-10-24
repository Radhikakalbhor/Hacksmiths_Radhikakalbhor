/**
 * Job Detail API: GET /api/jobs/[id]
 * Enforces role-based privacy and returns permitted bid information.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';

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

    // Fetch the job record
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('[GET /api/jobs/[id]] Query error:', jobError.message);
      return apiError('Failed to fetch job details.', 500, 'DATABASE_ERROR');
    }

    if (!job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    const isCustomerOwner = job.customer_id === user.id;
    const isAssignedWorker = job.selected_worker_id === user.id;
    const isOpenForBidding = ['POSTED', 'BIDDING_OPEN'].includes(job.status);
    const isWorker = profile.role === 'worker';
    const isAdmin = profile.role === 'admin';

    // Authorization check
    if (!isCustomerOwner && !isAssignedWorker && !(isWorker && isOpenForBidding) && !isAdmin) {
      return apiError(
        'Access denied: You are not authorized to view this job.',
        403,
        'FORBIDDEN'
      );
    }

    // 1. If customer owns the job: Include all bids with worker reputation details
    if (isCustomerOwner || isAdmin) {
      const { data: bids } = await supabase!
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

      return apiSuccess({
        job,
        bids: bids ?? [],
        viewerRole: 'customer',
      });
    }

    // 2. If assigned worker: Include full job and their winning bid
    if (isAssignedWorker) {
      const { data: winningBid } = await supabase!
        .from('bids')
        .select('*')
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .maybeSingle();

      return apiSuccess({
        job,
        myBid: winningBid,
        viewerRole: 'assigned_worker',
      });
    }

    // 3. If worker viewing an open job: Obfuscate private house address until assigned
    // and check if worker has an existing bid
    const { data: myBid } = await supabase!
      .from('bids')
      .select('*')
      .eq('job_id', jobId)
      .eq('worker_id', user.id)
      .maybeSingle();

    const sanitizedJob = {
      ...job,
      address_line: `${job.city}, ${job.pincode} (Exact address revealed upon assignment)`,
    };

    return apiSuccess({
      job: sanitizedJob,
      myBid: myBid ?? null,
      viewerRole: 'prospective_worker',
    });
  } catch (error) {
    console.error('[GET /api/jobs/[id]] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
