-- Migration: 20261025000008_booking_lifecycle_and_messages.sql
-- Description: Optional dedicated table for job/booking chat messages and status extensions.

CREATE TABLE IF NOT EXISTS public.job_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'worker', 'system')),
    message_text TEXT NOT NULL CHECK (length(trim(message_text)) > 0 AND length(message_text) <= 1000),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_messages_job ON public.job_messages (job_id, created_at ASC);

-- Enable Row-Level Security on job_messages
ALTER TABLE public.job_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Only customer owner and assigned worker can read messages for a job
CREATE POLICY job_messages_select_policy ON public.job_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_messages.job_id
              AND (j.customer_id = auth.uid() OR j.selected_worker_id = auth.uid() OR j.assigned_worker_id = auth.uid())
        )
    );

-- Policy: Only customer owner and assigned worker can insert messages
CREATE POLICY job_messages_insert_policy ON public.job_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_messages.job_id
              AND (j.customer_id = auth.uid() OR j.selected_worker_id = auth.uid() OR j.assigned_worker_id = auth.uid())
        )
    );

-- Grant privileges to authenticated and service_role
GRANT SELECT, INSERT ON public.job_messages TO authenticated;
GRANT ALL ON public.job_messages TO service_role;
