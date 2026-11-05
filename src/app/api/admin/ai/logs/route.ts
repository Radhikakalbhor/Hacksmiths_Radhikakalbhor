import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/services/admin.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { data, error } = await adminClient
    .from('ai_job_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return apiError(error.message, 500, 'DB_ERROR');

  const formatted = (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    jobId: row.job_id ? String(row.job_id) : null,
    inputType: (row.input_type as string) || 'text',
    rawInput: String(row.raw_input || ''),
    generatedScope: (row.generated_scope as Record<string, unknown>) || {},
    feedback: (row.feedback as 'up' | 'down' | null) ?? null,
    createdAt: String(row.created_at),
  }));

  return apiSuccess(formatted);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  try {
    const { logId, feedback } = await request.json();

    if (!logId || !['up', 'down', null].includes(feedback)) {
      return apiError('Invalid feedback payload', 400, 'INVALID_INPUT');
    }

    const { error } = await adminClient
      .from('ai_job_logs')
      .update({ feedback: (feedback as string | null) })
      .eq('id', logId);

    if (error) throw error;

    await logAdminAction({
      adminId: auth.admin.userId,
      action: 'AI_LOG_FEEDBACK',
      entityType: 'AI_JOB_LOG',
      entityId: logId,
      metadata: { feedback },
    });

    return apiSuccess({ success: true, logId, feedback });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record AI feedback';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}
