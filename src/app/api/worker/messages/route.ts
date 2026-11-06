/**
 * Worker Conversations API: GET /api/worker/messages
 * Returns all active booking conversations for the authenticated worker,
 * complete with last message snippet, timestamp, customer info, and unread counts.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { BookingService } from '@/lib/services/booking.service';
import { BookingState, ChatMessage } from '@/types/booking';

export interface WorkerConversationItem {
  jobId: string;
  category: string;
  title: string;
  status: string;
  stage: string;
  customerName: string;
  customerPhone: string | null;
  customerAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  lastMessageSenderRole: 'customer' | 'worker' | 'system' | null;
  unreadCount: number;
  isRealBooking: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    const authResult = await requireRole(supabase, ['worker']);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    const admin = getSupabaseAdminClient();
    const serverClient = admin || supabase!;

    // 1. Fetch all jobs where this worker is assigned or selected
    const { data: jobs, error: jobsError } = await serverClient
      .from('jobs')
      .select('id, category, title, status, customer_id, selected_worker_id, created_at, ai_details')
      .or(`selected_worker_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (jobsError) {
      return apiError(jobsError.message, 500, 'DATABASE_ERROR');
    }

    const conversationList: WorkerConversationItem[] = [];

    // 2. Fetch customer profiles for context
    const customerIds = Array.from(new Set((jobs || []).map((j) => j.customer_id).filter(Boolean)));
    const customerProfilesMap = new Map<string, { full_name: string; phone?: string; avatar_url?: string }>();

    if (customerIds.length > 0) {
      const { data: customerProfiles } = await serverClient
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', customerIds);

      if (customerProfiles) {
        customerProfiles.forEach((p) => {
          customerProfilesMap.set(p.id, {
            full_name: p.full_name,
            phone: p.phone,
            avatar_url: p.avatar_url || undefined,
          });
        });
      }
    }

    // 3. For each job, load messages and compute unread counts
    for (const job of jobs || []) {
      const ai = (job.ai_details && typeof job.ai_details === 'object' ? job.ai_details : {}) as Record<string, unknown>;
      const booking = (ai.booking as BookingState) || null;
      const customer = customerProfilesMap.get(job.customer_id);

      const messages: ChatMessage[] = await BookingService.fetchMessages(serverClient, job.id);

      const unreadCount = messages.filter((m) => m.senderRole === 'customer' && !m.isRead).length;

      let lastMsg: ChatMessage | null = null;
      if (messages.length > 0) {
        lastMsg = messages[messages.length - 1];
      }

      const isReal = booking ? !booking.isDemoWorker : true;

      conversationList.push({
        jobId: job.id,
        category: job.category,
        title: job.title,
        status: job.status,
        stage: booking?.stage || 'requested',
        customerName: customer?.full_name || 'Customer',
        customerPhone: customer?.phone || null,
        customerAvatarUrl: customer?.avatar_url || null,
        lastMessage: lastMsg ? lastMsg.text : null,
        lastMessageTime: lastMsg ? lastMsg.createdAt : job.created_at,
        lastMessageSenderRole: lastMsg ? lastMsg.senderRole : null,
        unreadCount,
        isRealBooking: isReal,
      });
    }

    // Sort conversations: unread first, then by latest message timestamp
    conversationList.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    const totalUnread = conversationList.reduce((acc, c) => acc + c.unreadCount, 0);

    return apiSuccess({
      conversations: conversationList,
      totalUnread,
      count: conversationList.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error fetching worker conversations.';
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}

