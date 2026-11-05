import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { moderateJob, convertToCsv } from '@/lib/services/admin.service';
import { validateJobModeration } from '@/lib/validations/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const category = searchParams.get('category') || 'all';
  const search = searchParams.get('search') || '';
  const exportCsv = searchParams.get('format') === 'csv';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = exportCsv ? 1000 : parseInt(searchParams.get('limit') || '15', 10);
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('jobs')
    .select(`
      id,
      customer_id,
      selected_worker_id,
      category,
      title,
      description,
      status,
      urgency,
      address_line,
      city,
      pincode,
      accepted_price_inr,
      created_at,
      completed_at,
      profiles!jobs_customer_id_fkey(full_name, phone)
    `, { count: 'exact' });

  if (status !== 'all') {
    query = query.ilike('status', status);
  }

  if (category !== 'all') {
    query = query.eq('category', category);
  }

  if (search.trim()) {
    query = query.or(`title.ilike.%${search.trim()}%,pincode.ilike.%${search.trim()}%,address_line.ilike.%${search.trim()}%`);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return apiError(error.message, 500, 'DB_ERROR');

  if (exportCsv) {
    const csvData = convertToCsv((data as unknown as Record<string, unknown>[]) || [], [
      { key: 'id', label: 'Job ID' },
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
      { key: 'urgency', label: 'Urgency' },
      { key: 'city', label: 'City' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'accepted_price_inr', label: 'Price (INR)' },
      { key: 'created_at', label: 'Created At' },
    ]);

    return new Response(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sahayak-jobs-${Date.now()}.csv"`,
      },
    });
  }

  return apiSuccess({
    jobs: (data || []).map((j: Record<string, unknown>) => {
      const profiles = Array.isArray(j.profiles)
        ? (j.profiles[0] as Record<string, unknown>)
        : (j.profiles as Record<string, unknown>);
      return {
        ...j,
        customerName: profiles?.full_name ? String(profiles.full_name) : undefined,
        customerPhone: profiles?.phone ? String(profiles.phone) : undefined,
      };
    }),
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
    const validation = validateJobModeration(body);
    if (!validation.success || !validation.data) {
      return apiError('Validation failed', 400, 'INVALID_INPUT', validation.errors);
    }

    const result = await moderateJob(auth.admin.userId, validation.data);
    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Job action failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}
