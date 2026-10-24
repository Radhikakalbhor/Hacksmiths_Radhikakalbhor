/**
 * Job Reviews & Ratings API: POST & GET /api/jobs/[id]/review
 * Allows authenticated customers to submit verified ratings and reviews for genuinely completed jobs.
 * Enforces job ownership, completion status, and single-review constraint.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/server';
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

    const supabase = await getSupabaseServerClient(request);
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

    const payload = body as {
      rating?: number;
      reviewText?: string;
      punctualityRating?: number;
      qualityRating?: number;
      behaviorRating?: number;
    };

    const rating = Math.round(Number(payload.rating));
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return apiError('Rating must be an integer between 1 and 5.', 400, 'INVALID_RATING');
    }

    // 1. Fetch Job
    const { data: job, error: jobError } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    // 2. Ownership check: Only customer who posted the job can review
    if (job.customer_id !== user.id) {
      return apiError(
        'Access denied: Only the customer who posted this service request can submit a review.',
        403,
        'FORBIDDEN'
      );
    }

    // 3. Completion check: Job must be genuinely completed
    const rawAi = job.ai_details;
    const aiObj = rawAi && typeof rawAi === 'object' ? (rawAi as Record<string, unknown>) : null;
    const bookingStage = (aiObj?.booking as { stage?: string })?.stage;
    const isCompleted =
      ['completed', 'COMPLETED'].includes(job.status) ||
      bookingStage === 'completed';

    if (!isCompleted) {
      return apiError(
        'Reviews can only be submitted after the service has been genuinely completed.',
        400,
        'JOB_NOT_COMPLETED'
      );
    }

    // 4. One review per eligible job check
    const adminClient = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (adminClient || supabase) as any;

    const { data: existingReview } = await client
      .from('reviews')
      .select('id, rating, review_text, created_at')
      .eq('job_id', jobId)
      .maybeSingle();

    if (existingReview) {
      return apiError(
        'A review has already been submitted for this completed job.',
        409,
        'DUPLICATE_REVIEW'
      );
    }

    // 5. Resolve worker profile ID
    const assignedWorkerUserId =
      job.selected_worker_id ||
      (aiObj?.booking as { workerId?: string })?.workerId;

    if (!assignedWorkerUserId) {
      return apiError(
        'No worker was recorded as assigned to this service request.',
        400,
        'WORKER_NOT_ASSIGNED'
      );
    }

    let workerProfileId = assignedWorkerUserId;
    const { data: wp } = await client
      .from('worker_profiles')
      .select('id, user_id')
      .or(`user_id.eq.${assignedWorkerUserId},id.eq.${assignedWorkerUserId}`)
      .maybeSingle();

    if (wp) {
      workerProfileId = wp.id;
    }

    // 6. Insert review into public.reviews table
    const punctuality = payload.punctualityRating ? Math.round(Number(payload.punctualityRating)) : rating;
    const quality = payload.qualityRating ? Math.round(Number(payload.qualityRating)) : rating;
    const behavior = payload.behaviorRating ? Math.round(Number(payload.behaviorRating)) : rating;
    const reviewText = payload.reviewText?.trim() || null;

    const insertPayload = {
      job_id: jobId,
      customer_id: user.id,
      worker_id: workerProfileId,
      rating: rating,
      rating_overall: rating,
      rating_punctuality: punctuality,
      rating_work_quality: quality,
      rating_behavior: behavior,
      punctuality_rating: punctuality,
      quality_rating: quality,
      review_text: reviewText,
    };

    const { data: insertedReview, error: insertError } = await client
      .from('reviews')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[POST /api/jobs/[id]/review] Error inserting review:', insertError.message);
      return apiError(insertError.message, 500, 'DATABASE_ERROR');
    }

    // 7. Sync review into jobs.ai_details for immediate frontend view consistency
    const updatedAiDetails = {
      ...aiObj,
      review: {
        rating,
        reviewText,
        createdAt: insertedReview.created_at || new Date().toISOString(),
      },
    };

    await client
      .from('jobs')
      .update({ ai_details: updatedAiDetails })
      .eq('id', jobId);

    // 8. Update worker_profiles average reputation score
    const { data: allWorkerReviews } = await client
      .from('reviews')
      .select('rating, rating_overall')
      .eq('worker_id', workerProfileId);

    if (allWorkerReviews && Array.isArray(allWorkerReviews) && allWorkerReviews.length > 0) {
      const sum = allWorkerReviews.reduce((acc, r) => acc + (r.rating_overall || r.rating || 5), 0);
      const avg = Math.round((sum / allWorkerReviews.length) * 10) / 10;

      await client
        .from('worker_profiles')
        .update({ reputation_score: avg })
        .eq('id', workerProfileId);
    }

    return apiSuccess(insertedReview, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[POST /api/jobs/[id]/review] Unexpected error:', msg);
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (getSupabaseAdminClient() || supabase) as any;
    const { data: review, error } = await client
      .from('reviews')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[GET /api/jobs/[id]/review] Query error:', error.message);
      return apiError('Failed to fetch review.', 500, 'DATABASE_ERROR');
    }

    return apiSuccess(review ?? null);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[GET /api/jobs/[id]/review] Unexpected error:', msg);
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}
