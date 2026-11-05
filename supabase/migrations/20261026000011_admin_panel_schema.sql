-- ==============================================================================
-- Sahayak Migration 11: Admin Panel Schema, Moderation, Auditing & Escalation
-- Enforces zero-trust admin privileges, RLS security, and audit trail.
-- ==============================================================================

-- 1. Ensure 'ADMIN' exists in user_role enum
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add suspension flags to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- 3. Admin Audit Log Table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON public.admin_audit_log (entity_type, entity_id);

-- 4. Worker Verification Documents Table
CREATE TABLE IF NOT EXISTS public.verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_docs_worker ON public.verification_documents (worker_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_status ON public.verification_documents (status);

-- 5. Disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    raised_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    against_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
    resolution TEXT,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_job ON public.disputes (job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes (status);

-- 6. Dedicated SOS Incidents Table
CREATE TABLE IF NOT EXISTS public.sos_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    triggered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    severity safety_severity NOT NULL DEFAULT 'URGENT_EMERGENCY',
    status TEXT NOT NULL DEFAULT 'TRIGGERED' CHECK (status IN ('TRIGGERED', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED')),
    location_point geography(POINT, 4326),
    trusted_contacts JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sos_incidents_status ON public.sos_incidents (status);
CREATE INDEX IF NOT EXISTS idx_sos_incidents_triggered_by ON public.sos_incidents (triggered_by);

-- 7. Review Moderation Flags Table
CREATE TABLE IF NOT EXISTS public.review_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_flags_review ON public.review_flags (review_id);
CREATE INDEX IF NOT EXISTS idx_review_flags_status ON public.review_flags (status);

-- 8. Platform Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL', 'CUSTOMERS', 'WORKERS', 'CITY')),
    city TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements (created_at DESC);

-- 9. AI Job Posting Logs Table
CREATE TABLE IF NOT EXISTS public.ai_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    input_type TEXT NOT NULL DEFAULT 'text',
    raw_input TEXT NOT NULL,
    generated_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    feedback TEXT CHECK (feedback IN ('up', 'down', null)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_job_logs_created ON public.ai_job_logs (created_at DESC);

-- ==============================================================================
-- Row-Level Security Policies
-- ==============================================================================

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_job_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN')
        AND is_suspended = false
    );
$$;

-- Admin Audit Log: strictly readable by admins, insertions allowed via service_role/admin
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit logs"
    ON public.admin_audit_log FOR SELECT
    USING (public.is_current_admin());

-- Verification Documents: worker can view own, admins can manage all
DROP POLICY IF EXISTS "Workers view own verification docs" ON public.verification_documents;
CREATE POLICY "Workers view own verification docs"
    ON public.verification_documents FOR SELECT
    USING (worker_id = auth.uid() OR public.is_current_admin());

DROP POLICY IF EXISTS "Workers upload verification docs" ON public.verification_documents;
CREATE POLICY "Workers upload verification docs"
    ON public.verification_documents FOR INSERT
    WITH CHECK (worker_id = auth.uid() OR public.is_current_admin());

DROP POLICY IF EXISTS "Admins manage verification docs" ON public.verification_documents;
CREATE POLICY "Admins manage verification docs"
    ON public.verification_documents FOR ALL
    USING (public.is_current_admin());

-- Disputes: involved parties can view & create, admins can view & resolve
DROP POLICY IF EXISTS "Parties can view their disputes" ON public.disputes;
CREATE POLICY "Parties can view their disputes"
    ON public.disputes FOR SELECT
    USING (raised_by = auth.uid() OR against_user = auth.uid() OR public.is_current_admin());

DROP POLICY IF EXISTS "Users can raise disputes" ON public.disputes;
CREATE POLICY "Users can raise disputes"
    ON public.disputes FOR INSERT
    WITH CHECK (raised_by = auth.uid() OR public.is_current_admin());

DROP POLICY IF EXISTS "Admins manage disputes" ON public.disputes;
CREATE POLICY "Admins manage disputes"
    ON public.disputes FOR ALL
    USING (public.is_current_admin());

-- SOS Incidents: triggerer can view, admins can manage
DROP POLICY IF EXISTS "Users can trigger and view their SOS" ON public.sos_incidents;
CREATE POLICY "Users can trigger and view their SOS"
    ON public.sos_incidents FOR SELECT
    USING (triggered_by = auth.uid() OR public.is_current_admin());

DROP POLICY IF EXISTS "Users can trigger SOS" ON public.sos_incidents;
CREATE POLICY "Users can trigger SOS"
    ON public.sos_incidents FOR INSERT
    WITH CHECK (triggered_by = auth.uid() OR public.is_current_admin());

DROP POLICY IF EXISTS "Admins manage SOS" ON public.sos_incidents;
CREATE POLICY "Admins manage SOS"
    ON public.sos_incidents FOR ALL
    USING (public.is_current_admin());

-- Review Flags: admins manage all
DROP POLICY IF EXISTS "Admins manage review flags" ON public.review_flags;
CREATE POLICY "Admins manage review flags"
    ON public.review_flags FOR ALL
    USING (public.is_current_admin());

-- Announcements: everyone can read active announcements, only admins can create
DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
CREATE POLICY "Anyone can read announcements"
    ON public.announcements FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements"
    ON public.announcements FOR ALL
    USING (public.is_current_admin());

-- AI Job Logs: readable & manageable by admins
DROP POLICY IF EXISTS "Admins manage AI logs" ON public.ai_job_logs;
CREATE POLICY "Admins manage AI logs"
    ON public.ai_job_logs FOR ALL
    USING (public.is_current_admin());

-- Grant table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.verification_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.disputes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sos_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.review_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_job_logs TO authenticated;

