-- Fix: Credit broadcaster in join_stream_box and process_stream_billing
-- join_stream_box: flat fee deducts from guest but never credited broadcaster
-- process_stream_billing: per-minute guest fee deducts from guest but never credited broadcaster

-- 1. Fix join_stream_box: credit broadcaster on flat fee
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
  v_broadcaster_id UUID;
BEGIN
  -- Check if user is banned from this stream
  IF EXISTS (
    SELECT 1 FROM public.stream_bans
    WHERE stream_id = p_stream_id
    AND user_id = p_user_id
    AND expires_at > NOW()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are banned from this stream');
  END IF;

  -- Get stream details
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Stream not found'); END IF;

  v_box_price := COALESCE(v_stream.box_price_amount, 0);
  v_price_type := COALESCE(v_stream.box_price_type, 'per_minute');
  v_broadcaster_id := v_stream.user_id;

  -- Check user balance
  SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;

  IF v_user_balance < v_box_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins to join box');
  END IF;

  -- If flat fee, charge immediately and CREDIT BROADCASTER
  IF v_box_price > 0 AND v_price_type = 'flat' THEN
    -- Deduct from Guest
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_box_price,
        total_spent_coins = COALESCE(total_spent_coins, 0) + v_box_price
    WHERE id = p_user_id;

    -- Credit Broadcaster
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_box_price
    WHERE id = v_broadcaster_id;

    -- Transaction Logs
    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES
    (p_user_id, -v_box_price, 'guest_box_fee', 'Joined Guest Box (Flat Fee)', json_build_object('stream_id', p_stream_id, 'recipient', v_broadcaster_id)),
    (v_broadcaster_id, v_box_price, 'guest_box_income', 'Guest Joined Box', json_build_object('stream_id', p_stream_id, 'sender', p_user_id));
  END IF;

  -- Add to stream_guests
  INSERT INTO public.stream_guests (stream_id, user_id, status, last_billed_at)
  VALUES (p_stream_id, p_user_id, 'active', NOW())
  ON CONFLICT (stream_id, user_id)
  DO UPDATE SET status = 'active', joined_at = NOW(), last_billed_at = NOW();

  RETURN json_build_object('success', true);
END;
$$;

-- 2. Fix process_stream_billing: credit broadcaster on per-minute guest fees
CREATE OR REPLACE FUNCTION public.process_stream_billing(
  p_stream_id UUID,
  p_user_id UUID,
  p_is_host BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_profile RECORD;
  v_cost NUMERIC(20, 2);
  v_guest RECORD;
  v_broadcaster_id UUID;
BEGIN
  -- Check if stream exists and is active
  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF NOT FOUND OR v_stream.is_live = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found or not active');
  END IF;

  v_broadcaster_id := v_stream.user_id;

  -- Get user profile
  SELECT * INTO v_user_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- A. Broadcaster Billing (0.5 coins/min) - NO EXEMPTIONS
  IF p_is_host THEN
    v_cost := 0.5;

    IF v_cost > 0 THEN
        -- Check balance
        IF v_user_profile.troll_coins < v_cost THEN
           -- End stream if insufficient funds
           UPDATE public.streams
           SET is_live = false, ended_at = NOW()
           WHERE id = p_stream_id;

           RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'end_stream');
        END IF;

        -- Deduct coins
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_cost,
            total_spent_coins = total_spent_coins + v_cost
        WHERE id = p_user_id;

        -- Record transaction
        INSERT INTO public.coin_transactions (
          user_id, amount, type, description, stream_id
        ) VALUES (
          p_user_id, -v_cost, 'stream_cost', 'Broadcasting fee (1 min)', p_stream_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  -- B. Guest Billing (0.5 coins/min) - NO EXEMPTIONS
  SELECT * INTO v_guest
  FROM public.stream_guests
  WHERE stream_id = p_stream_id AND user_id = p_user_id AND status = 'active';

  IF FOUND THEN
      v_cost := 0.5;

      IF v_cost > 0 THEN
          IF v_user_profile.troll_coins < v_cost THEN
            -- Remove guest
            UPDATE public.stream_guests
            SET status = 'removed', left_at = NOW()
            WHERE stream_id = p_stream_id AND user_id = p_user_id;

            RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'remove_guest');
          END IF;

          -- Deduct coins from guest
          UPDATE public.user_profiles
          SET troll_coins = troll_coins - v_cost,
              total_spent_coins = total_spent_coins + v_cost
          WHERE id = p_user_id;

          -- Credit broadcaster
          UPDATE public.user_profiles
          SET troll_coins = troll_coins + v_cost
          WHERE id = v_broadcaster_id;

          -- Record transactions for guest (debit) and broadcaster (credit)
          INSERT INTO public.coin_transactions (user_id, amount, type, description, stream_id)
          VALUES
            (p_user_id, -v_cost, 'stream_cost', 'Guest participation fee (1 min)', p_stream_id),
            (v_broadcaster_id, v_cost, 'guest_box_income', 'Guest participation fee (1 min)', p_stream_id);
      END IF;

      RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'User not associated with stream billing');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.join_stream_box(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_stream_box(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_stream_billing(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_stream_billing(UUID, UUID, BOOLEAN) TO service_role;
