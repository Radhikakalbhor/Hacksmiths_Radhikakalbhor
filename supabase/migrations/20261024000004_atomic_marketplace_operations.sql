-- ==============================================================================
-- Sahayak Migration 04: Atomic Marketplace Operations
-- Provides transaction-safe, race-condition-free bid acceptance and assignment
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.accept_job_bid(
    p_job_id UUID,
    p_bid_id UUID,
    p_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_job RECORD;
    v_bid RECORD;
BEGIN
    -- 1. Lock the job record FOR UPDATE to prevent concurrent modifications
    SELECT * INTO v_job
    FROM public.jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'NOT_FOUND',
            'error', 'Job not found.'
        );
    END IF;

    -- 2. Verify job ownership
    IF v_job.customer_id != p_customer_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'FORBIDDEN',
            'error', 'Unauthorized: Only the customer who posted the job can accept bids.'
        );
    END IF;

    -- 3. Verify job is open for acceptance
    IF v_job.status NOT IN ('POSTED', 'BIDDING_OPEN') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CONFLICT',
            'error', 'Job is no longer open for bid acceptance. Current status: ' || v_job.status
        );
    END IF;

    IF v_job.selected_worker_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CONFLICT',
            'error', 'A worker has already been assigned to this job.'
        );
    END IF;

    -- 4. Lock and verify the targeted bid FOR UPDATE
    SELECT * INTO v_bid
    FROM public.bids
    WHERE id = p_bid_id AND job_id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'NOT_FOUND',
            'error', 'Bid not found for this job.'
        );
    END IF;

    IF v_bid.status != 'PENDING' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CONFLICT',
            'error', 'This bid is no longer pending. Status: ' || v_bid.status
        );
    END IF;

    -- 5. Atomic Update: Accept winning bid
    UPDATE public.bids
    SET status = 'ACCEPTED', updated_at = NOW()
    WHERE id = p_bid_id;

    -- 6. Atomic Update: Reject all other pending bids on this job
    UPDATE public.bids
    SET status = 'REJECTED', updated_at = NOW()
    WHERE job_id = p_job_id AND id != p_bid_id AND status = 'PENDING';

    -- 7. Atomic Update: Assign job to the winning worker
    UPDATE public.jobs
    SET status = 'ASSIGNED',
        selected_worker_id = v_bid.worker_id,
        accepted_bid_id = p_bid_id,
        accepted_price_inr = v_bid.offered_amount_inr,
        updated_at = NOW()
    WHERE id = p_job_id;

    RETURN jsonb_build_object(
        'success', true,
        'job_id', p_job_id,
        'bid_id', p_bid_id,
        'worker_id', v_bid.worker_id,
        'accepted_price_inr', v_bid.offered_amount_inr,
        'status', 'ASSIGNED'
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_job_bid TO authenticated;
