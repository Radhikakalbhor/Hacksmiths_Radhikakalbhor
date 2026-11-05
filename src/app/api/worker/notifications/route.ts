/**
 * Worker Notifications API: GET and PATCH /api/worker/notifications
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/server';
import { NotificationService } from '@/lib/services/notification.service';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    const result = await NotificationService.getWorkerNotifications(supabase!, user.id, {
      unreadOnly,
      limit,
    });

    return apiSuccess(result);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[GET /api/worker/notifications] Error:', error);
    return apiError('Failed to fetch notifications.', 500, 'NOTIFICATIONS_ERROR');
  }
}

export async function PATCH(request: NextRequest) {
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
      notificationId?: string;
      markAll?: boolean;
    };

    if (payload.markAll) {
      const success = await NotificationService.markAllAsRead(supabase!, user.id);
      return apiSuccess({ success, markedAll: true });
    }

    if (payload.notificationId) {
      const success = await NotificationService.markAsRead(supabase!, user.id, payload.notificationId);
      return apiSuccess({ success, notificationId: payload.notificationId });
    }

    return apiError('Provide notificationId or markAll: true.', 400, 'INVALID_PAYLOAD');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error && (error as { digest: string }).digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    console.error('[PATCH /api/worker/notifications] Error:', error);
    return apiError('Failed to update notifications.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

