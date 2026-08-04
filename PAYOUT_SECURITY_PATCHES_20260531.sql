-- ============================================================
-- Mai Troll PAYOUT SECURITY PATCHES (2026-05-31)
-- ============================================================
-- STATUS: PREPARED ONLY — DO NOT RUN WITHOUT APPROVAL
-- These patches address P0/P1 security findings from the payout audit.
-- ============================================================


-- ============================================================
-- P0 FIX 3 — admin_process_payout RPC: add internal admin role check
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_process_payout(
    p_payout_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payout RECORD;
    v_user RECORD;
    v_actor_role TEXT;
    v_actor_is_admin BOOLEAN;
BEGIN
    -- SECURITY: Verify the calling user has an authorized role
    SELECT role, is_admin INTO v_actor_role, v_actor_is_admin
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not authorized');
    END IF;

    IF v_actor_role NOT IN ('admin', 'ceo', 'superadmin', 'lead_troll_officer')
       AND v_actor_is_admin IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'not authorized');
    END IF;

    IF p_admin_id IS NOT NULL AND p_admin_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'admin_id must match authenticated user');
    END IF;

    SELECT * INTO v_payout
    FROM public.payout_requests
    WHERE id = p_payout_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payout request not found.');
    END IF;

    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_payout.user_id;

    IF p_action = 'approve' THEN
        IF v_payout.status NOT IN ('pending', 'reviewed') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payout is not in a reviewable status.');
        END IF;

        UPDATE public.payout_requests
        SET status = 'approved',
            approved_by = auth.uid()::text,
            approved_at = NOW(),
            admin_id = auth.uid(),
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_approved',
            'Cashout Approved',
            format('Your cashout request for $%s has been approved and is being processed.', v_payout.cash_amount),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout approved.');

    ELSIF p_action = 'pay' THEN
        IF v_payout.status != 'approved' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payout must be approved before marking as paid.');
        END IF;

        UPDATE public.payout_requests
        SET status = 'paid',
            paid_at = NOW(),
            processed_at = NOW(),
            processed_by = auth.uid(),
            payment_reference = COALESCE(p_payment_reference, payment_reference),
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        UPDATE public.user_profiles
        SET cashout_reserved_coins = GREATEST(0, COALESCE(cashout_reserved_coins, 0) - v_payout.coin_amount),
            updated_at = NOW()
        WHERE id = v_payout.user_id;

        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_paid',
            'Cashout Paid! 💰',
            format('Your cashout of $%s has been sent via %s to %s.', v_payout.cash_amount, v_payout.provider_type, v_payout.provider_username),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout marked as paid.');

    ELSIF p_action = 'reject' THEN
        IF v_payout.status NOT IN ('pending', 'reviewed', 'approved') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cannot reject payout in current status.');
        END IF;

        UPDATE public.user_profiles
        SET cashout_reserved_coins = GREATEST(0, COALESCE(cashout_reserved_coins, 0) - v_payout.coin_amount),
            cashout_coins = COALESCE(cashout_coins, 0) + v_payout.coin_amount,
            updated_at = NOW()
        WHERE id = v_payout.user_id;

        UPDATE public.payout_requests
        SET status = 'rejected',
            rejection_reason = COALESCE(p_rejection_reason, 'Rejected by admin.'),
            processed_at = NOW(),
            processed_by = auth.uid(),
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_rejected',
            'Cashout Rejected',
            format('Your cashout request was rejected. Reason: %s. Your coins have been returned to your balance.', COALESCE(p_rejection_reason, 'No reason provided.')),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout rejected and coins returned.');

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use approve, pay, or reject.');
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_process_payout(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_payout(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;


-- ============================================================
-- P0 FIX 4 — payout_requests RLS: protect sensitive fields
-- ============================================================

DROP POLICY IF EXISTS "users update own payouts" ON public.payout_requests;
DROP POLICY IF EXISTS "auth_update_own" ON public.payout_requests;

CREATE POLICY "users update own payout method only"
ON public.payout_requests
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND coin_amount IS NOT DISTINCT FROM (SELECT pr.coin_amount FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND cash_amount IS NOT DISTINCT FROM (SELECT pr.cash_amount FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND requested_coins IS NOT DISTINCT FROM (SELECT pr.requested_coins FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND coins_redeemed IS NOT DISTINCT FROM (SELECT pr.coins_redeemed FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND coins_used IS NOT DISTINCT FROM (SELECT pr.coins_used FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND amount_usd IS NOT DISTINCT FROM (SELECT pr.amount_usd FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND payment_reference IS NOT DISTINCT FROM (SELECT pr.payment_reference FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND notes IS NOT DISTINCT FROM (SELECT pr.notes FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND approved_by IS NOT DISTINCT FROM (SELECT pr.approved_by FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND approved_at IS NOT DISTINCT FROM (SELECT pr.approved_at FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND processed_by IS NOT DISTINCT FROM (SELECT pr.processed_by FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND processed_at IS NOT DISTINCT FROM (SELECT pr.processed_at FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND paid_at IS NOT DISTINCT FROM (SELECT pr.paid_at FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND rejection_reason IS NOT DISTINCT FROM (SELECT pr.rejection_reason FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND is_sent IS NOT DISTINCT FROM (SELECT pr.is_sent FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND paypal_payout_id IS NOT DISTINCT FROM (SELECT pr.paypal_payout_id FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND paypal_batch_id IS NOT DISTINCT FROM (SELECT pr.paypal_batch_id FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND paypal_batch_status IS NOT DISTINCT FROM (SELECT pr.paypal_batch_status FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND paypal_sender_batch_id IS NOT DISTINCT FROM (SELECT pr.paypal_sender_batch_id FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND paypal_email IS NOT DISTINCT FROM (SELECT pr.paypal_email FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND net_amount IS NOT DISTINCT FROM (SELECT pr.net_amount FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND receipt_url IS NOT DISTINCT FROM (SELECT pr.receipt_url FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND idempotency_key IS NOT DISTINCT FROM (SELECT pr.idempotency_key FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND admin_id IS NOT DISTINCT FROM (SELECT pr.admin_id FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND coins_reserved IS NOT DISTINCT FROM (SELECT pr.coins_reserved FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND processing_fee IS NOT DISTINCT FROM (SELECT pr.processing_fee FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
    AND currency IS NOT DISTINCT FROM (SELECT pr.currency FROM public.payout_requests pr WHERE pr.id = payout_requests.id)
);


-- ============================================================
-- P1 FIX 5 — verification_docs storage policies
-- ============================================================

CREATE POLICY "Users can upload own verification docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'verification_docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own verification docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'verification_docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own verification docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'verification_docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can read all verification docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'verification_docs'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role IN ('admin', 'ceo', 'superadmin', 'lead_troll_officer', 'secretary') OR is_admin = true)
    )
);

CREATE POLICY "Service role full access to verification docs"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'verification_docs')
WITH CHECK (bucket_id = 'verification_docs');
