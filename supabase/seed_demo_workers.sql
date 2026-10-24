-- ==============================================================================
-- Sahayak Development-Only Seed Script: Clearly Labelled DEMO Workers
-- ==============================================================================
-- FOR LOCAL DEVELOPMENT & GEOSPATIAL TESTING ONLY
-- All names, contact details, and locations below are entirely fictional DEMO test data.
-- They are clearly prefixed with "DEMO -" and do not represent real people or verified professionals.
-- Safe and idempotent: Uses fixed test UUIDs (00000000-0000-0000-0000-00000000000X).
-- Will NOT overwrite existing real user accounts.
-- ==============================================================================

DO $$
DECLARE
    -- Fixed demo UUIDs
    v_plumber_id UUID := '00000000-0000-0000-0000-000000000001';
    v_electrician_id UUID := '00000000-0000-0000-0000-000000000002';
    v_cleaner_id UUID := '00000000-0000-0000-0000-000000000003';
    v_carpenter_id UUID := '00000000-0000-0000-0000-000000000004';
    v_painter_id UUID := '00000000-0000-0000-0000-000000000005';
    v_appliance_id UUID := '00000000-0000-0000-0000-000000000006';
    v_maid_id UUID := '00000000-0000-0000-0000-000000000007';
    v_cook_id UUID := '00000000-0000-0000-0000-000000000008';
BEGIN
    -- 1. Insert mock entries into auth.users (if not already existing)
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    )
    VALUES
        (v_plumber_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.plumber@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Ramesh Kumar (Plumber)"}', NOW(), NOW()),
        (v_electrician_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.electrician@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Amit Verma (Electrician)"}', NOW(), NOW()),
        (v_cleaner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.cleaner@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Sunita Devi (Deep Cleaning)"}', NOW(), NOW()),
        (v_carpenter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.carpenter@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Rajesh Singh (Carpenter)"}', NOW(), NOW()),
        (v_painter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.painter@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Priya Sharma (Painter)"}', NOW(), NOW()),
        (v_appliance_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.appliance@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Vikram Patel (Appliance Repair)"}', NOW(), NOW()),
        (v_maid_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.maid@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Lakshmi Bai (House Help)"}', NOW(), NOW()),
        (v_cook_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.cook@sahayak.test', '$2a$10$dummyhashedpasswordfordemotesting', NOW(), '{"provider":"email","providers":["email"]}', '{"role":"worker","full_name":"DEMO - Chef Manoj (Cook)"}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        phone,
        email,
        full_name,
        role,
        verification_status,
        primary_city
    )
    VALUES
        (v_plumber_id, '9999900001', 'demo.plumber@sahayak.test', 'DEMO - Ramesh Kumar (Plumber)', 'worker', 'verified', 'Delhi NCR'),
        (v_electrician_id, '9999900002', 'demo.electrician@sahayak.test', 'DEMO - Amit Verma (Electrician)', 'worker', 'verified', 'Delhi NCR'),
        (v_cleaner_id, '9999900003', 'demo.cleaner@sahayak.test', 'DEMO - Sunita Devi (Deep Cleaning)', 'worker', 'verified', 'Delhi NCR'),
        (v_carpenter_id, '9999900004', 'demo.carpenter@sahayak.test', 'DEMO - Rajesh Singh (Carpenter)', 'worker', 'verified', 'Delhi NCR'),
        (v_painter_id, '9999900005', 'demo.painter@sahayak.test', 'DEMO - Priya Sharma (Painter)', 'worker', 'verified', 'Delhi NCR'),
        (v_appliance_id, '9999900006', 'demo.appliance@sahayak.test', 'DEMO - Vikram Patel (Appliance Repair)', 'worker', 'verified', 'Delhi NCR'),
        (v_maid_id, '9999900007', 'demo.maid@sahayak.test', 'DEMO - Lakshmi Bai (House Help)', 'worker', 'verified', 'Delhi NCR'),
        (v_cook_id, '9999900008', 'demo.cook@sahayak.test', 'DEMO - Chef Manoj (Cook)', 'worker', 'verified', 'Delhi NCR')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        verification_status = 'verified';

    -- 3. Insert into public.worker_profiles with coordinates in Delhi NCR
    -- Central Delhi: 28.6139, 77.2090
    -- South Delhi (Saket): 28.5244, 77.2066
    -- West Delhi (Dwarka): 28.5823, 77.0500
    -- North Delhi (Rohini): 28.7140, 77.1190
    -- East Delhi / Noida: 28.5355, 77.3910
    -- Gurugram: 28.4595, 77.0266
    INSERT INTO public.worker_profiles (
        user_id,
        primary_category,
        skills,
        bio,
        years_experience,
        service_radius_km,
        hourly_rate_inr,
        fixed_rate_estimate_inr,
        is_available,
        is_publicly_visible,
        government_id_verified,
        background_check_verified,
        reputation_score,
        total_completed_jobs,
        service_location
    )
    VALUES
        -- 1. Plumber in Central Delhi (2.1 km from Connaught Place)
        (v_plumber_id, 'plumbing', ARRAY['Leak Repair', 'Pipe Installation', 'Tap Replacement', 'Bathroom Fitting'], '[DEMO TEST WORKER] Fictional plumber for local PostGIS testing. Experienced in residential plumbing.', 6, 15.0, 350.00, 500.00, true, true, true, true, 4.85, 34, ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)::geography),

        -- 2. Electrician in South Delhi (Saket)
        (v_electrician_id, 'electrical', ARRAY['Wiring', 'MCB Tripping', 'Switchboard Repair', 'Fan Installation'], '[DEMO TEST WORKER] Fictional electrician for local testing. Available for urgent domestic electrical faults.', 4, 15.0, 300.00, 450.00, true, true, true, true, 4.90, 42, ST_SetSRID(ST_MakePoint(77.2066, 28.5244), 4326)::geography),

        -- 3. Deep Cleaner in West Delhi (Dwarka)
        (v_cleaner_id, 'cleaning', ARRAY['Deep Home Cleaning', 'Kitchen Degreasing', 'Sofa Shampoo', 'Floor Buffing'], '[DEMO TEST WORKER] Fictional deep cleaning pro for spatial dispatch demonstration.', 5, 20.0, 600.00, 1200.00, true, true, true, true, 4.75, 29, ST_SetSRID(ST_MakePoint(77.0500, 28.5823), 4326)::geography),

        -- 4. Carpenter in Central/South Delhi
        (v_carpenter_id, 'carpentry', ARRAY['Furniture Repair', 'Door Latch Fixing', 'Cabinet Installation', 'Hinges'], '[DEMO TEST WORKER] Fictional carpenter profile for testing bidding and discovery workflows.', 8, 12.0, 400.00, 600.00, true, true, true, true, 4.80, 51, ST_SetSRID(ST_MakePoint(77.1950, 28.5700), 4326)::geography),

        -- 5. Painter in East Delhi / Noida
        (v_painter_id, 'painting', ARRAY['Wall Painting', 'Waterproofing Touchup', 'Putty Filling', 'Stencil Work'], '[DEMO TEST WORKER] Fictional painter profile for local service matching tests.', 7, 25.0, 800.00, 2500.00, true, true, true, true, 4.65, 21, ST_SetSRID(ST_MakePoint(77.3910, 28.5355), 4326)::geography),

        -- 6. Appliance Repair in North Delhi (Rohini)
        (v_appliance_id, 'appliance_repair', ARRAY['Washing Machine Repair', 'Refrigerator Gas Refill', 'Microwave Repair'], '[DEMO TEST WORKER] Fictional technician profile for appliance repair testing.', 5, 15.0, 450.00, 800.00, true, true, true, true, 4.95, 38, ST_SetSRID(ST_MakePoint(77.1190, 28.7140), 4326)::geography),

        -- 7. House Help / Maid in South Delhi
        (v_maid_id, 'maid', ARRAY['Daily Housekeeping', 'Utensil Cleaning', 'Dusting', 'Floor Mopping'], '[DEMO TEST WORKER] Fictional domestic help profile for verification testing.', 3, 10.0, 250.00, 400.00, true, true, true, true, 4.70, 18, ST_SetSRID(ST_MakePoint(77.2200, 28.5400), 4326)::geography),

        -- 8. Cook in Gurugram
        (v_cook_id, 'cooking', ARRAY['North Indian Homestyle', 'Meal Preparation', 'Party Snacks', 'Rotis'], '[DEMO TEST WORKER] Fictional cook profile for regional marketplace demonstration.', 6, 12.0, 500.00, 900.00, true, true, true, true, 4.88, 27, ST_SetSRID(ST_MakePoint(77.0266, 28.4595), 4326)::geography)
    ON CONFLICT (user_id) DO UPDATE SET
        is_available = true,
        is_publicly_visible = true,
        reputation_score = EXCLUDED.reputation_score,
        service_location = EXCLUDED.service_location;

END $$;
