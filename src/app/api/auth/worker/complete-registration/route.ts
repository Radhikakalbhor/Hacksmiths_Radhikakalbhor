import { NextRequest, connection } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';
import { validateWorkerRegistration } from '@/lib/validations/auth';

export async function POST(request: NextRequest) {
  await connection();

  try {
    const supabase = await getSupabaseServerClient(request);
    if (!supabase) {
      return apiError('Database client unavailable.', 503, 'DATABASE_UNAVAILABLE');
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError('Authentication required. Please verify your OTP first.', 401, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const validation = validateWorkerRegistration({
      fullName: body.fullName,
      phone: body.phone,
      primaryCategory: body.primaryCategory,
      yearsExperience: body.yearsExperience,
      bio: body.bio,
      email: user.email || body.email || '',
    });

    if (!validation.success || !validation.data) {
      return apiError(
        Object.values(validation.errors || {})[0] || 'Invalid registration details.',
        400,
        'VALIDATION_FAILED',
        validation.errors
      );
    }

    const { fullName, phone, primaryCategory, yearsExperience, bio } = validation.data;

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return apiError('Privileged database client unavailable.', 503, 'DATABASE_UNAVAILABLE');
    }

    // 1. Provision or update profiles table safely via admin client (bypassing privilege escalation triggers)
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateProfErr } = await admin
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
          role: 'worker',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateProfErr) {
        console.error('[Worker Registration] Error updating profile:', updateProfErr.message);
        return apiError('Failed to update user profile to partner.', 500, 'DATABASE_ERROR');
      }
    } else {
      const { error: insertProfErr } = await admin.from('profiles').insert({
        id: user.id,
        email: user.email || validation.data.email,
        phone: phone,
        full_name: fullName,
        role: 'worker',
        verification_status: 'unverified',
        primary_city: 'Mumbai',
      });

      if (insertProfErr) {
        console.error('[Worker Registration] Error inserting profile:', insertProfErr.message);
        return apiError('Failed to create partner profile.', 500, 'DATABASE_ERROR');
      }
    }

    // 2. Provision or update worker_profiles table
    const { data: existingWp } = await admin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingWp) {
      const { error: updateWpErr } = await admin
        .from('worker_profiles')
        .update({
          primary_category: primaryCategory,
          bio: bio,
          years_experience: yearsExperience,
          is_available: true,
        })
        .eq('id', existingWp.id);

      if (updateWpErr) {
        console.error('[Worker Registration] Error updating worker profile:', updateWpErr.message);
        return apiError('Failed to update trade credentials.', 500, 'DATABASE_ERROR');
      }
    } else {
      const { error: insertWpErr } = await admin.from('worker_profiles').insert({
        user_id: user.id,
        primary_category: primaryCategory,
        skills: [primaryCategory],
        bio: bio,
        years_experience: yearsExperience,
        service_radius_km: 10.0,
        is_available: true,
        is_publicly_visible: false,
      });

      if (insertWpErr) {
        console.error('[Worker Registration] Error inserting worker profile:', insertWpErr.message);
        return apiError('Failed to initialize worker profile record.', 500, 'DATABASE_ERROR');
      }
    }

    // Also update auth.users metadata if admin API is available
    try {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          role: 'worker',
          full_name: fullName,
          phone: phone,
        },
      });
    } catch (metaErr) {
      console.warn('[Worker Registration] Notice: Could not update auth user metadata:', metaErr);
    }

    return apiSuccess({
      success: true,
      role: 'worker',
      destination: '/worker/dashboard',
    });
  } catch (err: unknown) {
    console.error('[Worker Registration Complete] Unexpected error:', err);
    return apiError(
      err instanceof Error ? err.message : 'Internal error completing registration',
      500,
      'INTERNAL_ERROR'
    );
  }
}

