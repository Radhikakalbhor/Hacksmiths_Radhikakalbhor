-- ==============================================================================
-- Sahayak Migration 13: Worker Wallet, Earnings Management & Notifications
-- ==============================================================================

-- 1. Platform Settings (Commission %, Cancellation Policy)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial default platform settings idempotently
INSERT INTO public.platform_settings (key, value, description)
VALUES 
    ('commission_rate_percent', '{"value": 10.0}'::jsonb, 'Platform commission percentage charged on completed jobs (default: 10%)'),
    ('cancellation_time_limit_minutes', '{"value": 60}'::jsonb, 'Worker cancellation buffer time before scheduled service (default: 60 minutes)'),
    ('cancellation_policy', '{"max_free_cancellations": 3, "penalty_inr": 50.0}'::jsonb, 'Worker cancellation terms and conditions')
ON CONFLICT (key) DO NOTHING;

-- 2. Worker Wallets
CREATE TABLE IF NOT EXISTS public.worker_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    available_balance_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance_inr >= 0),
    pending_balance_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (pending_balance_inr >= 0),
    total_earned_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_earned_inr >= 0),
    total_withdrawn_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn_inr >= 0),
    total_deductions_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_deductions_inr >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_wallets_worker ON public.worker_wallets (worker_id);

-- 3. Wallet Transactions (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.worker_wallets(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('JOB_PAYOUT', 'COMMISSION_DEDUCTION', 'PENALTY_DEDUCTION', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT')),
    amount_inr NUMERIC(10, 2) NOT NULL,
    balance_after_inr NUMERIC(10, 2) NOT NULL CHECK (balance_after_inr >= 0),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
    description TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_worker ON public.wallet_transactions (worker_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON public.wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_job ON public.wallet_transactions (job_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON public.wallet_transactions (created_at DESC);

-- 4. Worker Payout Methods (Bank Accounts & UPI)
CREATE TABLE IF NOT EXISTS public.worker_payout_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL CHECK (method_type IN ('UPI', 'BANK_ACCOUNT')),
    account_holder_name TEXT NOT NULL,
    upi_id TEXT,
    bank_name TEXT,
    account_number_masked TEXT,
    ifsc_code TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_payout_methods_worker ON public.worker_payout_methods (worker_id);

-- 5. Withdrawal Requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.worker_wallets(id) ON DELETE CASCADE,
    amount_inr NUMERIC(10, 2) NOT NULL CHECK (amount_inr > 0),
    payout_method_type TEXT NOT NULL CHECK (payout_method_type IN ('UPI', 'BANK_ACCOUNT')),
    payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED')),
    admin_notes TEXT,
    payout_reference TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_worker ON public.withdrawal_requests (worker_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON public.withdrawal_requests (status);

-- 6. Job Payments (Escrow & Settlement tracking)
CREATE TABLE IF NOT EXISTS public.job_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gross_amount_inr NUMERIC(10, 2) NOT NULL CHECK (gross_amount_inr >= 0),
    commission_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (commission_rate_percent >= 0 AND commission_rate_percent <= 100),
    commission_amount_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (commission_amount_inr >= 0),
    worker_net_earning_inr NUMERIC(10, 2) NOT NULL CHECK (worker_net_earning_inr >= 0),
    payment_status TEXT NOT NULL DEFAULT 'HELD_IN_ESCROW' CHECK (payment_status IN ('HELD_IN_ESCROW', 'PENDING_RELEASE', 'RELEASED_TO_WALLET', 'REFUNDED', 'DISPUTED')),
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_payments_worker ON public.job_payments (worker_id);
CREATE INDEX IF NOT EXISTS idx_job_payments_customer ON public.job_payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_job_payments_status ON public.job_payments (payment_status);

-- 7. Worker Notifications
CREATE TABLE IF NOT EXISTS public.worker_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'NEW_OFFER', 
        'OFFER_ACCEPTED', 
        'OFFER_REJECTED', 
        'BOOKING_CANCELLED', 
        'UPCOMING_REMINDER', 
        'COMPLETION_CONFIRMED', 
        'PAYMENT_CREDITED', 
        'WITHDRAWAL_STATUS', 
        'SYSTEM'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_notifications_worker ON public.worker_notifications (worker_id, is_read, created_at DESC);

-- Enable RLS on all newly created tables
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_notifications ENABLE ROW LEVEL SECURITY;

-- 8. Row Level Security Policies

-- Platform Settings: Everyone can read, only admin can modify
DROP POLICY IF EXISTS "platform_settings_read_all" ON public.platform_settings;
CREATE POLICY "platform_settings_read_all" ON public.platform_settings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Worker Wallets: Worker can read their own wallet, admin can read/write all
DROP POLICY IF EXISTS "worker_wallets_owner_read" ON public.worker_wallets;
CREATE POLICY "worker_wallets_owner_read" ON public.worker_wallets
    FOR SELECT TO authenticated USING (worker_id = auth.uid() OR public.is_admin());

-- Wallet Transactions: Worker can read their own transactions, admin can read all
DROP POLICY IF EXISTS "wallet_transactions_owner_read" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_owner_read" ON public.wallet_transactions
    FOR SELECT TO authenticated USING (worker_id = auth.uid() OR public.is_admin());

-- Worker Payout Methods: Worker can manage their own methods, admin can view
DROP POLICY IF EXISTS "worker_payout_methods_owner" ON public.worker_payout_methods;
CREATE POLICY "worker_payout_methods_owner" ON public.worker_payout_methods
    FOR ALL TO authenticated USING (worker_id = auth.uid() OR public.is_admin())
    WITH CHECK (worker_id = auth.uid() OR public.is_admin());

-- Withdrawal Requests: Worker can read their own and create, admin can read and update
DROP POLICY IF EXISTS "withdrawal_requests_owner_read" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_owner_read" ON public.withdrawal_requests
    FOR SELECT TO authenticated USING (worker_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "withdrawal_requests_owner_insert" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_owner_insert" ON public.withdrawal_requests
    FOR INSERT TO authenticated WITH CHECK (worker_id = auth.uid());

DROP POLICY IF EXISTS "withdrawal_requests_admin_update" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_admin_update" ON public.withdrawal_requests
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Job Payments: Customer and Worker can read payments for their jobs, admin has full access
DROP POLICY IF EXISTS "job_payments_participants_read" ON public.job_payments;
CREATE POLICY "job_payments_participants_read" ON public.job_payments
    FOR SELECT TO authenticated USING (customer_id = auth.uid() OR worker_id = auth.uid() OR public.is_admin());

-- Worker Notifications: Worker can read and update (mark read) their own notifications
DROP POLICY IF EXISTS "worker_notifications_owner" ON public.worker_notifications;
CREATE POLICY "worker_notifications_owner" ON public.worker_notifications
    FOR SELECT TO authenticated USING (worker_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "worker_notifications_owner_update" ON public.worker_notifications;
CREATE POLICY "worker_notifications_owner_update" ON public.worker_notifications
    FOR UPDATE TO authenticated USING (worker_id = auth.uid()) WITH CHECK (worker_id = auth.uid());

-- 9. Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;

GRANT SELECT ON TABLE public.worker_wallets TO authenticated;
GRANT ALL ON TABLE public.worker_wallets TO service_role;

GRANT SELECT ON TABLE public.wallet_transactions TO authenticated;
GRANT ALL ON TABLE public.wallet_transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.worker_payout_methods TO authenticated;
GRANT ALL ON TABLE public.worker_payout_methods TO service_role;

GRANT SELECT, INSERT ON TABLE public.withdrawal_requests TO authenticated;
GRANT ALL ON TABLE public.withdrawal_requests TO service_role;

GRANT SELECT ON TABLE public.job_payments TO authenticated;
GRANT ALL ON TABLE public.job_payments TO service_role;

GRANT SELECT, UPDATE ON TABLE public.worker_notifications TO authenticated;
GRANT ALL ON TABLE public.worker_notifications TO service_role;

-- 10. Atomic Stored Procedures

-- Function: Get or create worker wallet
CREATE OR REPLACE FUNCTION public.get_or_create_worker_wallet(p_worker_id UUID)
RETURNS public.worker_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_wallet public.worker_wallets;
BEGIN
    SELECT * INTO v_wallet FROM public.worker_wallets WHERE worker_id = p_worker_id;
    IF NOT FOUND THEN
        INSERT INTO public.worker_wallets (worker_id, available_balance_inr, pending_balance_inr, total_earned_inr, total_withdrawn_inr, total_deductions_inr)
        VALUES (p_worker_id, 0.00, 0.00, 0.00, 0.00, 0.00)
        ON CONFLICT (worker_id) DO UPDATE SET updated_at = NOW()
        RETURNING * INTO v_wallet;
    END IF;
    RETURN v_wallet;
END;
$$;

-- Function: Atomic Credit of Job Earnings to Worker Wallet
CREATE OR REPLACE FUNCTION public.credit_job_earnings_to_wallet(
    p_job_id UUID,
    p_commission_percent NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_job RECORD;
    v_payment RECORD;
    v_wallet RECORD;
    v_commission_rate NUMERIC(5, 2);
    v_gross_amount NUMERIC(10, 2);
    v_commission_amount NUMERIC(10, 2);
    v_net_earning NUMERIC(10, 2);
    v_new_available NUMERIC(10, 2);
    v_new_pending NUMERIC(10, 2);
    v_new_total_earned NUMERIC(10, 2);
    v_new_total_deductions NUMERIC(10, 2);
    v_setting JSONB;
BEGIN
    -- 1. Lock job record
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;

    IF v_job.selected_worker_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job has no assigned worker');
    END IF;

    -- 2. Check if payment was already released
    SELECT * INTO v_payment FROM public.job_payments WHERE job_id = p_job_id FOR UPDATE;
    IF FOUND AND v_payment.payment_status = 'RELEASED_TO_WALLET' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Earnings for this job have already been released to wallet');
    END IF;

    -- Determine commission rate
    IF p_commission_percent IS NOT NULL THEN
        v_commission_rate := p_commission_percent;
    ELSE
        SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'commission_rate_percent';
        IF v_setting IS NOT NULL AND (v_setting->>'value') IS NOT NULL THEN
            v_commission_rate := (v_setting->>'value')::NUMERIC;
        ELSE
            v_commission_rate := 10.00;
        END IF;
    END IF;

    -- Determine gross amount (from accepted_price_inr or estimated_budget_inr or payment)
    IF v_payment IS NOT NULL AND v_payment.gross_amount_inr > 0 THEN
        v_gross_amount := v_payment.gross_amount_inr;
    ELSIF v_job.accepted_price_inr IS NOT NULL AND v_job.accepted_price_inr > 0 THEN
        v_gross_amount := v_job.accepted_price_inr;
    ELSE
        v_gross_amount := COALESCE(v_job.estimated_budget_inr, 500.00);
    END IF;

    -- Compute commission and net earning
    v_commission_amount := ROUND((v_gross_amount * (v_commission_rate / 100.00)), 2);
    v_net_earning := ROUND(v_gross_amount - v_commission_amount, 2);

    -- 3. Lock or create worker wallet
    SELECT * INTO v_wallet FROM public.worker_wallets WHERE worker_id = v_job.selected_worker_id FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO public.worker_wallets (worker_id, available_balance_inr, pending_balance_inr, total_earned_inr, total_withdrawn_inr, total_deductions_inr)
        VALUES (v_job.selected_worker_id, 0.00, 0.00, 0.00, 0.00, 0.00)
        RETURNING * INTO v_wallet;
    END IF;

    -- Calculate updated balances
    v_new_available := v_wallet.available_balance_inr + v_net_earning;
    v_new_pending := GREATEST(0.00, v_wallet.pending_balance_inr - v_gross_amount);
    v_new_total_earned := v_wallet.total_earned_inr + v_net_earning;
    v_new_total_deductions := v_wallet.total_deductions_inr + v_commission_amount;

    -- 4. Update worker wallet
    UPDATE public.worker_wallets
    SET 
        available_balance_inr = v_new_available,
        pending_balance_inr = v_new_pending,
        total_earned_inr = v_new_total_earned,
        total_deductions_inr = v_new_total_deductions,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- 5. Record immutable wallet transaction for Net Payout
    INSERT INTO public.wallet_transactions (
        wallet_id, worker_id, job_id, transaction_type, amount_inr, balance_after_inr, status, description, reference_id
    ) VALUES (
        v_wallet.id, v_job.selected_worker_id, p_job_id, 'JOB_PAYOUT', v_net_earning, v_new_available, 'COMPLETED',
        'Payment received for job: ' || v_job.title || ' (Gross: ₹' || v_gross_amount || ', Comm: ₹' || v_commission_amount || ')',
        'JOB-PAY-' || p_job_id
    );

    -- 6. Upsert job_payments record
    IF v_payment IS NULL THEN
        INSERT INTO public.job_payments (
            job_id, customer_id, worker_id, gross_amount_inr, commission_rate_percent, commission_amount_inr,
            worker_net_earning_inr, payment_status, released_at
        ) VALUES (
            p_job_id, v_job.customer_id, v_job.selected_worker_id, v_gross_amount, v_commission_rate, v_commission_amount,
            v_net_earning, 'RELEASED_TO_WALLET', NOW()
        );
    ELSE
        UPDATE public.job_payments
        SET 
            gross_amount_inr = v_gross_amount,
            commission_rate_percent = v_commission_rate,
            commission_amount_inr = v_commission_amount,
            worker_net_earning_inr = v_net_earning,
            payment_status = 'RELEASED_TO_WALLET',
            released_at = NOW(),
            updated_at = NOW()
        WHERE id = v_payment.id;
    END IF;

    -- 7. Update legacy worker_earnings table for cross-compatibility
    INSERT INTO public.worker_earnings (
        worker_id, job_id, gross_amount_inr, platform_fee_inr, net_payout_inr, status, paid_at
    ) VALUES (
        v_job.selected_worker_id, p_job_id, v_gross_amount, v_commission_amount, v_net_earning, 'PROCESSED', NOW()
    ) ON CONFLICT (job_id) DO UPDATE SET
        gross_amount_inr = EXCLUDED.gross_amount_inr,
        platform_fee_inr = EXCLUDED.platform_fee_inr,
        net_payout_inr = EXCLUDED.net_payout_inr,
        status = 'PROCESSED',
        paid_at = NOW();

    -- 8. Create worker notification
    INSERT INTO public.worker_notifications (
        worker_id, type, title, message, job_id, metadata
    ) VALUES (
        v_job.selected_worker_id, 'PAYMENT_CREDITED', 'Payment Credited: ₹' || v_net_earning,
        'Earnings for job "' || v_job.title || '" have been released to your available balance.',
        p_job_id,
        jsonb_build_object('gross', v_gross_amount, 'commission', v_commission_amount, 'net', v_net_earning)
    );

    RETURN jsonb_build_object(
        'success', true,
        'grossAmountInr', v_gross_amount,
        'commissionAmountInr', v_commission_amount,
        'commissionRatePercent', v_commission_rate,
        'netEarningInr', v_net_earning,
        'newAvailableBalanceInr', v_new_available
    );
END;
$$;

-- Function: Worker Requests Wallet Withdrawal
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
    p_worker_id UUID,
    p_amount NUMERIC,
    p_method_type TEXT,
    p_details JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_wallet RECORD;
    v_req_id UUID;
    v_new_available NUMERIC(10, 2);
    v_new_total_withdrawn NUMERIC(10, 2);
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must be greater than zero.');
    END IF;

    -- Lock worker wallet
    SELECT * INTO v_wallet FROM public.worker_wallets WHERE worker_id = p_worker_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Worker wallet not found.');
    END IF;

    IF v_wallet.available_balance_inr < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient available balance (Available: ₹' || v_wallet.available_balance_inr || ').');
    END IF;

    -- Deduct balance atomically
    v_new_available := v_wallet.available_balance_inr - p_amount;
    v_new_total_withdrawn := v_wallet.total_withdrawn_inr + p_amount;

    UPDATE public.worker_wallets
    SET 
        available_balance_inr = v_new_available,
        total_withdrawn_inr = v_new_total_withdrawn,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- Create withdrawal request record
    INSERT INTO public.withdrawal_requests (
        worker_id, wallet_id, amount_inr, payout_method_type, payout_details, status
    ) VALUES (
        p_worker_id, v_wallet.id, p_amount, p_method_type, p_details, 'PENDING'
    ) RETURNING id INTO v_req_id;

    -- Record transaction
    INSERT INTO public.wallet_transactions (
        wallet_id, worker_id, transaction_type, amount_inr, balance_after_inr, status, description, reference_id
    ) VALUES (
        v_wallet.id, p_worker_id, 'WITHDRAWAL', -p_amount, v_new_available, 'PENDING',
        'Withdrawal request via ' || p_method_type || ' initiated', 'WDR-' || v_req_id
    );

    -- Notify worker
    INSERT INTO public.worker_notifications (
        worker_id, type, title, message, metadata
    ) VALUES (
        p_worker_id, 'WITHDRAWAL_STATUS', 'Withdrawal Initiated: ₹' || p_amount,
        'Your withdrawal request of ₹' || p_amount || ' has been submitted and is pending processing.',
        jsonb_build_object('requestId', v_req_id, 'amount', p_amount)
    );

    RETURN jsonb_build_object(
        'success', true,
        'requestId', v_req_id,
        'amountInr', p_amount,
        'availableBalanceAfterInr', v_new_available
    );
END;
$$;

-- Function: Admin processes withdrawal decision (approve / reject)
CREATE OR REPLACE FUNCTION public.process_withdrawal_decision(
    p_request_id UUID,
    p_action TEXT, -- 'APPROVE' or 'REJECT'
    p_admin_notes TEXT DEFAULT NULL,
    p_payout_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_req RECORD;
    v_wallet RECORD;
    v_new_available NUMERIC(10, 2);
    v_new_withdrawn NUMERIC(10, 2);
BEGIN
    SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found.');
    END IF;

    IF v_req.status != 'PENDING' AND v_req.status != 'PROCESSING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request has already been processed with status: ' || v_req.status);
    END IF;

    SELECT * INTO v_wallet FROM public.worker_wallets WHERE id = v_req.wallet_id FOR UPDATE;

    IF p_action = 'APPROVE' THEN
        UPDATE public.withdrawal_requests
        SET 
            status = 'COMPLETED',
            admin_notes = p_admin_notes,
            payout_reference = COALESCE(p_payout_ref, 'SIM-PAY-' || floor(random() * 900000 + 100000)::text),
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_request_id;

        -- Update transaction status to COMPLETED
        UPDATE public.wallet_transactions
        SET status = 'COMPLETED'
        WHERE reference_id = 'WDR-' || p_request_id;

        -- Notify worker
        INSERT INTO public.worker_notifications (
            worker_id, type, title, message, metadata
        ) VALUES (
            v_req.worker_id, 'WITHDRAWAL_STATUS', 'Withdrawal Completed: ₹' || v_req.amount_inr,
            'Your payout of ₹' || v_req.amount_inr || ' has been approved and processed successfully.',
            jsonb_build_object('requestId', p_request_id, 'reference', COALESCE(p_payout_ref, 'SIM-PAY'))
        );

        RETURN jsonb_build_object('success', true, 'status', 'COMPLETED');

    ELSIF p_action = 'REJECT' THEN
        -- Refund amount back to available balance
        v_new_available := v_wallet.available_balance_inr + v_req.amount_inr;
        v_new_withdrawn := GREATEST(0.00, v_wallet.total_withdrawn_inr - v_req.amount_inr);

        UPDATE public.worker_wallets
        SET 
            available_balance_inr = v_new_available,
            total_withdrawn_inr = v_new_withdrawn,
            updated_at = NOW()
        WHERE id = v_wallet.id;

        UPDATE public.withdrawal_requests
        SET 
            status = 'REJECTED',
            admin_notes = p_admin_notes,
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_request_id;

        -- Mark transaction as FAILED/REVERSED
        UPDATE public.wallet_transactions
        SET status = 'FAILED', description = description || ' (Rejected: ' || COALESCE(p_admin_notes, 'Declined') || ')'
        WHERE reference_id = 'WDR-' || p_request_id;

        -- Record Refund transaction
        INSERT INTO public.wallet_transactions (
            wallet_id, worker_id, transaction_type, amount_inr, balance_after_inr, status, description, reference_id
        ) VALUES (
            v_wallet.id, v_req.worker_id, 'REFUND', v_req.amount_inr, v_new_available, 'COMPLETED',
            'Refund of rejected withdrawal: ' || COALESCE(p_admin_notes, 'Rejected by admin'),
            'REFUND-' || p_request_id
        );

        -- Notify worker
        INSERT INTO public.worker_notifications (
            worker_id, type, title, message, metadata
        ) VALUES (
            v_req.worker_id, 'WITHDRAWAL_STATUS', 'Withdrawal Rejected: ₹' || v_req.amount_inr,
            'Your withdrawal request of ₹' || v_req.amount_inr || ' was rejected: ' || COALESCE(p_admin_notes, 'Contact support') || '. Funds refunded to your wallet.',
            jsonb_build_object('requestId', p_request_id, 'reason', p_admin_notes)
        );

        RETURN jsonb_build_object('success', true, 'status', 'REJECTED', 'refundedAmountInr', v_req.amount_inr);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Must be APPROVE or REJECT.');
    END IF;
END;
$$;

