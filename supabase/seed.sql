-- ==============================================================================
-- Sahayak Seed Data: Illustrative Local Price Benchmarks
-- DEMO ESTIMATES ONLY: These figures represent illustrative local baseline ranges
-- for hackathon demonstration. They require empirical validation against live
-- market quotes before commercial deployment.
-- This script is idempotent and safe to rerun multiple times.
-- ==============================================================================

INSERT INTO public.price_benchmarks (
    category,
    city,
    micro_market_area,
    min_price_inr,
    median_price_inr,
    max_price_inr,
    sample_size,
    currency,
    is_demo_estimate,
    last_calculated_at
)
VALUES
    -- 1. Plumbing
    ('plumbing', 'Delhi NCR', 'Dwarka & South West Delhi', 250.00, 350.00, 550.00, 48, 'INR', true, NOW()),
    ('plumbing', 'Delhi NCR', 'Saket & South Delhi', 300.00, 420.00, 650.00, 62, 'INR', true, NOW()),
    ('plumbing', 'Delhi NCR', 'Rohini & North Delhi', 220.00, 320.00, 500.00, 35, 'INR', true, NOW()),
    ('plumbing', 'Delhi NCR', 'Noida Sector 62', 250.00, 380.00, 600.00, 41, 'INR', true, NOW()),

    -- 2. Electrical
    ('electrical', 'Delhi NCR', 'Dwarka & South West Delhi', 200.00, 300.00, 500.00, 53, 'INR', true, NOW()),
    ('electrical', 'Delhi NCR', 'Saket & South Delhi', 250.00, 380.00, 600.00, 59, 'INR', true, NOW()),
    ('electrical', 'Delhi NCR', 'Rohini & North Delhi', 200.00, 280.00, 450.00, 38, 'INR', true, NOW()),
    ('electrical', 'Delhi NCR', 'Gurugram Sector 29', 300.00, 450.00, 750.00, 44, 'INR', true, NOW()),

    -- 3. Deep Cleaning
    ('cleaning', 'Delhi NCR', 'Dwarka & South West Delhi', 750.00, 1100.00, 2200.00, 29, 'INR', true, NOW()),
    ('cleaning', 'Delhi NCR', 'Saket & South Delhi', 900.00, 1400.00, 2800.00, 37, 'INR', true, NOW()),
    ('cleaning', 'Delhi NCR', 'Noida Sector 62', 700.00, 1050.00, 2000.00, 31, 'INR', true, NOW()),

    -- 4. Painting & Touchup
    ('painting', 'Delhi NCR', 'Dwarka & South West Delhi', 1200.00, 2200.00, 4500.00, 22, 'INR', true, NOW()),
    ('painting', 'Delhi NCR', 'Saket & South Delhi', 1500.00, 2800.00, 5500.00, 28, 'INR', true, NOW()),
    ('painting', 'Delhi NCR', 'Rohini & North Delhi', 1100.00, 2000.00, 4000.00, 19, 'INR', true, NOW()),

    -- 5. House Help & Maid
    ('maid', 'Delhi NCR', 'Dwarka & South West Delhi', 300.00, 450.00, 800.00, 65, 'INR', true, NOW()),
    ('maid', 'Delhi NCR', 'Saket & South Delhi', 350.00, 550.00, 950.00, 71, 'INR', true, NOW()),
    ('maid', 'Delhi NCR', 'Noida Sector 62', 280.00, 400.00, 750.00, 54, 'INR', true, NOW()),

    -- 6. Cook & Chef
    ('cooking', 'Delhi NCR', 'Dwarka & South West Delhi', 400.00, 650.00, 1200.00, 34, 'INR', true, NOW()),
    ('cooking', 'Delhi NCR', 'Saket & South Delhi', 500.00, 850.00, 1500.00, 42, 'INR', true, NOW()),
    ('cooking', 'Delhi NCR', 'Gurugram Sector 29', 550.00, 900.00, 1600.00, 39, 'INR', true, NOW()),

    -- 7. Carpentry
    ('carpentry', 'Delhi NCR', 'Dwarka & South West Delhi', 300.00, 450.00, 750.00, 31, 'INR', true, NOW()),
    ('carpentry', 'Delhi NCR', 'Saket & South Delhi', 350.00, 520.00, 900.00, 36, 'INR', true, NOW()),
    ('carpentry', 'Delhi NCR', 'Rohini & North Delhi', 250.00, 400.00, 700.00, 27, 'INR', true, NOW()),

    -- 8. Appliance Repair
    ('appliance_repair', 'Delhi NCR', 'Dwarka & South West Delhi', 350.00, 550.00, 1100.00, 47, 'INR', true, NOW()),
    ('appliance_repair', 'Delhi NCR', 'Saket & South Delhi', 400.00, 650.00, 1300.00, 58, 'INR', true, NOW()),
    ('appliance_repair', 'Delhi NCR', 'Noida Sector 62', 320.00, 500.00, 1000.00, 43, 'INR', true, NOW())
ON CONFLICT (category, city, micro_market_area)
DO UPDATE SET
    min_price_inr = EXCLUDED.min_price_inr,
    median_price_inr = EXCLUDED.median_price_inr,
    max_price_inr = EXCLUDED.max_price_inr,
    sample_size = EXCLUDED.sample_size,
    is_demo_estimate = true,
    last_calculated_at = NOW();
