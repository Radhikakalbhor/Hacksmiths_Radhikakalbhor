/**
 * Booking History API: GET /api/bookings
 * Returns bookings for the currently authenticated customer only,
 * enforcing Supabase RLS and server-side session authentication.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingStage, BookingState } from '@/types/booking';

export interface BookingHistoryItem {
  id: string;
  title: string;
  category: string;
  status: string;
  stage: BookingStage;
  workerId: string;
  workerName: string;
  workerCategory: string;
  workerRating: number | null;
  workerExperience: number | null;
  workerAvatarUrl: string | null;
  isDemoWorker: boolean;
  agreedPriceInr: number;
  bookedAt: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  customerReview: {
    rating: number;
    reviewText: string | null;
    createdAt: string | null;
  } | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireAuth(supabase);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;

    // Fetch jobs owned by authenticated customer, ordered newest first
    // Supabase RLS also strictly enforces customer_id = auth.uid()
    const { data: jobs, error: jobsError } = await supabase!
      .from('jobs')
      .select(`
        id,
        customer_id,
        selected_worker_id,
        title,
        category,
        status,
        address_line,
        city,
        pincode,
        created_at,
        started_at,
        completed_at,
        cancelled_at,
        cancellation_reason,
        accepted_price_inr,
        estimated_max_price_inr,
        scheduled_date,
        scheduled_time_slot,
        ai_details
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (jobsError) {
      console.error('[GET /api/bookings] Error fetching customer jobs:', jobsError.message);
      return apiError('Failed to fetch booking history.', 500, 'DATABASE_ERROR');
    }

    if (!jobs || jobs.length === 0) {
      return apiSuccess<BookingHistoryItem[]>([]);
    }

    // Filter jobs that represent bookings
    // A booking exists if ai_details.booking is populated OR the job has progressed beyond 'posted' with an assigned worker
    const bookingJobs = jobs.filter((job) => {
      const rawAi = job.ai_details;
      const aiObj = rawAi && typeof rawAi === 'object' ? (rawAi as Record<string, unknown>) : null;
      const hasBookingState = Boolean(aiObj?.booking);
      const isBookedStatus = ['assigned', 'in_progress', 'completed', 'cancelled'].includes(job.status || '');
      return hasBookingState || (isBookedStatus && Boolean(job.selected_worker_id));
    });

    if (bookingJobs.length === 0) {
      return apiSuccess<BookingHistoryItem[]>([]);
    }

    // Fetch reviews written by this customer for their jobs
    const jobIds = bookingJobs.map((j) => j.id);
    const { data: reviews } = await supabase!
      .from('reviews')
      .select('job_id, rating, review_text, created_at')
      .in('job_id', jobIds);

    const reviewMap = new Map<string, { rating: number; review_text: string | null; created_at: string | null }>();
    if (reviews && Array.isArray(reviews)) {
      for (const rev of reviews) {
        if (rev.job_id) {
          reviewMap.set(rev.job_id, rev);
        }
      }
    }

    // Map each job to a standardized BookingHistoryItem
    const bookingItems: BookingHistoryItem[] = bookingJobs.map((job) => {
      const rawAi = job.ai_details;
      const aiObj = rawAi && typeof rawAi === 'object' ? (rawAi as Record<string, unknown>) : null;
      const bState = aiObj?.booking as BookingState | undefined;

      // Determine stage
      let stage: BookingStage = 'accepted';
      if (bState?.stage) {
        stage = bState.stage;
      } else if (job.status === 'cancelled') {
        stage = 'cancelled';
      } else if (job.status === 'completed') {
        stage = 'completed';
      } else if (job.status === 'in_progress') {
        stage = 'in_progress';
      } else if (job.status === 'assigned') {
        stage = 'accepted';
      }

      // Determine review
      const rev = reviewMap.get(job.id);
      let customerReview: BookingHistoryItem['customerReview'] = null;
      if (rev && typeof rev.rating === 'number') {
        customerReview = {
          rating: rev.rating,
          reviewText: rev.review_text || null,
          createdAt: rev.created_at || null,
        };
      } else if (aiObj?.review && typeof (aiObj.review as { rating?: number }).rating === 'number') {
        const aiRev = aiObj.review as { rating: number; reviewText?: string; review_text?: string; createdAt?: string };
        customerReview = {
          rating: aiRev.rating,
          reviewText: aiRev.reviewText || aiRev.review_text || null,
          createdAt: aiRev.createdAt || null,
        };
      }

      // Agreed price
      const price = bState?.agreedPriceInr ?? (job.accepted_price_inr ? Number(job.accepted_price_inr) : (job.estimated_max_price_inr ? Number(job.estimated_max_price_inr) : 0));

      // Worker profile info
      const workerName = bState?.workerName || 'Professional Service Partner';
      const workerCategory = bState?.workerCategory || job.category;
      const workerRating = typeof bState?.workerRating === 'number' ? bState.workerRating : null;
      const workerExperience = typeof bState?.workerExperience === 'number' ? bState.workerExperience : null;
      const workerAvatarUrl = bState?.workerAvatarUrl || null;
      const isDemoWorker = bState?.isDemoWorker ?? false;

      // Booking date & time
      const bookedAt = bState?.stageUpdatedAt || job.created_at;
      const cancelledAt = job.cancelled_at || (stage === 'cancelled' ? (bState?.stageUpdatedAt || null) : null);
      const cancellationReason = job.cancellation_reason || bState?.cancellationReason || null;
      const completedAt = job.completed_at || (stage === 'completed' ? (bState?.stageUpdatedAt || null) : null);
      const startedAt = job.started_at || null;

      return {
        id: job.id,
        title: job.title || `${workerCategory.charAt(0).toUpperCase() + workerCategory.slice(1)} Service`,
        category: job.category,
        status: job.status,
        stage,
        workerId: bState?.workerId || job.selected_worker_id || '',
        workerName,
        workerCategory,
        workerRating,
        workerExperience,
        workerAvatarUrl,
        isDemoWorker,
        agreedPriceInr: price,
        bookedAt,
        createdAt: job.created_at,
        startedAt,
        completedAt,
        cancelledAt,
        cancellationReason,
        customerReview,
        addressLine: job.address_line,
        city: job.city,
        pincode: job.pincode,
      };
    });

    // Sort newest-first by bookedAt or createdAt
    bookingItems.sort((a, b) => new Date(b.bookedAt || b.createdAt).getTime() - new Date(a.bookedAt || a.createdAt).getTime());

    return apiSuccess<BookingHistoryItem[]>(bookingItems);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      typeof (err as { digest?: unknown }).digest === 'string' &&
      ((err as { digest: string }).digest.startsWith('NEXT_') ||
       (err as { digest: string }).digest.startsWith('DYNAMIC_'))
    ) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[GET /api/bookings] Unexpected error:', message);
    return apiError(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
