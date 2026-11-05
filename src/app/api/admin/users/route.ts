import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { moderateUser, convertToCsv } from '@/lib/services/admin.service';
import { validateUserModeration } from '@/lib/validations/admin';
import { apiSuccess, apiError } from '@/lib/api/response';
import type { UserRole } from '@/types/roles';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') || 'all';
  const search = searchParams.get('search') || '';
  const exportCsv = searchParams.get('format') === 'csv';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = exportCsv ? 1000 : parseInt(searchParams.get('limit') || '15', 10);
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('profiles')
    .select(`
      id,
      phone,
      email,
      full_name,
      avatar_url,
      role,
      verification_status,
      primary_city,
      is_suspended,
      suspended_reason,
      created_at
    `, { count: 'exact' });

  if (role !== 'all') {
    query = query.eq('role', role as UserRole);
  }

  if (search.trim()) {
    query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return apiError(error.message, 500, 'DB_ERROR');

  if (exportCsv) {
    const csvData = convertToCsv(data || [], [
      { key: 'id', label: 'User ID' },
      { key: 'full_name', label: 'Full Name' },
      { key: 'role', label: 'Role' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'verification_status', label: 'Verification Status' },
      { key: 'primary_city', label: 'City' },
      { key: 'is_suspended', label: 'Suspended' },
      { key: 'created_at', label: 'Registered At' },
    ]);

    return new Response(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sahayak-users-${Date.now()}.csv"`,
      },
    });
  }

  return apiSuccess({
    users: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const validation = validateUserModeration(body);
    if (!validation.success || !validation.data) {
      return apiError('Validation failed', 400, 'INVALID_INPUT', validation.errors);
    }

    const result = await moderateUser(auth.admin.userId, validation.data);
    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'User moderation failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}
