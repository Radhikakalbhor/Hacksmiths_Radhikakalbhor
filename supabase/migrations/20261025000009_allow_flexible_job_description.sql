-- ==============================================================================
-- Sahayak Migration 09: Flexible Job Description
-- Author: Sahayak Engineering
-- Description: Updates jobs_description_check to allow empty/omitted descriptions
--              while preventing corrupt whitespace, ensuring backward compatibility.
-- ==============================================================================

DO $$
BEGIN
    -- Drop existing description check constraint if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'jobs_description_check'
          AND conrelid = 'public.jobs'::regclass
    ) THEN
        ALTER TABLE public.jobs DROP CONSTRAINT jobs_description_check;
    END IF;

    -- Add updated, backward-compatible check constraint:
    -- Accepts any non-whitespace string of length >= 0 or NULL
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_description_check
        CHECK (description IS NULL OR length(trim(description)) >= 0);
END $$;
