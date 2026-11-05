/**
 * Worker Payout Methods API: GET, POST, DELETE /api/worker/payout-methods
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/server';
import { WalletService } from '@/lib/services/wallet.service';
import { apiSuccess, apiError } from '@/lib/api/response';
import { PayoutMethodType } from '@/types/wallet';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    const methods = await WalletService.getPayoutMethods(supabase!, user.id);
    return apiSuccess(methods);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/worker/payout-methods] Error:', error);
    return apiError('Failed to fetch payout methods.', 500, 'PAYOUT_METHODS_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON payload.', 400, 'BAD_REQUEST');
    }

    const payload = body as {
      methodType: PayoutMethodType;
      accountHolderName: string;
      upiId?: string;
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      isPrimary?: boolean;
    };

    const result = await WalletService.savePayoutMethod(supabase!, user.id, payload);
    if (!result.success) {
      return apiError(result.error || 'Failed to save payout method.', 400, 'VALIDATION_ERROR');
    }

    return apiSuccess(result.data, 201);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[POST /api/worker/payout-methods] Error:', error);
    return apiError('Failed to save payout method.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    const { searchParams } = request.nextUrl;
    const methodId = searchParams.get('id');

    if (!methodId) {
      return apiError('Missing method id parameter.', 400, 'MISSING_ID');
    }

    const success = await WalletService.deletePayoutMethod(supabase!, user.id, methodId);
    if (!success) {
      return apiError('Failed to delete payout method.', 400, 'DELETE_FAILED');
    }

    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[DELETE /api/worker/payout-methods] Error:', error);
    return apiError('Internal server error.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

