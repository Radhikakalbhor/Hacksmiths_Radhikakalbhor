-- ==============================================================================
-- Sahayak Migration 06: Database Privileges Recovery & Non-Recursive RLS Policies
--
-- PURPOSE:
-- 1. Complete Least-Privilege DAC Table & Routine Grants:
--    Restores missing table/sequence/routine grants for `authenticated` and `service_role`
--    while ensuring `anon` cannot access private customer profiles, jobs, or bids.
-- 2. Profiles INSERT Anti-Escalation Guard:
--    Installs `trg_prevent_profile_insert_privilege_escalation` so regular users cannot
--    self-assign `role = 'admin'` or pre-verified status during profile creation.
-- 3. Fixes ALL Direct and Indirect Infinite Recursion on `public.profiles` RLS:
--    - Replaces circular `public.is_admin()` references on `profiles` with direct ownership (`auth.uid() = id`).
--    - Replaces raw cross-table subquery in "Counterparties can view active job participant profile"
--      with a SECURITY DEFINER helper (`is_active_counterparty`), breaking the profiles -> jobs -> profiles cycle.
--    - Replaces raw subquery in jobs policy "Workers can discover open jobs for bidding" with
--      a SECURITY DEFINER helper (`is_worker`), preventing reverse recursion back to profiles.
-- 4. Hardens `public.is_admin()`:
--    Accepts only trusted server-controlled identity (`service_role` and `app_metadata`).
--    Strictly excludes client-mutable `user_metadata`.
-- 5. Fully Idempotent:
--    Can be safely applied and rerun whether Migration 05 was previously executed or not.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Access
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Anonymous (anon) Role: Public Read-Only Access
-- ------------------------------------------------------------------------------
-- Public visitors may only browse approved worker profiles, pricing benchmarks, and reviews
GRANT SELECT ON TABLE public.worker_profiles TO anon;
GRANT SELECT ON TABLE public.price_benchmarks TO anon;
GRANT SELECT ON TABLE public.reviews TO anon;

-- Public worker spatial discovery
GRANT EXECUTE ON FUNCTION public.find_nearby_workers(DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT, INT) TO anon;

-- Explicitly revoke access to all private/sensitive tables from anonymous callers
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.jobs FROM anon;
REVOKE ALL ON TABLE public.bids FROM anon;
REVOKE ALL ON TABLE public.job_verifications FROM anon;
REVOKE ALL ON TABLE public.safety_events FROM anon;
REVOKE ALL ON TABLE public.worker_earnings FROM anon;

-- ------------------------------------------------------------------------------
-- 3. Authenticated (authenticated) Role: Verified Customers & Workers
-- ------------------------------------------------------------------------------
-- Profiles & Market Entities
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.worker_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bids TO authenticated;

-- Pricing & Reviews
GRANT SELECT ON TABLE public.price_benchmarks TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reviews TO authenticated;

-- Safety Events (Emergency SOS submission & status)
GRANT SELECT, INSERT ON TABLE public.safety_events TO authenticated;

-- Job Verifications: Withheld from direct table queries; OTP operations use verify_job_otp
REVOKE ALL ON TABLE public.job_verifications FROM authenticated;

-- Worker Earnings: Read-only access to own financial records
GRANT SELECT ON TABLE public.worker_earnings TO authenticated;

-- Sequences for ID generation
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Authorized Database Functions
GRANT EXECUTE ON FUNCTION public.find_nearby_workers(DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_job_otp(UUID, verification_type, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Server-Side Service Role (service_role)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE 
    public.profiles,
    public.worker_profiles,
    public.jobs,
    public.bids,
    public.price_benchmarks,
    public.reviews,
    public.job_verifications,
    public.safety_events,
    public.worker_earnings
TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 5. Profiles INSERT Privilege Escalation Guard
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_insert_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Allow service role bypass
    IF (auth.jwt() ->> 'role') = 'service_role'
       OR current_user = 'service_role'
       OR pg_catalog.current_setting('role', true) = 'service_role'
       OR pg_catalog.current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Regular users cannot insert themselves as 'admin'
    IF NEW.role = 'admin' THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'PERMISSION DENIED: You cannot self-assign the admin role.';
        END IF;
    END IF;

    -- Regular users cannot insert themselves with pre-verified status
    IF NEW.verification_status IS DISTINCT FROM 'unverified' THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'PERMISSION DENIED: Initial verification status must be unverified.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_insert_privilege_escalation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_profile_insert_privilege_escalation() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_prevent_profile_insert_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_insert_privilege_escalation
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_insert_privilege_escalation();

-- ------------------------------------------------------------------------------
-- 6. Helper Security Functions (SECURITY DEFINER to Break Cross-Table RLS Recursion)
-- ------------------------------------------------------------------------------

-- Hardened admin check: Only server credentials and app_metadata; non-recursive profiles check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
BEGIN
    -- 1. Check if session/caller is service_role (trusted server key)
    IF (auth.jwt() ->> 'role') = 'service_role'
       OR current_user = 'service_role'
       OR pg_catalog.current_setting('role', true) = 'service_role'
       OR pg_catalog.current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN true;
    END IF;

    -- 2. Check trusted server-controlled JWT app_metadata claim (user_metadata is NOT accepted)
    IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
        RETURN true;
    END IF;

    -- 3. Anonymous users cannot be admins
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- 4. Check if authenticated user has admin role in public.profiles table (database-backed)
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Helper to check if caller and target_profile_id are counterparties on an active job or bid.
-- Using SECURITY DEFINER bypasses RLS on jobs/bids, breaking the profiles -> jobs -> profiles cycle.
CREATE OR REPLACE FUNCTION public.is_active_counterparty(target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
BEGIN
    IF auth.uid() IS NULL OR target_profile_id IS NULL THEN
        RETURN false;
    END IF;

    -- Directly check jobs where caller and target are counterparties
    IF EXISTS (
        SELECT 1 FROM public.jobs
        WHERE (customer_id = auth.uid() AND selected_worker_id = target_profile_id)
           OR (selected_worker_id = auth.uid() AND customer_id = target_profile_id)
    ) THEN
        RETURN true;
    END IF;

    -- Directly check bids where caller is customer and target is bidder
    RETURN EXISTS (
        SELECT 1 FROM public.bids b
        JOIN public.jobs j ON j.id = b.job_id
        WHERE b.worker_id = target_profile_id AND j.customer_id = auth.uid()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_active_counterparty(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_counterparty(UUID) TO authenticated, service_role;

-- Helper to check if caller is a registered worker.
-- Using SECURITY DEFINER bypasses RLS on profiles, breaking the jobs -> profiles -> jobs cycle.
CREATE OR REPLACE FUNCTION public.is_worker()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- Fast-path check from trusted app_metadata
    IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'worker' THEN
        RETURN true;
    END IF;

    -- Direct table lookup bypassing RLS
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'worker'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_worker() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_worker() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. Fix RLS Policies on public.profiles (Eliminate All Direct & Indirect Recursion)
-- ------------------------------------------------------------------------------

-- Users can read their own profile (strictly scoped to auth.uid() = id, zero recursion)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Counterparties can view basic profile info if they share a job or bid.
-- Mediated by SECURITY DEFINER is_active_counterparty() to eliminate recursion to jobs/bids.
DROP POLICY IF EXISTS "Counterparties can view active job participant profile" ON public.profiles;
CREATE POLICY "Counterparties can view active job participant profile"
    ON public.profiles FOR SELECT
    USING (public.is_active_counterparty(id));

-- Users can update their own profile (strictly scoped to auth.uid() = id)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Dedicated administrative policies: Platform administrators and service_role can view/update
-- any profile using trusted server claims (service_role or server-controlled app_metadata only).
DROP POLICY IF EXISTS "Admins and service role can view all profiles" ON public.profiles;
CREATE POLICY "Admins and service role can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR current_user = 'service_role'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

DROP POLICY IF EXISTS "Admins and service role can update all profiles" ON public.profiles;
CREATE POLICY "Admins and service role can update all profiles"
    ON public.profiles FOR UPDATE
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR current_user = 'service_role'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR current_user = 'service_role'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- ------------------------------------------------------------------------------
-- 8. Fix RLS Policy on public.jobs (Eliminate Indirect Reverse Recursion to profiles)
-- ------------------------------------------------------------------------------

-- Workers can discover open jobs for bidding.
-- Mediated by SECURITY DEFINER is_worker() to eliminate subquery recursion to profiles.
DROP POLICY IF EXISTS "Workers can discover open jobs for bidding" ON public.jobs;
CREATE POLICY "Workers can discover open jobs for bidding"
    ON public.jobs FOR SELECT
    USING (
        status IN ('POSTED', 'BIDDING_OPEN')
        AND (public.is_worker() OR public.is_admin())
    );

-- ------------------------------------------------------------------------------
-- 9. Default Privileges for Future Database Objects
-- ------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON ROUTINES TO service_role;
