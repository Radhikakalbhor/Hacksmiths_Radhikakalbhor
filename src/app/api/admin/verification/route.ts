import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getVerificationQueue, processWorkerVerification } from '@/lib/services/admin.service';
import { validateWorkerVerification } from '@/lib/validations/admin';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'PENDING';

  const queue = await getVerificationQueue(status);
  return apiSuccess(queue);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const validation = validateWorkerVerification(body);
    if (!validation.success || !validation.data) {
      return apiError('Validation failed', 400, 'INVALID_INPUT', validation.errors);
    }

    const result = await processWorkerVerification(auth.admin.userId, validation.data);
    return apiSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification update failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}

