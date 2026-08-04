-- ============================================================
-- pay_broadofficer_individual RPC
-- ============================================================
-- Pays a single BroadOfficer from the broadcaster's troll_coins.
-- Atomic: broadcaster is debited and officer is credited together.
-- ============================================================

CREATE OR REPLACE FUNCTION public.pay_broadofficer_individual(
    p_stream_id UUID,
    p_officer_id UUID,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stream RECORD;
    v_officer_id UUID;
    v_broadcaster_balance BIGINT;
    v_officer_balance BIGINT;
BEGIN
    SELECT user_id INTO v_stream.user_id FROM public.streams WHERE id = p_stream_id;
    IF v_stream.user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
    END IF;

    IF auth.uid() != v_stream.user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the stream broadcaster can pay officers');
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    IF p_officer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Officer ID is required');
    END IF;

    SELECT officer_id INTO v_officer_id
    FROM public.broadcast_officers
    WHERE broadcaster_id = v_stream.user_id
      AND stream_id = p_stream_id
      AND officer_id = p_officer_id;

    IF v_officer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Officer not found for this stream');
    END IF;

    UPDATE public.user_profiles SET troll_coins = troll_coins - p_amount WHERE id = v_stream.user_id RETURNING troll_coins INTO v_broadcaster_balance;
    UPDATE public.user_profiles SET troll_coins = troll_coins + p_amount WHERE id = v_officer_id RETURNING troll_coins INTO v_officer_balance;

    BEGIN
      UPDATE public.broadcast_officers
      SET last_paid_at = NOW(),
          total_paid = COALESCE(total_paid, 0) + p_amount
      WHERE broadcaster_id = v_stream.user_id
        AND stream_id = p_stream_id
        AND officer_id = p_officer_id;
    EXCEPTION
      WHEN undefined_column THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'broadcaster_balance', v_broadcaster_balance,
        'officer_balance', v_officer_balance,
        'paid_amount', p_amount
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_broadofficer_individual(UUID, UUID, INTEGER) TO authenticated;
