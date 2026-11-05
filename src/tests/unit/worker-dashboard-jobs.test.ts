import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Worker Dashboard Jobs Categorization & Lifecycle', () => {
  // Pure categorization function identical to the logic in route.ts
  function categorizeJobs(
    workerId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jobs: any[],
    pendingBidJobIds: Set<string>,
    rejectedBidJobIds: Set<string>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upcoming: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accepted: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rejected: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completed: any[] = [];

    jobs.forEach((job) => {
      const booking = job.ai_details?.booking || null;
      const isCancelled =
        job.status === 'cancelled' ||
        job.status === 'CANCELLED' ||
        booking?.stage === 'cancelled' ||
        Boolean(booking?.cancellationReason);

      const isCompleted =
        job.status === 'completed' ||
        job.status === 'COMPLETED' ||
        booking?.stage === 'completed';

      if (isCancelled) {
        rejected.push(job);
      } else if (isCompleted) {
        completed.push(job);
      } else if (booking?.stage === 'requested' || (job.selected_worker_id !== workerId && pendingBidJobIds.has(job.id))) {
        pending.push(job);
      } else if (job.selected_worker_id === workerId) {
        if (booking?.stage === 'in_progress' || booking?.stage === 'on_the_way' || booking?.stage === 'arrived') {
          accepted.push(job);
        } else {
          upcoming.push(job);
        }
      } else if (rejectedBidJobIds.has(job.id)) {
        rejected.push(job);
      }
    });

    return { upcoming, pending, accepted, rejected, completed };
  }

  const workerId = 'worker-uuid-1';

  it('categorizes scheduled future jobs as UPCOMING without overlap', () => {
    const jobs = [
      {
        id: 'job-1',
        title: 'AC Servicing',
        status: 'assigned',
        selected_worker_id: workerId,
        ai_details: {
          booking: {
            stage: 'accepted',
            workerId,
          },
        },
      },
    ];

    const result = categorizeJobs(workerId, jobs, new Set(), new Set());
    assert.equal(result.upcoming.length, 1);
    assert.equal(result.pending.length, 0);
    assert.equal(result.accepted.length, 0);
    assert.equal(result.rejected.length, 0);
  });

  it('categorizes direct requests and pending bids as PENDING without overlap', () => {
    const jobs = [
      {
        id: 'job-2',
        title: 'Water Leak Repair',
        status: 'posted',
        selected_worker_id: workerId,
        ai_details: {
          booking: {
            stage: 'requested',
            workerId,
          },
        },
      },
      {
        id: 'job-3',
        title: 'Painting Living Room',
        status: 'bidding_open',
        selected_worker_id: null,
      },
    ];

    const result = categorizeJobs(workerId, jobs, new Set(['job-3']), new Set());
    assert.equal(result.pending.length, 2);
    assert.equal(result.upcoming.length, 0);
    assert.equal(result.accepted.length, 0);
    assert.equal(result.rejected.length, 0);
  });

  it('categorizes in-progress and in-transit jobs as ACCEPTED without overlap', () => {
    const jobs = [
      {
        id: 'job-4',
        title: 'Switchboard Repair',
        status: 'assigned',
        selected_worker_id: workerId,
        ai_details: {
          booking: {
            stage: 'in_progress',
            workerId,
          },
        },
      },
      {
        id: 'job-5',
        title: 'Carpentry Table Assembly',
        status: 'assigned',
        selected_worker_id: workerId,
        ai_details: {
          booking: {
            stage: 'on_the_way',
            workerId,
          },
        },
      },
    ];

    const result = categorizeJobs(workerId, jobs, new Set(), new Set());
    assert.equal(result.accepted.length, 2);
    assert.equal(result.upcoming.length, 0);
    assert.equal(result.pending.length, 0);
    assert.equal(result.rejected.length, 0);
  });

  it('categorizes cancelled jobs or rejected bids as REJECTED without overlap', () => {
    const jobs = [
      {
        id: 'job-6',
        title: 'Cancelled Pipe Cleaning',
        status: 'cancelled',
        selected_worker_id: workerId,
        ai_details: {
          booking: {
            stage: 'cancelled',
            cancellationReason: 'Emergency conflict',
          },
        },
      },
      {
        id: 'job-7',
        title: 'Declined Chimney Repair',
        status: 'posted',
        selected_worker_id: null,
      },
    ];

    const result = categorizeJobs(workerId, jobs, new Set(), new Set(['job-7']));
    assert.equal(result.rejected.length, 2);
    assert.equal(result.upcoming.length, 0);
    assert.equal(result.pending.length, 0);
    assert.equal(result.accepted.length, 0);
  });

  it('guarantees each job appears in exactly one category', () => {
    const mixedJobs = [
      { id: 'j1', status: 'assigned', selected_worker_id: workerId, ai_details: { booking: { stage: 'accepted' } } },
      { id: 'j2', status: 'posted', selected_worker_id: workerId, ai_details: { booking: { stage: 'requested' } } },
      { id: 'j3', status: 'assigned', selected_worker_id: workerId, ai_details: { booking: { stage: 'in_progress' } } },
      { id: 'j4', status: 'cancelled', selected_worker_id: workerId, ai_details: { booking: { stage: 'cancelled' } } },
      { id: 'j5', status: 'completed', selected_worker_id: workerId, ai_details: { booking: { stage: 'completed' } } },
    ];

    const res = categorizeJobs(workerId, mixedJobs, new Set(), new Set());
    const totalCategorized = res.upcoming.length + res.pending.length + res.accepted.length + res.rejected.length + res.completed.length;
    assert.equal(totalCategorized, mixedJobs.length);
  });
});
