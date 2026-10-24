-- ==============================================================================
-- Sahayak Hackathon Demo Dataset (SQL Seed Script)
-- Hyperlocal Household Services Marketplace
--
-- TARGET DATABASE: Supabase PostgreSQL (with PostGIS enabled)
-- PREREQUISITE: Run `node scripts/seed-demo.mjs` first to provision the 13
--               demo accounts through the official Supabase Auth Admin API.
-- SAFETY: Does NOT insert fabricated records directly into auth.users.
--         Sets government_id_verified = false and background_check_verified = false.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Verify that Demo Auth Users exist before proceeding
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_missing_count INT;
BEGIN
    SELECT COUNT(*) INTO v_missing_count
    FROM (
        VALUES
            ('demo-customer@sahayak.demo.internal'),
            ('ramesh-plumber@sahayak.demo.internal'),
            ('santosh-plumber@sahayak.demo.internal'),
            ('ganesh-plumber@sahayak.demo.internal'),
            ('arif-electrician@sahayak.demo.internal'),
            ('vikram-electrician@sahayak.demo.internal'),
            ('sunita-cleaner@sahayak.demo.internal'),
            ('priya-cleaner@sahayak.demo.internal'),
            ('jagdish-carpenter@sahayak.demo.internal'),
            ('manoj-painter@sahayak.demo.internal'),
            ('deepak-appliance@sahayak.demo.internal'),
            ('kavita-cook@sahayak.demo.internal'),
            ('lata-maid@sahayak.demo.internal')
    ) AS expected(email)
    LEFT JOIN auth.users u ON lower(u.email) = lower(expected.email)
    WHERE u.id IS NULL;

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'Prerequisite check failed: % demo auth user(s) not found in auth.users. Please run "node scripts/seed-demo.mjs" first to safely create them via the Supabase Auth Admin API.', v_missing_count;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Customer Profile
-- ------------------------------------------------------------------------------
INSERT INTO public.profiles (
    id, phone, email, full_name, avatar_url, role, verification_status, primary_city
)
SELECT
    id, '+919999000099', email, '[DEMO] Ananya Deshmukh',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    'customer', 'unverified', 'Mumbai'
FROM auth.users
WHERE lower(email) = 'demo-customer@sahayak.demo.internal'
ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    full_name = EXCLUDED.full_name,
    verification_status = 'unverified',
    primary_city = 'Mumbai';

-- ------------------------------------------------------------------------------
-- 3. 12 Worker Profiles (Mumbai Cluster)
-- Fictional workers are explicitly unverified (no false claims)
-- ------------------------------------------------------------------------------

-- Helper DO block to link and populate worker profiles
DO $$
DECLARE
    v_uid UUID;
BEGIN
    -- 1. Ramesh Kumar (Plumbing - Bandra West)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'ramesh-plumber@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000001', 'ramesh-plumber@sahayak.demo.internal', '[DEMO] Ramesh Kumar', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'plumbing', ARRAY['Pipe Fitting', 'Leak Detection', 'Drain Cleaning', 'Tap Repair', 'Geyser Fitting'],
        '[DEMO] Master plumber with 8+ years experience in Bandra, Khar, and Santa Cruz. Fast response for leakage emergencies. (Fictional profile for demonstration only).',
        8, 12.0, 350.00, 500.00, true, true, false, false, 4.90, 42,
        ST_SetSRID(ST_MakePoint(72.8295, 19.0596), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        reputation_score = EXCLUDED.reputation_score, total_completed_jobs = EXCLUDED.total_completed_jobs,
        service_location = EXCLUDED.service_location;

    -- 2. Santosh Shinde (Plumbing - Dadar West)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'santosh-plumber@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000002', 'santosh-plumber@sahayak.demo.internal', '[DEMO] Santosh Shinde', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'plumbing', ARRAY['Sanitary Installation', 'Water Tank Cleaning', 'Pipe Replacement', 'Flush Repair'],
        '[DEMO] Reliable plumbing specialist serving Dadar, Matunga, and Prabhadevi. (Fictional profile for demonstration only).',
        5, 10.0, 300.00, 450.00, true, true, false, false, 4.80, 28,
        ST_SetSRID(ST_MakePoint(72.8478, 19.0178), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 3. Ganesh Patil (Plumbing - Andheri East)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'ganesh-plumber@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000003', 'ganesh-plumber@sahayak.demo.internal', '[DEMO] Ganesh Patil', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'plumbing', ARRAY['Bathroom Renovation', 'Clogged Drains', 'Geyser Installation', 'Motor Servicing'],
        '[DEMO] Veteran plumbing technician in Andheri & Vile Parle. Expert in residential water pressure overhauls. (Fictional profile for demonstration only).',
        11, 15.0, 400.00, 600.00, true, true, false, false, 4.95, 67,
        ST_SetSRID(ST_MakePoint(72.8697, 19.1136), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 4. Arif Khan (Electrical - Kurla West)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'arif-electrician@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000004', 'arif-electrician@sahayak.demo.internal', '[DEMO] Arif Khan', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'electrical', ARRAY['Short Circuit Repair', 'MCB Tripping', 'Switchboard Repair', 'Fan Installation'],
        '[DEMO] Licensed wireman in Kurla & BKC. Prompt resolution of domestic power cutoffs and circuit faults. (Fictional profile for demonstration only).',
        6, 10.0, 350.00, 450.00, true, true, false, false, 4.80, 34,
        ST_SetSRID(ST_MakePoint(72.8845, 19.0726), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 5. Vikramaditya Sharma (Electrical - Powai)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'vikram-electrician@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000005', 'vikram-electrician@sahayak.demo.internal', '[DEMO] Vikramaditya Sharma', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'electrical', ARRAY['Inverter Setup', 'Complete Home Rewiring', 'Appliance Power Line', 'Chandelier Installation'],
        '[DEMO] Experienced electrician serving Powai and Vikhroli residential high-rises. (Fictional profile for demonstration only).',
        9, 14.0, 450.00, 700.00, true, true, false, false, 4.90, 51,
        ST_SetSRID(ST_MakePoint(72.9060, 19.1176), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 6. Sunita Jadhav (Cleaning - Worli)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'sunita-cleaner@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000006', 'sunita-cleaner@sahayak.demo.internal', '[DEMO] Sunita Jadhav', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'cleaning', ARRAY['Deep Kitchen Cleaning', 'Bathroom Disinfection', 'Sofa Shampooing', 'Balcony Scrubbing'],
        '[DEMO] Home deep cleaning professional across South Mumbai and Worli. Uses non-toxic eco agents. (Fictional profile for demonstration only).',
        4, 10.0, 250.00, 1200.00, true, true, false, false, 4.75, 19,
        ST_SetSRID(ST_MakePoint(72.8180, 19.0144), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 7. Priya Kamble (Cleaning - Juhu)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'priya-cleaner@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000007', 'priya-cleaner@sahayak.demo.internal', '[DEMO] Priya Kamble', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'cleaning', ARRAY['Full Home Deep Clean', 'Floor Scrubbing', 'Kitchen Chimney Degreasing', 'Window Glass Cleaning'],
        '[DEMO] 7 years in residential deep hygiene across Juhu and Bandra. (Fictional profile for demonstration only).',
        7, 12.0, 280.00, 1500.00, true, true, false, false, 4.90, 48,
        ST_SetSRID(ST_MakePoint(72.8263, 19.1075), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 8. Jagdish Mistry (Carpentry - Malad West)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'jagdish-carpenter@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000008', 'jagdish-carpenter@sahayak.demo.internal', '[DEMO] Jagdish Mistry', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'carpentry', ARRAY['Furniture Assembly', 'Door Hinge Repair', 'Custom Shelving', 'Lock Replacement'],
        '[DEMO] Skilled woodworker covering Malad, Kandivali, and Goregaon. (Fictional profile for demonstration only).',
        12, 14.0, 450.00, 600.00, true, true, false, false, 4.90, 73,
        ST_SetSRID(ST_MakePoint(72.8485, 19.1860), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 9. Manoj Varma (Painting - Goregaon East)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'manoj-painter@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000009', 'manoj-painter@sahayak.demo.internal', '[DEMO] Manoj Varma', 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'painting', ARRAY['Wall Damp Proofing', 'Interior Painting', 'Stencils & Textures', 'Single Room Touch-up'],
        '[DEMO] Painting contractor serving Goregaon and Jogeshwari. (Fictional profile for demonstration only).',
        8, 12.0, 350.00, 2000.00, true, true, false, false, 4.80, 39,
        ST_SetSRID(ST_MakePoint(72.8596, 19.1663), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 10. Deepak Nair (Appliance Repair - Borivali West)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'deepak-appliance@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000010', 'deepak-appliance@sahayak.demo.internal', '[DEMO] Deepak Nair', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'appliance_repair', ARRAY['Washing Machine Repair', 'Refrigerator Servicing', 'Microwave Repair', 'AC Gas Refill'],
        '[DEMO] Certified technician in Borivali and Dahisar for major appliances. (Fictional profile for demonstration only).',
        10, 15.0, 400.00, 750.00, true, true, false, false, 4.90, 58,
        ST_SetSRID(ST_MakePoint(72.8567, 19.2307), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 11. Kavita Deshmukh (Cooking - Ghatkopar East)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'kavita-cook@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000011', 'kavita-cook@sahayak.demo.internal', '[DEMO] Kavita Deshmukh', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'cooking', ARRAY['North Indian', 'Maharashtrian Thali', 'Dietary Meal Prep', 'Gujarati Delicacies'],
        '[DEMO] Home chef with 6 years experience across Ghatkopar and Mulund. (Fictional profile for demonstration only).',
        6, 10.0, 300.00, 600.00, true, true, false, false, 4.85, 31,
        ST_SetSRID(ST_MakePoint(72.9090, 19.0860), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

    -- 12. Lata Gaikwad (Maid / House Help - Chembur)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'lata-maid@sahayak.demo.internal';
    INSERT INTO public.profiles (id, phone, email, full_name, avatar_url, role, verification_status, primary_city)
    VALUES (v_uid, '+919999000012', 'lata-maid@sahayak.demo.internal', '[DEMO] Lata Gaikwad', 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150', 'worker', 'unverified', 'Mumbai')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, verification_status = 'unverified', primary_city = 'Mumbai';

    INSERT INTO public.worker_profiles (
        user_id, primary_category, skills, bio, years_experience, service_radius_km,
        hourly_rate_inr, fixed_rate_estimate_inr, is_available, is_publicly_visible,
        government_id_verified, background_check_verified, reputation_score, total_completed_jobs, service_location
    ) VALUES (
        v_uid, 'cleaning', ARRAY['House Help', 'Daily Housekeeping', 'Floor Mopping', 'Dishwashing', 'Dusting & Organizing', 'Clothes Laundering'],
        '[DEMO] Trustworthy domestic helper and general house maintenance specialist covering Chembur and Sion. (Fictional profile for demonstration only).',
        5, 8.0, 250.00, 500.00, true, true, false, false, 4.70, 25,
        ST_SetSRID(ST_MakePoint(72.8994, 19.0522), 4326)::geography
    ) ON CONFLICT (user_id) DO UPDATE SET
        primary_category = EXCLUDED.primary_category, skills = EXCLUDED.skills, bio = EXCLUDED.bio,
        hourly_rate_inr = EXCLUDED.hourly_rate_inr, is_available = true, is_publicly_visible = true,
        government_id_verified = false, background_check_verified = false,
        service_location = EXCLUDED.service_location;

END $$;

-- ------------------------------------------------------------------------------
-- 4. Micro-Market Price Benchmarks (Mumbai & Delhi NCR - 8 Categories)
-- Uses deterministic IDs b0000000-... for precise idempotent management
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_category_market'
    ) THEN
        ALTER TABLE public.price_benchmarks
        ADD CONSTRAINT unique_category_market UNIQUE (category, city, micro_market_area);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
DECLARE
    v_has_legacy_min_price BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'price_benchmarks' AND column_name = 'min_price'
    ) INTO v_has_legacy_min_price;

    IF v_has_legacy_min_price THEN
        -- Legacy table has min_price / median_price / max_price columns alongside min_price_inr
        EXECUTE $sql$
            INSERT INTO public.price_benchmarks (
                id, category, city, micro_market_area, min_price, median_price, max_price, min_price_inr, median_price_inr, max_price_inr, sample_size, currency, is_demo_estimate
            ) VALUES
                ('b0000000-0000-0000-0000-000000000001'::uuid, 'plumbing', 'Mumbai', 'Bandra & Western Suburbs', 250.00, 450.00, 750.00, 250.00, 450.00, 750.00, 48, 'INR', true),
                ('b0000000-0000-0000-0000-000000000002'::uuid, 'plumbing', 'Mumbai', 'South Mumbai (Dadar / Worli)', 300.00, 500.00, 900.00, 300.00, 500.00, 900.00, 36, 'INR', true),
                ('b0000000-0000-0000-0000-000000000003'::uuid, 'plumbing', 'Mumbai', 'Greater Mumbai (All Areas)', 250.00, 450.00, 800.00, 250.00, 450.00, 800.00, 90, 'INR', true),
                ('b0000000-0000-0000-0000-000000000004'::uuid, 'electrical', 'Mumbai', 'Bandra & Western Suburbs', 200.00, 400.00, 700.00, 200.00, 400.00, 700.00, 52, 'INR', true),
                ('b0000000-0000-0000-0000-000000000005'::uuid, 'electrical', 'Mumbai', 'Powai & Central Suburbs', 250.00, 450.00, 800.00, 250.00, 450.00, 800.00, 41, 'INR', true),
                ('b0000000-0000-0000-0000-000000000006'::uuid, 'electrical', 'Mumbai', 'Greater Mumbai (All Areas)', 200.00, 420.00, 750.00, 200.00, 420.00, 750.00, 95, 'INR', true),
                ('b0000000-0000-0000-0000-000000000007'::uuid, 'cleaning', 'Mumbai', 'Bandra & South Mumbai', 800.00, 1500.00, 2800.00, 800.00, 1500.00, 2800.00, 60, 'INR', true),
                ('b0000000-0000-0000-0000-000000000008'::uuid, 'cleaning', 'Mumbai', 'Andheri & Suburbs', 700.00, 1200.00, 2400.00, 700.00, 1200.00, 2400.00, 45, 'INR', true),
                ('b0000000-0000-0000-0000-000000000009'::uuid, 'cleaning', 'Mumbai', 'Greater Mumbai (All Areas)', 750.00, 1350.00, 2600.00, 750.00, 1350.00, 2600.00, 105, 'INR', true),
                ('b0000000-0000-0000-0000-000000000010'::uuid, 'carpentry', 'Mumbai', 'Western Suburbs', 300.00, 550.00, 1000.00, 300.00, 550.00, 1000.00, 30, 'INR', true),
                ('b0000000-0000-0000-0000-000000000011'::uuid, 'carpentry', 'Mumbai', 'Greater Mumbai (All Areas)', 300.00, 550.00, 950.00, 300.00, 550.00, 950.00, 65, 'INR', true),
                ('b0000000-0000-0000-0000-000000000012'::uuid, 'painting', 'Mumbai', 'Greater Mumbai', 1200.00, 2500.00, 5500.00, 1200.00, 2500.00, 5500.00, 24, 'INR', true),
                ('b0000000-0000-0000-0000-000000000013'::uuid, 'appliance_repair', 'Mumbai', 'Western & Central Suburbs', 350.00, 650.00, 1400.00, 350.00, 650.00, 1400.00, 40, 'INR', true),
                ('b0000000-0000-0000-0000-000000000014'::uuid, 'appliance_repair', 'Mumbai', 'Greater Mumbai (All Areas)', 350.00, 650.00, 1300.00, 350.00, 650.00, 1300.00, 80, 'INR', true),
                ('b0000000-0000-0000-0000-000000000015'::uuid, 'cooking', 'Mumbai', 'Greater Mumbai', 350.00, 600.00, 1200.00, 350.00, 600.00, 1200.00, 35, 'INR', true),
                ('b0000000-0000-0000-0000-000000000016'::uuid, 'cleaning', 'Mumbai', 'Greater Mumbai (House Help & Domestic)', 250.00, 450.00, 850.00, 250.00, 450.00, 850.00, 55, 'INR', true),
                ('b0000000-0000-0000-0000-000000000017'::uuid, 'plumbing', 'Delhi NCR', 'South Delhi (Hauz Khas / Saket)', 250.00, 400.00, 700.00, 250.00, 400.00, 700.00, 50, 'INR', true),
                ('b0000000-0000-0000-0000-000000000018'::uuid, 'electrical', 'Delhi NCR', 'South Delhi & Noida', 200.00, 380.00, 650.00, 200.00, 380.00, 650.00, 44, 'INR', true),
                ('b0000000-0000-0000-0000-000000000019'::uuid, 'cleaning', 'Delhi NCR', 'South Delhi & Gurgaon', 800.00, 1400.00, 2600.00, 800.00, 1400.00, 2600.00, 58, 'INR', true)
            ON CONFLICT (category, city, micro_market_area) DO UPDATE SET
                min_price = EXCLUDED.min_price,
                median_price = EXCLUDED.median_price,
                max_price = EXCLUDED.max_price,
                min_price_inr = EXCLUDED.min_price_inr,
                median_price_inr = EXCLUDED.median_price_inr,
                max_price_inr = EXCLUDED.max_price_inr,
                sample_size = EXCLUDED.sample_size,
                is_demo_estimate = true,
                last_calculated_at = NOW();
        $sql$;
    ELSE
        INSERT INTO public.price_benchmarks (
            id, category, city, micro_market_area, min_price_inr, median_price_inr, max_price_inr, sample_size, currency, is_demo_estimate
        ) VALUES
            ('b0000000-0000-0000-0000-000000000001'::uuid, 'plumbing', 'Mumbai', 'Bandra & Western Suburbs', 250.00, 450.00, 750.00, 48, 'INR', true),
            ('b0000000-0000-0000-0000-000000000002'::uuid, 'plumbing', 'Mumbai', 'South Mumbai (Dadar / Worli)', 300.00, 500.00, 900.00, 36, 'INR', true),
            ('b0000000-0000-0000-0000-000000000003'::uuid, 'plumbing', 'Mumbai', 'Greater Mumbai (All Areas)', 250.00, 450.00, 800.00, 90, 'INR', true),
            ('b0000000-0000-0000-0000-000000000004'::uuid, 'electrical', 'Mumbai', 'Bandra & Western Suburbs', 200.00, 400.00, 700.00, 52, 'INR', true),
            ('b0000000-0000-0000-0000-000000000005'::uuid, 'electrical', 'Mumbai', 'Powai & Central Suburbs', 250.00, 450.00, 800.00, 41, 'INR', true),
            ('b0000000-0000-0000-0000-000000000006'::uuid, 'electrical', 'Mumbai', 'Greater Mumbai (All Areas)', 200.00, 420.00, 750.00, 95, 'INR', true),
            ('b0000000-0000-0000-0000-000000000007'::uuid, 'cleaning', 'Mumbai', 'Bandra & South Mumbai', 800.00, 1500.00, 2800.00, 60, 'INR', true),
            ('b0000000-0000-0000-0000-000000000008'::uuid, 'cleaning', 'Mumbai', 'Andheri & Suburbs', 700.00, 1200.00, 2400.00, 45, 'INR', true),
            ('b0000000-0000-0000-0000-000000000009'::uuid, 'cleaning', 'Mumbai', 'Greater Mumbai (All Areas)', 750.00, 1350.00, 2600.00, 105, 'INR', true),
            ('b0000000-0000-0000-0000-000000000010'::uuid, 'carpentry', 'Mumbai', 'Western Suburbs', 300.00, 550.00, 1000.00, 30, 'INR', true),
            ('b0000000-0000-0000-0000-000000000011'::uuid, 'carpentry', 'Mumbai', 'Greater Mumbai (All Areas)', 300.00, 550.00, 950.00, 65, 'INR', true),
            ('b0000000-0000-0000-0000-000000000012'::uuid, 'painting', 'Mumbai', 'Greater Mumbai', 1200.00, 2500.00, 5500.00, 24, 'INR', true),
            ('b0000000-0000-0000-0000-000000000013'::uuid, 'appliance_repair', 'Mumbai', 'Western & Central Suburbs', 350.00, 650.00, 1400.00, 40, 'INR', true),
            ('b0000000-0000-0000-0000-000000000014'::uuid, 'appliance_repair', 'Mumbai', 'Greater Mumbai (All Areas)', 350.00, 650.00, 1300.00, 80, 'INR', true),
            ('b0000000-0000-0000-0000-000000000015'::uuid, 'cooking', 'Mumbai', 'Greater Mumbai', 350.00, 600.00, 1200.00, 35, 'INR', true),
            ('b0000000-0000-0000-0000-000000000016'::uuid, 'cleaning', 'Mumbai', 'Greater Mumbai (House Help & Domestic)', 250.00, 450.00, 850.00, 55, 'INR', true),
            ('b0000000-0000-0000-0000-000000000017'::uuid, 'plumbing', 'Delhi NCR', 'South Delhi (Hauz Khas / Saket)', 250.00, 400.00, 700.00, 50, 'INR', true),
            ('b0000000-0000-0000-0000-000000000018'::uuid, 'electrical', 'Delhi NCR', 'South Delhi & Noida', 200.00, 380.00, 650.00, 44, 'INR', true),
            ('b0000000-0000-0000-0000-000000000019'::uuid, 'cleaning', 'Delhi NCR', 'South Delhi & Gurgaon', 800.00, 1400.00, 2600.00, 58, 'INR', true)
        ON CONFLICT (category, city, micro_market_area) DO UPDATE SET
            min_price_inr = EXCLUDED.min_price_inr,
            median_price_inr = EXCLUDED.median_price_inr,
            max_price_inr = EXCLUDED.max_price_inr,
            sample_size = EXCLUDED.sample_size,
            is_demo_estimate = true,
            last_calculated_at = NOW();
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Sample Completed Job, Accepted Bid & 5-Star Review
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_cust_id UUID;
    v_worker_id UUID;
    v_worker_wp_id UUID;
    v_job_id UUID := 'd0000000-0000-0000-0000-000000000101'::uuid;
    v_bid_id UUID := 'd0000000-0000-0000-0000-000000000201'::uuid;
BEGIN
    SELECT id INTO v_cust_id FROM auth.users WHERE lower(email) = 'demo-customer@sahayak.demo.internal';
    SELECT id INTO v_worker_id FROM auth.users WHERE lower(email) = 'ramesh-plumber@sahayak.demo.internal';
    SELECT id INTO v_worker_wp_id FROM public.worker_profiles WHERE user_id = v_worker_id;

    -- 5.1 Insert sample job (status 'posted')
    INSERT INTO public.jobs (
        id, customer_id, selected_worker_id, category, title, description,
        urgency, status, location_point, service_location, address_line, landmark,
        city, pincode, estimated_min_price_inr, estimated_max_price_inr, accepted_price_inr,
        created_at, updated_at
    ) VALUES (
        v_job_id, v_cust_id, NULL, 'plumbing',
        '[DEMO] Kitchen Sink Drain & Mixer Tap Leakage Repair',
        'Kitchen basin pipe leaking into under-sink cabinet. Looking for prompt diagnosis and replacement of damaged fittings or washers.',
        'standard', 'posted',
        ST_SetSRID(ST_MakePoint(72.8295, 19.0596), 4326)::geography,
        ST_SetSRID(ST_MakePoint(72.8295, 19.0596), 4326)::geography,
        'Flat 402, Sea Green Apartments, Perry Cross Road, Bandra West',
        'Near Candies Cafe', 'Mumbai', '400050',
        400.00, 600.00, NULL, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'
    ) ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        selected_worker_id = NULL,
        status = 'posted',
        accepted_price_inr = NULL;

    -- 5.2 Insert pending worker bid (status 'submitted', referencing worker_profiles.id)
    INSERT INTO public.bids (
        id, job_id, worker_id, offered_amount_inr, proposed_amount, labor_cost_inr,
        materials_estimate_inr, visitation_fee_inr, status, note, created_at, updated_at
    ) VALUES (
        v_bid_id, v_job_id, COALESCE(v_worker_wp_id, v_worker_id), 450.00, 450.00, 350.00, 100.00, 0.00,
        'submitted', 'Can visit within 45 minutes with replacement rubber washers and heavy-duty sealant tape.',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'
    ) ON CONFLICT (id) DO UPDATE SET
        worker_id = EXCLUDED.worker_id,
        offered_amount_inr = EXCLUDED.offered_amount_inr,
        proposed_amount = EXCLUDED.proposed_amount,
        status = 'submitted';

    -- 5.3 Lifecycle Integrity: Remove any orphaned review for this unfinished job
    -- (Customer reviews are strictly permitted only on COMPLETED jobs)
    DELETE FROM public.reviews WHERE job_id = v_job_id;

END $$;

COMMIT;

-- ==============================================================================
-- DEMO DATA VERIFICATION QUERY (Run to verify successful seeding)
-- ==============================================================================
-- SELECT
--     wp.primary_category,
--     p.full_name,
--     wp.hourly_rate_inr,
--     wp.reputation_score,
--     wp.total_completed_jobs,
--     ST_AsText(wp.service_location) as coordinates
-- FROM public.worker_profiles wp
-- JOIN public.profiles p ON p.id = wp.user_id
-- WHERE p.email IN (
--     'ramesh-plumber@sahayak.demo.internal',
--     'santosh-plumber@sahayak.demo.internal',
--     'ganesh-plumber@sahayak.demo.internal',
--     'arif-electrician@sahayak.demo.internal',
--     'vikram-electrician@sahayak.demo.internal',
--     'sunita-cleaner@sahayak.demo.internal',
--     'priya-cleaner@sahayak.demo.internal',
--     'jagdish-carpenter@sahayak.demo.internal',
--     'manoj-painter@sahayak.demo.internal',
--     'deepak-appliance@sahayak.demo.internal',
--     'kavita-cook@sahayak.demo.internal',
--     'lata-maid@sahayak.demo.internal'
-- )
-- ORDER BY wp.primary_category, wp.reputation_score DESC;

-- ==============================================================================
-- DEMO TEARDOWN SCRIPT (Targets ONLY records created by this specific seed)
-- ==============================================================================
-- BEGIN;
-- DELETE FROM public.reviews WHERE id = 'd0000000-0000-0000-0000-000000000301'::uuid;
-- DELETE FROM public.bids WHERE id = 'd0000000-0000-0000-0000-000000000201'::uuid;
-- DELETE FROM public.jobs WHERE id = 'd0000000-0000-0000-0000-000000000101'::uuid;
-- DELETE FROM public.worker_profiles WHERE user_id IN (
--     SELECT id FROM public.profiles WHERE email IN (
--         'demo-customer@sahayak.demo.internal',
--         'ramesh-plumber@sahayak.demo.internal',
--         'santosh-plumber@sahayak.demo.internal',
--         'ganesh-plumber@sahayak.demo.internal',
--         'arif-electrician@sahayak.demo.internal',
--         'vikram-electrician@sahayak.demo.internal',
--         'sunita-cleaner@sahayak.demo.internal',
--         'priya-cleaner@sahayak.demo.internal',
--         'jagdish-carpenter@sahayak.demo.internal',
--         'manoj-painter@sahayak.demo.internal',
--         'deepak-appliance@sahayak.demo.internal',
--         'kavita-cook@sahayak.demo.internal',
--         'lata-maid@sahayak.demo.internal'
--     )
-- );
-- DELETE FROM public.profiles WHERE email IN (
--     'demo-customer@sahayak.demo.internal',
--     'ramesh-plumber@sahayak.demo.internal',
--     'santosh-plumber@sahayak.demo.internal',
--     'ganesh-plumber@sahayak.demo.internal',
--     'arif-electrician@sahayak.demo.internal',
--     'vikram-electrician@sahayak.demo.internal',
--     'sunita-cleaner@sahayak.demo.internal',
--     'priya-cleaner@sahayak.demo.internal',
--     'jagdish-carpenter@sahayak.demo.internal',
--     'manoj-painter@sahayak.demo.internal',
--     'deepak-appliance@sahayak.demo.internal',
--     'kavita-cook@sahayak.demo.internal',
--     'lata-maid@sahayak.demo.internal'
-- );
-- DELETE FROM public.price_benchmarks WHERE id BETWEEN 'b0000000-0000-0000-0000-000000000001'::uuid AND 'b0000000-0000-0000-0000-000000000025'::uuid;
-- DELETE FROM auth.users WHERE email IN (
--     'demo-customer@sahayak.demo.internal',
--     'ramesh-plumber@sahayak.demo.internal',
--     'santosh-plumber@sahayak.demo.internal',
--     'ganesh-plumber@sahayak.demo.internal',
--     'arif-electrician@sahayak.demo.internal',
--     'vikram-electrician@sahayak.demo.internal',
--     'sunita-cleaner@sahayak.demo.internal',
--     'priya-cleaner@sahayak.demo.internal',
--     'jagdish-carpenter@sahayak.demo.internal',
--     'manoj-painter@sahayak.demo.internal',
--     'deepak-appliance@sahayak.demo.internal',
--     'kavita-cook@sahayak.demo.internal',
--     'lata-maid@sahayak.demo.internal'
-- );
-- COMMIT;
