/**
 * Admin Payouts API: GET and POST /api/admin/payouts
 * Allows administrators to review, approve, and reject worker withdrawal requests.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/server';
import { WalletService } from '@/lib/services/wallet.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['admin']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') || undefined;

    const requests = await WalletService.getWithdrawalRequests(supabase!, undefined, status);
    return apiSuccess(requests);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/admin/payouts] Error:', error);
    return apiError('Failed to fetch payout requests.', 500, 'ADMIN_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['admin']);

    if (!authResult.success) {
      return authResult.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON payload.', 400, 'BAD_REQUEST');
    }

    const payload = body as {
      requestId?: string;
      action?: 'APPROVE' | 'REJECT';
      adminNotes?: string;
      payoutReference?: string;
    };

    if (!payload.requestId || !payload.action || !['APPROVE', 'REJECT'].includes(payload.action)) {
      return apiError('Valid requestId and action (APPROVE/REJECT) are required.', 400, 'INVALID_PAYLOAD');
    }

    const result = await WalletService.processWithdrawalDecision(
      supabase!,
      payload.requestId,
      payload.action,
      payload.adminNotes,
      payload.payoutReference
    );

    if (!result.success) {
      return apiError(result.error || 'Failed to process decision.', 400, 'PROCESSING_ERROR');
    }

    return apiSuccess(result);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[POST /api/admin/payouts] Error:', error);
    return apiError('Internal server error.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

