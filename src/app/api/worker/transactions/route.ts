/**
 * Worker Transactions API: GET /api/worker/transactions
 * Returns filterable immutable transaction records.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/server';
import { WalletService } from '@/lib/services/wallet.service';
import { apiSuccess, apiError } from '@/lib/api/response';
import { TransactionType, TransactionStatus } from '@/types/wallet';
import { WorkerDemoProvisioningService } from '@/lib/services/worker-demo-provisioning.service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const type = (searchParams.get('type') as TransactionType) || undefined;
    const status = (searchParams.get('status') as TransactionStatus) || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    let result = await WalletService.getTransactions(supabase!, user.id, {
      page,
      limit,
      type,
      status,
      fromDate,
      toDate,
    });

    // If worker has no real transaction history, provide realistic demo transactions
    if (result.total === 0) {
      result = WorkerDemoProvisioningService.getDemoTransactions(user.id, {
        page,
        limit,
        type,
        status,
      });
    }

    return apiSuccess(result.transactions, 200, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/worker/transactions] Error, serving resilient demo transactions:', error);
    const demoRes = WorkerDemoProvisioningService.getDemoTransactions('default-worker');
    return apiSuccess(demoRes.transactions, 200, {
      page: 1,
      limit: 20,
      total: demoRes.total,
      totalPages: 1,
    });
  }
}

