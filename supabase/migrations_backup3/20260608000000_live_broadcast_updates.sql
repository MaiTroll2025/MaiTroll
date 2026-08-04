-- Migration: Live Broadcast System Updates
-- 1. Update default starter coins to 100
ALTER TABLE public.user_profiles 
ALTER COLUMN troll_coins SET DEFAULT 100;

-- 2. Add Box Pricing to Streams
ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS box_price_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS box_price_type TEXT DEFAULT 'per_minute' CHECK (box_price_type IN ('per_minute', 'flat'));

-- 3. Create Stream Guests table for tracking and billing
CREATE TABLE IF NOT EXISTS public.stream_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_billed_at TIMESTAMPTZ DEFAULT NOW(),
  total_paid INTEGER DEFAULT 0,
  UNIQUE(stream_id, user_id)
);

-- 4. Update Coin Transaction Types
-- We recreate the constraint to include new types and remove 'wheel_spin' if possible (or keep for legacy data safety).
-- To be safe, we will include 'wheel_spin' to prevent data loss but add the new required types.
DO $$
BEGIN
  ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
  
  ALTER TABLE public.coin_transactions
  ADD CONSTRAINT coin_transactions_type_check
  CHECK (type IN (
    'store_purchase',
    'purchase', -- Legacy
    'gift_sent',
    'gift_received',
    'cashout',
    'admin_grant',
    'admin_deduct',
    'admin_adjustment',
    'insurance_purchase',
    'entrance_effect',
    'perk_purchase',
    'refund',
    'reward',
    'lucky_gift_win',
    'troll_town_purchase',
    'troll_town_sale',
    'troll_town_upgrade',
    'broadcast_cost', -- NEW
    'guest_box_fee',   -- NEW
    'wheel_spin',     -- Kept for legacy data compatibility
    'cashout_request' -- Added from previous step
  ));
END $$;

-- 5. RPC: Join Stream Box (Billing & Entry)
CREATE OR REPLACE FUNCTION public.join_stream_box(
  p_stream_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_balance INT;
  v_box_price INT;
  v_price_type TEXT;
BEGIN
  -- Get stream details
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Stream not found'); END IF;

  v_box_price := COALESCE(v_stream.box_price_amount, 0);
  v_price_type := COALESCE(v_stream.box_price_type, 'per_minute');

  -- Check user balance
  SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
  
  IF v_user_balance < v_box_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins to join box');
  END IF;

  -- If flat fee, charge immediately
  IF v_box_price > 0 AND v_price_type = 'flat' THEN
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_box_price,
        total_spent_coins = COALESCE(total_spent_coins, 0) + v_box_price
    WHERE id = p_user_id;

    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (p_user_id, -v_box_price, 'guest_box_fee', 'Joined Guest Box (Flat Fee)', json_build_object('stream_id', p_stream_id));
  END IF;

  -- Add to stream_guests
  INSERT INTO public.stream_guests (stream_id, user_id, status, last_billed_at)
  VALUES (p_stream_id, p_user_id, 'active', NOW())
  ON CONFLICT (stream_id, user_id) 
  DO UPDATE SET status = 'active', joined_at = NOW(), last_billed_at = NOW();

  RETURN json_build_object('success', true);
END;
$$;

-- 6. RPC: Process Stream Billing (Heartbeat)
-- Called every minute by client (or server job). Handles Broadcaster + Guests.
CREATE OR REPLACE FUNCTION public.process_stream_billing(
  p_stream_id UUID,
  p_user_id UUID, -- The user calling this (could be host or guest)
  p_is_host BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_profile RECORD;
  v_cost INT;
  v_guest RECORD;
BEGIN
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  IF NOT FOUND OR v_stream.is_live = false THEN
    RETURN json_build_object('status', 'stop', 'reason', 'Stream ended');
  END IF;

  SELECT * INTO v_user_profile FROM public.user_profiles WHERE id = p_user_id;

  -- A. Broadcaster Billing (2 coins/min)
  IF p_is_host THEN
    -- Exempt roles check
    IF v_user_profile.role IN ('admin', 'secretary', 'lead_troll_officer') THEN
      RETURN json_build_object('status', 'ok', 'exempt', true);
    END IF;

    v_cost := 2;
    
    IF v_user_profile.troll_coins < v_cost THEN
      -- End stream logic could be triggered here or by client
      RETURN json_build_object('status', 'stop', 'reason', 'Insufficient funds');
    END IF;

    -- Deduct
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_cost,
        total_spent_coins = COALESCE(total_spent_coins, 0) + v_cost
    WHERE id = p_user_id;

    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (p_user_id, -v_cost, 'broadcast_cost', 'Broadcasting Cost (1 min)', json_build_object('stream_id', p_stream_id));

    RETURN json_build_object('status', 'ok', 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  -- B. Guest Billing (Box Price)
  IF NOT p_is_host THEN
    SELECT * INTO v_guest FROM public.stream_guests 
    WHERE stream_id = p_stream_id AND user_id = p_user_id AND status = 'active';

    IF NOT FOUND THEN
      RETURN json_build_object('status', 'stop', 'reason', 'Not in box');
    END IF;

    -- Check pricing type
    IF v_stream.box_price_type = 'per_minute' AND v_stream.box_price_amount > 0 THEN
      -- Check if enough time passed? For now, we assume client calls this ~60s. 
      -- To be robust, we should check `last_billed_at`.
      IF NOW() < v_guest.last_billed_at + interval '50 seconds' THEN
         RETURN json_build_object('status', 'ok', 'message', 'Too early');
      END IF;

      v_cost := v_stream.box_price_amount;

      IF v_user_profile.troll_coins < v_cost THEN
        UPDATE public.stream_guests SET status = 'removed' WHERE id = v_guest.id;
        RETURN json_build_object('status', 'stop', 'reason', 'Insufficient funds');
      END IF;

      -- Deduct
      UPDATE public.user_profiles 
      SET troll_coins = troll_coins - v_cost,
          total_spent_coins = COALESCE(total_spent_coins, 0) + v_cost
      WHERE id = p_user_id;

      INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
      VALUES (p_user_id, -v_cost, 'guest_box_fee', 'Guest Box Fee (1 min)', json_build_object('stream_id', p_stream_id));

      UPDATE public.stream_guests 
      SET last_billed_at = NOW(), total_paid = total_paid + v_cost 
      WHERE id = v_guest.id;

      RETURN json_build_object('status', 'ok', 'remaining', v_user_profile.troll_coins - v_cost);
    END IF;

    RETURN json_build_object('status', 'ok', 'message', 'No per-minute charge');
  END IF;
END;
$$;
