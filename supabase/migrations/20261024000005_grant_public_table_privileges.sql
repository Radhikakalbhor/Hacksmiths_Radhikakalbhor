-- ==============================================================================
-- Sahayak Migration 05: Least-Privilege Table & Routine Grants for API Roles
-- 
-- Principle of Least Privilege:
-- 1. anon: Read-only access strictly confined to public data (benchmarks, reviews,
--    and publicly visible worker profiles). Denied access to private customer
--    profiles, jobs, bids, earnings, OTP verifications, and safety incidents.
-- 2. authenticated: Granular SELECT/INSERT/UPDATE on market entities (profiles, jobs,
--    bids, reviews, safety events) as authorized by Row-Level Security (RLS).
--    DELETE is withheld on all primary domain entities (bids are withdrawn, jobs cancelled).
-- 3. service_role: Trusted backend service key access for administrative jobs,
--    worker payouts, and automated operations.
-- 4. RLS remains fully enabled and actively enforced on all tables.
-- ==============================================================================

-- 1. Schema Access
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Anonymous (anon) Role: Public Read-Only Access
-- ------------------------------------------------------------------------------
-- Anonymous visitors can only view publicly discoverable worker profiles,
-- aggregated platform reviews, and market pricing benchmarks.
GRANT SELECT ON TABLE public.worker_profiles TO anon;
GRANT SELECT ON TABLE public.price_benchmarks TO anon;
GRANT SELECT ON TABLE public.reviews TO anon;

-- Anonymous users may execute only the public worker discovery function
GRANT EXECUTE ON FUNCTION public.find_nearby_workers(DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT, INT) TO anon;

-- Explicitly revoke all access on private tables for anon
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.jobs FROM anon;
REVOKE ALL ON TABLE public.bids FROM anon;
REVOKE ALL ON TABLE public.job_verifications FROM anon;
REVOKE ALL ON TABLE public.safety_events FROM anon;
REVOKE ALL ON TABLE public.worker_earnings FROM anon;

-- ------------------------------------------------------------------------------
-- 3. Profiles Privilege Escalation Guard on INSERT
-- ------------------------------------------------------------------------------
-- Migration 02 attached trg_prevent_profile_privilege_escalation BEFORE UPDATE.
-- This trigger closes the INSERT vector, ensuring regular users cannot self-assign
-- role = 'admin' or non-unverified status during client-side profile creation.
-- Hardened with strict search_path and schema-qualified references to prevent object-shadowing.
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

-- Restrict direct execute access on the trigger function
REVOKE ALL ON FUNCTION public.prevent_profile_insert_privilege_escalation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_profile_insert_privilege_escalation() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_prevent_profile_insert_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_insert_privilege_escalation
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_insert_privilege_escalation();

-- ------------------------------------------------------------------------------
-- 4. Authenticated (authenticated) Role: Verified Customers & Workers
-- ------------------------------------------------------------------------------
-- Profiles: Customers and workers can read, provision, and update their own profile.
-- Privilege escalation is guarded by trg_prevent_profile_insert_privilege_escalation and
-- trg_prevent_profile_privilege_escalation.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Worker Profiles: Workers can initialize and update their profile and skills.
-- Verification badge escalation is blocked by trg_prevent_worker_verification_escalation.
GRANT SELECT, INSERT, UPDATE ON TABLE public.worker_profiles TO authenticated;

-- Jobs: Customers create/update jobs; workers view open bidding & assigned jobs.
GRANT SELECT, INSERT, UPDATE ON TABLE public.jobs TO authenticated;

-- Bids: Workers submit/update bids; customers view bids on their jobs and counter-offer.
-- Status tampering is blocked by trg_prevent_bid_tampering; acceptance requires accept_job_bid RPC.
GRANT SELECT, INSERT, UPDATE ON TABLE public.bids TO authenticated;

-- Pricing & Reviews: Authenticated users can read benchmarks and read/submit reviews.
GRANT SELECT ON TABLE public.price_benchmarks TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reviews TO authenticated;

-- Safety Events: Users can view relevant events and trigger emergency SOS.
GRANT SELECT, INSERT ON TABLE public.safety_events TO authenticated;

-- Job Verifications: Withheld from direct client table queries.
-- OTP validation is performed exclusively via verify_job_otp (SECURITY DEFINER).
REVOKE ALL ON TABLE public.job_verifications FROM authenticated;

-- Worker Earnings: Workers can view their own financial ledger.
GRANT SELECT ON TABLE public.worker_earnings TO authenticated;

-- Sequences: Grant usage on sequences so authenticated inserts can generate keys if needed.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Authorized Database Functions for authenticated users
GRANT EXECUTE ON FUNCTION public.find_nearby_workers(DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_job_otp(UUID, verification_type, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Server-Side Service Role (service_role)
-- ------------------------------------------------------------------------------
-- Privileged server-side key for background jobs, admin operations, and payout processing.
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
-- 6. Least-Privilege Default Privileges for Future Objects
-- ------------------------------------------------------------------------------
-- Applies default privileges for future objects created in schema public by the executing role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON ROUTINES TO service_role;
