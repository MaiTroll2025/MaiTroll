BEGIN;

CREATE TABLE IF NOT EXISTS public.pet_feed_refund_entries (
  interaction_id UUID PRIMARY KEY REFERENCES public.pet_interactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  week_ending DATE NOT NULL,
  refund_half_coins BIGINT NOT NULL DEFAULT 5 CHECK (refund_half_coins > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_feed_refund_entries_week_user
  ON public.pet_feed_refund_entries (week_ending, user_id);

CREATE TABLE IF NOT EXISTS public.pet_weekly_refund_payouts (
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  week_ending DATE NOT NULL,
  refund_half_coins BIGINT NOT NULL CHECK (refund_half_coins >= 0),
  refund_coins BIGINT NOT NULL CHECK (refund_coins >= 0),
  carry_half_coin SMALLINT NOT NULL CHECK (carry_half_coin IN (0, 1)),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_ending)
);

CREATE OR REPLACE FUNCTION public.interact_with_troll_pet(
  p_pet_id UUID,
  p_interaction_type TEXT
)
RETURNS public.pets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet public.pets;
  v_delta INTEGER := 0;
  v_cost INTEGER := 0;
  v_admin_credit NUMERIC(18,2) := 0;
  v_daily_limit INTEGER := NULL;
  v_daily_count INTEGER := 0;
  v_user_balance NUMERIC(20,2);
  v_admin_pool_id UUID;
  v_admin_user_id UUID;
  v_interaction_id UUID;
  v_local_date DATE;
  v_week_ending DATE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_interaction_type NOT IN ('feed', 'walk', 'care') THEN RAISE EXCEPTION 'Unsupported pet interaction'; END IF;

  SELECT * INTO v_pet
  FROM public.pets
  WHERE id = p_pet_id AND owner_id = auth.uid() AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pet not found'; END IF;

  v_delta := CASE p_interaction_type
    WHEN 'feed' THEN 8
    WHEN 'walk' THEN 7
    ELSE 10
  END;

  v_cost := CASE p_interaction_type
    WHEN 'feed' THEN 5
    WHEN 'walk' THEN 1
    ELSE 0
  END;
  v_admin_credit := CASE p_interaction_type
    WHEN 'feed' THEN 2.5
    WHEN 'walk' THEN 1
    ELSE 0
  END;

  IF p_interaction_type = 'feed' THEN
    v_daily_limit := 1;
  ELSIF p_interaction_type = 'walk' THEN
    v_daily_limit := 4;
  END IF;

  IF v_daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.pet_interactions
    WHERE pet_id = p_pet_id
      AND owner_id = auth.uid()
      AND interaction_type = p_interaction_type
      AND created_at >= NOW() - INTERVAL '1 day';

    IF v_daily_count >= v_daily_limit THEN
      RAISE EXCEPTION 'Daily % limit reached for %', p_interaction_type, v_pet.name;
    END IF;
  END IF;

  IF v_cost > 0 THEN
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = auth.uid()
    FOR UPDATE;

    IF COALESCE(v_user_balance, 0) < v_cost THEN
      RAISE EXCEPTION 'Not enough Troll Coins';
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = auth.uid();

    SELECT id INTO v_admin_pool_id
    FROM public.admin_pool
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF v_admin_pool_id IS NULL THEN
      SELECT id INTO v_admin_user_id
      FROM public.user_profiles
      WHERE is_admin = true OR role = 'admin' OR role = 'ceo'
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_admin_user_id IS NULL THEN
        v_admin_user_id := auth.uid();
      END IF;

      INSERT INTO public.admin_pool (user_id, trollcoins_balance, updated_at)
      VALUES (v_admin_user_id, 0, NOW())
      RETURNING id INTO v_admin_pool_id;
    END IF;

    UPDATE public.admin_pool
    SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_admin_credit,
        updated_at = NOW()
    WHERE id = v_admin_pool_id;

    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
    VALUES (
      v_admin_credit,
      CASE p_interaction_type WHEN 'feed' THEN 'pet_feed_admin_share' ELSE 'pet_walk' END,
      auth.uid(),
      NOW()
    );
  END IF;

  UPDATE public.pets
  SET care_status = LEAST(100, care_status + v_delta),
      needs = jsonb_set(needs, ARRAY[CASE p_interaction_type WHEN 'feed' THEN 'hunger' WHEN 'walk' THEN 'walk' ELSE 'care' END], 'false'::jsonb),
      training_xp = training_xp + 1,
      updated_at = now(),
      last_care_at = now()
  WHERE id = p_pet_id
  RETURNING * INTO v_pet;

  INSERT INTO public.pet_interactions (pet_id, owner_id, interaction_type, status_delta)
  VALUES (p_pet_id, auth.uid(), p_interaction_type, v_delta)
  RETURNING id INTO v_interaction_id;

  IF p_interaction_type = 'feed' THEN
    v_local_date := (NOW() AT TIME ZONE 'America/Denver')::DATE;
    v_week_ending := v_local_date + ((5 - EXTRACT(DOW FROM v_local_date)::INTEGER + 7) % 7);

    INSERT INTO public.pet_feed_refund_entries (interaction_id, user_id, week_ending)
    VALUES (v_interaction_id, auth.uid(), v_week_ending);
  END IF;

  PERFORM public.create_notification(
    auth.uid(),
    'pet_care',
    CASE p_interaction_type
      WHEN 'feed' THEN 'Pet fed'
      WHEN 'walk' THEN 'Pet walked'
      ELSE 'Pet playtime'
    END,
    CASE p_interaction_type
      WHEN 'feed' THEN 'You fed ' || v_pet.name || ' for 5 Troll Coins. Half is reserved for your Friday Pet Refund.'
      WHEN 'walk' THEN 'You walked ' || v_pet.name || ' for 1 Troll Coin.'
      ELSE 'You played with ' || v_pet.name || ' for free and raised their care bar by 10%.'
    END,
    jsonb_build_object('pet_id', p_pet_id, 'interaction_type', p_interaction_type, 'cost', v_cost, 'admin_share', v_admin_credit, 'care_status', v_pet.care_status)
  );

  RETURN v_pet;
END;
$$;

CREATE OR REPLACE FUNCTION public.pet_process_friday_refunds()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_cutoff DATE;
  v_user_id UUID;
  v_week_ending DATE;
  v_refund_half_coins BIGINT;
  v_carry_half_coin SMALLINT;
  v_total_half_coins BIGINT;
  v_refund_coins BIGINT;
  v_processed INTEGER := 0;
  v_paid_coins BIGINT := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('pet_process_friday_refunds'));

  v_today := (NOW() AT TIME ZONE 'America/Denver')::DATE;
  v_cutoff := v_today - ((EXTRACT(DOW FROM v_today)::INTEGER + 2) % 7);

  FOR v_user_id, v_week_ending, v_refund_half_coins IN
    SELECT e.user_id, e.week_ending, SUM(e.refund_half_coins)
    FROM public.pet_feed_refund_entries e
    LEFT JOIN public.pet_weekly_refund_payouts p
      ON p.user_id = e.user_id AND p.week_ending = e.week_ending
    WHERE e.week_ending <= v_cutoff
      AND p.user_id IS NULL
    GROUP BY e.user_id, e.week_ending
    ORDER BY e.week_ending, e.user_id
  LOOP
    SELECT carry_half_coin INTO v_carry_half_coin
    FROM public.pet_weekly_refund_payouts
    WHERE user_id = v_user_id AND week_ending < v_week_ending
    ORDER BY week_ending DESC
    LIMIT 1;

    v_total_half_coins := v_refund_half_coins + COALESCE(v_carry_half_coin, 0);
    v_refund_coins := v_total_half_coins / 2;
    v_carry_half_coin := (v_total_half_coins % 2)::SMALLINT;

    INSERT INTO public.pet_weekly_refund_payouts (
      user_id, week_ending, refund_half_coins, refund_coins, carry_half_coin
    ) VALUES (
      v_user_id, v_week_ending, v_refund_half_coins, v_refund_coins, v_carry_half_coin
    ) ON CONFLICT (user_id, week_ending) DO NOTHING;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_refund_coins > 0 THEN
      UPDATE public.user_profiles
      SET troll_coins = COALESCE(troll_coins, 0) + v_refund_coins
      WHERE id = v_user_id;

      INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
      VALUES (
        v_user_id,
        v_refund_coins,
        'earn',
        'Pet Refund',
        jsonb_build_object(
          'source', 'pet_feed_friday_refund',
          'week_ending', v_week_ending,
          'refund_half_coins', v_refund_half_coins,
          'refund_coins', v_refund_coins,
          'cashout_balance', true
        )
      );

      PERFORM public.create_notification(
        v_user_id,
        'pet_refund',
        'Pet Refund',
        v_refund_coins || ' Troll Coins from feeding your pet were added to your balance and are available for MAI Pay cashout.',
        jsonb_build_object('week_ending', v_week_ending, 'refund_coins', v_refund_coins, 'cashout_balance', true)
      );

      v_paid_coins := v_paid_coins + v_refund_coins;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'weeks_processed', v_processed,
    'refund_coins_paid', v_paid_coins,
    'through_week_ending', v_cutoff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pet_process_friday_refunds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pet_process_friday_refunds() TO service_role;

DO $$
DECLARE
  v_job_exists BOOLEAN;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
      INTO v_job_exists
      USING 'pet_feed_friday_refunds';

    IF NOT v_job_exists THEN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
        USING 'pet_feed_friday_refunds', '0 23 * * 5', 'SELECT public.pet_process_friday_refunds()';
    END IF;
  END IF;
END $$;

COMMIT;