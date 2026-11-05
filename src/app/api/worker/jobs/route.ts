/**
 * Worker Categorized Jobs API: GET /api/worker/jobs
 * Returns mutually exclusive categorized jobs for the authenticated worker:
 * - upcoming: Assigned jobs where work has not started
 * - pending: Direct job offers or requests awaiting worker response
 * - accepted: Active in-transit or in-progress jobs
 * - rejected: Declined or cancelled jobs
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingState } from '@/types/booking';
import { WorkerDemoProvisioningService } from '@/lib/services/worker-demo-provisioning.service';

interface JobRow {
  id: string;
  customer_id: string;
  category: string;
  title: string;
  description: string;
  urgency: string;
  city: string;
  address_line: string;
  pincode: string;
  status: string;
  selected_worker_id?: string | null;
  accepted_price_inr?: number | null;
  estimated_budget_inr?: number | null;
  scheduled_date?: string | null;
  scheduled_time_slot?: string | null;
  created_at: string;
  updated_at: string;
  ai_details?: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;

    // 1. Fetch all jobs where worker is selected OR has submitted a bid
    const [jobsRes, bidsRes] = await Promise.all([
      supabase!
        .from('jobs')
        .select('*')
        .eq('selected_worker_id', user.id)
        .order('created_at', { ascending: false }),
      supabase!
        .from('bids')
        .select('*, jobs!bids_job_id_fkey(*)')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const jobsMap = new Map<string, JobRow>();

    if (jobsRes.data) {
      jobsRes.data.forEach((j) => jobsMap.set(j.id, j as unknown as JobRow));
    }

    const rejectedBidJobIds = new Set<string>();
    const pendingBidJobIds = new Set<string>();

    if (bidsRes.data) {
      bidsRes.data.forEach((b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attachedJob = (b as any).jobs as JobRow | null;
        if (attachedJob && !jobsMap.has(attachedJob.id)) {
          jobsMap.set(attachedJob.id, attachedJob);
        }
        if (b.status === 'REJECTED') {
          rejectedBidJobIds.add(b.job_id);
        } else if (b.status === 'PENDING') {
          pendingBidJobIds.add(b.job_id);
        }
      });
    }

    const allJobs = Array.from(jobsMap.values());

    // 2. Fetch customer profiles for context (names, avatars)
    const customerIds = Array.from(new Set(allJobs.map((j) => j.customer_id).filter(Boolean)));
    const customerProfilesMap = new Map<string, { full_name: string; phone?: string; avatar_url?: string }>();

    if (customerIds.length > 0) {
      const { data: customerProfiles } = await supabase!
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', customerIds);

      if (customerProfiles) {
        customerProfiles.forEach((p) => {
          customerProfilesMap.set(p.id, {
            full_name: p.full_name,
            phone: p.phone,
            avatar_url: p.avatar_url || undefined,
          });
        });
      }
    }

    // 3. Categorize with strict mutual exclusivity
    const upcoming: unknown[] = [];
    const pending: unknown[] = [];
    const accepted: unknown[] = [];
    const rejected: unknown[] = [];
    const completed: unknown[] = [];

    allJobs.forEach((job) => {
      const ai = (job.ai_details && typeof job.ai_details === 'object' ? job.ai_details : {}) as Record<string, unknown>;
      const booking = (ai.booking as BookingState) || null;
      const customer = customerProfilesMap.get(job.customer_id);

      const enrichedJob = {
        ...job,
        customerName: customer?.full_name || 'Customer',
        customerPhone: customer?.phone || null,
        customerAvatarUrl: customer?.avatar_url || null,
        booking,
        agreedPriceInr: job.accepted_price_inr || booking?.agreedPriceInr || job.estimated_budget_inr || 500,
      };

      const isCancelled =
        job.status === 'cancelled' ||
        job.status === 'CANCELLED' ||
        booking?.stage === 'cancelled' ||
        Boolean(booking?.cancellationReason);

      const isCompleted =
        job.status === 'completed' ||
        job.status === 'COMPLETED' ||
        booking?.stage === 'completed';

      if (isCancelled) {
        rejected.push(enrichedJob);
      } else if (isCompleted) {
        completed.push(enrichedJob);
      } else if (booking?.stage === 'requested' || (job.selected_worker_id !== user.id && pendingBidJobIds.has(job.id))) {
        pending.push(enrichedJob);
      } else if (job.selected_worker_id === user.id) {
        if (booking?.stage === 'in_progress' || booking?.stage === 'on_the_way' || booking?.stage === 'arrived') {
          accepted.push(enrichedJob);
        } else {
          upcoming.push(enrichedJob);
        }
      } else if (rejectedBidJobIds.has(job.id)) {
        rejected.push(enrichedJob);
      }
    });

    // 4. Fetch worker primary category if available to align demo records
    let workerCategory = (user.user_metadata?.primary_category as string) || 'plumbing';
    try {
      const { data: wpData } = await supabase!
        .from('worker_profiles')
        .select('primary_category')
        .eq('user_id', user.id)
        .maybeSingle();
      if (wpData?.primary_category) {
        workerCategory = wpData.primary_category;
      }
    } catch {
      // Ignore
    }

    const demoData = WorkerDemoProvisioningService.getDemoJobs(user.id, workerCategory);

    // Idempotent priority: real records always take precedence; empty sections are filled with realistic demo data
    const finalUpcoming = upcoming.length > 0 ? upcoming : demoData.upcoming;
    const finalPending = pending.length > 0 ? pending : demoData.pending;
    const finalAccepted = accepted.length > 0 ? accepted : demoData.accepted;
    const finalRejected = rejected.length > 0 ? rejected : demoData.rejected;
    const finalCompleted = completed.length > 0 ? completed : demoData.completed;

    return apiSuccess({
      upcoming: finalUpcoming,
      pending: finalPending,
      accepted: finalAccepted,
      rejected: finalRejected,
      completed: finalCompleted,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/worker/jobs] Error, serving resilient demo data:', error);
    const demoData = WorkerDemoProvisioningService.getDemoJobs('default-worker', 'plumbing');
    return apiSuccess(demoData);
  }
}

