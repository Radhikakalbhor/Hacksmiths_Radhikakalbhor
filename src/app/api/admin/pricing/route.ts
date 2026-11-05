import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { updatePriceBenchmark } from '@/lib/services/admin.service';
import { validatePriceBenchmark } from '@/lib/validations/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  const { data: benchmarks, error } = await adminClient
    .from('price_benchmarks')
    .select('*')
    .order('category', { ascending: true });

  if (error) return apiError(error.message, 500, 'DB_ERROR');

  // Compute average accepted bid per category to compare
  const { data: jobs } = await adminClient
    .from('jobs')
    .select('category, accepted_price_inr')
    .not('accepted_price_inr', 'is', null);

  const avgMap: Record<string, { sum: number; count: number }> = {};
  if (jobs) {
    jobs.forEach((j: { category: string; accepted_price_inr: number | null }) => {
      if (j.accepted_price_inr) {
        if (!avgMap[j.category]) avgMap[j.category] = { sum: 0, count: 0 };
        avgMap[j.category].sum += Number(j.accepted_price_inr);
        avgMap[j.category].count += 1;
      }
    });
  }

  const enriched = (benchmarks || []).map((b: Record<string, unknown>) => {
    const category = String(b.category);
    const stats = avgMap[category];
    const avgAcceptedBidInr = stats ? Math.round(stats.sum / stats.count) : Math.round(Number(b.typical_price_inr));
    return {
      id: String(b.id),
      category,
      city: String(b.city || 'Mumbai'),
      minPriceInr: Number(b.min_price_inr),
      typicalPriceInr: Number(b.typical_price_inr),
      maxPriceInr: Number(b.max_price_inr),
      avgAcceptedBidInr,
      updatedAt: String(b.updated_at || b.created_at || new Date().toISOString()),
    };
  });

  return apiSuccess(enriched);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const validation = validatePriceBenchmark(body);
    if (!validation.success || !validation.data) {
      return apiError('Validation failed', 400, 'INVALID_INPUT', validation.errors);
    }

    const result = await updatePriceBenchmark(auth.admin.userId, validation.data);
    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Benchmark update failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}

