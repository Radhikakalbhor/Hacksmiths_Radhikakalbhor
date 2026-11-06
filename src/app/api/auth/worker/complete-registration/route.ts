import { NextRequest, connection } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/response';
import { validateWorkerRegistration } from '@/lib/validations/auth';

export async function POST(request: NextRequest) {
  await connection();

  try {
    const supabase = await getSupabaseServerClient(request);
    let user: any = null;

    if (supabase) {
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      user = cookieUser;
    }

    // Fallback: If cookie is not yet synced in the browser client, check Bearer token
    if (!user) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const admin = getSupabaseAdminClient();
        if (admin && token) {
          const { data: tokenData, error: tokenError } = await admin.auth.getUser(token);
          if (!tokenError && tokenData?.user) {
            user = tokenData.user;
          }
        }
      }
    }

    if (!user) {
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

    // Normalize phone number to standard E.164 (+91XXXXXXXXXX)
    let normalizedPhone = phone.replace(/[\s\-()]/g, '');
    if (/^[6-9]\d{9}$/.test(normalizedPhone)) {
      normalizedPhone = `+91${normalizedPhone}`;
    }

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

    const baseProfFields = {
      full_name: fullName,
      phone: normalizedPhone,
      role: 'worker' as const,
      verification_status: 'verified' as const,
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      let updateProfErr: any = null;
      // Attempt with user_source first for forward compatibility with hybrid schema migration
      const res1 = await admin
        .from('profiles')
        .update({
          ...baseProfFields,
          user_source: 'real',
        })
        .eq('id', user.id);

      updateProfErr = res1.error;

      // If user_source is not yet in PostgREST schema cache (PGRST204), fallback to core columns
      if (
        updateProfErr &&
        (updateProfErr.code === 'PGRST204' || updateProfErr.message?.toLowerCase().includes('user_source'))
      ) {
        const resFallback = await admin
          .from('profiles')
          .update(baseProfFields)
          .eq('id', user.id);
        updateProfErr = resFallback.error;
      }

      if (updateProfErr) {
        console.error('[Worker Registration] Error updating profile:', updateProfErr.message);
        if (
          updateProfErr.code === '23505' ||
          updateProfErr.message?.toLowerCase().includes('unique') ||
          updateProfErr.message?.toLowerCase().includes('duplicate')
        ) {
          return apiError('This mobile number is already registered with another account.', 409, 'DUPLICATE_RESOURCE');
        }
        return apiError(updateProfErr.message || 'Failed to update user profile to partner.', 500, 'DATABASE_ERROR');
      }
    } else {
      const baseInsertProf = {
        id: user.id,
        email: user.email || validation.data.email,
        phone: normalizedPhone,
        full_name: fullName,
        role: 'worker' as const,
        verification_status: 'verified' as const,
        primary_city: 'Mumbai',
      };

      let insertProfErr: any = null;
      const res1 = await admin.from('profiles').insert({
        ...baseInsertProf,
        user_source: 'real',
      });
      insertProfErr = res1.error;

      // If user_source is not yet in PostgREST schema cache, fallback to core columns
      if (
        insertProfErr &&
        (insertProfErr.code === 'PGRST204' || insertProfErr.message?.toLowerCase().includes('user_source'))
      ) {
        const resFallback = await admin.from('profiles').insert(baseInsertProf);
        insertProfErr = resFallback.error;
      }

      if (insertProfErr) {
        console.error('[Worker Registration] Error inserting profile:', insertProfErr.message);
        if (
          insertProfErr.code === '23505' ||
          insertProfErr.message?.toLowerCase().includes('unique') ||
          insertProfErr.message?.toLowerCase().includes('duplicate')
        ) {
          return apiError('This mobile number is already registered with another account.', 409, 'DUPLICATE_RESOURCE');
        }
        return apiError(insertProfErr.message || 'Failed to create partner profile.', 500, 'DATABASE_ERROR');
      }
    }

    // 2. Provision or update worker_profiles table
    const { data: existingWp } = await admin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const baseWpFields = {
      primary_category: primaryCategory,
      bio: bio,
      years_experience: yearsExperience,
      is_available: true,
      is_publicly_visible: true,
      updated_at: new Date().toISOString(),
    };

    if (existingWp) {
      let updateWpErr: any = null;
      const res1 = await admin
        .from('worker_profiles')
        .update({
          ...baseWpFields,
          worker_source: 'real',
          is_demo: false,
        })
        .eq('id', existingWp.id);
      updateWpErr = res1.error;

      // If worker_source or is_demo not in schema cache, fallback to core columns
      if (
        updateWpErr &&
        (updateWpErr.code === 'PGRST204' ||
          updateWpErr.message?.toLowerCase().includes('worker_source') ||
          updateWpErr.message?.toLowerCase().includes('is_demo'))
      ) {
        const resFallback = await admin
          .from('worker_profiles')
          .update(baseWpFields)
          .eq('id', existingWp.id);
        updateWpErr = resFallback.error;
      }

      if (updateWpErr) {
        console.error('[Worker Registration] Error updating worker profile:', updateWpErr.message);
        return apiError(updateWpErr.message || 'Failed to update trade credentials.', 500, 'DATABASE_ERROR');
      }
    } else {
      const baseInsertWp = {
        user_id: user.id,
        primary_category: primaryCategory,
        skills: [primaryCategory],
        bio: bio,
        years_experience: yearsExperience,
        service_radius_km: 15.0,
        is_available: true,
        is_publicly_visible: true,
        reputation_score: 5.0,
        total_completed_jobs: 0,
      };

      let insertWpErr: any = null;
      const res1 = await admin.from('worker_profiles').insert({
        ...baseInsertWp,
        worker_source: 'real',
        is_demo: false,
      });
      insertWpErr = res1.error;

      // If worker_source or is_demo not in schema cache, fallback to core columns
      if (
        insertWpErr &&
        (insertWpErr.code === 'PGRST204' ||
          insertWpErr.message?.toLowerCase().includes('worker_source') ||
          insertWpErr.message?.toLowerCase().includes('is_demo'))
      ) {
        const resFallback = await admin.from('worker_profiles').insert(baseInsertWp);
        insertWpErr = resFallback.error;
      }

      if (insertWpErr) {
        console.error('[Worker Registration] Error inserting worker profile:', insertWpErr.message);
        return apiError(insertWpErr.message || 'Failed to initialize worker profile record.', 500, 'DATABASE_ERROR');
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

