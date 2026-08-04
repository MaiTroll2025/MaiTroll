CREATE OR REPLACE FUNCTION public.try_pay_coins_secure(
    p_amount BIGINT,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_balance BIGINT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    SELECT troll_coins INTO v_balance
    FROM public.user_profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = v_user_id;

    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (v_user_id, -p_amount, 'paid', p_reason, p_reason, p_metadata);

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_pay_coins_secure(BIGINT, TEXT, JSONB) TO authenticated;