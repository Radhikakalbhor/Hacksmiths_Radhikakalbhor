/**
 * Job Detail API: GET /api/jobs/[id]
 * Enforces role-based privacy and returns permitted bid information.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { PricingService } from '@/lib/services/pricing.service';
import { WorkersService } from '@/lib/services/workers.service';

export async function GET(
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
    const isOpenForBidding = ['POSTED', 'BIDDING_OPEN', 'posted', 'bidding_open'].includes(job.status);
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
      let { data: bids } = await supabase!
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

      // If job is open and has 0 bids, auto-seed realistic bids from nearby verified workers
      if ((!bids || bids.length === 0) && isOpenForBidding) {
        try {
          const locField = job.service_location ?? job.location_point;
          let lat = 19.076;
          let lng = 72.8777;
          if (typeof locField === 'string') {
            const match = locField.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          }

          const nearbyCandidates = await WorkersService.queryNearbyWorkers(supabase!, {
            originLat: lat,
            originLng: lng,
            radiusMeters: 25000,
            categoryFilter: job.category,
            maxResults: 5,
          });

          if (nearbyCandidates && nearbyCandidates.length > 0) {
            const adminClient = getSupabaseAdminClient();
            const clientToUse = adminClient || supabase!;

            const notesByTrade: Record<string, string[]> = {
              appliance_repair: [
                'Certified technician with diagnostic tools and replacement parts in van. Ready to inspect today.',
                'Experienced appliance repair specialist. Full inspection of motor, thermostat, and electrical wiring.',
                'Fast response in your neighborhood. Same-day troubleshooting with genuine replacement parts.',
                'Specialist in domestic appliance diagnosis and servicing. 6-month repair warranty included.',
              ],
              plumbing: [
                'Equipped with heavy-duty sealant tape, spare angle valves, and pipe fittings for immediate resolution.',
                'Prompt response for leakage emergencies. Experienced in residential pipe and drain overhaul.',
                'Certified plumbing partner in your locality. Clean, professional workmanship guaranteed.',
                'Specialist in residential fixtures, tap cartridges, and drain clearing.',
              ],
              electrical: [
                'Licensed wireman carrying voltage testers and spare circuit breakers for immediate diagnosis.',
                'Residential electrician. Complete check of switchboard, MCB, and earthing lines.',
                'Prompt inspection and safe fault isolation. Fully equipped for domestic wiring repairs.',
                'Specialist in home power restoration and fixture wiring. Verified partner.',
              ],
              cleaning: [
                'Equipped with eco-friendly sanitizing solutions and industrial-grade vacuum equipment.',
                'Experienced deep cleaning specialist covering your area. Thorough room hygiene guaranteed.',
                'Full sanitization and stain removal using professional non-toxic cleaning agents.',
                'Prompt domestic housekeeping and deep surface restoration.',
              ],
            };

            const categoryKey = (job.category || 'other').toLowerCase();
            const tradeNotes = notesByTrade[categoryKey] || [
              'Verified local professional ready to inspect and resolve your request today.',
              'Experienced service partner in your locality. Prompt arrival and verified service.',
              'Equipped with tools and materials for immediate diagnosis and completion.',
              'Specialist in domestic service requests with verified track record.',
            ];

            for (let i = 0; i < nearbyCandidates.length; i++) {
              const w = nearbyCandidates[i];
              // Real registered workers submit their own bids; only demo candidates provide instant simulated bids
              if (w.worker_source === 'real' || !w.is_demo) {
                continue;
              }
              const quoteRes = PricingService.calculateWorkerQuoteForJob(w, job);
              const laborCost = Math.round(quoteRes.quoteInr * 0.75);
              const materialsEstimate = quoteRes.quoteInr - laborCost;
              const note = tradeNotes[i % tradeNotes.length];

              const bidPayload = {
                job_id: jobId,
                worker_id: w.worker_id,
                offered_amount_inr: quoteRes.quoteInr,
                proposed_amount: quoteRes.quoteInr,
                labor_cost_inr: laborCost,
                materials_estimate_inr: materialsEstimate,
                visitation_fee_inr: 0,
                status: 'PENDING' as const,
                note,
              };

              const { error: insErr } = await clientToUse.from('bids').insert(bidPayload);
              if (insErr && (insErr.message?.includes('enum') || insErr.message?.includes('check constraint'))) {
                await (clientToUse.from('bids') as any).insert({ ...bidPayload, status: 'submitted' });
              }
            }

            // Re-fetch fresh bids with worker profile relations
            const { data: freshBids } = await supabase!
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

            if (freshBids && freshBids.length > 0) {
              bids = freshBids;
            }
          }
        } catch (autoBidErr) {
          console.warn('[GET /api/jobs/[id]] Auto-bids provision notice:', autoBidErr);
        }
      }

      // Fetch matching price benchmark for locality
      const benchmark = await PricingService.fetchBenchmarkForArea(
        supabase!,
        job.category,
        job.city,
        job.address_line
      );

      // Fetch existing customer review for this job
      const { data: review } = await supabase!
        .from('reviews')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      return apiSuccess({
        job,
        bids: bids ?? [],
        benchmark: benchmark
          ? {
              category: benchmark.category,
              city: benchmark.city,
              microMarketArea: benchmark.micro_market_area,
              minPriceInr: benchmark.min_price_inr,
              medianPriceInr: benchmark.median_price_inr,
              maxPriceInr: benchmark.max_price_inr,
            }
          : null,
        review: review ?? null,
        viewerRole: 'customer',
      });
    }

    // Helper to sanitize sensitive customer fields (like OTP) for workers/public
    const sanitizeJobForNonCustomer = <T extends Record<string, unknown>>(rawJob: T): T => {
      const jobWithAi = rawJob as { ai_details?: unknown };
      if (!jobWithAi.ai_details || typeof jobWithAi.ai_details !== 'object') return rawJob;
      const details = { ...(jobWithAi.ai_details as Record<string, unknown>) };
      if (details.booking && typeof details.booking === 'object') {
        const bookingCopy = { ...(details.booking as Record<string, unknown>) };
        delete bookingCopy.customerOtp;
        details.booking = bookingCopy;
      }
      return { ...rawJob, ai_details: details };
    };

    // 2. If assigned worker: Include sanitized job and winning bid
    if (isAssignedWorker) {
      const { data: winningBid } = await supabase!
        .from('bids')
        .select('*')
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .maybeSingle();

      return apiSuccess({
        job: sanitizeJobForNonCustomer(job),
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
      ...sanitizeJobForNonCustomer(job),
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
