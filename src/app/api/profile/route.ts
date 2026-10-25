/**
 * Customer Profile API: GET & PATCH /api/profile
 * Allows authenticated users to safely view and update their profile.
 * Mediates updates through the server so that recursive RLS policies on public.profiles
 * in the database do not block updates, while strictly ensuring users can only modify their own profile.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { validateIndianPhoneNumber } from '@/lib/validations/auth';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    if (!supabase) {
      return apiError('Database connection unavailable.', 503, 'DATABASE_UNAVAILABLE');
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError('Authentication required.', 401, 'UNAUTHENTICATED');
    }

    // Try fetching from public.profiles
    const admin = getSupabaseAdminClient();
    const client = admin || supabase;
    const { data: profile } = await client
      .from('profiles')
      .select('id, full_name, email, phone, primary_city, role')
      .eq('id', user.id)
      .maybeSingle();

    return apiSuccess({
      id: user.id,
      email: user.email || profile?.email || '',
      fullName:
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Customer',
      phone: profile?.phone || user.phone || user.user_metadata?.phone || '',
      defaultAddress:
        user.user_metadata?.default_service_address ||
        user.user_metadata?.address ||
        profile?.primary_city ||
        '',
      role: profile?.role || user.user_metadata?.role || 'customer',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve profile.';
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient(request);
    if (!supabase) {
      return apiError('Database connection unavailable.', 503, 'DATABASE_UNAVAILABLE');
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError('Authentication required to update profile.', 401, 'UNAUTHENTICATED');
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON payload in request body.', 400, 'BAD_REQUEST');
    }

    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    if (!fullName || fullName.length < 2) {
      return apiError('Full Name must be at least 2 characters.', 400, 'INVALID_NAME');
    }

    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (phone && !validateIndianPhoneNumber(phone)) {
      return apiError(
        'Please enter a valid 10-digit Indian phone number (e.g. 9876543210).',
        400,
        'INVALID_PHONE'
      );
    }

    const defaultAddress = typeof body.defaultAddress === 'string' ? body.defaultAddress.trim() : '';

    // Determine safe phone to persist
    const rawFallback = body.fallbackPhone || user.phone || user.user_metadata?.phone;
    const phoneToPersist =
      phone || rawFallback || `user_${user.id.replace(/-/g, '').slice(0, 10)}`;

    const profileUpdatePayload: {
      full_name: string;
      phone: string;
      primary_city?: string;
      updated_at: string;
    } = {
      full_name: fullName,
      phone: phoneToPersist,
      updated_at: new Date().toISOString(),
    };

    if (defaultAddress) {
      profileUpdatePayload.primary_city = defaultAddress;
    }

    // 1. Update public.profiles using admin client to prevent recursive RLS policy loops on profiles
    // The admin client uses the service-role securely on the server and strictly scopes to `user.id`
    const admin = getSupabaseAdminClient();
    const dbClient = admin || supabase;

    const { data: updatedProfile, error: dbError } = await dbClient
      .from('profiles')
      .update(profileUpdatePayload)
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (dbError) {
      console.error('[PATCH /api/profile] Database update error:', dbError.message);
      return apiError(dbError.message, 500, 'PROFILE_UPDATE_FAILED');
    }

    // 2. Keep Supabase Auth user metadata synchronized
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          name: fullName,
          phone: phone || undefined,
          default_service_address: defaultAddress || undefined,
          address: defaultAddress || undefined,
          primary_city: defaultAddress || undefined,
        },
      });
    } catch {
      // Non-critical metadata update failure tolerated if profiles table updated
    }

    return apiSuccess({
      message: 'Profile saved successfully!',
      profile: updatedProfile || {
        id: user.id,
        full_name: fullName,
        phone: phoneToPersist,
        primary_city: profileUpdatePayload.primary_city,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An error occurred while saving profile.';
    return apiError(msg, 500, 'INTERNAL_SERVER_ERROR');
  }
}
