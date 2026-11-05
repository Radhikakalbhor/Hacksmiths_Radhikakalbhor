import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { handleSosIncident } from '@/lib/services/admin.service';
import { validateSosAction } from '@/lib/validations/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = adminClient
    .from('sos_incidents')
    .select(`
      id,
      job_id,
      triggered_by,
      severity,
      status,
      notes,
      trusted_contacts,
      created_at,
      resolved_at,
      profiles!sos_incidents_triggered_by_fkey(full_name, phone, role)
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return apiError(error.message, 500, 'DB_ERROR');

  const rawList = (data || []) as unknown as Record<string, unknown>[];
  const formatted = rawList.map((s) => {
    const userProfile = Array.isArray(s.profiles) ? (s.profiles[0] as Record<string, unknown>) : (s.profiles as Record<string, unknown>);
    return {
      id: String(s.id),
      jobId: s.job_id ? String(s.job_id) : null,
      triggeredBy: String(s.triggered_by),
      triggeredByName: String(userProfile?.full_name || 'Anonymous User'),
      triggeredByPhone: String(userProfile?.phone || 'Not available'),
      triggeredByRole: String(userProfile?.role || 'customer'),
      severity: String(s.severity),
      status: String(s.status),
      notes: s.notes ? String(s.notes) : null,
      trustedContacts: (s.trusted_contacts as unknown[]) || [],
      locationPoint: { lat: 19.0596, lng: 72.8295, address: 'Bandra West, Mumbai' },
      createdAt: String(s.created_at),
      resolvedAt: s.resolved_at ? String(s.resolved_at) : null,
    };
  });

  return apiSuccess(formatted);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const validation = validateSosAction(body);
    if (!validation.success || !validation.data) {
      return apiError('Validation failed', 400, 'INVALID_INPUT', validation.errors);
    }

    const result = await handleSosIncident(auth.admin.userId, validation.data);
    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'SOS incident action failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}

