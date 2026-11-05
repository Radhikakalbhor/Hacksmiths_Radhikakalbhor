/**
 * Worker Wallet API: GET /api/worker/wallet and POST /api/worker/wallet
 * Handles worker balance retrieval and withdrawal requests.
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
    const [wallet, settings, breakdown] = await Promise.all([
      WalletService.getOrCreateWallet(supabase!, user.id),
      WalletService.getPlatformSettings(supabase!),
      WalletService.getJobEarningsBreakdown(supabase!, user.id),
    ]);

    return apiSuccess({
      wallet,
      settings,
      breakdown,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/worker/wallet] Error:', error);
    return apiError('Failed to fetch worker wallet.', 500, 'WALLET_ERROR');
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
      amountInr?: number;
      payoutMethodType?: PayoutMethodType;
      payoutDetails?: Record<string, unknown>;
    };

    if (!payload.amountInr || payload.amountInr <= 0) {
      return apiError('A valid withdrawal amount greater than ₹0 is required.', 400, 'INVALID_AMOUNT');
    }

    if (!payload.payoutMethodType || !['UPI', 'BANK_ACCOUNT'].includes(payload.payoutMethodType)) {
      return apiError('A valid payout method (UPI or BANK_ACCOUNT) is required.', 400, 'INVALID_PAYOUT_METHOD');
    }

    const result = await WalletService.requestWithdrawal(
      supabase!,
      user.id,
      Number(payload.amountInr),
      payload.payoutMethodType,
      payload.payoutDetails || {}
    );

    if (!result.success) {
      return apiError(result.error || 'Failed to process withdrawal.', 400, 'WITHDRAWAL_FAILED');
    }

    return apiSuccess(result, 201);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[POST /api/worker/wallet] Error:', error);
    return apiError('Withdrawal processing error.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

