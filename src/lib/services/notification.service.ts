/**
 * Sahayak Real-Time Worker Notification Service
 * Manages persistent notifications, unread counters, and delivery updates.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { WorkerNotification, WorkerNotificationType } from '@/types/wallet';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export class NotificationService {
  /**
   * Dispatches a persistent notification to a worker.
   */
  static async sendNotification(
    supabase: SupabaseClient<Database>,
    params: {
      workerId: string;
      type: WorkerNotificationType;
      title: string;
      message: string;
      jobId?: string | null;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ success: boolean; id?: string }> {
    const admin = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (admin || supabase) as any;

    try {
      const { data, error } = await client
        .from('worker_notifications')
        .insert({
          worker_id: params.workerId,
          type: params.type,
          title: params.title,
          message: params.message,
          job_id: params.jobId || null,
          metadata: params.metadata || {},
          is_read: false,
        })
        .select('id')
        .single();

      if (error) {
        console.warn('[NotificationService] Error inserting notification:', error.message);
        return { success: false };
      }

      return { success: true, id: data.id };
    } catch (err) {
      console.warn('[NotificationService] Unexpected notification error:', err);
      return { success: false };
    }
  }

  /**
   * Fetches notifications and unread count for a worker.
   */
  static async getWorkerNotifications(
    supabase: SupabaseClient<Database>,
    workerId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
    }
  ): Promise<{ notifications: WorkerNotification[]; unreadCount: number }> {
    const limit = Math.min(50, Math.max(1, options?.limit ?? 20));

    let query = supabase
      .from('worker_notifications')
      .select('*')
      .eq('worker_id', workerId);

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    // Calculate unread count
    const { count: unreadCount } = await supabase
      .from('worker_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('worker_id', workerId)
      .eq('is_read', false);

    if (error || !data) {
      return { notifications: [], unreadCount: unreadCount ?? 0 };
    }

    const notifications: WorkerNotification[] = data.map((n) => ({
      id: n.id,
      workerId: n.worker_id,
      type: n.type as WorkerNotificationType,
      title: n.title,
      message: n.message,
      jobId: n.job_id,
      isRead: n.is_read,
      metadata: (n.metadata && typeof n.metadata === 'object' ? n.metadata : {}) as Record<string, unknown>,
      createdAt: n.created_at,
    }));

    return {
      notifications,
      unreadCount: unreadCount ?? 0,
    };
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(
    supabase: SupabaseClient<Database>,
    workerId: string,
    notificationId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('worker_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('worker_id', workerId);

    return !error;
  }

  /**
   * Marks all notifications as read for a worker.
   */
  static async markAllAsRead(
    supabase: SupabaseClient<Database>,
    workerId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('worker_notifications')
      .update({ is_read: true })
      .eq('worker_id', workerId)
      .eq('is_read', false);

    return !error;
  }
}

