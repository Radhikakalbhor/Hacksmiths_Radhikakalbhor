-- Migration: 20261025000010_expand_jobs_urgency_check.sql
-- Description: Expand jobs_urgency_check to accept 'same_day' alongside 'standard', 'urgent', and 'emergency'
-- This ensures full backward-compatibility and forward-compatibility between frontend urgency values and database checks.

DO $$
BEGIN
  -- 1. Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'jobs_urgency_check' 
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs DROP CONSTRAINT jobs_urgency_check;
  END IF;

  -- 2. Add expanded constraint accepting all valid platform urgency values
  ALTER TABLE public.jobs ADD CONSTRAINT jobs_urgency_check
    CHECK (urgency IN ('standard', 'same_day', 'urgent', 'emergency'));

  -- 3. Update comments
  COMMENT ON COLUMN public.jobs.urgency IS 'Job urgency level: standard, same_day, urgent, or emergency';
END $$;
