-- Ensure scheduling columns exist idempotently on public.jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_time_slot TEXT;

-- Create index on scheduled_date for fast filtering and calendar discovery
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON public.jobs(scheduled_date);

