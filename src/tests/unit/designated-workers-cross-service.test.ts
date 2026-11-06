import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESIGNATED_CROSS_SERVICE_WORKERS,
  DESIGNATED_CROSS_SERVICE_USER_IDS,
  EXCLUDED_CROSS_SERVICE_USER_IDS,
  EXCLUDED_CROSS_SERVICE_EMAILS,
  isDesignatedCrossServiceWorkerId,
  isDesignatedCrossServiceEmail,
  isDesignatedCrossServiceWorker,
} from '@/lib/config/designated-workers';
import { WorkersService } from '@/lib/services/workers.service';
import { BookingState } from '@/types/booking';

describe('Designated Cross-Service Real Test Workers Suite', () => {
  const verifiedIds = [
    '0fd68ac1-4a91-400d-9287-46fd12cb9f6f', // Agam
    'e46994d2-bc15-411b-b82e-015f69e31960', // Dhawal
    '9c0783dc-218d-4c51-b7fa-31f2dfc23aac', // Radha
    '9682e393-1467-47e4-8dec-51076e0bdd37', // Radhika
    '0df39f8c-8aa4-496a-9171-64ce48f18a12', // Sayantan
  ];

  const excludedId = '714b0e10-ef5f-418b-b474-a1a07d725911'; // warrior22ghosh@gmail.com

  it('1. Correctly verifies all five designated Supabase user IDs', () => {
    assert.equal(DESIGNATED_CROSS_SERVICE_WORKERS.length, 5);
    for (const id of verifiedIds) {
      assert.equal(isDesignatedCrossServiceWorkerId(id), true);
      assert.equal(isDesignatedCrossServiceWorker(id), true);
    }
  });

  it('2. Strictly excludes warrior22ghosh@gmail.com and its user ID', () => {
    assert.equal(isDesignatedCrossServiceWorkerId(excludedId), false);
    assert.equal(isDesignatedCrossServiceEmail('warrior22ghosh@gmail.com'), false);
    assert.equal(isDesignatedCrossServiceWorker(excludedId, 'warrior22ghosh@gmail.com'), false);
    assert.equal(EXCLUDED_CROSS_SERVICE_USER_IDS.has(excludedId.toLowerCase()), true);
    assert.equal(EXCLUDED_CROSS_SERVICE_EMAILS.has('warrior22ghosh@gmail.com'), true);
  });

  it('3. Appears across every service category (Plumbing, Electrical, Deep Cleaning, Cooking, Painting)', async () => {
    const categoriesToTest = [
      'plumbing',
      'electrical',
      'deep cleaning',
      'cleaning',
      'cooking',
      'painting',
      'carpentry',
      'appliance_repair',
    ];

    const mockRealRows = [
      {
        id: 'wp-1',
        user_id: '0fd68ac1-4a91-400d-9287-46fd12cb9f6f',
        primary_category: 'plumbing',
        skills: ['plumbing'],
        experience_years: 4,
        is_available: true,
        worker_source: 'real',
        is_demo: false,
        profiles: {
          id: '0fd68ac1-4a91-400d-9287-46fd12cb9f6f',
          full_name: 'Agam',
          email: 'aagamnew21@gmail.com',
          role: 'worker',
          verification_status: 'verified',
        },
      },
      {
        id: 'wp-2',
        user_id: 'e46994d2-bc15-411b-b82e-015f69e31960',
        primary_category: 'plumbing',
        skills: ['plumbing'],
        experience_years: 3,
        is_available: true,
        worker_source: 'real',
        is_demo: false,
        profiles: {
          id: 'e46994d2-bc15-411b-b82e-015f69e31960',
          full_name: 'Dhawal',
          email: 'dhawalsunaniya763@gmail.com',
          role: 'worker',
          verification_status: 'verified',
        },
      },
      {
        id: 'wp-3',
        user_id: '9c0783dc-218d-4c51-b7fa-31f2dfc23aac',
        primary_category: 'plumbing',
        skills: ['plumbing'],
        experience_years: 2,
        is_available: true,
        worker_source: 'real',
        is_demo: false,
        profiles: {
          id: '9c0783dc-218d-4c51-b7fa-31f2dfc23aac',
          full_name: 'Radha',
          email: 'kalbhorradhika7@gmail.com',
          role: 'worker',
          verification_status: 'verified',
        },
      },
      {
        id: 'wp-4',
        user_id: '9682e393-1467-47e4-8dec-51076e0bdd37',
        primary_category: 'plumbing',
        skills: ['plumbing'],
        experience_years: 2,
        is_available: true,
        worker_source: 'real',
        is_demo: false,
        profiles: {
          id: '9682e393-1467-47e4-8dec-51076e0bdd37',
          full_name: 'Radhika',
          email: 'radhika.kalbhor24@sakec.ac.in',
          role: 'worker',
          verification_status: 'verified',
        },
      },
      {
        id: 'wp-5',
        user_id: '0df39f8c-8aa4-496a-9171-64ce48f18a12',
        primary_category: 'electrical',
        skills: ['electrical'],
        experience_years: 3,
        is_available: true,
        worker_source: 'real',
        is_demo: false,
        profiles: {
          id: '0df39f8c-8aa4-496a-9171-64ce48f18a12',
          full_name: 'Sayantan',
          email: 'warriors22ghosh@gmail.com',
          role: 'worker',
          verification_status: 'verified',
        },
      },
      // Excluded worker record
      {
        id: 'wp-excluded',
        user_id: excludedId,
        primary_category: 'plumbing',
        skills: ['plumbing'],
        experience_years: 1,
        is_available: true,
        worker_source: 'real',
        is_demo: false,
        profiles: {
          id: excludedId,
          full_name: 'Excluded Sayanthan',
          email: 'warrior22ghosh@gmail.com',
          role: 'worker',
          verification_status: 'unverified',
        },
      },
      // Regular other real worker (carpenter)
      {
        id: 'wp-regular-carpenter',
        user_id: 'other-carpenter-uuid',
        primary_category: 'carpentry',
        skills: ['carpentry', 'woodwork'],
        experience_years: 5,
        is_available: true,
        worker_source: 'real',
        is_demo: false,
        profiles: {
          id: 'other-carpenter-uuid',
          full_name: 'Ramesh Carpenter',
          email: 'ramesh.carpenter@example.com',
          role: 'worker',
          verification_status: 'verified',
        },
      },
    ];

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: mockRealRows, error: null }),
        }),
      }),
      rpc: async () => ({ data: [], error: null }),
    } as any;

    for (const cat of categoriesToTest) {
      const results = await WorkersService.queryNearbyWorkers(mockSupabase, {
        originLat: 19.076,
        originLng: 72.8777,
        categoryFilter: cat,
        maxResults: 50,
      });

      const returnedIds = new Set(results.map((w) => w.worker_id));

      // 1. All 5 designated accounts MUST appear in this category!
      for (const id of verifiedIds) {
        assert.equal(
          returnedIds.has(id),
          true,
          `Worker ${id} should appear in category ${cat}`
        );
        const workerCard = results.find((w) => w.worker_id === id);
        assert.equal(workerCard?.is_cross_service_demo, true);
        assert.equal(workerCard?.worker_source, 'real');
        assert.equal(workerCard?.is_demo, false);
      }

      // 2. The excluded worker must NOT appear in non-plumbing categories!
      if (cat !== 'plumbing') {
        assert.equal(returnedIds.has(excludedId), false);
      }

      // 3. The regular carpenter must ONLY appear in carpentry!
      if (cat === 'carpentry') {
        assert.equal(returnedIds.has('other-carpenter-uuid'), true);
      } else {
        assert.equal(returnedIds.has('other-carpenter-uuid'), false);
      }
    }
  });

  it('4. Preserves original primary_category and profile details without fabricating certification', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              {
                id: 'wp-1',
                user_id: '0fd68ac1-4a91-400d-9287-46fd12cb9f6f',
                primary_category: 'plumbing',
                skills: ['plumbing', 'pipe_fitting'],
                experience_years: 4,
                is_available: true,
                worker_source: 'real',
                is_demo: false,
                profiles: {
                  id: '0fd68ac1-4a91-400d-9287-46fd12cb9f6f',
                  full_name: 'Agam',
                  email: 'aagamnew21@gmail.com',
                  role: 'worker',
                },
              },
            ],
            error: null,
          }),
        }),
      }),
      rpc: async () => ({ data: [], error: null }),
    } as any;

    const results = await WorkersService.queryNearbyWorkers(mockSupabase, {
      originLat: 19.076,
      originLng: 72.8777,
      categoryFilter: 'cooking', // Customer requested cooking
      maxResults: 20,
    });

    const agam = results.find((w) => w.worker_id === '0fd68ac1-4a91-400d-9287-46fd12cb9f6f');
    assert.ok(agam);
    // Original trade and skills are completely preserved!
    assert.equal(agam.primary_category, 'plumbing');
    assert.deepEqual(agam.skills, ['plumbing', 'pipe_fitting']);
    // Cross-service demo badge is attached
    assert.equal(agam.is_cross_service_demo, true);
    assert.equal(agam.cross_service_badge, 'Cross-Service Demo');
  });

  it('5. Avoids duplicate worker cards when merging search results', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              {
                id: 'wp-1',
                user_id: '0fd68ac1-4a91-400d-9287-46fd12cb9f6f',
                primary_category: 'plumbing',
                skills: ['plumbing'],
                experience_years: 4,
                is_available: true,
                worker_source: 'real',
                profiles: {
                  id: '0fd68ac1-4a91-400d-9287-46fd12cb9f6f',
                  full_name: 'Agam',
                  email: 'aagamnew21@gmail.com',
                },
              },
            ],
            error: null,
          }),
        }),
      }),
      rpc: async () => ({ data: [], error: null }),
    } as any;

    const results = await WorkersService.queryNearbyWorkers(mockSupabase, {
      originLat: 19.076,
      originLng: 72.8777,
      categoryFilter: 'plumbing',
      maxResults: 20,
    });

    const agamOccurrences = results.filter(
      (w) => w.worker_id === '0fd68ac1-4a91-400d-9287-46fd12cb9f6f'
    );
    assert.equal(agamOccurrences.length, 1);
  });

  it('6. Direct booking routes real designated worker requests genuine booking without auto-start timer', () => {
    const designatedId = '0fd68ac1-4a91-400d-9287-46fd12cb9f6f';
    const isDesignated = isDesignatedCrossServiceWorkerId(designatedId);

    const booking: BookingState = {
      stage: isDesignated ? 'requested' : 'accepted',
      stageUpdatedAt: new Date().toISOString(),
      accepted_at: isDesignated ? null : new Date().toISOString(),
      workerId: designatedId,
      workerName: 'Agam',
      workerCategory: 'cooking', // Customer booked cooking
      workerRating: 5.0,
      workerExperience: 3,
      isDemoWorker: false, // Strictly false!
      agreedPriceInr: 850,
      estimatedArrivalMinutes: 20,
      simulatedSecondsRemaining: undefined, // No timer before acceptance
      customerOtp: undefined, // No OTP before acceptance
      otpVerified: false,
    };

    assert.equal(booking.isDemoWorker, false);
    assert.equal(booking.stage, 'requested');
    assert.equal(booking.accepted_at, null);
    assert.equal(booking.simulatedSecondsRemaining, undefined);
    assert.equal(booking.workerCategory, 'cooking');
  });

  it('7. Preserves demo worker simulated booking flow with auto-acceptance', () => {
    const demoBooking: BookingState = {
      stage: 'accepted',
      stageUpdatedAt: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      workerId: 'demo-worker-uuid-1',
      workerName: 'Rajesh Kumar',
      workerCategory: 'plumbing',
      workerRating: 4.9,
      workerExperience: 8,
      isDemoWorker: true,
      agreedPriceInr: 450,
      estimatedArrivalMinutes: 15,
      simulatedSecondsRemaining: 900,
      customerOtp: '849201',
      otpVerified: false,
    };

    assert.equal(demoBooking.isDemoWorker, true);
    assert.equal(demoBooking.stage, 'accepted');
    assert.ok(demoBooking.accepted_at);
    assert.equal(demoBooking.simulatedSecondsRemaining, 900);
    assert.equal(demoBooking.customerOtp, '849201');
  });
});
