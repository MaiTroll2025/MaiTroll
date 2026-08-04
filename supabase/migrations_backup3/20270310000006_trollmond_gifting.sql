-- Add currency to gift_items table (used by Frontend)
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'troll_coins';
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_type TEXT;

-- Seed Trollmond Gifts into gift_items
-- Use DO block to avoid unique constraint violations if name isn't unique but we want to be safe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.gift_items WHERE name = 'Diamond Ring') THEN
        INSERT INTO public.gift_items (name, value, coin_cost, icon, animation_type, currency, category) VALUES ('Diamond Ring', 10, 10, '💍', 'tier_1', 'trollmonds', 'Luxury');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gift_items WHERE name = 'Briefcase') THEN
        INSERT INTO public.gift_items (name, value, coin_cost, icon, animation_type, currency, category) VALUES ('Briefcase', 50, 50, '💼', 'tier_2', 'trollmonds', 'Luxury');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gift_items WHERE name = 'Luxury Car Key') THEN
        INSERT INTO public.gift_items (name, value, coin_cost, icon, animation_type, currency, category) VALUES ('Luxury Car Key', 100, 100, '🔑', 'tier_2', 'trollmonds', 'Luxury');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gift_items WHERE name = 'Mansion Deed') THEN
        INSERT INTO public.gift_items (name, value, coin_cost, icon, animation_type, currency, category) VALUES ('Mansion Deed', 500, 500, '📜', 'tier_3', 'trollmonds', 'Luxury');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gift_items WHERE name = 'Private Jet') THEN
        INSERT INTO public.gift_items (name, value, coin_cost, icon, animation_type, currency, category) VALUES ('Private Jet', 1000, 1000, '✈️', 'tier_4', 'trollmonds', 'Luxury');
    END IF;
END $$;

-- Create Trollmond Holds table
CREATE TABLE IF NOT EXISTS public.trollmond_holds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    amount INTEGER NOT NULL,
    unlock_at TIMESTAMPTZ NOT NULL,
    source_sender_id UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trollmond_holds_user_unlock ON public.trollmond_holds(user_id, unlock_at);

-- RPC: Send Trollmond Gift
CREATE OR REPLACE FUNCTION public.send_trollmond_gift(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_gift_id UUID,
    p_stream_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost INTEGER;
    v_gift_name TEXT;
    v_sender_balance INTEGER;
    v_sender_created_at TIMESTAMPTZ;
    v_daily_sent INTEGER;
    v_daily_cap INTEGER := 1000; -- Hardcoded cap for now
    v_min_age_days INTEGER := 7;
BEGIN
    -- 1. Validation
    IF p_sender_id = p_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot gift yourself');
    END IF;

    -- Get Gift Info from gift_items (using coin_cost or legacy value as cost)
    SELECT COALESCE(coin_cost, value), name INTO v_cost, v_gift_name FROM public.gift_items WHERE id = p_gift_id AND currency = 'trollmonds';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid Trollmond gift');
    END IF;

    -- Check Sender Balance
    SELECT trollmonds, created_at INTO v_sender_balance, v_sender_created_at FROM public.user_profiles WHERE id = p_sender_id;
    
    -- Default balance to 0 if null
    v_sender_balance := COALESCE(v_sender_balance, 0);
    
    IF v_sender_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Trollmonds');
    END IF;

    -- Check Account Age
    IF now() - v_sender_created_at < (v_min_age_days || ' days')::INTERVAL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Account too new to send Trollmonds');
    END IF;

    -- Check Daily Cap
    -- Calculate sum of gifts sent in last 24h
    -- We look at trollmond_transactions with type 'gift_sent' and negative amount
    SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_daily_sent
    FROM public.trollmond_transactions
    WHERE user_id = p_sender_id 
    AND type = 'gift_sent' 
    AND created_at > now() - INTERVAL '24 hours';

    IF v_daily_sent + v_cost > v_daily_cap THEN
        RETURN jsonb_build_object('success', false, 'message', 'Daily Trollmond gift limit reached (' || v_daily_cap || ' max)');
    END IF;

    -- 2. Execution
    -- Deduct from Sender
    UPDATE public.user_profiles 
    SET trollmonds = trollmonds - v_cost 
    WHERE id = p_sender_id;

    -- Add to Receiver
    UPDATE public.user_profiles 
    SET trollmonds = COALESCE(trollmonds, 0) + v_cost 
    WHERE id = p_receiver_id;

    -- Create Hold (24 hours)
    INSERT INTO public.trollmond_holds (user_id, amount, unlock_at, source_sender_id)
    VALUES (p_receiver_id, v_cost, now() + INTERVAL '24 hours', p_sender_id);

    -- Log Transactions
    INSERT INTO public.trollmond_transactions (user_id, amount, type, source_type, metadata)
    VALUES 
    (p_sender_id, -v_cost, 'gift_sent', 'broadcast_gift', jsonb_build_object('gift_id', p_gift_id, 'receiver_id', p_receiver_id, 'gift_name', v_gift_name, 'amount', v_cost)),
    (p_receiver_id, v_cost, 'gift_received', 'broadcast_gift', jsonb_build_object('gift_id', p_gift_id, 'sender_id', p_sender_id, 'gift_name', v_gift_name, 'amount', v_cost));

    -- Chat Notification
    IF p_stream_id IS NOT NULL THEN
        INSERT INTO public.stream_messages (stream_id, user_id, content, type)
        VALUES (p_stream_id, p_sender_id, 'TROLLMOND_GIFT:' || v_gift_name || ':' || v_cost, 'system');
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_sender_balance - v_cost);
END;
$$;
