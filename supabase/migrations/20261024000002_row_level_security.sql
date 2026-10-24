-- ==============================================================================
-- Sahayak Migration 02: Row-Level Security (RLS) & Authorization Policies
-- Enforces strict zero-trust access control at the database layer
-- Fully idempotent with DROP POLICY IF EXISTS guards on all policies
-- ==============================================================================

-- 1. Helper Security Functions

-- Check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;

-- Trigger to prevent regular users from elevating role or verification status
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow service role bypass
    IF (auth.jwt() ->> 'role') = 'service_role'
       OR current_user = 'service_role'
       OR current_setting('role', true) = 'service_role'
       OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Only existing admins can change role or verification_status
    IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.verification_status IS DISTINCT FROM NEW.verification_status) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'PERMISSION DENIED: You cannot change your own role or verification status.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Trigger to prevent workers from self-approving KYC badges or public visibility
CREATE OR REPLACE FUNCTION public.prevent_worker_verification_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow service role bypass
    IF (auth.jwt() ->> 'role') = 'service_role'
       OR current_user = 'service_role'
       OR current_setting('role', true) = 'service_role'
       OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF (OLD.government_id_verified IS DISTINCT FROM NEW.government_id_verified) OR
       (OLD.background_check_verified IS DISTINCT FROM NEW.background_check_verified) OR
       (OLD.is_publicly_visible IS DISTINCT FROM NEW.is_publicly_visible) OR
       (OLD.reputation_score IS DISTINCT FROM NEW.reputation_score) OR
       (OLD.total_completed_jobs IS DISTINCT FROM NEW.total_completed_jobs) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'PERMISSION DENIED: Verification badges and reputation metrics can only be updated by the platform.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_worker_verification_escalation ON public.worker_profiles;
CREATE TRIGGER trg_prevent_worker_verification_escalation
    BEFORE UPDATE ON public.worker_profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_worker_verification_escalation();

-- ==============================================================================
-- 2. Enable RLS on All Tables
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_earnings ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. Profiles Policies
-- ==============================================================================

-- A user can read their own profile, or admins can read any profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

-- Counterparties can view basic profile info if they share a job or bid
DROP POLICY IF EXISTS "Counterparties can view active job participant profile" ON public.profiles;
CREATE POLICY "Counterparties can view active job participant profile"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE (jobs.customer_id = auth.uid() AND jobs.selected_worker_id = profiles.id)
               OR (jobs.selected_worker_id = auth.uid() AND jobs.customer_id = profiles.id)
        )
        OR EXISTS (
            SELECT 1 FROM public.bids
            JOIN public.jobs ON jobs.id = bids.job_id
            WHERE (bids.worker_id = profiles.id AND jobs.customer_id = auth.uid())
        )
    );

-- Users can insert their own profile on signup
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile (privilege escalation blocked by trigger)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- ==============================================================================
-- 4. Worker Profiles Policies
-- ==============================================================================

-- Public can view approved & verified worker profiles; workers can view their own; admin can view all
DROP POLICY IF EXISTS "Public worker discovery for approved workers" ON public.worker_profiles;
CREATE POLICY "Public worker discovery for approved workers"
    ON public.worker_profiles FOR SELECT
    USING (is_publicly_visible = true OR auth.uid() = user_id OR public.is_admin());

-- Workers can create their worker profile
DROP POLICY IF EXISTS "Workers can insert own worker profile" ON public.worker_profiles;
CREATE POLICY "Workers can insert own worker profile"
    ON public.worker_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Workers can update non-privileged fields of their profile
DROP POLICY IF EXISTS "Workers can update own worker profile" ON public.worker_profiles;
CREATE POLICY "Workers can update own worker profile"
    ON public.worker_profiles FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 5. Jobs Policies
-- ==============================================================================

-- Customers can view their own jobs
DROP POLICY IF EXISTS "Customers can view own jobs" ON public.jobs;
CREATE POLICY "Customers can view own jobs"
    ON public.jobs FOR SELECT
    USING (auth.uid() = customer_id OR public.is_admin());

-- Assigned worker can view their assigned job
DROP POLICY IF EXISTS "Assigned worker can view job" ON public.jobs;
CREATE POLICY "Assigned worker can view job"
    ON public.jobs FOR SELECT
    USING (auth.uid() = selected_worker_id);

-- Workers can view open jobs available for bidding
DROP POLICY IF EXISTS "Workers can discover open jobs for bidding" ON public.jobs;
CREATE POLICY "Workers can discover open jobs for bidding"
    ON public.jobs FOR SELECT
    USING (
        status IN ('POSTED', 'BIDDING_OPEN')
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'worker'
        )
    );

-- Customers can post jobs
DROP POLICY IF EXISTS "Customers can create jobs" ON public.jobs;
CREATE POLICY "Customers can create jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

-- Customers can update their jobs (e.g. cancel, select worker, update details)
DROP POLICY IF EXISTS "Customers can update own jobs" ON public.jobs;
CREATE POLICY "Customers can update own jobs"
    ON public.jobs FOR UPDATE
    USING (auth.uid() = customer_id OR public.is_admin())
    WITH CHECK (auth.uid() = customer_id OR public.is_admin());

-- Assigned workers can update job status during work execution (e.g. mark arrived, complete)
DROP POLICY IF EXISTS "Assigned worker can update job progress" ON public.jobs;
CREATE POLICY "Assigned worker can update job progress"
    ON public.jobs FOR UPDATE
    USING (auth.uid() = selected_worker_id)
    WITH CHECK (auth.uid() = selected_worker_id);

-- ==============================================================================
-- 6. Bids Policies
-- ==============================================================================

-- Workers can see their own bids
DROP POLICY IF EXISTS "Workers can view own bids" ON public.bids;
CREATE POLICY "Workers can view own bids"
    ON public.bids FOR SELECT
    USING (auth.uid() = worker_id OR public.is_admin());

-- Job owner (customer) can view bids on their jobs
DROP POLICY IF EXISTS "Customers can view bids on their jobs" ON public.bids;
CREATE POLICY "Customers can view bids on their jobs"
    ON public.bids FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = bids.job_id AND jobs.customer_id = auth.uid()
        )
    );

-- Verified workers can place bids on open jobs
DROP POLICY IF EXISTS "Workers can insert bids" ON public.bids;
CREATE POLICY "Workers can insert bids"
    ON public.bids FOR INSERT
    WITH CHECK (
        auth.uid() = worker_id
        AND EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = bids.job_id AND jobs.status IN ('POSTED', 'BIDDING_OPEN')
        )
    );

-- Workers can update/withdraw their own bids
DROP POLICY IF EXISTS "Workers can update own bids" ON public.bids;
CREATE POLICY "Workers can update own bids"
    ON public.bids FOR UPDATE
    USING (auth.uid() = worker_id)
    WITH CHECK (auth.uid() = worker_id);

-- Customers can update bid status / counter on their own jobs
DROP POLICY IF EXISTS "Customers can update bid status" ON public.bids;
CREATE POLICY "Customers can update bid status"
    ON public.bids FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = bids.job_id AND jobs.customer_id = auth.uid()
        )
    );

-- ==============================================================================
-- 7. Price Benchmarks Policies
-- ==============================================================================

-- Price benchmarks are publicly readable for transparency
DROP POLICY IF EXISTS "Anyone can view price benchmarks" ON public.price_benchmarks;
CREATE POLICY "Anyone can view price benchmarks"
    ON public.price_benchmarks FOR SELECT
    TO authenticated, anon
    USING (true);

-- Only admins / service role can mutate benchmarks
DROP POLICY IF EXISTS "Admins can manage price benchmarks" ON public.price_benchmarks;
CREATE POLICY "Admins can manage price benchmarks"
    ON public.price_benchmarks FOR ALL
    USING (public.is_admin());

-- ==============================================================================
-- 8. Reviews Policies
-- ==============================================================================

-- Public can view reviews for worker discovery
DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;
CREATE POLICY "Public can view reviews"
    ON public.reviews FOR SELECT
    TO authenticated, anon
    USING (true);

-- Customers can submit a review only for COMPLETED jobs they own
DROP POLICY IF EXISTS "Customers can review completed jobs" ON public.reviews;
CREATE POLICY "Customers can review completed jobs"
    ON public.reviews FOR INSERT
    WITH CHECK (
        auth.uid() = customer_id
        AND EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = reviews.job_id
              AND jobs.customer_id = auth.uid()
              AND jobs.selected_worker_id = reviews.worker_id
              AND jobs.status = 'COMPLETED'
        )
    );

-- ==============================================================================
-- 9. Job Verifications Policies (Start & Completion OTP)
-- ==============================================================================
-- OTP records are strictly restricted. Direct SELECT of hashes by clients is disallowed.
-- Verification is performed via secure server-side RPC functions.

DROP POLICY IF EXISTS "Admins can view job verifications" ON public.job_verifications;
CREATE POLICY "Admins can view job verifications"
    ON public.job_verifications FOR ALL
    USING (public.is_admin());

-- ==============================================================================
-- 10. Safety Events Policies (SOS & Trusted Contacts)
-- ==============================================================================

-- Users can view safety events they triggered or are party to
DROP POLICY IF EXISTS "Users can view relevant safety events" ON public.safety_events;
CREATE POLICY "Users can view relevant safety events"
    ON public.safety_events FOR SELECT
    USING (
        auth.uid() = triggered_by_user_id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.jobs
            WHERE jobs.id = safety_events.job_id
              AND (jobs.customer_id = auth.uid() OR jobs.selected_worker_id = auth.uid())
        )
    );

-- Any authenticated user can trigger a safety event (SOS)
DROP POLICY IF EXISTS "Users can trigger safety events" ON public.safety_events;
CREATE POLICY "Users can trigger safety events"
    ON public.safety_events FOR INSERT
    WITH CHECK (auth.uid() = triggered_by_user_id);

-- Only admins can resolve safety events
DROP POLICY IF EXISTS "Admins can update safety events" ON public.safety_events;
CREATE POLICY "Admins can update safety events"
    ON public.safety_events FOR UPDATE
    USING (public.is_admin());

-- ==============================================================================
-- 11. Worker Earnings Policies
-- ==============================================================================

-- Workers can view only their own earnings
DROP POLICY IF EXISTS "Workers can view own earnings" ON public.worker_earnings;
CREATE POLICY "Workers can view own earnings"
    ON public.worker_earnings FOR SELECT
    USING (auth.uid() = worker_id OR public.is_admin());

-- Only admins or server service role can record or modify earnings
DROP POLICY IF EXISTS "Only admins can manage worker earnings" ON public.worker_earnings;
CREATE POLICY "Only admins can manage worker earnings"
    ON public.worker_earnings FOR ALL
    USING (public.is_admin());
