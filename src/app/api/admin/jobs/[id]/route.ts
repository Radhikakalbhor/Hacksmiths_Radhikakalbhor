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

  const { data: job, error: jobErr } = await adminClient
    .from('jobs')
    .select(`
      *,
      customer:profiles!jobs_customer_id_fkey(id, full_name, phone, avatar_url, primary_city),
      assigned_worker:profiles!jobs_selected_worker_id_fkey(id, full_name, phone, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (jobErr || !job) {
    return apiError('Job not found', 404, 'NOT_FOUND');
  }

  // Fetch bids for this job
  const { data: bids } = await adminClient
    .from('bids')
    .select(`
      id,
      worker_id,
      offered_amount_inr,
      status,
      note,
      created_at,
      worker:profiles!bids_worker_id_fkey(full_name, phone, avatar_url)
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false });

  const rawJob = job as unknown as Record<string, unknown>;

  // Safe milestone status without exposing raw plain OTPs
  const otpState = {
    startOtpVerified: ['OTP_START_VERIFIED', 'IN_PROGRESS', 'OTP_COMPLETION_VERIFIED', 'COMPLETED'].includes(
      String(job.status).toUpperCase()
    ),
    completionOtpVerified: ['OTP_COMPLETION_VERIFIED', 'COMPLETED'].includes(
      String(job.status).toUpperCase()
    ),
    hasStartOtpHash: Boolean(rawJob.otp_hash || rawJob.start_otp_hash),
    hasCompletionOtpHash: Boolean(rawJob.completion_otp_hash),
  };

  // Mini-map coordinates
  let coordinates = { lat: 19.0760, lng: 72.8777 }; // Default Mumbai
  if (rawJob.latitude && rawJob.longitude) {
    coordinates = { lat: Number(rawJob.latitude), lng: Number(rawJob.longitude) };
  }

  return apiSuccess({
    job,
    bids: bids || [],
    otpState,
    coordinates,
  });
}
