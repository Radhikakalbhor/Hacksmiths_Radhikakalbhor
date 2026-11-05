-- ==============================================================================
-- Migration: Add estimated_budget_inr column to public.jobs table
-- Safely records the customer's explicitly chosen budget alongside
-- the recommended fair market range (estimated_min_price_inr / estimated_max_price_inr).
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'jobs'
          AND column_name = 'estimated_budget_inr'
    ) THEN
        ALTER TABLE public.jobs
        ADD COLUMN estimated_budget_inr NUMERIC(10, 2)
        CHECK (estimated_budget_inr IS NULL OR estimated_budget_inr >= 0);
    END IF;
END $$;

