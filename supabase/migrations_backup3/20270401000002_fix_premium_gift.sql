-- Update send_premium_gift to support quantity and numeric cost
-- This ensures compatibility with the frontend gift system and large transactions

CREATE OR REPLACE FUNCTION public.send_premium_gift(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_stream_id UUID,
    p_gift_id TEXT,
    p_cost NUMERIC,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_spend_result JSONB;
    v_cashback NUMERIC := 0;
    v_receiver_credit NUMERIC;
    v_sender_balance NUMERIC;
    v_rgb_awarded BOOLEAN := false;
    v_gold_awarded BOOLEAN := false;
    v_total_cost NUMERIC;
BEGIN
    -- Validate Sender
    IF p_sender_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized sender');
    END IF;

    v_total_cost := p_cost * p_quantity;

    -- 1. Deduct from sender
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_sender_id,
        v_total_cost,
        'paid',
        'gift_sent',
        NULL,
        jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'gift_id', p_gift_id, 'quantity', p_quantity)
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    v_sender_balance := (v_spend_result->>'new_balance')::numeric;

    -- 2. Credit Receiver (95%)
    v_receiver_credit := FLOOR(v_total_cost * 0.95);
    IF v_receiver_credit > 0 THEN
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins + v_receiver_credit,
            updated_at = now()  -- IMPORTANT: Trigger real-time updates
        WHERE id = p_receiver_id;
        
        -- Log receiver credit
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_receiver_id, v_receiver_credit, 'earned', 'gift_received', NULL, jsonb_build_object('sender_id', p_sender_id, 'gift_id', p_gift_id), 'in');
    END IF;

    -- 3. Cashback Chance (10% chance to get 5% back)
    IF random() < 0.10 THEN
        v_cashback := FLOOR(v_total_cost * 0.05);
        IF v_cashback > 0 THEN
            UPDATE public.user_profiles 
            SET troll_coins = troll_coins + v_cashback,
                updated_at = now()  -- IMPORTANT: Trigger real-time updates
            WHERE id = p_sender_id;
            
            v_sender_balance := v_sender_balance + v_cashback;
            
            INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, direction)
            VALUES (p_sender_id, v_cashback, 'bonus', 'gift_cashback', NULL, 'in');
        END IF;
    END IF;

    -- 4. Log to Gift Ledger (for analytics/history)
    -- Using safe cast or 0 if null
    INSERT INTO public.gift_ledger (
        sender_id, receiver_id, stream_id, gift_id, amount, quantity, metadata, status, processed_at
    ) VALUES (
        p_sender_id, 
        p_receiver_id, 
        p_stream_id, 
        p_gift_id, 
        COALESCE(p_cost::integer, 0), 
        p_quantity, 
        jsonb_build_object('source', 'send_premium_gift'), 
        'processed', 
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_sender_balance,
        'cashback', v_cashback,
        'rgb_awarded', v_rgb_awarded,
        'gold_awarded', v_gold_awarded
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_premium_gift(UUID, UUID, UUID, TEXT, NUMERIC, INTEGER) TO authenticated;
