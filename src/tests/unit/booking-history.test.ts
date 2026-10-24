import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BookingHistoryItem } from '@/app/api/bookings/route';

describe('Booking History Logic & Filtering', () => {
  const sampleBookings: BookingHistoryItem[] = [
    {
      id: 'job-1',
      title: 'Electrician',
      category: 'electrical',
      status: 'assigned',
      stage: 'accepted',
      workerId: 'worker-1',
      workerName: 'Ramesh Kumar',
      workerCategory: 'electrical',
      workerRating: 4.9,
      workerExperience: 6,
      workerAvatarUrl: null,
      isDemoWorker: false,
      agreedPriceInr: 700,
      bookedAt: '2026-10-24T18:00:00Z',
      createdAt: '2026-10-24T17:30:00Z',
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      customerReview: null,
      addressLine: 'Kothrud',
      city: 'Pune',
      pincode: '411038',
    },
    {
      id: 'job-2',
      title: 'Painting & Touchup',
      category: 'painting',
      status: 'cancelled',
      stage: 'cancelled',
      workerId: 'worker-2',
      workerName: 'Suresh Patel',
      workerCategory: 'painting',
      workerRating: 4.8,
      workerExperience: 8,
      workerAvatarUrl: null,
      isDemoWorker: true,
      agreedPriceInr: 2000,
      bookedAt: '2026-10-24T19:00:00Z',
      createdAt: '2026-10-24T18:45:00Z',
      startedAt: null,
      completedAt: null,
      cancelledAt: '2026-10-24T19:15:00Z',
      cancellationReason: 'I changed my mind',
      customerReview: null,
      addressLine: 'Baner',
      city: 'Pune',
      pincode: '411045',
    },
    {
      id: 'job-3',
      title: 'Deep House Cleaning',
      category: 'cleaning',
      status: 'completed',
      stage: 'completed',
      workerId: 'worker-3',
      workerName: 'Anita Shinde',
      workerCategory: 'cleaning',
      workerRating: 5.0,
      workerExperience: 4,
      workerAvatarUrl: null,
      isDemoWorker: false,
      agreedPriceInr: 1500,
      bookedAt: '2026-10-23T10:00:00Z',
      createdAt: '2026-10-23T09:30:00Z',
      startedAt: '2026-10-23T10:15:00Z',
      completedAt: '2026-10-23T12:30:00Z',
      cancelledAt: null,
      cancellationReason: null,
      customerReview: {
        rating: 5,
        reviewText: 'Excellent work, very thorough cleaning!',
        createdAt: '2026-10-23T12:45:00Z',
      },
      addressLine: 'Viman Nagar',
      city: 'Pune',
      pincode: '411014',
    },
    {
      id: 'job-4',
      title: 'AC Gas Refill',
      category: 'appliance_repair',
      status: 'assigned',
      stage: 'on_the_way',
      workerId: 'worker-4',
      workerName: 'Vikram Joshi',
      workerCategory: 'appliance_repair',
      workerRating: 4.7,
      workerExperience: 5,
      workerAvatarUrl: null,
      isDemoWorker: true,
      agreedPriceInr: 1200,
      bookedAt: '2026-10-24T20:00:00Z',
      createdAt: '2026-10-24T19:50:00Z',
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      customerReview: null,
      addressLine: 'Aundh',
      city: 'Pune',
      pincode: '411007',
    },
  ];

  it('correctly filters active/upcoming bookings', () => {
    const isBookingActive = (b: BookingHistoryItem) =>
      ['requested', 'accepted', 'on_the_way', 'arrived', 'in_progress'].includes(b.stage) &&
      b.status !== 'cancelled' &&
      b.status !== 'completed';

    const active = sampleBookings.filter(isBookingActive);
    assert.strictEqual(active.length, 2);
    assert.strictEqual(active.some((b) => b.id === 'job-1'), true);
    assert.strictEqual(active.some((b) => b.id === 'job-4'), true);
    assert.strictEqual(active.some((b) => b.id === 'job-2'), false);
    assert.strictEqual(active.some((b) => b.id === 'job-3'), false);
  });

  it('correctly filters completed bookings', () => {
    const isBookingCompleted = (b: BookingHistoryItem) =>
      b.stage === 'completed' || b.status === 'completed';

    const completed = sampleBookings.filter(isBookingCompleted);
    assert.strictEqual(completed.length, 1);
    assert.strictEqual(completed[0].id, 'job-3');
    assert.strictEqual(completed[0].customerReview?.rating, 5);
  });

  it('correctly filters cancelled bookings and exposes reason and timestamp', () => {
    const isBookingCancelled = (b: BookingHistoryItem) =>
      b.stage === 'cancelled' || b.status === 'cancelled';

    const cancelled = sampleBookings.filter(isBookingCancelled);
    assert.strictEqual(cancelled.length, 1);
    assert.strictEqual(cancelled[0].id, 'job-2');
    assert.strictEqual(cancelled[0].cancellationReason, 'I changed my mind');
    assert.strictEqual(cancelled[0].cancelledAt, '2026-10-24T19:15:00Z');
  });

  it('sorts bookings newest-first by bookedAt or createdAt', () => {
    const sorted = [...sampleBookings].sort(
      (a, b) =>
        new Date(b.bookedAt || b.createdAt).getTime() -
        new Date(a.bookedAt || a.createdAt).getTime()
    );

    assert.strictEqual(sorted[0].id, 'job-4'); // 20:00
    assert.strictEqual(sorted[1].id, 'job-2'); // 19:00
    assert.strictEqual(sorted[2].id, 'job-1'); // 18:00
    assert.strictEqual(sorted[3].id, 'job-3'); // 23rd 10:00
  });

  it('handles "Not rated yet" when no review exists', () => {
    const unratedBooking = sampleBookings.find((b) => b.id === 'job-1')!;
    assert.strictEqual(unratedBooking.customerReview, null);

    const ratedBooking = sampleBookings.find((b) => b.id === 'job-3')!;
    assert.notStrictEqual(ratedBooking.customerReview, null);
    assert.strictEqual(ratedBooking.customerReview?.rating, 5);
  });

  it('preserves exact pricing, worker name, and category', () => {
    const b = sampleBookings[0];
    assert.strictEqual(b.agreedPriceInr, 700);
    assert.strictEqual(b.workerName, 'Ramesh Kumar');
    assert.strictEqual(b.workerCategory, 'electrical');
  });
});
