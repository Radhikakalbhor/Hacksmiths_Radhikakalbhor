-- ==============================================================================
-- Sahayak Migration 14: Hybrid Real + Demo Worker Marketplace Schema
-- Adds explicit source attribution (real vs demo) and supports real worker discovery.
-- Safe, idempotent, and non-destructive.
-- ==============================================================================

-- 1. Add source columns with safe defaults ('real' and is_demo = false)
-- This ensures all existing and future real accounts default to 'real'
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_source TEXT NOT NULL DEFAULT 'real' CHECK (user_source IN ('real', 'demo'));

ALTER TABLE public.worker_profiles
ADD COLUMN IF NOT EXISTS worker_source TEXT NOT NULL DEFAULT 'real' CHECK (worker_source IN ('real', 'demo')),
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- 2. Mark ONLY verified demonstration accounts as 'demo'
-- Uses strict email domain matching (@sahayak.demo.internal)
-- Guarantees NO real worker (e.g. Agam, Gmail, Yahoo, Outlook) can ever be misclassified
UPDATE public.profiles
SET user_source = 'demo'
WHERE lower(email) LIKE '%@sahayak.demo.internal';

UPDATE public.worker_profiles
SET worker_source = 'demo',
    is_demo = true
WHERE user_id IN (
    SELECT id FROM public.profiles 
    WHERE lower(email) LIKE '%@sahayak.demo.internal'
);

-- 3. Create indexes for high-performance hybrid worker queries
CREATE INDEX IF NOT EXISTS idx_worker_profiles_hybrid_discovery
ON public.worker_profiles (is_publicly_visible, is_available, primary_category);

CREATE INDEX IF NOT EXISTS idx_worker_profiles_source
ON public.worker_profiles (worker_source, is_demo);

-- 4. Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
