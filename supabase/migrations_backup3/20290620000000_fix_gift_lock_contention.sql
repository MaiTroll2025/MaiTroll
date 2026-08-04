-- Fix gift processing: eliminate FOR UPDATE row locks on concurrent gifts
-- Problem: When N viewers send gifts to one broadcaster simultaneously,
--   SELECT ... FOR UPDATE on the receiver row serializes all N transactions.
--   Gift #1 locks -> Gift #2 waits -> Gift #3 waits -> ...
-- Solution: Replace locked SELECT+UPDATE with atomic UPDATE ... WHERE checks.
--   The sender's balance guard is: UPDATE ... SET troll_coins = troll_coins - X
--     WHERE id = p_sender_id AND troll_coins >= X
--   This is atomic and never needs a row lock.
--   The receiver credit is: UPDATE ... SET troll_coins = troll_coins + Y
--     This is also atomic and safe without a lock.

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
BEGIN
   -- Bypass coin protection trigger for this SECURITY DEFINER function
   PERFORM set_config('app.bypass_coin_protection', 'true', true);

   IF p_quantity IS NULL OR p_quantity < 1 THEN
     p_quantity := 1;
   END IF;

   -- Idempotency check
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

   -- Look up gift cost — PRIMARY: gift_items
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

   -- Fallback: purchasable_items (category: gift)
   IF v_gift_cost IS NULL THEN
     SELECT coin_price::integer, display_name
       INTO v_gift_cost, v_gift_name
     FROM public.purchasable_items
     WHERE (id::text = p_gift_id OR item_key = p_gift_id)
       AND category = 'gift'
       AND is_active = true
     LIMIT 1;
   END IF;

   -- Last resort: public.gifts (backward compat for old gift slugs like 'rose', 'diamond')
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

   -- ── Determine trollmond deduction ──────────────────────────────────────
   IF v_gift_cost >= 100 THEN
     v_per_gift_trollmond_cost := 100;
   ELSE
     v_per_gift_trollmond_cost := 0;
   END IF;

   v_trollmonds_to_deduct := v_per_gift_trollmond_cost * p_quantity;

   -- Plain SELECT (no lock) — we only need the sender's current balance
   -- and trollmonds for the deduct step below.
   SELECT * INTO v_sender
   FROM public.user_profiles
   WHERE id = p_sender_id;

   IF NOT FOUND THEN
     RETURN jsonb_build_object('success', false, 'message', 'Sender not found');
   END IF;

   IF v_trollmonds_to_deduct > 0 AND COALESCE(v_sender.trollmonds, 0) < v_trollmonds_to_deduct THEN
     v_trollmonds_to_deduct := 0;
   END IF;

   -- ── Agency split lookup ────────────────────────────────────────────────
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

   -- Calculate agency/creator split
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

   -- ── Spend coins from sender (atomic, no row lock) ─────────────────────
   v_coins_back := floor(v_total_cost * 0.10);

   UPDATE public.user_profiles
   SET troll_coins = COALESCE(troll_coins, 0) - v_total_cost + v_coins_back
   WHERE id = p_sender_id
     AND COALESCE(troll_coins, 0) >= v_total_cost;

   IF NOT FOUND THEN
     RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
   END IF;

   -- ── Deduct trollmonds from sender and transfer to receiver ─────────────
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

   -- ── Credit receiver with FULL coins (no fees) ─────────────────────────
   UPDATE public.user_profiles
   SET troll_coins = COALESCE(troll_coins, 0) + v_recipient_share,
       total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
   WHERE id = p_receiver_id;

   IF NOT FOUND THEN
     RETURN jsonb_build_object('success', false, 'message', 'Recipient profile not found');
   END IF;

   -- ── Update stream totals ───────────────────────────────────────────────
   IF p_stream_id IS NOT NULL THEN
     UPDATE public.streams
     SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
     WHERE id = p_stream_id;
   END IF;

   -- ── Record stream_gifts ────────────────────────────────────────────────
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
       'recruiter_bonus_coins', v_recruiter_bonus
     )
   )
   RETURNING id INTO v_existing_id;

   -- ── Agency earnings ───────────────────────────────────────────────────
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

   -- ── Leader/recruiter bonus credit ─────────────────────────────────────
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

   -- ── Coin transactions ──────────────────────────────────────────────────
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

   -- ── Stream messages ────────────────────────────────────────────────────
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

   -- ── Battle scoring ─────────────────────────────────────────────────────
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

   -- ── Friday Battle Bonus ────────────────────────────────────────────────
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
     'message', 'Gift sent successfully'
   );
END;
$$;
