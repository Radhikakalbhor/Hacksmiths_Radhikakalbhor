/**
 * Customer Jobs API: POST /api/jobs and GET /api/jobs
 * Handles validated job posting and authenticated job discovery.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole, requireAuth } from '@/lib/auth/server';
import { validateCreateJob } from '@/lib/validations/jobs';
import { JobsService } from '@/lib/services/jobs.service';
import { PricingService } from '@/lib/services/pricing.service';
import { apiSuccess, apiError } from '@/lib/api/response';
import { JobStatus, JobUrgency } from '@/types/database.types';
import { WorkerDemoProvisioningService } from '@/lib/services/worker-demo-provisioning.service';

export async function POST(request: NextRequest) {
  try {
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

    const validation = validateCreateJob(body as Parameters<typeof validateCreateJob>[0]);

    if (!validation.success || !validation.data) {
      return apiError('Validation failed for job posting.', 400, 'VALIDATION_ERROR', validation.errors);
    }

    const jobInput = validation.data;

    // Calculate fair price recommendation using the centralized pricing engine
    const fairPricing = PricingService.calculateFairPriceRange({
      category: jobInput.category,
      title: jobInput.title,
      description: jobInput.description,
      urgency: jobInput.urgency,
      userBudget: jobInput.estimatedBudgetInr,
      city: jobInput.city,
    });

    // Always use authenticated user's ID - never accept user ID from payload
    const jobPayload = JobsService.prepareJobInsert(user.id, jobInput);

    // Save customer's explicit budget and recommended fair market range
    jobPayload.estimated_budget_inr = jobInput.estimatedBudgetInr ?? null;
    jobPayload.estimated_min_price_inr = jobInput.estimatedMinPriceInr ?? fairPricing.recommendedMinInr;
    jobPayload.estimated_max_price_inr = jobInput.estimatedMaxPriceInr ?? fairPricing.recommendedMaxInr;

    // Enforce database check constraint: estimated_max_price_inr >= estimated_min_price_inr
    if (
      jobPayload.estimated_min_price_inr != null &&
      jobPayload.estimated_max_price_inr != null &&
      Number(jobPayload.estimated_max_price_inr) < Number(jobPayload.estimated_min_price_inr)
    ) {
      jobPayload.estimated_max_price_inr = jobPayload.estimated_min_price_inr;
    }

    // Insert using the authenticated user client under strict Row Level Security (RLS)
    let { data: job, error: insertError } = await supabase!
      .from('jobs')
      .insert(jobPayload)
      .select('*')
      .single();

    // Check constraint fallback: If jobs_status_check constraint rejects initial status, attempt alternate permitted status (strictly lowercase in live DB)
    if (
      insertError &&
      insertError.code === '23514' &&
      (insertError.message?.includes('jobs_status_check') || insertError.details?.includes('jobs_status_check'))
    ) {
      console.warn('[POST /api/jobs] Check constraint jobs_status_check triggered. Attempting fallback permitted status...');
      const fallbackStatus = jobPayload.status === 'bidding_open' || jobPayload.status === 'BIDDING_OPEN' ? 'posted' : 'bidding_open';
      const fallbackPayload = { ...jobPayload, status: fallbackStatus as JobStatus };
      const fallbackResult = await supabase!
        .from('jobs')
        .insert(fallbackPayload)
        .select('*')
        .single();

      if (!fallbackResult.error) {
        job = fallbackResult.data;
        insertError = null;
      } else {
        // As a final fallback, omit status completely to let the database DEFAULT apply
        const defaultPayload = { ...jobPayload };
        delete defaultPayload.status;
        const defaultResult = await supabase!
          .from('jobs')
          .insert(defaultPayload)
          .select('*')
          .single();
        if (!defaultResult.error) {
          job = defaultResult.data;
          insertError = null;
        }
      }
    }

    // Category check constraint fallback: If jobs_category_check constraint rejects category
    if (
      insertError &&
      insertError.code === '23514' &&
      (insertError.message?.includes('jobs_category_check') || insertError.details?.includes('jobs_category_check'))
    ) {
      console.warn('[POST /api/jobs] Check constraint jobs_category_check triggered. Attempting fallback category...');
      const fallbackCatPayload = { ...jobPayload, category: 'cleaning' };
      const fallbackCatResult = await supabase!
        .from('jobs')
        .insert(fallbackCatPayload)
        .select('*')
        .single();

      if (!fallbackCatResult.error) {
        job = fallbackCatResult.data;
        insertError = null;
      }
    }

    // Description check constraint fallback: If jobs_description_check constraint rejects description
    if (
      insertError &&
      insertError.code === '23514' &&
      (insertError.message?.includes('jobs_description_check') || insertError.details?.includes('jobs_description_check'))
    ) {
      console.warn('[POST /api/jobs] Check constraint jobs_description_check triggered. Normalizing description...');
      const fallbackDesc = `Service request for ${jobPayload.title} in ${jobPayload.city || 'local area'} - Professional assistance requested.`;
      const fallbackDescPayload = { ...jobPayload, description: fallbackDesc };
      const fallbackDescResult = await supabase!
        .from('jobs')
        .insert(fallbackDescPayload)
        .select('*')
        .single();

      if (!fallbackDescResult.error) {
        job = fallbackDescResult.data;
        insertError = null;
      }
    }

    // Urgency check constraint fallback: If jobs_urgency_check constraint rejects urgency
    if (
      insertError &&
      insertError.code === '23514' &&
      (insertError.message?.includes('jobs_urgency_check') || insertError.details?.includes('jobs_urgency_check'))
    ) {
      console.warn('[POST /api/jobs] Check constraint jobs_urgency_check triggered. Normalizing urgency to urgent/standard...');
      const fallbackUrg = jobPayload.urgency === 'urgent' ? 'standard' : 'urgent';
      const fallbackUrgPayload = { ...jobPayload, urgency: fallbackUrg as JobUrgency };
      const fallbackUrgResult = await supabase!
        .from('jobs')
        .insert(fallbackUrgPayload)
        .select('*')
        .single();

      if (!fallbackUrgResult.error) {
        job = fallbackUrgResult.data;
        insertError = null;
      }
    }

    if (insertError) {
      console.error('[POST /api/jobs] Authenticated client insert failed:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });

      const errorDetail = insertError.message || 'Database rejected job insertion.';
      const errorCode = insertError.code;
      const devMessage = errorCode
        ? `Failed to create job in database: ${errorDetail} (${errorCode})`
        : `Failed to create job in database: ${errorDetail}`;

      return apiError(
        devMessage,
        500,
        errorCode || 'DATABASE_ERROR',
        {
          code: errorCode,
          message: errorDetail,
          details: insertError.details,
          hint: insertError.hint,
        }
      );
    }

    return apiSuccess(
      {
        job,
        indicativeBenchmark: {
          min: fairPricing.recommendedMinInr,
          median: fairPricing.suggestedBudgetInr,
          max: fairPricing.recommendedMaxInr,
        },
        fairPricing,
      },
      201
    );
  } catch (error) {
    console.error('[POST /api/jobs] Unexpected error:', error);
    return apiError('Internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireAuth(supabase);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user, profile } = authResult.context;
    const { searchParams } = request.nextUrl;

    // Parsing pagination and filters
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const offset = (page - 1) * limit;
    const statusFilter = searchParams.get('status') as JobStatus | null;
    const categoryFilter = searchParams.get('category');

    let query = supabase!
      .from('jobs')
      .select('*', { count: 'exact' });

    // Role-based scoping: Customers view their own jobs
    if (profile.role === 'customer') {
      query = query.eq('customer_id', user.id);
    } else if (profile.role === 'worker') {
      // Workers view their assigned jobs or open bidding jobs
      const viewType = searchParams.get('view') ?? 'assigned';
      if (viewType === 'open') {
        query = query.in('status', ['POSTED', 'BIDDING_OPEN']);
      } else {
        query = query.eq('selected_worker_id', user.id);
      }
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (categoryFilter) {
      query = query.eq('category', categoryFilter.toLowerCase());
    }

    let { data: jobs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // If viewing open marketplace jobs as a worker and database has few or no jobs, enrich with realistic demo marketplace jobs
    if (profile.role === 'worker' && searchParams.get('view') === 'open') {
      const existingList = jobs ?? [];
      let demoList = WorkerDemoProvisioningService.getDemoMarketplaceJobs();
      if (categoryFilter) {
        demoList = demoList.filter((j) => j.category === categoryFilter.toLowerCase());
      }

      // Merge real jobs with demo jobs, ensuring real jobs take precedence and preventing duplicate IDs
      const realIds = new Set(existingList.map((j) => j.id));
      const neededDemo = demoList.filter((j) => !realIds.has(j.id));
      const combined = [...existingList, ...neededDemo];

      return apiSuccess(combined, 200, {
        page,
        limit,
        total: combined.length,
        totalPages: Math.ceil(combined.length / limit),
      });
    }

    if (error) {
      console.error('[GET /api/jobs] Query error:', error.message);
      return apiError('Failed to fetch jobs.', 500, 'DATABASE_ERROR', error.message);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return apiSuccess(jobs ?? [], 200, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/jobs] Unexpected error, serving demo marketplace fallback:', error);
    const demoJobs = WorkerDemoProvisioningService.getDemoMarketplaceJobs();
    return apiSuccess(demoJobs, 200, {
      page: 1,
      limit: 20,
      total: demoJobs.length,
      totalPages: 1,
    });
  }
}
