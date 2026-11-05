import { NextRequest, connection } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';
import { validateEmail } from '@/lib/validations/auth';

export async function POST(request: NextRequest) {
  await connection();

  try {
    const body = await request.json();
    const { email, intent } = body || {};

    if (!email || typeof email !== 'string') {
      return apiError('Email address is required.', 400, 'INVALID_EMAIL');
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmail(cleanEmail)) {
      return apiError('Please provide a valid email address.', 400, 'INVALID_EMAIL');
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return apiError('Database configuration unavailable.', 503, 'DATABASE_UNAVAILABLE');
    }

    // Query profiles table by email
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, role, email, full_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (profileErr) {
      console.error('[Worker Auth Pre-Check] Error querying profile:', profileErr.message);
      return apiError('Internal error verifying partner status.', 500, 'DATABASE_ERROR');
    }

    // Also check worker_profiles if profile exists
    let hasWorkerProfile = false;
    if (profile) {
      const { data: wp } = await admin
        .from('worker_profiles')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();
      hasWorkerProfile = !!wp;
    }

    if (intent === 'signin') {
      // Must be an existing worker with worker role
      const isRegisteredWorker = profile && profile.role === 'worker' && hasWorkerProfile;

      if (!isRegisteredWorker) {
        return apiSuccess({
          allowed: false,
          code: 'NOT_REGISTERED_WORKER',
          error: 'This email is not registered as a worker. Please register as a new partner first.',
        });
      }

      return apiSuccess({
        allowed: true,
        role: 'worker',
      });
    }

    if (intent === 'register') {
      // Check for duplicate worker registration
      if (profile && profile.role === 'worker' && hasWorkerProfile) {
        return apiSuccess({
          allowed: false,
          code: 'ALREADY_REGISTERED_WORKER',
          error: 'This email is already registered as a worker partner. Please use "Existing Worker Sign In" to log in.',
        });
      }

      // Check if existing customer
      if (profile && profile.role === 'customer') {
        return apiSuccess({
          allowed: true,
          isExistingCustomer: true,
          message:
            'Notice: An existing customer account with this email was found. Completing partner verification will enable worker partner capabilities for your account while preserving your customer job history.',
        });
      }

      // Completely new email
      return apiSuccess({
        allowed: true,
        isNew: true,
      });
    }

    return apiError('Invalid intent specified. Must be "signin" or "register".', 400, 'INVALID_INTENT');
  } catch (err: unknown) {
    console.error('[Worker Auth Pre-Check] Unexpected error:', err);
    return apiError(
      err instanceof Error ? err.message : 'Internal error during pre-check',
      500,
      'INTERNAL_ERROR'
    );
  }
}

