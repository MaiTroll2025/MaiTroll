-- ============================================================================
-- FEED THE TROLL — server-side credit logic, evolution, milestones, reset,
-- cashout, realtime event emission. All financial logic runs here atomically
-- inside the gift transaction. The browser never computes the 1% allocation.
-- ============================================================================

-- The schema migration (20260716000002_feed_the_troll_schema.sql) owns the
-- full table/RLS definitions. These two CREATE TABLE statements are repeated
-- here (idempotent via IF NOT EXISTS) so this function file is self-sufficient
-- regardless of apply order: the functions below reference these config tables.
CREATE TABLE IF NOT EXISTS public.troll_feed_evolution_config (
  stage        text PRIMARY KEY,
  display_name text NOT NULL,
  min_lifetime_fed_coins bigint NOT NULL,
  sort_order   integer NOT NULL,
  badge_label  text,
  theme_key    text,
  is_active    boolean DEFAULT true
);
INSERT INTO public.troll_feed_evolution_config (stage, display_name, min_lifetime_fed_coins, sort_order, badge_label, theme_key)
VALUES
  ('baby',    'Baby Troll',    0,       1, 'Hatchling', 'baby'),
  ('young',   'Young Troll',   10000,   2, 'Sprout',    'young'),
  ('warrior', 'Warrior Troll', 100000,  3, 'Warrior',   'warrior'),
  ('king',    'King Troll',    1000000, 4, 'Royal',     'king')
ON CONFLICT (stage) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.troll_feed_gift_size_config (
  size        text PRIMARY KEY,
  min_value   integer NOT NULL,
  max_value   integer,
  sort_order  integer NOT NULL,
  is_active   boolean DEFAULT true
);
INSERT INTO public.troll_feed_gift_size_config (size, min_value, max_value, sort_order)
VALUES
  ('small',    1,    99,     1),
  ('medium',   100,  999,    2),
  ('large',    1000, 9999,   3),
  ('legendary',10000, NULL,  4)
ON CONFLICT (size) DO NOTHING;

-- Helper: derive the evolution stage from lifetime-fed coins using config.
CREATE OR REPLACE FUNCTION public.troll_feed_stage_for_lifetime(p_lifetime bigint)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT stage FROM public.troll_feed_evolution_config
  WHERE is_active = true AND min_lifetime_fed_coins <= p_lifetime
  ORDER BY min_lifetime_fed_coins DESC
  LIMIT 1;
$$;

-- Helper: derive gift-size category from eligible value using config.
CREATE OR REPLACE FUNCTION public.troll_feed_size_for_value(p_value integer)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT size FROM public.troll_feed_gift_size_config
     WHERE is_active = true
       AND p_value >= min_value
       AND (max_value IS NULL OR p_value <= max_value)
     ORDER BY min_value DESC LIMIT 1),
    'small');
$$;

-- Core credit routine. Called from within send_gift_in_stream (same tx).
-- Returns a jsonb describing everything the UI needs to animate/refresh.
CREATE OR REPLACE FUNCTION public.troll_feed_credit(
  p_broadcaster_id uuid,
  p_sender_id uuid,
  p_stream_id uuid,
  p_battle_id uuid,
  p_gift_id text,
  p_gift_name text,
  p_eligible_value integer,
  p_txn_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc          integer;
  v_state          public.troll_feed_state%ROWTYPE;
  v_settings       public.troll_feed_settings%ROWTYPE;
  v_size           text;
  v_prev_stage     text;
  v_new_stage      text;
  v_evolved        boolean := false;
  v_cashout        boolean := false;
  v_cashout_amt    bigint := 0;
  v_new_cycle      integer;
  v_sender_name    text;
  v_event          jsonb;
  v_milestone_hits jsonb := '[]'::jsonb;
  v_dupe           uuid;
BEGIN
  -- Idempotency: never credit the same feeding twice.
  IF p_txn_key IS NOT NULL THEN
    SELECT id INTO v_dupe FROM public.troll_feed_transactions
    WHERE broadcaster_id = p_broadcaster_id AND idempotency_key = p_txn_key
    LIMIT 1;
    IF v_dupe IS NOT NULL THEN
      RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate');
    END IF;
  END IF;

  -- Server-computed exact 1% allocation (floor; no browser involvement).
  v_alloc := floor(p_eligible_value * 0.01);

  -- Ensure state + settings rows exist.
  INSERT INTO public.troll_feed_state (broadcaster_id)
  VALUES (p_broadcaster_id)
  ON CONFLICT (broadcaster_id) DO NOTHING;

  INSERT INTO public.troll_feed_settings (broadcaster_id)
  VALUES (p_broadcaster_id)
  ON CONFLICT (broadcaster_id) DO NOTHING;

  INSERT INTO public.troll_feed_gift_trains (broadcaster_id)
  VALUES (p_broadcaster_id)
  ON CONFLICT (broadcaster_id) DO NOTHING;

  SELECT * INTO v_state FROM public.troll_feed_state WHERE broadcaster_id = p_broadcaster_id;
  SELECT * INTO v_settings FROM public.troll_feed_settings WHERE broadcaster_id = p_broadcaster_id;
  v_size := public.troll_feed_size_for_value(p_eligible_value);

  -- Record the feeding transaction (single source of truth).
  INSERT INTO public.troll_feed_transactions (
    broadcaster_id, sender_id, stream_id, battle_id, gift_id, gift_name,
    eligible_gift_value, troll_allocation, size_category, cycle_index, idempotency_key
  ) VALUES (
    p_broadcaster_id, p_sender_id, p_stream_id, p_battle_id, p_gift_id, p_gift_name,
    p_eligible_value, v_alloc, v_size, v_state.current_cycle_index, p_txn_key
  );

  -- Update troll state: balance + lifetime + counts + unique feeders.
  UPDATE public.troll_feed_state
  SET current_cycle_balance = current_cycle_balance + v_alloc,
      lifetime_fed_coins    = lifetime_fed_coins + v_alloc,
      total_feedings        = total_feedings + 1,
      unique_feeders        = (
        CASE WHEN EXISTS (
          SELECT 1 FROM public.troll_feed_leaderboard
          WHERE broadcaster_id = p_broadcaster_id AND sender_id = p_sender_id
        ) THEN unique_feeders ELSE unique_feeders + 1 END
      ),
      last_fed_at         = now(),
      last_interaction_at = now(),
      personality_state   = 'eating',
      updated_at          = now()
  WHERE broadcaster_id = p_broadcaster_id;

  -- Upsert leaderboard totals for the sender.
  INSERT INTO public.troll_feed_leaderboard (
    broadcaster_id, sender_id, total_eligible_value, total_troll_allocated,
    feeding_count, largest_single_feed, updated_at
  ) VALUES (
    p_broadcaster_id, p_sender_id, p_eligible_value, v_alloc, 1,
    p_eligible_value, now()
  )
  ON CONFLICT (broadcaster_id, sender_id) DO UPDATE
  SET total_eligible_value  = troll_feed_leaderboard.total_eligible_value + p_eligible_value,
      total_troll_allocated = troll_feed_leaderboard.total_troll_allocated + v_alloc,
      feeding_count         = troll_feed_leaderboard.feeding_count + 1,
      largest_single_feed   = GREATEST(troll_feed_leaderboard.largest_single_feed, p_eligible_value),
      updated_at            = now();

  -- Gift-train tracking (3+ eligible gifts within 10s => train).
  UPDATE public.troll_feed_gift_trains
  SET current_train_count = CASE
        WHEN current_train_started_at IS NOT NULL
             AND current_train_started_at > (now() - interval '10 seconds')
        THEN current_train_count + 1
        ELSE 1 END,
      current_train_started_at = CASE
        WHEN current_train_started_at IS NOT NULL
             AND current_train_started_at > (now() - interval '10 seconds')
        THEN current_train_started_at
        ELSE now() END,
      largest_train_this_live = GREATEST(largest_train_this_live,
        CASE WHEN current_train_started_at IS NOT NULL
                  AND current_train_started_at > (now() - interval '10 seconds')
             THEN LEAST(current_train_count + 1, 100000)
             ELSE 1 END),
      largest_train_lifetime = GREATEST(largest_train_lifetime,
        CASE WHEN current_train_started_at IS NOT NULL
                  AND current_train_started_at > (now() - interval '10 seconds')
             THEN LEAST(current_train_count + 1, 100000)
             ELSE 1 END),
      top_contributor_id = CASE
        WHEN top_contributor_id IS NULL OR top_contributor_count < (
          SELECT feeding_count FROM public.troll_feed_leaderboard
          WHERE broadcaster_id = p_broadcaster_id AND sender_id = p_sender_id)
        THEN p_sender_id ELSE top_contributor_id END,
      top_contributor_count = GREATEST(top_contributor_count, (
        SELECT feeding_count FROM public.troll_feed_leaderboard
        WHERE broadcaster_id = p_broadcaster_id AND sender_id = p_sender_id)),
      updated_at = now()
  WHERE broadcaster_id = p_broadcaster_id;

  -- Recompute evolution stage from new lifetime total.
  SELECT * INTO v_state FROM public.troll_feed_state WHERE broadcaster_id = p_broadcaster_id;
  v_prev_stage := v_state.evolution_stage;
  v_new_stage  := public.troll_feed_stage_for_lifetime(v_state.lifetime_fed_coins);

  IF v_new_stage IS DISTINCT FROM v_prev_stage THEN
    UPDATE public.troll_feed_state
    SET evolution_stage = v_new_stage,
        personality_state = 'evolving',
        updated_at = now()
    WHERE broadcaster_id = p_broadcaster_id;

    INSERT INTO public.troll_feed_evolution_history (
      broadcaster_id, from_stage, to_stage, lifetime_fed_at_transition
    ) VALUES (
      p_broadcaster_id, v_prev_stage, v_new_stage, v_state.lifetime_fed_coins
    );
    v_evolved := true;
  END IF;

  -- Milestone checks (configurable). Insert permanent completion records.
  SELECT COALESCE(jsonb_agg(m.id), '[]'::jsonb) INTO v_milestone_hits
  FROM public.troll_feed_milestone_config m
  WHERE m.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.troll_feed_milestones x
      WHERE x.broadcaster_id = p_broadcaster_id AND x.milestone_id = m.id
    )
    AND (
      (m.category = 'feeding_count'  AND v_state.total_feedings >= m.requirement) OR
      (m.category = 'lifetime_coins' AND v_state.lifetime_fed_coins >= m.requirement) OR
      (m.category = 'cashout_count'  AND v_state.cashout_count >= m.requirement) OR
      (m.category = 'unique_feeders' AND v_state.unique_feeders >= m.requirement)
    );

  IF jsonb_array_length(v_milestone_hits) > 0 THEN
    INSERT INTO public.troll_feed_milestones (broadcaster_id, milestone_id, progress)
    SELECT p_broadcaster_id, id, requirement
    FROM jsonb_array_elements_text(v_milestone_hits) AS id
    ON CONFLICT (broadcaster_id, milestone_id) DO NOTHING;
  END IF;

  -- Cashout / reset when current-cycle balance reaches the threshold.
  IF v_state.current_cycle_balance >= v_settings.cashout_threshold THEN
    v_cashout_amt := v_state.current_cycle_balance;
    v_new_cycle   := v_state.current_cycle_index + 1;

    -- Atomically: move completed amount into the broadcaster's cashout-eligible
    -- ledger (user_earnings_summary eligibility derives from troll_coins), then
    -- reset only the current-cycle progress. Lifetime totals are preserved.
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_cashout_amt,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_cashout_amt
    WHERE id = p_broadcaster_id;

    INSERT INTO public.troll_feed_cashouts (broadcaster_id, cycle_index, amount_cashed_out)
    VALUES (p_broadcaster_id, v_state.current_cycle_index, v_cashout_amt);

    UPDATE public.troll_feed_state
    SET current_cycle_balance = 0,
        cashout_count = cashout_count + 1,
        current_cycle_index = v_new_cycle,
        updated_at = now()
    WHERE broadcaster_id = p_broadcaster_id;

    v_cashout := true;
  END IF;

  SELECT username INTO v_sender_name
  FROM public.user_profiles WHERE id = p_sender_id;

  -- Build the realtime-safe event payload (no private data).
  v_event := jsonb_build_object(
    'eventType', 'troll_fed',
    'broadcasterId', p_broadcaster_id,
    'streamId', p_stream_id,
    'battleId', p_battle_id,
    'senderId', p_sender_id,
    'senderDisplayName', COALESCE(v_sender_name, 'Troll Citizen'),
    'giftId', p_gift_id,
    'giftName', p_gift_name,
    'eligibleGiftValue', p_eligible_value,
    'trollAllocation', v_alloc,
    'sizeCategory', v_size,
    'evolutionStage', v_new_stage,
    'evolved', v_evolved,
    'cashoutCompleted', v_cashout,
    'cashoutAmount', v_cashout_amt,
    'milestones', v_milestone_hits,
    'createdAt', now()
  );

  RETURN v_event;
END;
$$;

-- ----------------------------------------------------------------------------
-- Extend send_gift_in_stream to atomically credit the troll (1% of eligible
-- gift value) and return the troll event in its result payload.
-- The edit is a surgical REPLACE of the function body's tail: we insert the
-- troll_feed_credit call right after the receiver credit, and append the troll
-- event to the returned jsonb. We keep the entire existing logic untouched.
-- ----------------------------------------------------------------------------
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
  v_trollmonds_to_deduct integer := 0;
  v_trollmonds_transferred integer := 0;
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
  v_per_gift_trollmond_cost integer := 0;
  v_is_friday boolean := false;
  v_bonus_result jsonb;
  v_sender_troll_coins bigint;
  v_troll_event jsonb := NULL;
  v_eligible_value integer;
BEGIN
   PERFORM set_config('app.bypass_coin_protection', 'true', true);

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

   SELECT value::integer, name
     INTO v_gift_cost, v_gift_name
   FROM public.gift_items
   WHERE status = 'active'
     AND (
       id::text = p_gift_id
       OR gift_slug = p_gift_id
       OR slug = p_gift_id
       OR name = p_gift_id
     )
   LIMIT 1;

   IF v_gift_cost IS NULL THEN
     SELECT coin_price::integer, display_name
       INTO v_gift_cost, v_gift_name
     FROM public.purchasable_items
     WHERE (id::text = p_gift_id OR item_key = p_gift_id)
       AND category = 'gift'
       AND is_active = true
     LIMIT 1;
   END IF;

   IF v_gift_cost IS NULL THEN
     SELECT cost::integer, name
       INTO v_gift_cost, v_gift_name
     FROM public.gifts
     WHERE id::text = p_gift_id OR slug = p_gift_id
     LIMIT 1;
   END IF;

   IF v_gift_cost IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
   END IF;

   v_total_cost := v_gift_cost * p_quantity;
   -- Eligible value for the troll = full gift value (cost to sender).
   v_eligible_value := v_total_cost;

   IF v_gift_cost >= 100 THEN
     v_per_gift_trollmond_cost := 100;
   ELSE
     v_per_gift_trollmond_cost := 0;
   END IF;

   v_trollmonds_to_deduct := v_per_gift_trollmond_cost * p_quantity;

   SELECT * INTO v_sender
   FROM public.user_profiles
   WHERE id = p_sender_id;

   IF NOT FOUND THEN
     RETURN jsonb_build_object('success', false, 'message', 'Sender not found');
   END IF;

   IF v_trollmonds_to_deduct > 0 AND COALESCE(v_sender.trollmonds, 0) < v_trollmonds_to_deduct THEN
     v_trollmonds_to_deduct := 0;
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

   v_coins_back := floor(v_total_cost * 0.10);

   UPDATE public.user_profiles
   SET troll_coins = COALESCE(troll_coins, 0) - v_total_cost + v_coins_back
   WHERE id = p_sender_id
     AND COALESCE(troll_coins, 0) >= v_total_cost;

   IF NOT FOUND THEN
     RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
   END IF;

   IF v_trollmonds_to_deduct > 0 THEN
     UPDATE public.user_profiles
     SET trollmonds = COALESCE(trollmonds, 0) - v_trollmonds_to_deduct
     WHERE id = p_sender_id
       AND COALESCE(trollmonds, 0) >= v_trollmonds_to_deduct;

     IF FOUND THEN
       UPDATE public.user_profiles
       SET trollmonds = COALESCE(trollmonds, 0) + v_trollmonds_to_deduct
       WHERE id = p_receiver_id;
       v_trollmonds_transferred := v_trollmonds_to_deduct;
     ELSE
       v_trollmonds_to_deduct := 0;
       v_trollmonds_transferred := 0;
     END IF;
   END IF;

   UPDATE public.user_profiles
   SET troll_coins = COALESCE(troll_coins, 0) + v_recipient_share,
       total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
   WHERE id = p_receiver_id;

   IF NOT FOUND THEN
     RETURN jsonb_build_object('success', false, 'message', 'Recipient profile not found');
   END IF;

   -- ── FEED THE TROLL: atomic 1% credit (same transaction) ─────────────────
   -- The broadcaster's normal gift credit is handled above. The troll gets its
   -- own dedicated, separately-tracked 1% of eligible value. This never
   -- touches the broadcaster's spendable balance except on a completed cashout,
   -- where the completed cycle amount is moved into cashout-eligible coins.
   BEGIN
     SELECT public.troll_feed_credit(
       p_receiver_id, p_sender_id, p_stream_id, NULL,
       p_gift_id, v_gift_name, v_eligible_value, v_txn_key
     ) INTO v_troll_event;
   EXCEPTION WHEN OTHERS THEN
     -- Troll failures must never block the gift. Log and continue.
     v_troll_event := jsonb_build_object('error', SQLERRM);
   END;

   IF p_stream_id IS NOT NULL THEN
     UPDATE public.streams
     SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
     WHERE id = p_stream_id;
   END IF;

   INSERT INTO public.stream_gifts (
     stream_id, sender_id, receiver_id, recipient_id,
     gift_id, gift_type, quantity, amount, coins_spent,
     coins_amount, currency_used, trollmonds_spent,
     trollmonds_transferred, coins_back, transaction_type, metadata
   ) VALUES (
     p_stream_id, p_sender_id, p_receiver_id, p_receiver_id,
     p_gift_id, p_gift_id, p_quantity, v_total_cost, v_total_cost,
     v_total_cost, 'coins', v_trollmonds_to_deduct,
     v_trollmonds_transferred, v_coins_back,
     CASE WHEN v_trollmonds_transferred > 0 THEN 'gift_with_trollmonds' ELSE 'gift' END,
     p_metadata || jsonb_build_object(
       'gift_value', v_total_cost,
       'currency_used', 'coins',
       'trollmonds_spent', v_trollmonds_to_deduct,
       'trollmonds_transferred', v_trollmonds_transferred,
       'coins_back', v_coins_back,
       'transaction_type', CASE WHEN v_trollmonds_transferred > 0 THEN 'gift_with_trollmonds' ELSE 'gift' END,
       'coins_back_source', 'gift_return_reward',
       'agency_split_percent', v_agency_split_percent,
       'agency_share_coins', v_agency_share,
       'creator_share_coins', v_recipient_share,
       'leader_bonus_coins', v_leader_bonus,
       'recruiter_bonus_coins', v_recruiter_bonus,
       'troll_allocation', COALESCE((v_troll_event->>'trollAllocation')::integer, 0),
       'troll_evolved', COALESCE((v_troll_event->>'evolved')::boolean, false),
       'troll_cashout_completed', COALESCE((v_troll_event->>'cashoutCompleted')::boolean, false)
     )
   )
   RETURNING id INTO v_existing_id;

   IF v_agency_id IS NOT NULL THEN
     INSERT INTO public.agency_earnings (
       agency_id, creator_id, source_type, source_id,
       gross_coins, split_percent, agency_coins, creator_coins
     ) VALUES (
       v_agency_id, p_receiver_id, 'gift', v_existing_id,
       v_total_cost, v_agency_split_percent, v_agency_share, v_recipient_share
     );

     IF v_leader_bonus > 0 AND v_leader_user_id IS NOT NULL THEN
       INSERT INTO public.agency_earnings (
         agency_id, creator_id, source_type, source_id,
         gross_coins, split_percent, agency_coins, creator_coins
       ) VALUES (
         v_agency_id, v_leader_user_id, 'gift', v_existing_id,
         v_leader_bonus, v_agency_split_percent, 0, v_leader_bonus
       );
     END IF;

     IF v_recruiter_bonus > 0 AND v_recruiter_user_id IS NOT NULL THEN
       INSERT INTO public.agency_earnings (
         agency_id, creator_id, source_type, source_id,
         gross_coins, split_percent, agency_coins, creator_coins
       ) VALUES (
         v_agency_id, v_recruiter_user_id, 'gift', v_existing_id,
         v_recruiter_bonus, v_agency_split_percent, 0, v_recruiter_bonus
       );
     END IF;
   END IF;

   IF v_leader_bonus > 0 AND v_leader_user_id IS NOT NULL THEN
     UPDATE public.user_profiles
     SET troll_coins = COALESCE(troll_coins, 0) + v_leader_bonus,
         total_earned_coins = COALESCE(total_earned_coins, 0) + v_leader_bonus
     WHERE id = v_leader_user_id;

     INSERT INTO public.coin_transactions (
       user_id, amount, type, currency, transaction_type, stream_id, metadata
     ) VALUES (
       v_leader_user_id, v_leader_bonus, 'agency_leader_bonus', 'coins', 'agency_leader_bonus', p_stream_id,
       jsonb_build_object(
         'stream_gift_id', v_existing_id, 'gift_id', p_gift_id,
         'gift_value', v_total_cost, 'bonus_amount', v_leader_bonus,
         'agency_id', v_agency_id, 'recipient_id', p_receiver_id
       )
     );
   END IF;

   IF v_recruiter_bonus > 0 AND v_recruiter_user_id IS NOT NULL THEN
     UPDATE public.user_profiles
     SET troll_coins = COALESCE(troll_coins, 0) + v_recruiter_bonus,
         total_earned_coins = COALESCE(total_earned_coins, 0) + v_recruiter_bonus
     WHERE id = v_recruiter_user_id;

     INSERT INTO public.coin_transactions (
       user_id, amount, type, currency, transaction_type, stream_id, metadata
     ) VALUES (
       v_recruiter_user_id, v_recruiter_bonus, 'agency_recruiter_bonus', 'coins', 'agency_recruiter_bonus', p_stream_id,
       jsonb_build_object(
         'stream_gift_id', v_existing_id, 'gift_id', p_gift_id,
         'gift_value', v_total_cost, 'bonus_amount', v_recruiter_bonus,
         'agency_id', v_agency_id, 'recipient_id', p_receiver_id
       )
     );
   END IF;

   INSERT INTO public.coin_transactions (user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata)
   VALUES
   (p_sender_id, -v_total_cost, 'gift_sent', 'coins', 'gift_sent', p_stream_id, p_sender_id, p_receiver_id,
     jsonb_build_object(
       'recipient_id', p_receiver_id, 'stream_id', p_stream_id,
       'gift_id', p_gift_id, 'gift_value', v_total_cost,
       'trollmonds_spent', v_trollmonds_to_deduct,
       'trollmonds_transferred', v_trollmonds_transferred,
       'coins_back', v_coins_back, 'stream_gift_id', v_existing_id
     )),
   (p_receiver_id, v_recipient_share, 'gift_received', 'coins', 'gift_received', p_stream_id, p_sender_id, p_receiver_id,
     jsonb_build_object(
       'sender_id', p_sender_id, 'stream_id', p_stream_id,
       'gift_id', p_gift_id, 'gift_value', v_total_cost,
       'stream_gift_id', v_existing_id
     ));

   IF v_coins_back > 0 THEN
     INSERT INTO public.coin_transactions (user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata)
     VALUES (
       p_sender_id, v_coins_back, 'gift_return_reward', 'coins', 'gift_return_reward', p_stream_id, NULL, p_sender_id,
       jsonb_build_object(
         'stream_id', p_stream_id, 'gift_id', p_gift_id,
         'gift_value', v_total_cost, 'stream_gift_id', v_existing_id
       )
     );
   END IF;

   IF p_stream_id IS NOT NULL THEN
     INSERT INTO public.stream_messages (stream_id, user_id, content, type)
     VALUES (
       p_stream_id, p_sender_id,
       'GIFT_EVENT:' || COALESCE(v_gift_name, p_gift_id) || ':' || p_quantity || ':' || v_total_cost || ':coins:' || v_coins_back || ':' || v_trollmonds_transferred,
       'system'
     );

     IF v_coins_back > 0 THEN
       SELECT COALESCE(username, display_name, split_part(email, '@', 1), 'Troll Citizen')
         INTO v_sender_name
       FROM public.user_profiles
       WHERE id = p_sender_id;

       INSERT INTO public.stream_messages (stream_id, user_id, content, type)
       VALUES (
         p_stream_id, p_sender_id,
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

   IF v_battle_id IS NOT NULL THEN
     v_is_friday := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Denver')) = 5;
     IF v_is_friday THEN
       v_bonus_result := public.award_friday_battle_gifter_bonus(p_sender_id, v_battle_id, v_total_cost::BIGINT);
     END IF;
   END IF;

   RETURN jsonb_build_object(
     'success', true,
     'transaction_id', v_existing_id,
     'currency_used', 'coins',
     'gift_value', v_total_cost,
     'trollmonds_spent', v_trollmonds_to_deduct,
     'trollmonds_transferred', v_trollmonds_transferred,
     'coins_back', v_coins_back,
     'agency_split_percent', v_agency_split_percent,
     'agency_share_coins', v_agency_share,
     'creator_share_coins', v_recipient_share,
     'leader_bonus_coins', v_leader_bonus,
     'recruiter_bonus_coins', v_recruiter_bonus,
     'friday_battle_bonus', COALESCE(v_bonus_result->>'success', 'false')::BOOLEAN,
     'troll_event', v_troll_event,
     'message', 'Gift sent successfully'
   );
END;
$$;
