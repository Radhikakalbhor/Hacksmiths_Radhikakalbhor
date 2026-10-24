-- ==============================================================================
-- Sahayak Migration 03: PostGIS Spatial Queries & Secure Verification Functions
-- Provides nearby worker discovery and cryptographic OTP handshake
-- ==============================================================================

-- 1. PostGIS Nearby Workers Discovery Function
-- Exposes only approved, non-sensitive worker data for customer discovery
CREATE OR REPLACE FUNCTION public.find_nearby_workers(
    origin_lat DOUBLE PRECISION,
    origin_lng DOUBLE PRECISION,
    radius_meters INT DEFAULT 10000,
    category_filter TEXT DEFAULT NULL,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    worker_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    primary_category TEXT,
    skills TEXT[],
    bio TEXT,
    years_experience INT,
    hourly_rate_inr NUMERIC,
    fixed_rate_estimate_inr NUMERIC,
    reputation_score NUMERIC,
    total_completed_jobs INT,
    is_available BOOLEAN,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
DECLARE
    origin_point geography;
BEGIN
    origin_point := ST_SetSRID(ST_MakePoint(origin_lng, origin_lat), 4326)::geography;

    RETURN QUERY
    SELECT
        p.id AS worker_id,
        p.full_name,
        p.avatar_url,
        wp.primary_category,
        wp.skills,
        wp.bio,
        wp.years_experience,
        wp.hourly_rate_inr,
        wp.fixed_rate_estimate_inr,
        wp.reputation_score,
        wp.total_completed_jobs,
        wp.is_available,
        ST_Distance(wp.service_location, origin_point) AS distance_meters
    FROM public.worker_profiles wp
    JOIN public.profiles p ON p.id = wp.user_id
    WHERE wp.is_publicly_visible = true
      AND wp.is_available = true
      AND wp.service_location IS NOT NULL
      AND (category_filter IS NULL OR wp.primary_category ILIKE category_filter)
      AND ST_DWithin(wp.service_location, origin_point, radius_meters)
    ORDER BY distance_meters ASC
    LIMIT max_results;
END;
$$;

-- Grant execution to authenticated & anonymous users for public discovery
GRANT EXECUTE ON FUNCTION public.find_nearby_workers(
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    INTEGER,
    TEXT,
    INTEGER
) TO authenticated, anon;

-- 2. Secure Server-Side OTP Verification Function
-- Validates salted SHA-256 OTP hashes without revealing plain text
CREATE OR REPLACE FUNCTION public.verify_job_otp(
    p_job_id UUID,
    p_type verification_type,
    p_otp_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_rec RECORD;
    v_computed_hash TEXT;
    v_next_status job_status;
BEGIN
    -- 1. Authorization: Verify caller is party to the job (customer or selected_worker) or an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.jobs
        WHERE id = p_job_id
          AND (customer_id = auth.uid() OR selected_worker_id = auth.uid())
    ) AND NOT public.is_admin() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: Only job participants can verify OTP codes.'
        );
    END IF;

    -- 2. Retrieve verification record
    SELECT * INTO v_rec
    FROM public.job_verifications
    WHERE job_id = p_job_id AND verification_type = p_type
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No verification record found for this job milestone.');
    END IF;

    IF v_rec.verified_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'This OTP has already been verified.');
    END IF;

    IF NOW() > v_rec.expires_at THEN
        RETURN jsonb_build_object('success', false, 'error', 'OTP has expired. Please request a new code.');
    END IF;

    IF v_rec.attempts >= v_rec.max_attempts THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum OTP verification attempts exceeded.');
    END IF;

    -- Increment attempt counter
    UPDATE public.job_verifications
    SET attempts = attempts + 1
    WHERE id = v_rec.id;

    -- Compute SHA-256 hash using salt
    v_computed_hash := encode(digest(p_otp_code || v_rec.salt, 'sha256'), 'hex');

    IF v_computed_hash != v_rec.otp_hash THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid verification code.',
            'remaining_attempts', v_rec.max_attempts - (v_rec.attempts + 1)
        );
    END IF;

    -- Mark verified
    UPDATE public.job_verifications
    SET verified_at = NOW()
    WHERE id = v_rec.id;

    -- Determine next status transition
    IF p_type = 'JOB_START' THEN
        v_next_status := 'IN_PROGRESS';
    ELSE
        v_next_status := 'COMPLETED';
    END IF;

    -- Update job status
    UPDATE public.jobs
    SET status = v_next_status, updated_at = NOW()
    WHERE id = p_job_id;

    RETURN jsonb_build_object(
        'success', true,
        'new_status', v_next_status,
        'verified_at', NOW()
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_job_otp TO authenticated;

