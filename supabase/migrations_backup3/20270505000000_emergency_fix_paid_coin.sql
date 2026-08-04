
-- Emergency Fix for Paid Coins and Gifting Logic
-- Replaces send_gift_ledger to be synchronous and matches the client RPC signature

CREATE OR REPLACE FUNCTION public.send_gift_ledger(
    p_receiver_id UUID,
    p_gift_id TEXT,
    p_amount INTEGER,
    p_stream_id UUID DEFAULT NULL,
    p_quantity INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_id UUID;
    v_total_cost BIGINT;
    v_sender_balance BIGINT;
    v_receiver_balance BIGINT;
    v_gift_name TEXT;
    v_gift_uuid UUID;
    v_transaction_id UUID;
BEGIN
    -- Get Sender ID
    v_sender_id := auth.uid();
    IF v_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Calculate total cost
    v_total_cost := (p_amount * p_quantity)::BIGINT;

    -- Check sender balance (using troll_coins)
    SELECT troll_coins INTO v_sender_balance
    FROM public.user_profiles
    WHERE id = v_sender_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
    END IF;

    IF v_sender_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Prevent self-gifting
    IF v_sender_id = p_receiver_id THEN
         RETURN jsonb_build_object('success', false, 'error', 'Cannot gift yourself');
    END IF;

    -- Bypass triggers that might block coin updates (Crucial for Admin/System updates)
    PERFORM set_config('app.bypass_coin_protection', 'on', true);

    -- Deduct from sender immediately
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_total_cost
    WHERE id = v_sender_id;

    -- Add to receiver immediately
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_total_cost
    WHERE id = p_receiver_id;

    -- Log transaction for Sender
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        v_sender_id,
        -v_total_cost,
        'gift_sent',
        COALESCE(p_metadata->>'gift_name', 'Gift') || ' x' || p_quantity,
        p_metadata || jsonb_build_object(
            'processed', true,
            'receiver_id', p_receiver_id,
            'stream_id', p_stream_id,
            'gift_id', p_gift_id
        ),
        NOW()
    ) RETURNING id INTO v_transaction_id;

    -- Log transaction for Receiver
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        p_receiver_id,
        v_total_cost,
        'gift_received',
        COALESCE(p_metadata->>'gift_name', 'Gift') || ' x' || p_quantity,
        p_metadata || jsonb_build_object(
            'processed', true,
            'sender_id', v_sender_id,
            'stream_id', p_stream_id,
            'gift_id', p_gift_id
        ),
        NOW()
    );

    -- Also insert into gift_ledger for history/analytics (but mark as processed)
    -- This ensures compatibility with any stats processors that read the ledger
    INSERT INTO public.gift_ledger (
        sender_id,
        receiver_id,
        stream_id,
        gift_id,
        amount,
        quantity,
        metadata,
        status,
        idempotency_key,
        processed_at
    ) VALUES (
        v_sender_id,
        p_receiver_id,
        p_stream_id,
        p_gift_id,
        p_amount,
        p_quantity,
        p_metadata,
        'processed', -- Already applied
        p_idempotency_key,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_sender_balance - v_total_cost,
        'transaction_id', v_transaction_id,
        'message', 'Gift sent successfully'
    );
EXCEPTION WHEN OTHERS THEN
    -- In case of any error, we should probably rollback, but Postgres does that automatically for the transaction
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
