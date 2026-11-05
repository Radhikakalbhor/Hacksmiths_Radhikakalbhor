/**
 * Admin Configuration API: GET and POST /api/admin/config
 * Manages platform commission % and cancellation policies.
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

    const settings = await WalletService.getPlatformSettings(supabase!);
    return apiSuccess(settings);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/admin/config] Error:', error);
    return apiError('Failed to fetch platform config.', 500, 'ADMIN_ERROR');
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
      commissionRatePercent?: number;
      cancellationTimeLimitMinutes?: number;
      cancellationPolicy?: {
        maxFreeCancellations: number;
        penaltyInr: number;
      };
    };

    if (payload.commissionRatePercent != null) {
      if (payload.commissionRatePercent < 0 || payload.commissionRatePercent > 100) {
        return apiError('Commission rate must be between 0% and 100%.', 400, 'INVALID_COMMISSION');
      }
      await WalletService.updatePlatformSettings(supabase!, 'commission_rate_percent', {
        value: payload.commissionRatePercent,
      });
    }

    if (payload.cancellationTimeLimitMinutes != null) {
      await WalletService.updatePlatformSettings(supabase!, 'cancellation_time_limit_minutes', {
        value: payload.cancellationTimeLimitMinutes,
      });
    }

    if (payload.cancellationPolicy != null) {
      await WalletService.updatePlatformSettings(supabase!, 'cancellation_policy', {
        max_free_cancellations: payload.cancellationPolicy.maxFreeCancellations,
        penalty_inr: payload.cancellationPolicy.penaltyInr,
      });
    }

    const updatedSettings = await WalletService.getPlatformSettings(supabase!);
    return apiSuccess(updatedSettings);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[POST /api/admin/config] Error:', error);
    return apiError('Internal server error.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

