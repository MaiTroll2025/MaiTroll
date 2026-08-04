-- FIX AND DEBUG GIFT SYSTEM
-- This migration redefines send_premium_gift to ensure atomic updates and provide debug info.

-- Drop potential conflicting signatures to ensure we use this one
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, numeric, integer);

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
    v_actual_cost NUMERIC;
    v_sender_balance NUMERIC;
    v_new_sender_balance NUMERIC;
    v_receiver_credit NUMERIC;
    v_receiver_new_balance NUMERIC;
    v_cashback NUMERIC := 0;
    v_bonus_cashback NUMERIC := 0;
    v_total_cashback NUMERIC := 0;
    v_rgb_awarded BOOLEAN := false;
    v_gold_awarded BOOLEAN := false;
    v_debug_info JSONB;
BEGIN
    -- 0. Force bypass of any trigger-based coin protection
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 1. Input Validation
    IF p_quantity IS NULL OR p_quantity < 1 THEN
        p_quantity := 1;
    END IF;
    
    v_actual_cost := p_cost * p_quantity;

    -- 2. Check Sender Balance & Lock Row
    SELECT troll_coins INTO v_sender_balance
    FROM public.user_profiles
    WHERE id = p_sender_id
    FOR UPDATE;

    IF v_sender_balance IS NULL OR v_sender_balance < v_actual_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Insufficient funds', 
            'current_balance', v_sender_balance,
            'required', v_actual_cost
        );
    END IF;

    -- 3. Deduct from Sender
    -- We do this DIRECTLY here to ensure atomicity and avoid cross-function confusion
    v_new_sender_balance := v_sender_balance - v_actual_cost;
    
    UPDATE public.user_profiles
    SET troll_coins = v_new_sender_balance
    WHERE id = p_sender_id;

    -- 4. Log Sender Transaction
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
    VALUES (
        p_sender_id, 
        -v_actual_cost, 
        'paid', 
        'gift_sent', 
        p_gift_id, 
        jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'quantity', p_quantity), 
        'out'
    );

    -- 5. Calculate Receiver Credit (95%)
    v_receiver_credit := FLOOR(v_actual_cost * 0.95);

    -- 6. Credit Receiver
    IF v_receiver_credit > 0 THEN
        UPDATE public.user_profiles 
        SET 
            troll_coins = COALESCE(troll_coins, 0) + v_receiver_credit,
            total_earned_coins = COALESCE(total_earned_coins, 0) + v_receiver_credit
        WHERE id = p_receiver_id
        RETURNING troll_coins INTO v_receiver_new_balance;
        
        -- Log Receiver Transaction
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (
            p_receiver_id, 
            v_receiver_credit, 
            'earned', 
            'gift_received', 
            p_gift_id, 
            jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id), 
            'in'
        );
        
        -- Update Broadcaster Stats (Leaderboard)
        INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
        VALUES (p_receiver_id, v_actual_cost, v_actual_cost, now())
        ON CONFLICT (user_id) DO UPDATE SET
            total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
            total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
            last_updated_at = now();
    END IF;

    -- 7. Logic for Cashback/RGB/Gold
    -- Random Cashback 1-50
    v_cashback := floor(random() * 50 + 1);
    
    -- Tier IV/V Bonus (Cost > 10000)
    IF v_actual_cost >= 10000 THEN
        v_bonus_cashback := FLOOR(v_actual_cost * 0.05);
        v_rgb_awarded := true;
        -- Update RGB Expiry
         UPDATE public.user_profiles
         SET rgb_username_expires_at = GREATEST(now(), COALESCE(rgb_username_expires_at, now())) + INTERVAL '30 days'
         WHERE id = p_sender_id;
    END IF;
    
    -- Gold Trigger
    IF v_actual_cost = 1000000 THEN
        v_gold_awarded := true;
        UPDATE public.user_profiles SET is_gold = TRUE, gold_granted_at = now() WHERE id = p_sender_id;
    END IF;

    v_total_cashback := v_cashback + v_bonus_cashback;
    
    -- Apply Cashback
    IF v_total_cashback > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_total_cashback
        WHERE id = p_sender_id
        RETURNING troll_coins INTO v_new_sender_balance; -- Update final balance
        
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, direction)
        VALUES (p_sender_id, v_total_cashback, 'bonus', 'gift_cashback', p_gift_id, 'in');
    END IF;

    -- 8. Return Success with Debug Info
    v_debug_info := jsonb_build_object(
        'sender_start', v_sender_balance,
        'cost', v_actual_cost,
        'sender_end', v_new_sender_balance,
        'receiver_credit', v_receiver_credit,
        'receiver_new_balance', v_receiver_new_balance,
        'cashback', v_total_cashback
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_sender_balance,
        'cashback', v_total_cashback,
        'rgb_awarded', v_rgb_awarded,
        'gold_awarded', v_gold_awarded,
        'debug', v_debug_info
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'message', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_premium_gift(UUID, UUID, UUID, TEXT, NUMERIC, INTEGER) TO authenticated;
