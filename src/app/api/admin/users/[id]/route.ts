import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { id } = await context.params;

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (profileErr || !profile) {
    return apiError('User not found', 404, 'NOT_FOUND');
  }

  // If worker, fetch worker profile
  let workerDetails = null;
  if (profile.role === 'worker') {
    const { data: worker } = await adminClient
      .from('worker_profiles')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();
    workerDetails = worker;
  }

  // Fetch recent jobs (customer created or worker assigned)
  const { data: jobs } = await adminClient
    .from('jobs')
    .select('id, title, category, status, final_price_inr, created_at')
    .or(`customer_id.eq.${id},assigned_worker_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch reviews received
  const { data: reviews } = await adminClient
    .from('reviews')
    .select('*')
    .or(`customer_id.eq.${id},worker_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch verification docs if worker
  let verificationDocs: Record<string, unknown>[] = [];
  if (profile.role === 'worker') {
    const { data: docs } = await adminClient
      .from('verification_documents')
      .select('*')
      .eq('worker_id', id);
    verificationDocs = docs || [];
  }

  return apiSuccess({
    profile,
    workerDetails,
    jobs: jobs || [],
    reviews: reviews || [],
    verificationDocs,
  });
}

