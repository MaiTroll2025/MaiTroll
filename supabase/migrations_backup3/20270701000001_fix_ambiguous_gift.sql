-- FIX AMBIGUOUS FUNCTION OVERLOADS
-- Drops all possible variations of send_premium_gift to resolve PGRST203

-- Drop known variations
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, numeric, integer);
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.send_premium_gift(uuid, uuid, uuid, text, integer, numeric);

-- Re-create the function with comprehensive logging and locking (Same as v2)
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
    v_actual_sender_id UUID;
    v_sender_balance NUMERIC;
    v_new_sender_balance NUMERIC;
    v_receiver_credit NUMERIC;
    v_cashback NUMERIC := 0;
    v_bonus_cashback NUMERIC := 0;
    v_total_cashback NUMERIC := 0;
    v_total_cost NUMERIC;
    v_rgb_awarded BOOLEAN := false;
    v_gold_awarded BOOLEAN := false;
    v_debug_logs JSONB[] := ARRAY[]::JSONB[];
BEGIN
    -- 1. Security Check
    v_actual_sender_id := auth.uid();
    IF v_actual_sender_id IS NOT NULL AND v_actual_sender_id != p_sender_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Sender mismatch');
    END IF;
    
    -- Service role fallback
    IF v_actual_sender_id IS NULL THEN v_actual_sender_id := p_sender_id; END IF;

    -- 2. Calculate Totals
    IF p_quantity IS NULL OR p_quantity < 1 THEN p_quantity := 1; END IF;
    v_total_cost := p_cost * p_quantity;

    v_debug_logs := array_append(v_debug_logs, jsonb_build_object('step', 'init', 'sender', p_sender_id, 'cost', v_total_cost));

    -- 3. Lock Sender Row & Check Balance
    -- CRITICAL: FOR UPDATE prevents race conditions (double spending)
    SELECT troll_coins INTO v_sender_balance
    FROM public.user_profiles
    WHERE id = p_sender_id
    FOR UPDATE;

    IF v_sender_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sender profile not found');
    END IF;

    v_debug_logs := array_append(v_debug_logs, jsonb_build_object('step', 'balance_check', 'balance', v_sender_balance));

    IF v_sender_balance < v_total_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Insufficient funds',
            'required', v_total_cost,
            'available', v_sender_balance
        );
    END IF;

    -- 4. Calculate Bonuses (Tier IV/V & Cashback)
    -- Random Cashback 1-50 coins (per transaction, not per item, to keep it simple/safe)
    v_cashback := floor(random() * 50 + 1);

    -- Tier IV/V Bonus (Cost > 10000)
    IF v_total_cost >= 10000 THEN
        v_bonus_cashback := FLOOR(v_total_cost * 0.05);
        v_rgb_awarded := true;
        -- Update RGB Expiry
        UPDATE public.user_profiles
        SET rgb_username_expires_at = GREATEST(now(), COALESCE(rgb_username_expires_at, now())) + INTERVAL '30 days'
        WHERE id = p_sender_id;
    END IF;

    -- Gold Trigger (Exact 1M)
    IF v_total_cost = 1000000 THEN
        v_gold_awarded := true;
        UPDATE public.user_profiles
        SET is_gold = TRUE, gold_granted_at = now()
        WHERE id = p_sender_id;
    END IF;

    v_total_cashback := v_cashback + v_bonus_cashback;

    -- 5. Deduct from Sender
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_total_cost + v_total_cashback
    WHERE id = p_sender_id
    RETURNING troll_coins INTO v_new_sender_balance;

    -- Log Sender Transaction
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
    VALUES (
        p_sender_id, 
        -(v_total_cost - v_total_cashback), -- Net change
        'paid', 
        'gift_sent', 
        p_gift_id, 
        jsonb_build_object('receiver_id', p_receiver_id, 'cashback', v_total_cashback, 'quantity', p_quantity), 
        'out'
    );

    -- 6. Credit Receiver (95%)
    v_receiver_credit := FLOOR(v_total_cost * 0.95);
    
    IF v_receiver_credit > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_receiver_credit,
            total_earned_coins = COALESCE(total_earned_coins, 0) + v_receiver_credit,
            updated_at = now()  -- IMPORTANT: Trigger real-time updates
        WHERE id = p_receiver_id;

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
        
        -- Update Broadcaster Stats
        INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
        VALUES (p_receiver_id, v_total_cost, v_total_cost, now())
        ON CONFLICT (user_id) DO UPDATE SET
            total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
            total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
            last_updated_at = now();
    END IF;

    -- 7. Insert into stream_messages (System Message)
    IF p_stream_id IS NOT NULL THEN
        INSERT INTO public.stream_messages (stream_id, user_id, content, type)
        VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || p_gift_id || ':' || v_total_cost, 'system');
    END IF;

    -- 8. Log to Gift Ledger
    INSERT INTO public.gift_ledger (
        sender_id, receiver_id, stream_id, gift_id, amount, quantity, metadata, status, processed_at
    ) VALUES (
        p_sender_id, 
        p_receiver_id, 
        p_stream_id, 
        p_gift_id, 
        v_total_cost, 
        p_quantity, 
        jsonb_build_object('source', 'send_premium_gift_v2', 'debug', v_debug_logs), 
        'processed', 
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_sender_balance,
        'cashback', v_total_cashback,
        'rgb_awarded', v_rgb_awarded,
        'gold_awarded', v_gold_awarded,
        'debug', v_debug_logs
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_premium_gift(UUID, UUID, UUID, TEXT, NUMERIC, INTEGER) TO authenticated;
