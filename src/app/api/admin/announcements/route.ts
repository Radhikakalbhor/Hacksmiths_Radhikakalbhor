import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createAnnouncement } from '@/lib/services/admin.service';
import { validateAnnouncement } from '@/lib/validations/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { data, error } = await adminClient
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return apiError(error.message, 500, 'DB_ERROR');

  return apiSuccess(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const validation = validateAnnouncement(body);
    if (!validation.success || !validation.data) {
      return apiError('Validation failed', 400, 'INVALID_INPUT', validation.errors);
    }

    const result = await createAnnouncement(auth.admin.userId, validation.data);
    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Announcement broadcast failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}

