BEGIN;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS agency_fee_percent INTEGER DEFAULT 0 CHECK (agency_fee_percent >= 0 AND agency_fee_percent <= 100),
  ADD COLUMN IF NOT EXISTS platform_fee_percent INTEGER DEFAULT 0 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  ADD COLUMN IF NOT EXISTS leader_commission_percent INTEGER DEFAULT 0 CHECK (leader_commission_percent >= 0 AND leader_commission_percent <= 100),
  ADD COLUMN IF NOT EXISTS recruiter_commission_percent INTEGER DEFAULT 0 CHECK (recruiter_commission_percent >= 0 AND recruiter_commission_percent <= 100),
  ADD COLUMN IF NOT EXISTS fee_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_updated_by UUID REFERENCES auth.users(id);

ALTER TABLE public.agency_contracts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'agency_leader',
  ADD COLUMN IF NOT EXISTS contract_body TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS fee_percentage INTEGER DEFAULT 0 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  ADD COLUMN IF NOT EXISTS payout_terms TEXT,
  ADD COLUMN IF NOT EXISTS agency_responsibilities TEXT,
  ADD COLUMN IF NOT EXISTS leader_responsibilities TEXT,
  ADD COLUMN IF NOT EXISTS termination_terms TEXT,
  ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.agency_contracts ALTER COLUMN creator_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_agency_contract_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.creator_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.creator_id := NEW.user_id;
  END IF;

  IF NEW.contract_type IS NULL OR btrim(NEW.contract_type) = '' THEN
    NEW.contract_type := 'agency_leader';
  END IF;

  IF NEW.contract_body IS NULL AND NEW.body IS NOT NULL THEN
    NEW.contract_body := NEW.body;
  END IF;

  IF NEW.body IS NULL AND NEW.contract_body IS NOT NULL THEN
    NEW.body := NEW.contract_body;
  END IF;

  IF NEW.fee_percentage IS NULL THEN
    NEW.fee_percentage := COALESCE(NEW.split_percent, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agency_contracts_normalize_defaults ON public.agency_contracts;
CREATE TRIGGER trg_agency_contracts_normalize_defaults
BEFORE INSERT ON public.agency_contracts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_agency_contract_defaults();

CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_stream_id uuid,
  p_gift_id text,
  p_quantity integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender public.user_profiles%ROWTYPE;
  v_gift_cost integer;
  v_total_cost integer;
  v_gift_name text;
  v_battle_id uuid;
  v_is_challenger boolean;
  v_currency_used text := 'coins';
  v_trollmonds_spent integer := 0;
  v_coins_back integer := 0;
  v_recipient_share integer;
  v_txn_key text := nullif(p_metadata->>'txn_key', '');
  v_existing_id uuid;
  v_sender_name text;
  v_agency_id uuid;
  v_agency_status text;
  v_default_split_percent integer := 0;
  v_agency_split_percent integer := 0;
  v_creator_share integer := 0;
  v_agency_share integer := 0;
  v_leader_bonus integer := 0;
  v_recruiter_bonus integer := 0;
  v_leader_commission_percent integer := 0;
  v_recruiter_commission_percent integer := 0;
  v_leader_user_id uuid;
  v_recruiter_user_id uuid;
  v_manager_user_id uuid;
  v_owner_user_id uuid;
  v_recipient_is_banned boolean := false;
  v_recipient_is_jailed boolean := false;
  v_contract_split_percent integer := NULL;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    p_quantity := 1;
  END IF;

  IF v_txn_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.stream_gifts
    WHERE sender_id = p_sender_id
      AND metadata->>'txn_key' = v_txn_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_existing_id);
    END IF;
  END IF;

  SELECT cost::integer, name
    INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id OR slug = p_gift_id
  LIMIT 1;

  IF v_gift_cost IS NULL THEN
    SELECT value::integer, name
      INTO v_gift_cost, v_gift_name
    FROM public.gift_items
    WHERE id::text = p_gift_id OR slug = p_gift_id
    LIMIT 1;
  END IF;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  SELECT * INTO v_sender
  FROM public.user_profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sender not found');
  END IF;

  PERFORM 1 FROM public.user_profiles WHERE id = p_receiver_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Recipient not found');
  END IF;

  SELECT am.agency_id,
         a.status,
         COALESCE(a.default_split_percent, 0),
         COALESCE(up.is_banned, false),
         COALESCE(up.is_jailed, false)
    INTO v_agency_id,
         v_agency_status,
         v_default_split_percent,
         v_recipient_is_banned,
         v_recipient_is_jailed
  FROM public.agency_members am
  JOIN public.agencies a ON a.id = am.agency_id
  JOIN public.user_profiles up ON up.id = am.user_id
  WHERE am.user_id = p_receiver_id
    AND am.role = 'creator'
    AND am.status = 'active'
  ORDER BY am.joined_at DESC
  LIMIT 1;

  IF FOUND
     AND v_agency_status = 'approved'
     AND NOT v_recipient_is_banned
     AND NOT v_recipient_is_jailed THEN
    SELECT split_percent
      INTO v_contract_split_percent
    FROM public.agency_contracts
    WHERE agency_id = v_agency_id
      AND creator_id = p_receiver_id
      AND status = 'active'
      AND (creator_accepted_at IS NOT NULL OR agency_accepted_at IS NOT NULL)
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    ORDER BY created_at DESC
    LIMIT 1;

    v_agency_split_percent := COALESCE(v_contract_split_percent, v_default_split_percent, 0);
    IF v_agency_split_percent < 0 THEN
      v_agency_split_percent := 0;
    ELSIF v_agency_split_percent > 50 THEN
      v_agency_split_percent := 50;
    END IF;

    SELECT owner_id
      INTO v_owner_user_id
    FROM public.agencies
    WHERE id = v_agency_id;

    SELECT user_id
      INTO v_manager_user_id
    FROM public.agency_members
    WHERE agency_id = v_agency_id
      AND role = 'manager'
      AND status = 'active'
    ORDER BY joined_at
    LIMIT 1;

    IF v_owner_user_id IS NOT NULL AND v_owner_user_id <> p_receiver_id THEN
      v_leader_user_id := v_owner_user_id;
    ELSIF v_manager_user_id IS NOT NULL THEN
      v_leader_user_id := v_manager_user_id;
    END IF;

    SELECT COALESCE(leader_commission_percent, 0), COALESCE(recruiter_commission_percent, 0)
      INTO v_leader_commission_percent, v_recruiter_commission_percent
    FROM public.agencies
    WHERE id = v_agency_id;

    IF v_leader_commission_percent < 0 THEN
      v_leader_commission_percent := 0;
    ELSIF v_leader_commission_percent > 100 THEN
      v_leader_commission_percent := 100;
    END IF;

    IF v_recruiter_commission_percent < 0 THEN
      v_recruiter_commission_percent := 0;
    ELSIF v_recruiter_commission_percent > 100 THEN
      v_recruiter_commission_percent := 100;
    END IF;
  ELSE
    v_agency_split_percent := 0;
  END IF;

  IF v_agency_split_percent > 0 THEN
    v_agency_share := (v_total_cost * v_agency_split_percent) / 100;
    v_creator_share := v_total_cost - v_agency_share;
  ELSE
    v_agency_share := 0;
    v_creator_share := v_total_cost;
  END IF;

  v_leader_bonus := 0;
  v_recruiter_bonus := 0;

  IF v_agency_split_percent > 0 AND v_leader_user_id IS NOT NULL THEN
    v_leader_bonus := (v_creator_share * v_leader_commission_percent) / 100;
  END IF;

  IF v_recruiter_user_id IS NOT NULL AND v_agency_split_percent > 0 THEN
    v_recruiter_bonus := (v_creator_share * v_recruiter_commission_percent) / 100;
  END IF;

  IF v_leader_bonus + v_recruiter_bonus > v_creator_share THEN
    v_leader_bonus := LEAST(v_leader_bonus, v_creator_share);
    v_recruiter_bonus := GREATEST(0, v_creator_share - v_leader_bonus);
  END IF;

  v_recipient_share := v_creator_share - v_leader_bonus - v_recruiter_bonus;

  IF COALESCE(v_sender.trollmonds, 0) >= v_total_cost THEN
    v_currency_used := 'trollmonds';
    v_trollmonds_spent := v_total_cost;
    v_coins_back := floor(v_total_cost * 0.10);

    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) - v_trollmonds_spent,
        troll_coins = COALESCE(troll_coins, 0) + v_coins_back
    WHERE id = p_sender_id
      AND COALESCE(trollmonds, 0) >= v_trollmonds_spent;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient Trollmonds');
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_recipient_share,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
    WHERE id = p_receiver_id;
  ELSE
    IF COALESCE(v_sender.troll_coins, 0) < v_total_cost THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
    END IF;

    v_coins_back := floor(v_total_cost * 0.10);

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) - v_total_cost + v_coins_back
    WHERE id = p_sender_id
      AND COALESCE(troll_coins, 0) >= v_total_cost;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_recipient_share,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
    WHERE id = p_receiver_id;
  END IF;

  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  INSERT INTO public.stream_gifts (
    stream_id,
    sender_id,
    receiver_id,
    recipient_id,
    gift_id,
    gift_type,
    quantity,
    amount,
    coins_spent,
    coins_amount,
    currency_used,
    trollmonds_spent,
    coins_back,
    transaction_type,
    metadata
  ) VALUES (
    p_stream_id,
    p_sender_id,
    p_receiver_id,
    p_receiver_id,
    p_gift_id,
    p_gift_id,
    p_quantity,
    v_total_cost,
    CASE WHEN v_currency_used = 'coins' THEN v_total_cost ELSE 0 END,
    v_total_cost,
    v_currency_used,
    v_trollmonds_spent,
    v_coins_back,
    CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift' END,
    p_metadata || jsonb_build_object(
      'gift_value', v_total_cost,
      'currency_used', v_currency_used,
      'trollmonds_spent', v_trollmonds_spent,
      'coins_back', v_coins_back,
      'transaction_type', CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift' END,
      'coins_back_source', 'gift_return_reward',
      'agency_split_percent', v_agency_split_percent,
      'agency_share_coins', v_agency_share,
      'creator_share_coins', v_recipient_share,
      'leader_bonus_coins', v_leader_bonus,
      'recruiter_bonus_coins', v_recruiter_bonus
    )
  )
  RETURNING id INTO v_existing_id;

  IF v_agency_id IS NOT NULL THEN
    INSERT INTO public.agency_earnings (
      agency_id,
      creator_id,
      source_type,
      source_id,
      gross_coins,
      split_percent,
      agency_coins,
      creator_coins
    ) VALUES (
      v_agency_id,
      p_receiver_id,
      'gift',
      v_existing_id,
      v_total_cost,
      v_agency_split_percent,
      v_agency_share,
      v_recipient_share
    );

    IF v_leader_bonus > 0 AND v_leader_user_id IS NOT NULL THEN
      INSERT INTO public.agency_earnings (
        agency_id,
        creator_id,
        source_type,
        source_id,
        gross_coins,
        split_percent,
        agency_coins,
        creator_coins
      ) VALUES (
        v_agency_id,
        v_leader_user_id,
        'gift',
        v_existing_id,
        v_leader_bonus,
        v_agency_split_percent,
        0,
        v_leader_bonus
      );
    END IF;

    IF v_recruiter_bonus > 0 AND v_recruiter_user_id IS NOT NULL THEN
      INSERT INTO public.agency_earnings (
        agency_id,
        creator_id,
        source_type,
        source_id,
        gross_coins,
        split_percent,
        agency_coins,
        creator_coins
      ) VALUES (
        v_agency_id,
        v_recruiter_user_id,
        'gift',
        v_existing_id,
        v_recruiter_bonus,
        v_agency_split_percent,
        0,
        v_recruiter_bonus
      );
    END IF;
  END IF;

  IF v_leader_bonus > 0 AND v_leader_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_leader_bonus,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_leader_bonus
    WHERE id = v_leader_user_id;

    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      currency,
      transaction_type,
      metadata
    ) VALUES (
      v_leader_user_id,
      v_leader_bonus,
      'agency_leader_bonus',
      'coins',
      'agency_leader_bonus',
      jsonb_build_object(
        'stream_gift_id', v_existing_id,
        'gift_id', p_gift_id,
        'gift_value', v_total_cost,
        'bonus_amount', v_leader_bonus,
        'agency_id', v_agency_id,
        'recipient_id', p_receiver_id
      )
    );
  END IF;

  IF v_recruiter_bonus > 0 AND v_recruiter_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_recruiter_bonus,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recruiter_bonus
    WHERE id = v_recruiter_user_id;

    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      currency,
      transaction_type,
      metadata
    ) VALUES (
      v_recruiter_user_id,
      v_recruiter_bonus,
      'agency_recruiter_bonus',
      'coins',
      'agency_recruiter_bonus',
      jsonb_build_object(
        'stream_gift_id', v_existing_id,
        'gift_id', p_gift_id,
        'gift_value', v_total_cost,
        'bonus_amount', v_recruiter_bonus,
        'agency_id', v_agency_id,
        'recipient_id', p_receiver_id
      )
    );
  END IF;

  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    currency,
    transaction_type,
    metadata
  ) VALUES
  (
    p_sender_id,
    CASE WHEN v_currency_used = 'coins' THEN -v_total_cost ELSE 0 END,
    CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift_sent' END,
    v_currency_used,
    CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift_sent' END,
    jsonb_build_object('recipient_id', p_receiver_id, 'stream_id', p_stream_id, 'gift_id', p_gift_id, 'gift_value', v_total_cost, 'trollmonds_spent', v_trollmonds_spent, 'coins_back', v_coins_back, 'stream_gift_id', v_existing_id)
  ),
  (
    p_receiver_id,
    v_recipient_share,
    'gift_received',
    'coins',
    'gift_received',
    jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id, 'gift_id', p_gift_id, 'gift_value', v_total_cost, 'stream_gift_id', v_existing_id)
  );

  IF v_coins_back > 0 THEN
    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      currency,
      transaction_type,
      metadata
    ) VALUES (
      p_sender_id,
      v_coins_back,
      'gift_return_reward',
      'coins',
      'gift_return_reward',
      jsonb_build_object('stream_id', p_stream_id, 'gift_id', p_gift_id, 'gift_value', v_total_cost, 'stream_gift_id', v_existing_id)
    );
  END IF;

  IF p_stream_id IS NOT NULL THEN
    INSERT INTO public.stream_messages (stream_id, user_id, content, type)
    VALUES (
      p_stream_id,
      p_sender_id,
      CASE
        WHEN v_currency_used = 'trollmonds'
          THEN 'GIFT_EVENT:' || COALESCE(v_gift_name, p_gift_id) || ':' || p_quantity || ':' || v_total_cost || ':trollmonds:' || v_coins_back
        ELSE 'GIFT_EVENT:' || COALESCE(v_gift_name, p_gift_id) || ':' || p_quantity || ':' || v_total_cost
      END,
      'system'
    );

    IF v_coins_back > 0 THEN
      SELECT COALESCE(username, display_name, split_part(email, '@', 1), 'Troll Citizen')
        INTO v_sender_name
      FROM public.user_profiles
      WHERE id = p_sender_id;

      INSERT INTO public.stream_messages (stream_id, user_id, content, type)
      VALUES (
        p_stream_id,
        p_sender_id,
        COALESCE(v_sender_name, 'Troll Citizen') || ' got ' || v_coins_back || ' coins back',
        'system'
      );
    END IF;
  END IF;

  SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
  FROM public.battles
  WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
    AND status = 'active'
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    IF v_is_challenger THEN
      UPDATE public.battles
      SET score_challenger = COALESCE(score_challenger, 0) + v_total_cost,
          pot_challenger = COALESCE(pot_challenger, 0) + v_total_cost
      WHERE id = v_battle_id;
    ELSE
      UPDATE public.battles
      SET score_opponent = COALESCE(score_opponent, 0) + v_total_cost,
          pot_opponent = COALESCE(pot_opponent, 0) + v_total_cost
      WHERE id = v_battle_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_existing_id,
    'currency_used', v_currency_used,
    'gift_value', v_total_cost,
    'trollmonds_spent', v_trollmonds_spent,
    'coins_back', v_coins_back,
    'agency_split_percent', v_agency_split_percent,
    'agency_share_coins', v_agency_share,
    'creator_share_coins', v_recipient_share,
    'leader_bonus_coins', v_leader_bonus,
    'recruiter_bonus_coins', v_recruiter_bonus,
    'message', 'Gift sent successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(uuid, uuid, uuid, text, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_gift(
  p_stream_id uuid,
  p_recipient_id uuid,
  p_gift_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.send_gift_in_stream(
    auth.uid(),
    p_recipient_id,
    p_stream_id,
    p_gift_id::text,
    p_quantity,
    '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, uuid, integer) TO authenticated;

COMMENT ON TABLE public.agencies IS 'Talent Offices agency profiles with fee and commission settings';
COMMENT ON COLUMN public.agencies.leader_commission_percent IS 'Percent of creator earnings paid to the agency leader for successful recruitments';
COMMENT ON COLUMN public.agencies.recruiter_commission_percent IS 'Percent of creator earnings paid to assigned recruiters';

COMMIT;
