/**
 * Automated Unit Tests: Authentication & Role Authorization
 * Tests unauthenticated rejection, missing configuration handling, and role permissions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth, requireRole } from '@/lib/auth/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

describe('Server Authentication & Authorization Helpers', () => {
  it('should return 503 DATABASE_NOT_CONFIGURED when Supabase client is null', async () => {
    const result = await requireAuth(null);
    assert.equal(result.success, false);

    if (!result.success) {
      assert.equal(result.response.status, 503);
      const json = await result.response.json();
      assert.equal(json.code, 'DATABASE_NOT_CONFIGURED');
    }
  });

  it('should return 401 UNAUTHENTICATED when session user is missing', async () => {
    // Mock Supabase client returning no user
    const mockSupabaseNoUser = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: new Error('Session missing') }),
      },
    } as unknown as SupabaseClient<Database>;

    const result = await requireAuth(mockSupabaseNoUser);
    assert.equal(result.success, false);

    if (!result.success) {
      assert.equal(result.response.status, 401);
      const json = await result.response.json();
      assert.equal(json.code, 'UNAUTHENTICATED');
    }
  });

  it('should return 401 UNAUTHENTICATED when profile record is missing in database', async () => {
    const mockSupabaseNoProfile = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'usr-123' } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await requireAuth(mockSupabaseNoProfile);
    assert.equal(result.success, false);

    if (!result.success) {
      assert.equal(result.response.status, 401);
    }
  });

  it('should allow user when role matches allowed roles', async () => {
    const mockCustomerUser = { id: 'cust-123' };
    const mockCustomerProfile = {
      id: 'cust-123',
      role: 'customer' as const,
      full_name: 'Priya Sharma',
      phone: '9876543210',
    };

    const mockSupabase = {
      auth: {
        getUser: async () => ({ data: { user: mockCustomerUser }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockCustomerProfile, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await requireRole(mockSupabase, ['customer']);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.context.profile.role, 'customer');
      assert.equal(result.context.user.id, 'cust-123');
    }
  });

  it('should return 403 FORBIDDEN_ROLE when worker attempts customer-only action', async () => {
    const mockWorkerUser = { id: 'wrk-123' };
    const mockWorkerProfile = {
      id: 'wrk-123',
      role: 'worker' as const,
      full_name: 'Rameshwar Kumar',
      phone: '9876543211',
    };

    const mockSupabase = {
      auth: {
        getUser: async () => ({ data: { user: mockWorkerUser }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockWorkerProfile, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await requireRole(mockSupabase, ['customer']);
    assert.equal(result.success, false);

    if (!result.success) {
      assert.equal(result.response.status, 403);
      const json = await result.response.json();
      assert.equal(json.code, 'FORBIDDEN_ROLE');
    }
  });

  it('should auto-provision Google OAuth customer and authorize job posting with correct customer ID', async () => {
    const googleUser = {
      id: 'google-usr-999',
      email: 'customer@gmail.com',
      user_metadata: {
        full_name: 'Radhika Kalbhor',
        role: 'customer',
      },
    };

    let tableInsertedPayload: unknown = null;

    const mockSupabaseGoogleUser = {
      auth: {
        getUser: async () => ({ data: { user: googleUser }, error: null }),
      },
      from: (tableName: string) => {
        assert.equal(tableName, 'profiles');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }), // Initially missing profile
            }),
          }),
          upsert: (payload: unknown) => {
            tableInsertedPayload = payload;
            return {
              select: () => ({
                maybeSingle: async () => ({
                  data: {
                    ...(payload as object),
                    id: googleUser.id,
                    role: 'customer',
                    full_name: 'Radhika Kalbhor',
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      },
    } as unknown as SupabaseClient<Database>;

    const result = await requireRole(mockSupabaseGoogleUser, ['customer']);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.context.user.id, 'google-usr-999');
      assert.equal(result.context.profile.role, 'customer');
      assert.equal(result.context.profile.full_name, 'Radhika Kalbhor');
      assert.ok(tableInsertedPayload);
    }
  });

  it('should return 500 DATABASE_ERROR when profile query encounters a database permission failure', async () => {
    const activeUser = { id: 'usr-permission-err', email: 'test@example.com' };

    const mockSupabasePermError = {
      auth: {
        getUser: async () => ({ data: { user: activeUser }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: {
                code: '42501',
                message: 'permission denied for table profiles',
              },
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await requireAuth(mockSupabasePermError);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.response.status, 500);
      const json = await result.response.json();
      assert.equal(json.code, 'DATABASE_ERROR');
      assert.match(json.error, /permission denied for table profiles/);
    }
  });
});
