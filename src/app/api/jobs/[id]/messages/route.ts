/**
 * Booking In-App Messaging API
 * GET /api/jobs/[id]/messages
 * POST /api/jobs/[id]/messages
 * 
 * Provides authorized, real-time-ready messaging between customer and assigned worker.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingService } from '@/lib/services/booking.service';
import { BookingState } from '@/types/booking';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: jobId } = await params;
    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase!.auth.getUser();

    if (authError || !user) {
      return apiError('Authentication required to access booking messages.', 401, 'UNAUTHORIZED');
    }

    // Verify user is either job customer or assigned worker
    const { data: rawJob, error: jobError } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !rawJob) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    const job = rawJob as { customer_id: string; ai_details?: unknown };
    const aiDetails = (job.ai_details && typeof job.ai_details === 'object' ? job.ai_details : {}) as Record<string, unknown>;
    const booking = aiDetails.booking as BookingState | undefined;

    const isCustomer = job.customer_id === user.id;
    const isWorker = booking?.workerId === user.id;

    if (!isCustomer && !isWorker) {
      return apiError('You are not authorized to view messages for this booking.', 403, 'FORBIDDEN');
    }

    const messages = await BookingService.fetchMessages(supabase!, jobId);

    return apiSuccess({
      jobId,
      messages,
      totalCount: messages.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal messaging error.';
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: jobId } = await params;
    if (!jobId) {
      return apiError('Job ID parameter is required.', 400, 'BAD_REQUEST');
    }

    const supabase = await getSupabaseServerClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase!.auth.getUser();

    if (authError || !user) {
      return apiError('Authentication required to post booking messages.', 401, 'UNAUTHORIZED');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON body.', 400, 'BAD_REQUEST');
    }

    const payload = body as { text?: string };
    if (!payload.text || typeof payload.text !== 'string' || payload.text.trim().length === 0) {
      return apiError('Message text cannot be empty.', 400, 'EMPTY_MESSAGE');
    }

    const text = payload.text.trim();
    if (text.length > 1000) {
      return apiError('Message exceeds maximum length of 1000 characters.', 400, 'MESSAGE_TOO_LONG');
    }

    // Verify job authorization
    const { data: rawJob, error: jobError } = await supabase!
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !rawJob) {
      return apiError('Job not found.', 404, 'NOT_FOUND');
    }

    const job = rawJob as { customer_id: string; ai_details?: unknown };
    const aiDetails = (job.ai_details && typeof job.ai_details === 'object' ? job.ai_details : {}) as Record<string, unknown>;
    const booking = aiDetails.booking as BookingState | undefined;

    const isCustomer = job.customer_id === user.id;
    const isWorker = booking?.workerId === user.id;

    if (!isCustomer && !isWorker) {
      return apiError('You are not authorized to post messages on this booking.', 403, 'FORBIDDEN');
    }

    const senderRole = isCustomer ? 'customer' : 'worker';
    const senderName = isCustomer ? 'Customer' : (booking?.workerName || 'Professional');

    const result = await BookingService.postMessage(supabase!, jobId, {
      jobId,
      senderId: user.id,
      senderRole,
      senderName,
      text,
    });

    if (!result.success || !result.message) {
      return apiError(result.error || 'Failed to save message.', 500, 'PERSISTENCE_FAILED');
    }

    return apiSuccess({
      message: result.message,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal messaging error.';
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}
