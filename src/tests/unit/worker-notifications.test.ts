import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '@/lib/services/notification.service';

describe('Real-Time Worker Notifications Service', () => {
  it('dispatches notification payload with proper fields', async () => {
    let capturedInsert: Record<string, unknown> | null = null;
    const mockInsert = (payload: Record<string, unknown>) => {
      capturedInsert = payload;
      return {
        select: () => ({
          single: async () => ({ data: { id: 'notif-123' }, error: null }),
        }),
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSupabase: any = {
      from: () => ({
        insert: mockInsert,
      }),
    };

    const result = await NotificationService.sendNotification(mockSupabase, {
      workerId: 'worker-1',
      type: 'PAYMENT_CREDITED',
      title: 'Payment Credited',
      message: '₹900 credited to your wallet.',
      jobId: 'job-1',
      metadata: { gross: 1000, commission: 100, net: 900 },
    });

    assert.equal(result.success, true);
    assert.equal(result.id, 'notif-123');
    assert.equal(capturedInsert?.['worker_id'], 'worker-1');
    assert.equal(capturedInsert?.['type'], 'PAYMENT_CREDITED');
    assert.equal(capturedInsert?.['title'], 'Payment Credited');
    assert.equal(capturedInsert?.['is_read'], false);
  });

  it('marks individual notification as read', async () => {
    let capturedUpdate: Record<string, unknown> | null = null;
    const mockUpdate = (payload: Record<string, unknown>) => {
      capturedUpdate = payload;
      return {
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSupabase: any = {
      from: () => ({
        update: mockUpdate,
      }),
    };

    const success = await NotificationService.markAsRead(mockSupabase, 'worker-1', 'notif-123');
    assert.equal(success, true);
    assert.equal(capturedUpdate?.['is_read'], true);
  });

  it('marks all notifications as read for a worker', async () => {
    let capturedUpdate: Record<string, unknown> | null = null;
    const mockUpdate = (payload: Record<string, unknown>) => {
      capturedUpdate = payload;
      return {
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSupabase: any = {
      from: () => ({
        update: mockUpdate,
      }),
    };

    const success = await NotificationService.markAllAsRead(mockSupabase, 'worker-1');
    assert.equal(success, true);
    assert.equal(capturedUpdate?.['is_read'], true);
  });
});
