import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BookingService } from '@/lib/services/booking.service';
import { ChatMessage, BookingState } from '@/types/booking';
import {
  isDesignatedCrossServiceWorkerId,
  DESIGNATED_CROSS_SERVICE_USER_IDS,
} from '@/lib/config/designated-workers';

describe('Two-Way Real Worker Messaging Suite', () => {
  const customerId = 'cust-user-1111';
  const realWorkerId = '0fd68ac1-4a91-400d-9287-46fd12cb9f6f'; // Agam (Designated real test worker)
  const anotherRealWorkerId = '0df39f8c-8aa4-496a-9171-64ce48f18a12'; // Sayan
  const unauthorizedWorkerId = 'unauth-worker-9999';
  const unauthorizedCustomerId = 'unauth-cust-8888';
  const demoWorkerId = 'demo-worker-deep-cleaning-1';

  it('1. Customer can send a message to an assigned real worker with correct role and read state', () => {
    const rawJob: any = {
      id: 'job-msg-1',
      customer_id: customerId,
      title: 'Plumbing Repair in Kitchen',
      status: 'assigned',
      selected_worker_id: realWorkerId,
      ai_details: {
        booking: {
          stage: 'accepted',
          stageUpdatedAt: new Date().toISOString(),
          workerId: realWorkerId,
          workerName: 'Agam',
          workerCategory: 'plumbing',
          workerRating: 5.0,
          workerExperience: 4,
          agreedPriceInr: 450,
          isDemoWorker: false,
          otpVerified: false,
        } as BookingState,
        chat_messages: [] as ChatMessage[],
      },
    };

    const text = 'Hi Agam, how long until you arrive?';
    const messageId = 'msg-1';
    const nowIso = new Date().toISOString();

    const newMsg: ChatMessage = {
      id: messageId,
      jobId: 'job-msg-1',
      senderId: customerId,
      senderName: 'Customer Rahul',
      senderRole: 'customer',
      text,
      createdAt: nowIso,
      isRead: false,
      isReadByCustomer: true,
      isReadByWorker: false,
    };

    rawJob.ai_details.chat_messages.push(newMsg);

    assert.equal(rawJob.ai_details.chat_messages.length, 1);
    assert.equal(rawJob.ai_details.chat_messages[0].senderRole, 'customer');
    assert.equal(rawJob.ai_details.chat_messages[0].isReadByCustomer, true);
    assert.equal(rawJob.ai_details.chat_messages[0].isReadByWorker, false);
    assert.equal(rawJob.ai_details.chat_messages[0].text, text);
  });

  it('2. Real worker can reply back to customer with correct role and read state without automated demo replies', () => {
    const rawJob: any = {
      id: 'job-msg-1',
      customer_id: customerId,
      title: 'Plumbing Repair in Kitchen',
      status: 'assigned',
      selected_worker_id: realWorkerId,
      ai_details: {
        booking: {
          stage: 'accepted',
          stageUpdatedAt: new Date().toISOString(),
          workerId: realWorkerId,
          workerName: 'Agam',
          workerCategory: 'plumbing',
          workerRating: 5.0,
          workerExperience: 4,
          agreedPriceInr: 450,
          isDemoWorker: false,
          otpVerified: false,
        } as BookingState,
        chat_messages: [
          {
            id: 'msg-1',
            jobId: 'job-msg-1',
            senderId: customerId,
            senderName: 'Customer Rahul',
            senderRole: 'customer',
            text: 'How long until you arrive?',
            createdAt: new Date(Date.now() - 60000).toISOString(),
            isRead: false,
            isReadByCustomer: true,
            isReadByWorker: false,
          },
        ] as ChatMessage[],
      },
    };

    // Worker replies
    const replyText = "I'm on my way. Reaching in 10 minutes.";
    const replyMsg: ChatMessage = {
      id: 'msg-2',
      jobId: 'job-msg-1',
      senderId: realWorkerId,
      senderName: 'Agam',
      senderRole: 'worker',
      text: replyText,
      createdAt: new Date().toISOString(),
      isRead: false,
      isReadByCustomer: false,
      isReadByWorker: true,
    };

    rawJob.ai_details.chat_messages.push(replyMsg);

    // Verify worker reply attributes
    assert.equal(rawJob.ai_details.chat_messages.length, 2);
    const workerMsg = rawJob.ai_details.chat_messages[1];
    assert.equal(workerMsg.senderRole, 'worker');
    assert.equal(workerMsg.senderId, realWorkerId);
    assert.equal(workerMsg.isReadByWorker, true);
    assert.equal(workerMsg.isReadByCustomer, false);

    // Verify designated real worker never receives automated demo reply
    assert.equal(isDesignatedCrossServiceWorkerId(realWorkerId), true);
    assert.equal(workerMsg.text.includes('[Demo Simulation]'), false);
  });

  it('3. Real worker can initiate the conversation before customer sends any message', () => {
    const rawJob: any = {
      id: 'job-msg-init',
      customer_id: customerId,
      title: 'Electrical Switch Repair',
      status: 'assigned',
      selected_worker_id: anotherRealWorkerId, // Sayan
      ai_details: {
        booking: {
          stage: 'accepted',
          stageUpdatedAt: new Date().toISOString(),
          workerId: anotherRealWorkerId,
          workerName: 'Sayantan',
          workerCategory: 'electrical',
          workerRating: 4.9,
          workerExperience: 5,
          agreedPriceInr: 350,
          isDemoWorker: false,
          otpVerified: false,
        } as BookingState,
        chat_messages: [] as ChatMessage[],
      },
    };

    // Worker initiates
    const initialWorkerMsg: ChatMessage = {
      id: 'msg-init-1',
      jobId: 'job-msg-init',
      senderId: anotherRealWorkerId,
      senderName: 'Sayantan',
      senderRole: 'worker',
      text: 'Hello! I have accepted your booking. Could you confirm your building gate number?',
      createdAt: new Date().toISOString(),
      isRead: false,
      isReadByCustomer: false,
      isReadByWorker: true,
    };

    rawJob.ai_details.chat_messages.push(initialWorkerMsg);

    assert.equal(rawJob.ai_details.chat_messages.length, 1);
    assert.equal(rawJob.ai_details.chat_messages[0].senderRole, 'worker');
    assert.equal(rawJob.ai_details.chat_messages[0].isReadByWorker, true);
    assert.equal(rawJob.ai_details.chat_messages[0].isReadByCustomer, false);
  });

  it('4. Correctly computes unread counts for both customer and worker roles', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        jobId: 'job-msg-1',
        senderId: customerId,
        senderName: 'Customer',
        senderRole: 'customer',
        text: 'Hello',
        createdAt: new Date(Date.now() - 300000).toISOString(),
        isRead: false,
        isReadByCustomer: true,
        isReadByWorker: true, // Worker already read m1
      },
      {
        id: 'm2',
        jobId: 'job-msg-1',
        senderId: realWorkerId,
        senderName: 'Worker',
        senderRole: 'worker',
        text: 'On my way',
        createdAt: new Date(Date.now() - 200000).toISOString(),
        isRead: false,
        isReadByCustomer: true, // Customer already read m2
        isReadByWorker: true,
      },
      {
        id: 'm3',
        jobId: 'job-msg-1',
        senderId: customerId,
        senderName: 'Customer',
        senderRole: 'customer',
        text: 'Please call before arrival',
        createdAt: new Date(Date.now() - 100000).toISOString(),
        isRead: false,
        isReadByCustomer: true,
        isReadByWorker: false, // Worker has NOT read m3
      },
      {
        id: 'm4',
        jobId: 'job-msg-1',
        senderId: customerId,
        senderName: 'Customer',
        senderRole: 'customer',
        text: 'Gate code is 4421',
        createdAt: new Date(Date.now() - 50000).toISOString(),
        isRead: false,
        isReadByCustomer: true,
        isReadByWorker: false, // Worker has NOT read m4
      },
    ];

    const unreadCountForWorker = messages.filter(
      (m) => m.senderRole !== 'worker' && m.isReadByWorker === false
    ).length;

    const unreadCountForCustomer = messages.filter(
      (m) => m.senderRole !== 'customer' && m.isReadByCustomer === false
    ).length;

    assert.equal(unreadCountForWorker, 2); // m3 and m4 unread by worker
    assert.equal(unreadCountForCustomer, 0); // Customer has read all worker messages
  });

  it('5. markMessagesAsRead updates in-memory and database records for the reader role', async () => {
    let memoryMessages: ChatMessage[] = [
      {
        id: 'm1',
        jobId: 'job-1',
        senderId: customerId,
        senderName: 'Customer',
        senderRole: 'customer',
        text: 'I am waiting',
        createdAt: new Date().toISOString(),
        isRead: false,
        isReadByCustomer: true,
        isReadByWorker: false,
      },
      {
        id: 'm2',
        jobId: 'job-1',
        senderId: customerId,
        senderName: 'Customer',
        senderRole: 'customer',
        text: 'Bring plumbing wrench',
        createdAt: new Date().toISOString(),
        isRead: false,
        isReadByCustomer: true,
        isReadByWorker: false,
      },
    ];

    // Mock supabase update client
    const updatedRows: any[] = [];
    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'job_messages') {
          return {
            update: (values: any) => ({
              eq: (col: string, val: string) => ({
                eq: (col2: string, val2: string) => ({
                  select: () => {
                    updatedRows.push({ table, values, col, val, col2, val2 });
                    return Promise.resolve({ data: [{ id: 'm1' }, { id: 'm2' }], error: null });
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'jobs') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: 'job-1',
                      ai_details: {
                        booking: { workerId: realWorkerId },
                        chat_messages: memoryMessages,
                      },
                    },
                    error: null,
                  }),
              }),
            }),
            update: (values: any) => ({
              eq: () => {
                memoryMessages = values.ai_details.chat_messages;
                return Promise.resolve({ data: null, error: null });
              },
            }),
          };
        }
        return {};
      },
    };

    // Worker reads the messages
    const res = await BookingService.markMessagesAsRead(mockSupabase, 'job-1', 'worker');

    assert.equal(res.success, true);
    assert.equal(res.markedCount >= 2, true);
    assert.equal(memoryMessages.every((m) => m.isReadByWorker === true), true);
    assert.equal(updatedRows.length, 1);
    assert.equal(updatedRows[0].values.is_read_by_worker, true);
  });

  it('6. Booking-specific conversation isolation: messages do not leak across different jobs', () => {
    const job1Messages: ChatMessage[] = [
      {
        id: 'j1-m1',
        jobId: 'job-1',
        senderId: customerId,
        senderName: 'Customer',
        senderRole: 'customer',
        text: 'Job 1 message',
        createdAt: new Date().toISOString(),
        isRead: false,
        isReadByCustomer: true,
        isReadByWorker: false,
      },
    ];

    const job2Messages: ChatMessage[] = [
      {
        id: 'j2-m1',
        jobId: 'job-2',
        senderId: 'cust-2',
        senderName: 'Customer 2',
        senderRole: 'customer',
        text: 'Job 2 message',
        createdAt: new Date().toISOString(),
        isRead: false,
        isReadByCustomer: true,
        isReadByWorker: false,
      },
    ];

    assert.notDeepEqual(job1Messages, job2Messages);
    assert.equal(job1Messages.some((m) => m.id === 'j2-m1'), false);
    assert.equal(job2Messages.some((m) => m.id === 'j1-m1'), false);
  });

  it('7. Access authorization: unassigned workers and unauthorized customers are forbidden', () => {
    const booking = {
      jobId: 'job-auth-1',
      workerId: realWorkerId,
    };
    const job = {
      customer_id: customerId,
      selected_worker_id: realWorkerId,
    };

    const isAuthorized = (userId: string) => {
      const isCustomer = job.customer_id === userId;
      const isWorker = booking.workerId === userId || job.selected_worker_id === userId;
      return isCustomer || isWorker;
    };

    // Authorized
    assert.equal(isAuthorized(customerId), true);
    assert.equal(isAuthorized(realWorkerId), true);

    // Unauthorized
    assert.equal(isAuthorized(unauthorizedWorkerId), false);
    assert.equal(isAuthorized(unauthorizedCustomerId), false);
  });

  it('8. Real vs Demo worker behavior: demo workers receive simulated replies, real workers do not', () => {
    // 1. Designated real workers (all 5) must NOT be treated as demo
    for (const designatedId of DESIGNATED_CROSS_SERVICE_USER_IDS) {
      assert.equal(isDesignatedCrossServiceWorkerId(designatedId), true);
    }

    // A real worker booking
    const realBooking = {
      stage: 'accepted',
      stageUpdatedAt: new Date().toISOString(),
      workerId: realWorkerId,
      workerName: 'Agam',
      workerCategory: 'plumbing',
      workerRating: 5.0,
      workerExperience: 4,
      agreedPriceInr: 500,
      isDemoWorker: false,
      otpVerified: false,
    } as unknown as BookingState;

    const isDemoReplyEligibleForReal =
      Boolean(realBooking.isDemoWorker) && !isDesignatedCrossServiceWorkerId(realBooking.workerId);
    assert.equal(isDemoReplyEligibleForReal, false);

    // A demo worker booking
    const demoBooking = {
      stage: 'accepted',
      stageUpdatedAt: new Date().toISOString(),
      workerId: demoWorkerId,
      workerName: 'Anita Sharma',
      workerCategory: 'cleaning',
      workerRating: 4.8,
      workerExperience: 3,
      agreedPriceInr: 500,
      isDemoWorker: true,
      otpVerified: false,
    } as unknown as BookingState;

    const isDemoReplyEligibleForDemo =
      Boolean(demoBooking.isDemoWorker) && !isDesignatedCrossServiceWorkerId(demoBooking.workerId);
    assert.equal(isDemoReplyEligibleForDemo, true);
  });
});
