/**
 * Booking In-App Messaging API
 * GET /api/jobs/[id]/messages
 * POST /api/jobs/[id]/messages
 * 
 * Provides authorized, real-time-ready messaging between customer and assigned worker.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingService } from '@/lib/services/booking.service';
import { BookingState, ChatMessage } from '@/types/booking';

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

    const admin = getSupabaseAdminClient();
    const serverClient = admin || supabase!;

    // Verify user is either job customer or assigned worker
    const { data: rawJob, error: jobError } = await serverClient
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

    const messages = await BookingService.fetchMessages(serverClient, jobId);

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

    const admin = getSupabaseAdminClient();
    const serverClient = admin || supabase!;

    // Verify job authorization
    const { data: rawJob, error: jobError } = await serverClient
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

    // Robust Demo Worker Detection
    let isDemoWorker = Boolean(booking?.isDemoWorker);
    let workerDisplayName = booking?.workerName || 'Professional Partner';

    if (booking?.workerId && !isDemoWorker) {
      if (
        workerDisplayName.includes('[DEMO]') ||
        workerDisplayName.toLowerCase().includes('demo') ||
        (booking.workerPhone && booking.workerPhone.includes('99990000'))
      ) {
        isDemoWorker = true;
      } else {
        const { data: wp } = await serverClient
          .from('worker_profiles')
          .select('bio, user_id')
          .eq('user_id', booking.workerId)
          .maybeSingle();

        if (wp?.bio && (wp.bio.includes('[DEMO]') || wp.bio.toLowerCase().includes('demonstration only'))) {
          isDemoWorker = true;
        }

        if (!isDemoWorker && admin) {
          const { data: prof } = await admin
            .from('profiles')
            .select('full_name, phone, email')
            .eq('id', booking.workerId)
            .maybeSingle();

          if (
            prof?.full_name?.includes('[DEMO]') ||
            prof?.phone?.includes('99990000') ||
            prof?.email?.includes('sahayak.demo.internal')
          ) {
            isDemoWorker = true;
            if (prof.full_name) {
              workerDisplayName = prof.full_name;
            }
          }
        }
      }

      // If detected as demo worker, update the booking state in ai_details so future checks are instant
      if (isDemoWorker && booking) {
        const updatedBookingState = {
          ...booking,
          isDemoWorker: true,
          workerName: workerDisplayName,
        };
        await serverClient
          .from('jobs')
          .update({
            ai_details: {
              ...aiDetails,
              booking: updatedBookingState,
            } as any,
          })
          .eq('id', jobId);
      }
    }

    const senderRole = isCustomer ? 'customer' : 'worker';
    const senderName = isCustomer ? 'Customer' : workerDisplayName.replace(/^\[DEMO\]\s*/i, '');

    const result = await BookingService.postMessage(serverClient, jobId, {
      jobId,
      senderId: user.id,
      senderRole,
      senderName,
      text,
    });

    if (!result.success || !result.message) {
      return apiError(result.error || 'Failed to save message.', 500, 'PERSISTENCE_FAILED');
    }

    // Contextual demo-reply simulation for demo workers:
    // When the customer sends a message and the worker is a demo worker,
    // generate and persist a relevant contextual reply clearly labeled as Demo Simulation.
    let demoReply: ChatMessage | null = null;
    if (isCustomer && isDemoWorker) {
      const lower = text.toLowerCase();
      let replyContent = '[Demo Simulation] Message received! I am currently focused on reaching your address safely.';

      if (
        lower.includes('let me know')
      ) {
        replyContent = '[Demo Simulation] Absolutely, I will send a quick update the moment I pull up outside.';
      } else if (
        lower.includes('finding') ||
        lower.includes('find the gate')
      ) {
        replyContent = '[Demo Simulation] Thank you, following GPS coordinates and will message if directions are needed.';
      } else if (
        lower.includes('how long') ||
        lower.includes('when') ||
        lower.includes('arrive') ||
        lower.includes('arrival') ||
        lower.includes('time') ||
        lower.includes('minutes') ||
        lower.includes('reach') ||
        lower.includes('come fast') ||
        lower.includes('fast') ||
        lower.includes('late') ||
        lower.includes('hurry') ||
        lower.includes('quick') ||
        lower.includes('traffic')
      ) {
        const estMinutes = booking?.estimatedArrivalMinutes || 15;
        replyContent = `[Demo Simulation] On my way! Navigating local transit. Expect to arrive in approximately ${estMinutes} mins.`;
      } else if (
        lower.includes('entrance') ||
        lower.includes('gate') ||
        lower.includes('door') ||
        lower.includes('waiting') ||
        lower.includes('building') ||
        lower.includes('lobby') ||
        lower.includes('outside') ||
        lower.includes('stand') ||
        lower.includes('wing') ||
        lower.includes('flat') ||
        lower.includes('tower')
      ) {
        replyContent = '[Demo Simulation] Noted! I will meet you right at the building entrance/gate as soon as I arrive.';
      } else if (
        lower.includes('valve') ||
        lower.includes('leak') ||
        lower.includes('tool') ||
        lower.includes('material') ||
        lower.includes('wire') ||
        lower.includes('switch') ||
        lower.includes('paint') ||
        lower.includes('color') ||
        lower.includes('clean') ||
        lower.includes('food') ||
        lower.includes('cook') ||
        lower.includes('appliance') ||
        lower.includes('machine') ||
        lower.includes('check') ||
        lower.includes('inspect')
      ) {
        replyContent = '[Demo Simulation] Understood, I have standard trade tools and materials equipped to inspect that first thing.';
      } else if (
        lower.includes('hello') ||
        lower.includes('hi') ||
        lower.includes('hey') ||
        lower.includes('namaste')
      ) {
        replyContent = '[Demo Simulation] Namaste! I am on the way to your location now.';
      }

      const cleanWorkerName = workerDisplayName.replace(/^\[DEMO\]\s*/i, '');
      const demoPostResult = await BookingService.postMessage(serverClient, jobId, {
        jobId,
        senderId: booking?.workerId || '00000000-0000-0000-0000-000000000000',
        senderRole: 'worker',
        senderName: `${cleanWorkerName} (Demo Simulation)`,
        text: replyContent,
      });

      if (demoPostResult.success && demoPostResult.message) {
        demoReply = demoPostResult.message;
      }
    }

    return apiSuccess({
      message: result.message,
      demoReply,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal messaging error.';
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}
