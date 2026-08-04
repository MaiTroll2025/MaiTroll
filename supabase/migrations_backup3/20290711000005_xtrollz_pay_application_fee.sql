-- ============================================================
-- XTROLLZ APPLICATION FEE PAYMENT RPC
-- Fix: use troll_bank_spend_coins (which sets app.bypass_coin_protection)
-- instead of directly updating user_profiles.troll_coins, which is
-- blocked by the protect_sensitive_columns trigger.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.xtrollz_pay_application_fee(
    p_application_id uuid,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application public.xtrollz_applications%ROWTYPE;
    v_spend_result jsonb;
BEGIN
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    IF p_user_id <> auth.uid() AND NOT public.is_staff() THEN
        RAISE EXCEPTION 'Unauthorized: can only pay for your own application'
        USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_application
    FROM public.xtrollz_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application not found');
    END IF;

    IF v_application.user_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application does not belong to user');
    END IF;

    IF v_application.payment_status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application already paid');
    END IF;

    IF v_application.status NOT IN ('draft', 'payment_pending', 'payment_failed') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application is not in a payable state');
    END IF;

    v_spend_result := public.troll_bank_spend_coins(
        p_user_id => p_user_id,
        p_amount => 100,
        p_bucket => 'paid',
        p_source => 'xtrollz_application_fee',
        p_ref_id => p_application_id,
        p_metadata => jsonb_build_object('application_id', p_application_id)
    );

    IF NOT (v_spend_result->>'success')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', COALESCE(v_spend_result->>'error', 'Insufficient balance'),
            'amount_deducted', 0
        );
    END IF;

    UPDATE public.xtrollz_applications
    SET
        status = 'submitted',
        payment_status = 'completed',
        payment_amount = 100,
        payment_currency = 'TC',
        payment_timestamp = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Application fee paid successfully',
        'application_id', p_application_id,
        'amount_deducted', 100,
        'new_balance', (v_spend_result->>'new_balance')::numeric,
        'status', 'completed'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_pay_application_fee(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_pay_application_fee(uuid, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
