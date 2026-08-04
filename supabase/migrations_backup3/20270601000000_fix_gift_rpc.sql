-- Fix trigger to accept both 'true' and 'on'
CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bypass text;
BEGIN
    -- Allow service_role or superusers to bypass
    IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
        RETURN NEW;
    END IF;
    
    v_bypass := current_setting('app.bypass_coin_protection', true);

    -- Check for sensitive column changes in user_profiles
    IF TG_TABLE_NAME = 'user_profiles' THEN
        -- Prevent role escalation
        IF NEW.role IS DISTINCT FROM OLD.role THEN
             IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: role';
            END IF;
        END IF;
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: is_admin';
            END IF;
        END IF;
        IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
            IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
            END IF;
        END IF;
        
        -- Prevent currency manipulation
        IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
            IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
            END IF;
        END IF;

        IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
            IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
            END IF;
        END IF;
        
        -- Prevent leveling cheating
        IF NEW.level IS DISTINCT FROM OLD.level THEN
            IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: level';
            END IF;
        END IF;
        IF NEW.xp IS DISTINCT FROM OLD.xp THEN
             IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: xp';
            END IF;
        END IF;
    END IF;

    -- Check for sensitive column changes in streams
    IF TG_TABLE_NAME = 'streams' THEN
        -- Prevent faking live status
        IF NEW.is_live IS DISTINCT FROM OLD.is_live THEN
            -- Allow ending stream (true -> false), but prevent starting manually (false -> true)
            IF NEW.is_live = true THEN
                 IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                    RAISE EXCEPTION 'Cannot update restricted column: is_live. Use the broadcast setup flow.';
                 END IF;
            END IF;
        END IF;
        
        IF NEW.status IS DISTINCT FROM OLD.status THEN
             IF NEW.status = 'live' AND OLD.status != 'live' THEN
                 IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                     RAISE EXCEPTION 'Cannot manually set status to live';
                 END IF;
             END IF;
        END IF;
        
        -- Prevent faking viewers
        IF NEW.current_viewers IS DISTINCT FROM OLD.current_viewers THEN
             IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                 RAISE EXCEPTION 'Cannot update restricted column: current_viewers';
             END IF;
        END IF;

        -- Prevent HLS injection
        IF NEW.hls_url IS DISTINCT FROM OLD.hls_url THEN
            IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: hls_url';
            END IF;
        END IF;
        IF NEW.hls_path IS DISTINCT FROM OLD.hls_path THEN
            IF v_bypass IS DISTINCT FROM 'true' AND v_bypass IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Cannot update restricted column: hls_path';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Redefine send_premium_gift
CREATE OR REPLACE FUNCTION public.send_premium_gift(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT, 
  p_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actual_sender_id UUID;
  v_sender_balance BIGINT;
  v_receiver_exists BOOLEAN;
  v_cashback INTEGER;
  v_bonus_cashback INTEGER := 0;
  v_total_cashback INTEGER;
  v_is_tier_iv_v BOOLEAN := FALSE;
  v_is_gold_trigger BOOLEAN := FALSE;
  v_new_sender_balance BIGINT;
BEGIN
  -- 1. Security & Input Validation
  v_actual_sender_id := auth.uid();
  
  IF v_actual_sender_id IS NOT NULL AND v_actual_sender_id != p_sender_id THEN
      RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Cannot send gift as another user');
  END IF;

  IF v_actual_sender_id IS NULL THEN
      v_actual_sender_id := p_sender_id;
  END IF;

  IF v_actual_sender_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Sender ID is required');
  END IF;

  IF p_receiver_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Receiver ID is required');
  END IF;

  IF p_cost <= 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Invalid cost');
  END IF;

  -- Set bypass flag for coin updates (Using 'true' to be safe)
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- 2. Check Balance
  SELECT troll_coins INTO v_sender_balance FROM user_profiles WHERE id = v_actual_sender_id FOR UPDATE;
  
  IF v_sender_balance IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Sender profile not found');
  END IF;

  IF v_sender_balance < p_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- Verify receiver exists
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_receiver_id) INTO v_receiver_exists;
  IF NOT v_receiver_exists THEN
      RETURN jsonb_build_object('success', false, 'message', 'Receiver profile not found');
  END IF;

  -- 3. Determine Tier/Bonuses
  IF p_cost >= 10000 THEN
    v_is_tier_iv_v := TRUE;
    v_bonus_cashback := FLOOR(p_cost * 0.05); -- 5%
  END IF;

  IF p_cost = 1000000 THEN
    v_is_gold_trigger := TRUE;
  END IF;

  v_cashback := floor(random() * 50 + 1)::int;
  v_total_cashback := v_cashback + v_bonus_cashback;

  -- 4. Deduct Cost (Sender)
  UPDATE user_profiles 
  SET troll_coins = troll_coins - p_cost + v_total_cashback
  WHERE id = v_actual_sender_id
  RETURNING troll_coins INTO v_new_sender_balance;

  -- 5. Credit Receiver (95% share)
  UPDATE user_profiles
  SET troll_coins = troll_coins + FLOOR(p_cost * 0.95),
      total_coins_earned = COALESCE(total_coins_earned, 0) + FLOOR(p_cost * 0.95)
  WHERE id = p_receiver_id;

  -- 6. Apply Status
  IF v_is_tier_iv_v THEN
    UPDATE user_profiles
    SET rgb_username_expires_at = GREATEST(now(), COALESCE(rgb_username_expires_at, now())) + INTERVAL '30 days'
    WHERE id = v_actual_sender_id;
  END IF;

  IF v_is_gold_trigger THEN
    UPDATE user_profiles
    SET is_gold = TRUE, gold_granted_at = now()
    WHERE id = v_actual_sender_id;
  END IF;

  -- 7. Record Transaction
  INSERT INTO coin_transactions (user_id, amount, type, metadata)
  VALUES 
    (v_actual_sender_id, -p_cost, 'gift_sent', jsonb_build_object('gift_id', p_gift_id, 'receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'cashback', v_total_cashback)),
    (p_receiver_id, FLOOR(p_cost * 0.95), 'gift_received', jsonb_build_object('gift_id', p_gift_id, 'sender_id', v_actual_sender_id, 'stream_id', p_stream_id));
    
  -- 8. Insert into stream_messages
  IF p_stream_id IS NOT NULL THEN
    INSERT INTO stream_messages (stream_id, user_id, content, type)
    VALUES (p_stream_id, v_actual_sender_id, 'GIFT_EVENT:' || p_gift_id || ':' || p_cost, 'system');
  END IF;

  -- 9. Update Broadcaster Stats
  BEGIN
    INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
    VALUES (p_receiver_id, p_cost, p_cost, now())
    ON CONFLICT (user_id) DO UPDATE SET
        total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
        total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
        last_updated_at = now();
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 
    'cashback', v_total_cashback,
    'rgb_awarded', v_is_tier_iv_v,
    'gold_awarded', v_is_gold_trigger,
    'new_balance', v_new_sender_balance
  );
END;
$$;
