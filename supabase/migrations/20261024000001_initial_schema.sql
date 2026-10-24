-- ==============================================================================
-- Sahayak Migration 01: Core Database Schema with PostGIS Support
-- Hyperlocal blue-collar services marketplace
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Custom Enumerated Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'worker', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_urgency AS ENUM ('standard', 'same_day', 'emergency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
      'DRAFT',
      'POSTED',
      'BIDDING_OPEN',
      'ASSIGNED',
      'OTP_START_VERIFIED',
      'IN_PROGRESS',
      'OTP_COMPLETION_VERIFIED',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bid_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_type AS ENUM ('JOB_START', 'JOB_COMPLETION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE safety_severity AS ENUM ('URGENT_EMERGENCY', 'SAFETY_CHECK', 'DISPUTE_ESCALATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE safety_event_status AS ENUM ('TRIGGERED', 'DISPATCHED', 'RESOLVED', 'FALSE_ALARM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    verification_status verification_status NOT NULL DEFAULT 'unverified',
    primary_city TEXT NOT NULL DEFAULT 'Delhi NCR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all profiles columns exist if table was previously created
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'customer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'unverified';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_city TEXT DEFAULT 'Delhi NCR';

-- 4. Worker Profiles Table (Extended trade credentials & PostGIS service area)
CREATE TABLE IF NOT EXISTS public.worker_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    primary_category TEXT NOT NULL,
    skills TEXT[] NOT NULL DEFAULT '{}',
    bio TEXT,
    years_experience INT NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
    service_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 10.0 CHECK (service_radius_km > 0),
    hourly_rate_inr NUMERIC(10, 2) CHECK (hourly_rate_inr IS NULL OR hourly_rate_inr >= 0),
    fixed_rate_estimate_inr NUMERIC(10, 2) CHECK (fixed_rate_estimate_inr IS NULL OR fixed_rate_estimate_inr >= 0),
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_publicly_visible BOOLEAN NOT NULL DEFAULT false,
    government_id_verified BOOLEAN NOT NULL DEFAULT false,
    background_check_verified BOOLEAN NOT NULL DEFAULT false,
    reputation_score NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (reputation_score >= 0.00 AND reputation_score <= 5.00),
    total_completed_jobs INT NOT NULL DEFAULT 0 CHECK (total_completed_jobs >= 0),
    service_location geography(POINT, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all worker_profiles columns exist if table was previously created
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS primary_category TEXT;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS years_experience INT DEFAULT 0;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC(5, 2) DEFAULT 10.0;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS hourly_rate_inr NUMERIC(10, 2);
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS fixed_rate_estimate_inr NUMERIC(10, 2);
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS is_publicly_visible BOOLEAN DEFAULT false;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS government_id_verified BOOLEAN DEFAULT false;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS background_check_verified BOOLEAN DEFAULT false;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS reputation_score NUMERIC(3, 2) DEFAULT 5.00;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS total_completed_jobs INT DEFAULT 0;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS service_location geography(POINT, 4326);

-- Spatial index on worker location
CREATE INDEX IF NOT EXISTS idx_worker_service_location ON public.worker_profiles USING GIST (service_location);
CREATE INDEX IF NOT EXISTS idx_worker_category ON public.worker_profiles (primary_category);

-- 5. Jobs Table (Hyperlocal service requests with PostGIS geography point)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    selected_worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    accepted_bid_id UUID,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    urgency job_urgency NOT NULL DEFAULT 'standard',
    status job_status NOT NULL DEFAULT 'POSTED',
    location_point geography(POINT, 4326) NOT NULL,
    address_line TEXT NOT NULL,
    landmark TEXT,
    city TEXT NOT NULL,
    pincode TEXT NOT NULL CHECK (pincode ~ '^[0-9]{6}$'),
    estimated_min_price_inr NUMERIC(10, 2) CHECK (estimated_min_price_inr IS NULL OR estimated_min_price_inr >= 0),
    estimated_max_price_inr NUMERIC(10, 2) CHECK (estimated_max_price_inr IS NULL OR estimated_max_price_inr >= estimated_min_price_inr),
    accepted_price_inr NUMERIC(10, 2) CHECK (accepted_price_inr IS NULL OR accepted_price_inr >= 0),
    scheduled_date DATE,
    scheduled_time_slot TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all jobs columns exist if table was previously created
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS selected_worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS accepted_bid_id UUID;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS urgency job_urgency DEFAULT 'standard';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status job_status DEFAULT 'POSTED';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS landmark TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS estimated_min_price_inr NUMERIC(10, 2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS estimated_max_price_inr NUMERIC(10, 2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS accepted_price_inr NUMERIC(10, 2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_time_slot TEXT;

-- Spatial & query indexes on jobs
CREATE INDEX IF NOT EXISTS idx_jobs_location_point ON public.jobs USING GIST (location_point);
CREATE INDEX IF NOT EXISTS idx_jobs_status_category ON public.jobs (status, category);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON public.jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_worker ON public.jobs (selected_worker_id);

-- 6. Bids Table (Worker offers with counter-offer negotiation JSON)
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    offered_amount_inr NUMERIC(10, 2) NOT NULL CHECK (offered_amount_inr > 0),
    labor_cost_inr NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (labor_cost_inr >= 0),
    materials_estimate_inr NUMERIC(10, 2) DEFAULT 0 CHECK (materials_estimate_inr >= 0),
    visitation_fee_inr NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (visitation_fee_inr >= 0),
    note TEXT,
    counter_offers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status bid_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_worker_job_bid UNIQUE (job_id, worker_id)
);

-- Ensure all bids columns exist if table was previously created
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS offered_amount_inr NUMERIC(10, 2);
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS labor_cost_inr NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS materials_estimate_inr NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS visitation_fee_inr NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS counter_offers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS status bid_status DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS idx_bids_job ON public.bids (job_id);
CREATE INDEX IF NOT EXISTS idx_bids_worker ON public.bids (worker_id);

-- Ensure accepted_bid_id column exists if table was previously created
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS accepted_bid_id UUID;

-- Idempotent Foreign Key: jobs.accepted_bid_id -> bids.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_jobs_accepted_bid'
          AND conrelid = 'public.jobs'::regclass
    ) THEN
        ALTER TABLE public.jobs
            ADD CONSTRAINT fk_jobs_accepted_bid
            FOREIGN KEY (accepted_bid_id) REFERENCES public.bids(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 7. Price Benchmarks Table (Local micro-market fair rate ranges)
CREATE TABLE IF NOT EXISTS public.price_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    micro_market_area TEXT NOT NULL,
    min_price_inr NUMERIC(10, 2) NOT NULL CHECK (min_price_inr >= 0),
    median_price_inr NUMERIC(10, 2) NOT NULL CHECK (median_price_inr >= min_price_inr),
    max_price_inr NUMERIC(10, 2) NOT NULL CHECK (max_price_inr >= median_price_inr),
    sample_size INT NOT NULL DEFAULT 1 CHECK (sample_size > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    is_demo_estimate BOOLEAN NOT NULL DEFAULT true,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_category_market UNIQUE (category, city, micro_market_area)
);

-- Ensure all price_benchmarks columns exist if table was previously created
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS micro_market_area TEXT;
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS min_price_inr NUMERIC(10, 2);
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS median_price_inr NUMERIC(10, 2);
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS max_price_inr NUMERIC(10, 2);
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS sample_size INT DEFAULT 1;
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.price_benchmarks ADD COLUMN IF NOT EXISTS is_demo_estimate BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_benchmarks_lookup ON public.price_benchmarks (category, city, micro_market_area);

-- 8. Reviews Table (Customer reviews tied to completed jobs)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    punctuality_rating INT CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
    quality_rating INT CHECK (quality_rating >= 1 AND quality_rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all reviews columns exist if table was previously created
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating INT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS punctuality_rating INT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS quality_rating INT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_text TEXT;

CREATE INDEX IF NOT EXISTS idx_reviews_worker ON public.reviews (worker_id);

-- 9. Job Verifications Table (Secure hashed OTP storage for Start & Completion)
-- Plain text OTPs are NEVER stored. Only cryptographic digests with per-record salts.
CREATE TABLE IF NOT EXISTS public.job_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    verification_type verification_type NOT NULL,
    otp_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_job_verification_type UNIQUE (job_id, verification_type)
);

-- Ensure all job_verifications columns exist if table was previously created
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE;
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS verification_type verification_type;
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS otp_hash TEXT;
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS salt TEXT;
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 5;
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.job_verifications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_verifications_job ON public.job_verifications (job_id);

-- 10. Safety Events Table (SOS Emergency & Trusted-Contact sharing)
CREATE TABLE IF NOT EXISTS public.safety_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    severity safety_severity NOT NULL DEFAULT 'SAFETY_CHECK',
    status safety_event_status NOT NULL DEFAULT 'TRIGGERED',
    location_point geography(POINT, 4326),
    details JSONB DEFAULT '{}'::jsonb,
    trusted_contacts_notified INT NOT NULL DEFAULT 0,
    resolved_at TIMESTAMPTZ,
    resolver_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all safety_events columns exist if table was previously created
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS triggered_by_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS severity safety_severity DEFAULT 'SAFETY_CHECK';
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS status safety_event_status DEFAULT 'TRIGGERED';
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS trusted_contacts_notified INT DEFAULT 0;
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.safety_events ADD COLUMN IF NOT EXISTS resolver_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_safety_events_user ON public.safety_events (triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_job ON public.safety_events (job_id);

-- 11. Worker Earnings Table (Completed job payouts linked to jobs)
CREATE TABLE IF NOT EXISTS public.worker_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
    gross_amount_inr NUMERIC(10, 2) NOT NULL CHECK (gross_amount_inr >= 0),
    platform_fee_inr NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_inr >= 0),
    net_payout_inr NUMERIC(10, 2) NOT NULL CHECK (net_payout_inr >= 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all worker_earnings columns exist if table was previously created
ALTER TABLE public.worker_earnings ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.worker_earnings ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE;
ALTER TABLE public.worker_earnings ADD COLUMN IF NOT EXISTS gross_amount_inr NUMERIC(10, 2);
ALTER TABLE public.worker_earnings ADD COLUMN IF NOT EXISTS platform_fee_inr NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.worker_earnings ADD COLUMN IF NOT EXISTS net_payout_inr NUMERIC(10, 2);
ALTER TABLE public.worker_earnings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE public.worker_earnings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_worker_earnings_worker ON public.worker_earnings (worker_id);

-- 12. Generic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_worker_profiles_updated_at ON public.worker_profiles;
CREATE TRIGGER set_worker_profiles_updated_at
    BEFORE UPDATE ON public.worker_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;
CREATE TRIGGER set_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_bids_updated_at ON public.bids;
CREATE TRIGGER set_bids_updated_at
    BEFORE UPDATE ON public.bids
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
