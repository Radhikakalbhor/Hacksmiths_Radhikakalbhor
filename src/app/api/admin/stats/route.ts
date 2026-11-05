import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getAdminDashboardData } from '@/lib/services/admin.service';
import { apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  const data = await getAdminDashboardData(isNaN(days) ? 30 : days);
  return apiSuccess(data);
}

