-- Migration: 20261024000007_expand_jobs_and_worker_categories.sql
-- Description: Expand jobs_category_check to support 'maid', 'other', 'custom', and custom categories,
-- while ensuring backward compatibility with existing data and constraints.

-- 1. Safely drop the restrictive category check constraint on public.jobs
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_category_check;

-- 2. Add an updated, flexible check constraint that:
--    a) Supports all 8 standard trade categories: plumbing, electrical, cleaning, carpentry, painting, appliance_repair, cooking, maid
--    b) Supports explicit 'other' and 'custom' category tags
--    c) Supports custom service identifiers (lowercase alphanumeric with underscores/hyphens, length >= 2)
ALTER TABLE public.jobs ADD CONSTRAINT jobs_category_check 
    CHECK (
        category IN (
            'plumbing',
            'electrical',
            'cleaning',
            'carpentry',
            'painting',
            'appliance_repair',
            'cooking',
            'maid',
            'other',
            'custom'
        ) 
        OR (length(trim(category)) >= 2 AND category ~ '^[a-z0-9_ -]+$')
    );

-- 3. Also safely update public.worker_profiles if worker_profiles_primary_category_check exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'worker_profiles_primary_category_check'
    ) THEN
        ALTER TABLE public.worker_profiles DROP CONSTRAINT worker_profiles_primary_category_check;
        ALTER TABLE public.worker_profiles ADD CONSTRAINT worker_profiles_primary_category_check
            CHECK (
                primary_category IN (
                    'plumbing',
                    'electrical',
                    'cleaning',
                    'carpentry',
                    'painting',
                    'appliance_repair',
                    'cooking',
                    'maid',
                    'other',
                    'custom'
                )
                OR (length(trim(primary_category)) >= 2)
            );
    END IF;
END $$;

-- 4. Also ensure price_benchmarks_category_check permits 'maid', 'other', 'custom'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'price_benchmarks_category_check'
    ) THEN
        ALTER TABLE public.price_benchmarks DROP CONSTRAINT price_benchmarks_category_check;
        ALTER TABLE public.price_benchmarks ADD CONSTRAINT price_benchmarks_category_check
            CHECK (
                category IN (
                    'plumbing',
                    'electrical',
                    'cleaning',
                    'carpentry',
                    'painting',
                    'appliance_repair',
                    'cooking',
                    'maid',
                    'other',
                    'custom'
                )
            );
    END IF;
END $$;
