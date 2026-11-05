import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { resolveDispute } from '@/lib/services/admin.service';
import { validateDisputeResolution } from '@/lib/validations/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = adminClient
    .from('disputes')
    .select(`
      id,
      job_id,
      raised_by,
      against_user,
      reason,
      evidence,
      status,
      resolution,
      created_at,
      jobs!disputes_job_id_fkey(title, category, final_price_inr),
      raised_by_user:profiles!disputes_raised_by_fkey(full_name, role),
      against_user_profile:profiles!disputes_against_user_fkey(full_name, role)
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return apiError(error.message, 500, 'DB_ERROR');

  const formatted = (data || []).map((d: Record<string, unknown>) => {
    const job = Array.isArray(d.jobs) ? (d.jobs[0] as Record<string, unknown>) : (d.jobs as Record<string, unknown>);
    const raised = Array.isArray(d.raised_by_user) ? (d.raised_by_user[0] as Record<string, unknown>) : (d.raised_by_user as Record<string, unknown>);
    const against = Array.isArray(d.against_user_profile) ? (d.against_user_profile[0] as Record<string, unknown>) : (d.against_user_profile as Record<string, unknown>);

    return {
      id: String(d.id),
      jobId: String(d.job_id),
      jobTitle: String(job?.title || 'Service Request'),
      raisedBy: String(d.raised_by),
      raisedByName: String(raised?.full_name || 'Customer'),
      raisedByRole: String(raised?.role || 'customer'),
      againstUser: String(d.against_user),
      againstUserName: String(against?.full_name || 'Worker'),
      reason: String(d.reason),
      evidence: (d.evidence as Record<string, unknown>) || {},
      status: String(d.status),
      resolution: d.resolution ? String(d.resolution) : undefined,
      createdAt: String(d.created_at),
    };
  });

  return apiSuccess(formatted);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const validation = validateDisputeResolution(body);
    if (!validation.success || !validation.data) {
      return apiError('Validation failed', 400, 'INVALID_INPUT', validation.errors);
    }

    const result = await resolveDispute(auth.admin.userId, validation.data);
    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Dispute resolution failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}

