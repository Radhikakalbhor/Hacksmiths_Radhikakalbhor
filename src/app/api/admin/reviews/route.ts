import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { moderateReview } from '@/lib/services/admin.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { data, error } = await adminClient
    .from('review_flags')
    .select(`
      id,
      review_id,
      reason,
      status,
      created_at,
      reviews!review_flags_review_id_fkey(
        id,
        rating,
        comment,
        customer_id,
        worker_id,
        customer:profiles!reviews_customer_id_fkey(full_name),
        worker:profiles!reviews_worker_id_fkey(full_name)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return apiError(error.message, 500, 'DB_ERROR');

  const formatted = (data || []).map((rf: Record<string, unknown>) => {
    const rev = Array.isArray(rf.reviews) ? (rf.reviews[0] as Record<string, unknown>) : (rf.reviews as Record<string, unknown>);
    const cust = Array.isArray(rev?.customer) ? (rev.customer[0] as Record<string, unknown>) : (rev?.customer as Record<string, unknown>);
    const wrk = Array.isArray(rev?.worker) ? (rev.worker[0] as Record<string, unknown>) : (rev?.worker as Record<string, unknown>);

    return {
      id: String(rf.id),
      reviewId: String(rf.review_id),
      workerId: rev?.worker_id ? String(rev.worker_id) : undefined,
      workerName: String(wrk?.full_name || 'Worker'),
      customerId: rev?.customer_id ? String(rev.customer_id) : undefined,
      customerName: String(cust?.full_name || 'Customer'),
      rating: Number(rev?.rating || 5),
      reviewComment: String(rev?.comment || 'No comment provided'),
      reason: String(rf.reason),
      status: String(rf.status),
      createdAt: String(rf.created_at),
    };
  });

  return apiSuccess(formatted);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { reviewId, action, reason } = body;

    if (!reviewId || !['HIDE', 'RESTORE', 'REMOVE'].includes(action)) {
      return apiError('Invalid review moderation parameters', 400, 'INVALID_INPUT');
    }

    const result = await moderateReview(auth.admin.userId, {
      reviewId,
      action,
      reason: reason || `Admin action: ${action}`,
    });

    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Review moderation failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}

