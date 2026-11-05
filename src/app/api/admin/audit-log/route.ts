import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { convertToCsv } from '@/lib/services/admin.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'all';
  const entityType = searchParams.get('entityType') || 'all';
  const exportCsv = searchParams.get('format') === 'csv';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = exportCsv ? 1000 : parseInt(searchParams.get('limit') || '20', 10);
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('admin_audit_log')
    .select(`
      id,
      admin_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at,
      admin:profiles!admin_audit_log_admin_id_fkey(full_name, email)
    `, { count: 'exact' });

  if (action !== 'all') {
    query = query.ilike('action', `%${action}%`);
  }

  if (entityType !== 'all') {
    query = query.eq('entity_type', entityType);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return apiError(error.message, 500, 'DB_ERROR');

  const formatted = (data || []).map((row: Record<string, unknown>) => {
    const admin = Array.isArray(row.admin) ? (row.admin[0] as Record<string, unknown>) : (row.admin as Record<string, unknown>);
    return {
      id: String(row.id),
      adminId: String(row.admin_id),
      adminName: String(admin?.full_name || 'System Admin'),
      adminEmail: String(admin?.email || 'admin@sahayak.internal'),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: row.entity_id ? String(row.entity_id) : null,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: String(row.created_at),
    };
  });

  if (exportCsv) {
    const csvData = convertToCsv(formatted, [
      { key: 'id', label: 'Log ID' },
      { key: 'createdAt', label: 'Timestamp' },
      { key: 'adminName', label: 'Admin User' },
      { key: 'action', label: 'Action' },
      { key: 'entityType', label: 'Entity Type' },
      { key: 'entityId', label: 'Entity ID' },
      { key: 'metadata', label: 'Metadata' },
    ]);

    return new Response(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sahayak-audit-log-${Date.now()}.csv"`,
      },
    });
  }

  return apiSuccess({
    logs: formatted,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

