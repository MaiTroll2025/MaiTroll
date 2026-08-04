-- ============================================================================
-- Mai Troll — UNIVERSE BATTLES: CORE RPCS (Part 2 of 2)
-- Round lifecycle, scoring, Troll Bag, abilities, finalize + queue advancement,
-- champion resolution. Server-authoritative for every competitive result.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6. Start a round from a match (admin/system). Creates round_teams + scores.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_start_round(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.universe_match_assignments;
  v_event public.universe_events;
  v_round_id UUID;
  v_team_a UUID;
  v_team_b UUID;
  v_seats_one public.universe_team_seats[];
  v_seats_two public.universe_team_seats[];
  s public.universe_team_seats;
  seat_ids UUID[];
BEGIN
  SELECT * INTO v_match FROM public.universe_match_assignments WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  SELECT * INTO v_event FROM public.universe_events WHERE id = v_match.event_id;

  -- Build team A from registration_one captain + accepted seats
  SELECT COALESCE(ARRAY_AGG(st ORDER BY st.seat_number), '{}')
    INTO v_seats_one
  FROM public.universe_team_seats st
  WHERE st.registration_id = v_match.registration_one_id AND st.status = 'accepted';

  SELECT COALESCE(ARRAY_AGG(st ORDER BY st.seat_number), '{}')
    INTO v_seats_two
  FROM public.universe_team_seats st
  WHERE st.registration_id = v_match.registration_two_id AND st.status = 'accepted';

  INSERT INTO public.universe_rounds (event_id, round_number, match_id, status, started_at, ends_at, server_end_at)
  VALUES (
    v_match.event_id,
    COALESCE((SELECT MAX(round_number) FROM public.universe_rounds WHERE event_id = v_match.event_id), 0) + 1,
    p_match_id, 'active', NOW(),
    NOW() + (v_event.default_round_duration_seconds || ' seconds')::INTERVAL,
    NOW() + (v_event.default_round_duration_seconds || ' seconds')::INTERVAL
  ) RETURNING id, ('universe-round-' || gen_random_uuid()) INTO v_round_id, v_round_id;

  -- Team A
  INSERT INTO public.universe_round_teams (round_id, event_id, side, captain_user_id, seat_one_user_id, seat_two_user_id, seat_three_user_id)
  VALUES (
    v_round_id, v_match.event_id, 'A', v_match.box_one_captain_id,
    (SELECT invited_user_id FROM unnest(v_seats_one) st WHERE st.seat_number = 1 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_one) st WHERE st.seat_number = 2 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_one) st WHERE st.seat_number = 3 LIMIT 1)
  ) RETURNING id INTO v_team_a;

  -- Team B
  INSERT INTO public.universe_round_teams (round_id, event_id, side, captain_user_id, seat_one_user_id, seat_two_user_id, seat_three_user_id)
  VALUES (
    v_round_id, v_match.event_id, 'B', v_match.box_two_captain_id,
    (SELECT invited_user_id FROM unnest(v_seats_two) st WHERE st.seat_number = 1 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_two) st WHERE st.seat_number = 2 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_two) st WHERE st.seat_number = 3 LIMIT 1)
  ) RETURNING id INTO v_team_b;

  INSERT INTO public.universe_round_scores (round_id, team_id, captain_user_id) VALUES (v_round_id, v_team_a, v_match.box_one_captain_id);
  INSERT INTO public.universe_round_scores (round_id, team_id, captain_user_id) VALUES (v_round_id, v_team_b, v_match.box_two_captain_id);

  UPDATE public.universe_match_assignments SET status = 'active', updated_at = NOW() WHERE id = p_match_id;
  UPDATE public.universe_events SET status = 'active', current_round_id = v_round_id, updated_at = NOW() WHERE id = v_match.event_id;

  RETURN jsonb_build_object('success', true, 'round_id', v_round_id, 'team_a', v_team_a, 'team_b', v_team_b);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Apply a gift to a team (called from gifting flow). Only the Universe
--    Battle points multiplier changes; real earnings stay with the recipient.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_apply_gift(
  p_round_id UUID,
  p_team_id UUID,
  p_gift_recipient_user_id UUID,
  p_team_captain_user_id UUID,
  p_sender_id UUID,
  p_gift_id UUID,
  p_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score public.universe_round_scores;
  v_active_triple BOOLEAN := false;
  v_points BIGINT;
  v_unique INTEGER;
BEGIN
  -- Triple Gifts active? (3x on battle points only)
  SELECT EXISTS (
    SELECT 1 FROM public.universe_abilities a
    WHERE a.round_id = p_round_id AND a.target_team_id = p_team_id
      AND a.ability_type = 'triple_gifts' AND a.status = 'active'
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
  ) INTO v_active_triple;

  v_points := p_amount * (CASE WHEN v_active_triple THEN 3 ELSE 1 END);

  INSERT INTO public.universe_gift_events (
    event_id, round_id, team_id, gift_recipient_user_id, team_captain_user_id,
    sender_id, gift_id, amount, battle_points
  )
  SELECT e.event_id, p_round_id, p_team_id, p_gift_recipient_user_id, p_team_captain_user_id,
         p_sender_id, p_gift_id, p_amount, v_points
  FROM public.universe_rounds r
  JOIN public.universe_events e ON e.id = r.event_id
  WHERE r.id = p_round_id;

  SELECT * INTO v_score FROM public.universe_round_scores WHERE round_id = p_round_id AND team_id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Score row missing');
  END IF;

  -- Attribute contribution to the correct seat/captain slot
  UPDATE public.universe_round_scores s
  SET actual_score = s.actual_score + v_points,
      displayed_score = s.displayed_score + v_points,
      captain_score_contribution = CASE WHEN s.captain_user_id = p_gift_recipient_user_id THEN s.captain_score_contribution + v_points ELSE s.captain_score_contribution END,
      seat_one_score_contribution = CASE WHEN (SELECT seat_one_user_id FROM public.universe_round_teams t WHERE t.id = s.team_id) = p_gift_recipient_user_id THEN s.seat_one_score_contribution + v_points ELSE s.seat_one_score_contribution END,
      seat_two_score_contribution = CASE WHEN (SELECT seat_two_user_id FROM public.universe_round_teams t WHERE t.id = s.team_id) = p_gift_recipient_user_id THEN s.seat_two_score_contribution + v_points ELSE s.seat_two_score_contribution END,
      seat_three_score_contribution = CASE WHEN (SELECT seat_three_user_id FROM public.universe_round_teams t WHERE t.id = s.team_id) = p_gift_recipient_user_id THEN s.seat_three_score_contribution + v_points ELSE s.seat_three_score_contribution END,
      highest_single_gift = GREATEST(s.highest_single_gift, v_points),
      updated_at = NOW()
  WHERE s.id = v_score.id;

  SELECT COUNT(DISTINCT sender_id) INTO v_unique FROM public.universe_gift_events WHERE round_id = p_round_id AND team_id = p_team_id;
  UPDATE public.universe_round_scores SET unique_gifters = v_unique WHERE id = v_score.id;

  RETURN jsonb_build_object('success', true, 'battle_points', v_points, 'triple', v_active_triple);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Troll Bag claim (server randomly awards an ability). Client never picks.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_claim_troll_bag(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_round public.universe_rounds;
  v_event public.universe_events;
  v_ability_types TEXT[] := ARRAY['triple_gifts','timer_troll','hidden_challenger_score','turtle_mode','troll_mode','officer_fee','scramble_score'];
  v_pick TEXT;
  v_dur INTEGER;
  v_durations JSONB;
  v_claim_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO v_round FROM public.universe_rounds WHERE id = p_round_id;
  IF NOT FOUND OR v_round.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not active');
  END IF;
  SELECT * INTO v_event FROM public.universe_events WHERE id = v_round.event_id;

  -- One unprocessed claim per user per round
  IF EXISTS (
    SELECT 1 FROM public.universe_troll_bag_claims c
    WHERE c.round_id = p_round_id AND c.claimed_by_user_id = v_uid AND c.status IN ('pending','granted')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bag already claimed this round');
  END IF;

  v_durations := COALESCE(v_event.ability_settings->'durations', '{}'::jsonb);
  v_pick := v_ability_types[floor(random() * array_length(v_ability_types, 1)) + 1];

  v_dur := CASE v_pick
    WHEN 'triple_gifts' THEN COALESCE((v_durations->>'triple_gifts')::INT, 30)
    WHEN 'timer_troll' THEN 0
    WHEN 'hidden_challenger_score' THEN COALESCE((v_durations->>'hidden_challenger_score')::INT, 30)
    WHEN 'turtle_mode' THEN 0
    WHEN 'troll_mode' THEN COALESCE((v_durations->>'troll_mode')::INT, 20)
    WHEN 'officer_fee' THEN 0
    WHEN 'scramble_score' THEN COALESCE((v_durations->>'scramble_score')::INT, 20)
    ELSE 0 END;

  INSERT INTO public.universe_troll_bag_claims (event_id, round_id, match_id, claimed_by_user_id, ability_type, status, granted_at)
  VALUES (v_round.event_id, p_round_id, v_round.match_id, v_uid, v_pick, 'granted', NOW())
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id, 'ability_type', v_pick, 'duration_seconds', v_dur);
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Activate an ability awarded to the user (instant + timed effects).
--    Applies server-side score/timer mutations for instant effects.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_activate_ability(
  p_ability_id UUID,
  p_target_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ability public.universe_abilities;
  v_round public.universe_rounds;
  v_now TIMESTAMPTZ := NOW();
  v_event public.universe_events;
  v_target_score public.universe_round_scores;
  v_opp_score public.universe_round_scores;
  v_min_remaining INTEGER;
  v_new_end TIMESTAMPTZ;
  v_event_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_ability FROM public.universe_abilities WHERE id = p_ability_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ability not found');
  END IF;
  IF v_ability.awarded_to_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your ability');
  END IF;
  IF v_ability.status NOT IN ('awarded','available') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ability not activatable');
  END IF;

  SELECT * INTO v_round FROM public.universe_rounds WHERE id = v_ability.round_id;
  IF NOT FOUND OR v_round.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not active');
  END IF;
  SELECT * INTO v_event FROM public.universe_events WHERE id = v_round.event_id;
  v_event_id := v_event.id;

  -- Stacking / single-deception-effect guard
  IF v_ability.ability_type IN ('troll_mode','scramble_score') THEN
    IF EXISTS (
      SELECT 1 FROM public.universe_abilities a
      WHERE a.round_id = v_round.id AND a.target_team_id = p_target_team_id
        AND a.ability_type IN ('troll_mode','scramble_score')
        AND a.status = 'active' AND (a.expires_at IS NULL OR a.expires_at > v_now)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A score-deception effect is already active — queued after it ends');
    END IF;
  END IF;

  v_ability.expires_at := CASE WHEN v_ability.duration_seconds > 0
    THEN v_now + (v_ability.duration_seconds || ' seconds')::INTERVAL ELSE NULL END;

  -- Apply the effect server-side for instant abilities
  CASE v_ability.ability_type
    WHEN 'timer_troll' THEN
      v_min_remaining := GREATEST(5, EXTRACT(EPOCH FROM (v_round.server_end_at - v_now))::INT - 30);
      v_new_end := v_now + (v_min_remaining || ' seconds')::INTERVAL;
      UPDATE public.universe_rounds SET server_end_at = v_new_end, ends_at = v_new_end, updated_at = NOW() WHERE id = v_round.id;

    WHEN 'turtle_mode' THEN
      v_min_remaining := LEAST(600, EXTRACT(EPOCH FROM (v_round.server_end_at - v_now))::INT * 2);
      v_new_end := v_now + (v_min_remaining || ' seconds')::INTERVAL;
      UPDATE public.universe_rounds SET server_end_at = v_new_end, ends_at = v_new_end, updated_at = NOW() WHERE id = v_round.id;

    WHEN 'officer_fee' THEN
      SELECT * INTO v_target_score FROM public.universe_round_scores WHERE round_id = v_round.id AND team_id = p_target_team_id FOR UPDATE;
      UPDATE public.universe_round_scores
      SET actual_score = GREATEST(0, actual_score - (actual_score * 10 / 100)),
          displayed_score = GREATEST(0, displayed_score - (displayed_score * 10 / 100)),
          updated_at = NOW()
      WHERE id = v_target_score.id;

    ELSE
      -- timed effects (triple_gifts, hidden_challenger_score, troll_mode, scramble_score):
      -- nothing to mutate on scores/timer; rendered client-side from status.
      NULL;
  END CASE;

  UPDATE public.universe_abilities
  SET status = 'active', activated_at = v_now, reveal_at = v_now, expires_at = v_ability.expires_at, updated_at = NOW()
  WHERE id = v_ability.id;

  INSERT INTO public.universe_ability_events (
    ability_id, event_id, round_id, activated_by_user_id, target_team_id, ability_type, status, expires_at
  ) VALUES (
    v_ability.id, v_event_id, v_round.id, v_uid, p_target_team_id, v_ability.ability_type, 'active', v_ability.expires_at
  );

  RETURN jsonb_build_object('success', true, 'ability_type', v_ability.ability_type, 'expires_at', v_ability.expires_at);
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Finalize round + advance queue (atomic). Determines winner by ACTUAL
--     score, removes loser, pulls next captain, resets scores. Winner stays.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_finalize_round(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round public.universe_rounds;
  v_event public.universe_events;
  v_team_a public.universe_round_teams;
  v_team_b public.universe_round_teams;
  v_score_a public.universe_round_scores;
  v_score_b public.universe_round_scores;
  v_winner_side TEXT;
  v_winner_captain UUID;
  v_loser_captain UUID;
  v_next_reg public.universe_registrations;
  v_next_seats public.universe_team_seats[];
  v_new_team UUID;
  v_loser_box_cap UUID;
  v_winner_box_cap UUID;
  v_match public.universe_match_assignments;
  v_round_dur INTEGER;
BEGIN
  SELECT * INTO v_round FROM public.universe_rounds WHERE id = p_round_id;
  IF NOT FOUND OR v_round.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not active');
  END IF;
  SELECT * INTO v_event FROM public.universe_events WHERE id = v_round.event_id;
  v_round_dur := v_event.default_round_duration_seconds;

  SELECT * INTO v_team_a FROM public.universe_round_teams WHERE round_id = v_round.id AND side = 'A';
  SELECT * INTO v_team_b FROM public.universe_round_teams WHERE round_id = v_round.id AND side = 'B';
  SELECT * INTO v_score_a FROM public.universe_round_scores WHERE round_id = v_round.id AND team_id = v_team_a.id;
  SELECT * INTO v_score_b FROM public.universe_round_scores WHERE round_id = v_round.id AND team_id = v_team_b.id;

  -- Tie-break: actual score -> unique gifters -> highest single gift
  IF v_score_a.actual_score > v_score_b.actual_score THEN v_winner_side := 'A';
  ELSIF v_score_b.actual_score > v_score_a.actual_score THEN v_winner_side := 'B';
  ELSIF v_score_a.unique_gifters > v_score_b.unique_gifters THEN v_winner_side := 'A';
  ELSIF v_score_b.unique_gifters > v_score_a.unique_gifters THEN v_winner_side := 'B';
  ELSIF v_score_a.highest_single_gift > v_score_b.highest_single_gift THEN v_winner_side := 'A';
  ELSIF v_score_b.highest_single_gift > v_score_a.highest_single_gift THEN v_winner_side := 'B';
  ELSE v_winner_side := 'A'; -- first to tied score
  END IF;

  IF v_winner_side = 'A' THEN
    v_winner_captain := v_team_a.captain_user_id; v_loser_captain := v_team_b.captain_user_id;
    v_winner_box_cap := v_team_a.captain_user_id; v_loser_box_cap := v_team_b.captain_user_id;
  ELSE
    v_winner_captain := v_team_b.captain_user_id; v_loser_captain := v_team_a.captain_user_id;
    v_winner_box_cap := v_team_b.captain_user_id; v_loser_box_cap := v_team_a.captain_user_id;
  END IF;

  -- Lock the round: stop writes, expire effects
  UPDATE public.universe_rounds
  SET status = 'completed', winner_side = v_winner_side,
      winning_captain_id = v_winner_captain, losing_captain_id = v_loser_captain,
      actual_duration_seconds = EXTRACT(EPOCH FROM (NOW() - v_round.started_at))::INT,
      updated_at = NOW()
  WHERE id = v_round.id;

  UPDATE public.universe_abilities SET status = 'expired', updated_at = NOW()
  WHERE round_id = v_round.id AND status = 'active';

  -- Mark loser registration eliminated + remove from queue
  UPDATE public.universe_registrations SET status = 'completed', updated_at = NOW()
  WHERE captain_user_id = v_loser_captain AND event_id = v_round.event_id;
  UPDATE public.universe_queue SET status = 'eliminated', updated_at = NOW()
  WHERE captain_user_id = v_loser_captain AND event_id = v_round.event_id;

  -- Pull next eligible registered captain (not yet battled / eliminated)
  SELECT r.* INTO v_next_reg FROM public.universe_registrations r
  WHERE r.event_id = v_round.event_id
    AND r.status IN ('confirmed','submitted','checked_in')
    AND r.captain_user_id <> v_winner_captain
    AND NOT EXISTS (SELECT 1 FROM public.universe_queue q WHERE q.event_id = r.event_id AND q.captain_user_id = r.captain_user_id AND q.status = 'eliminated')
  ORDER BY r.registered_at ASC
  LIMIT 1;

  IF v_next_reg IS NULL THEN
    -- No more challengers -> champion
    UPDATE public.universe_events
    SET status = 'completed', champion_user_id = v_winner_captain, updated_at = NOW()
    WHERE id = v_round.event_id;
    PERFORM public.universe_set_champion(v_round.event_id, v_winner_captain);
    RETURN jsonb_build_object('success', true, 'winner_side', v_winner_side, 'champion', v_winner_captain, 'event_over', true);
  END IF;

  -- Build the new team on the LOSER's side (insert into the match assignment
  -- by rotating: winner stays, loser replaced). We create a fresh match
  -- assignment for the next round.
  SELECT COALESCE(ARRAY_AGG(st ORDER BY st.seat_number), '{}')
    INTO v_next_seats
  FROM public.universe_team_seats st
  WHERE st.registration_id = v_next_reg.id AND st.status = 'accepted';

  INSERT INTO public.universe_match_assignments (
    event_id, registration_one_id, registration_two_id, box_one_captain_id, box_two_captain_id,
    scheduled_start, opponent_reveal_at, status
  ) VALUES (
    v_round.event_id, v_next_reg.id,
    (SELECT id FROM public.universe_registrations WHERE captain_user_id = v_winner_captain AND event_id = v_round.event_id),
    (CASE WHEN v_winner_side = 'A' THEN v_winner_captain ELSE v_next_reg.captain_user_id END),
    (CASE WHEN v_winner_side = 'A' THEN v_next_reg.captain_user_id ELSE v_winner_captain END),
    v_event.scheduled_start, v_event.opponent_reveal_at, 'scheduled'
  );

  -- Queue the new challenger
  INSERT INTO public.universe_queue (event_id, registration_id, captain_user_id, position, status)
  VALUES (v_round.event_id, v_next_reg.id, v_next_reg.captain_user_id,
          (SELECT COALESCE(MAX(position),0)+1 FROM public.universe_queue WHERE event_id = v_round.event_id), 'next')
  ON CONFLICT (event_id, registration_id) DO UPDATE SET status = 'next', updated_at = NOW();

  UPDATE public.universe_registrations SET status = 'scheduled', scheduled_battle_at = v_event.scheduled_start, updated_at = NOW()
  WHERE id = v_next_reg.id;

  RETURN jsonb_build_object('success', true, 'winner_side', v_winner_side, 'winner_captain', v_winner_captain, 'next_challenger', v_next_reg.captain_user_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Set champion + record result
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_set_champion(p_event_id UUID, p_champion UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_round public.universe_rounds;
  v_team public.universe_round_teams;
  v_score public.universe_round_scores;
  v_gift_total BIGINT;
  v_unique INTEGER;
BEGIN
  SELECT * INTO v_final_round FROM public.universe_rounds
  WHERE event_id = p_event_id ORDER BY round_number DESC LIMIT 1;
  SELECT * INTO v_team FROM public.universe_round_teams
  WHERE round_id = v_final_round.id AND captain_user_id = p_champion LIMIT 1;
  SELECT * INTO v_score FROM public.universe_round_scores
  WHERE round_id = v_final_round.id AND team_id = v_team.id;

  SELECT COALESCE(SUM(battle_points),0), COUNT(DISTINCT sender_id)
    INTO v_gift_total, v_unique
  FROM public.universe_gift_events
  WHERE round_id = v_final_round.id AND team_id = v_team.id;

  INSERT INTO public.universe_event_results (
    event_id, champion_user_id, champion_seat_one, champion_seat_two, champion_seat_three,
    total_rounds_won, total_actual_score, team_gift_total, captain_contribution,
    seat_one_contribution, seat_two_contribution, seat_three_contribution,
    unique_supporters, highest_single_gift, final_battle_result
  ) VALUES (
    p_event_id, p_champion, v_team.seat_one_user_id, v_team.seat_two_user_id, v_team.seat_three_user_id,
    (SELECT COUNT(*) FROM public.universe_rounds WHERE event_id = p_event_id AND winning_captain_id = p_champion),
    v_score.actual_score, v_gift_total, v_score.captain_score_contribution,
    v_score.seat_one_score_contribution, v_score.seat_two_score_contribution, v_score.seat_three_score_contribution,
    v_unique, v_score.highest_single_gift, 'winner'
  );

  RETURN jsonb_build_object('success', true, 'champion', p_champion);
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. Admin: mark no-show / disqualify / emergency seat substitution
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_admin_action(
  p_event_id UUID,
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_universe_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO public.universe_admin_actions (event_id, admin_user_id, action, target_user_id, details)
  VALUES (p_event_id, v_uid, p_action, p_target_user_id, p_details);

  CASE p_action
    WHEN 'disqualify' THEN
      UPDATE public.universe_registrations SET status = 'disqualified', updated_at = NOW()
      WHERE event_id = p_event_id AND captain_user_id = p_target_user_id;
      UPDATE public.universe_queue SET status = 'disqualified', updated_at = NOW()
      WHERE event_id = p_event_id AND captain_user_id = p_target_user_id;
    WHEN 'no_show' THEN
      UPDATE public.universe_registrations SET status = 'no_show', updated_at = NOW()
      WHERE event_id = p_event_id AND captain_user_id = p_target_user_id;
    WHEN 'cancel_event' THEN
      UPDATE public.universe_events SET status = 'cancelled', updated_at = NOW() WHERE id = p_event_id;
    WHEN 'pause' THEN
      UPDATE public.universe_events SET status = 'paused', updated_at = NOW() WHERE id = p_event_id;
    WHEN 'resume' THEN
      UPDATE public.universe_events SET status = 'active', updated_at = NOW() WHERE id = p_event_id;
    ELSE NULL;
  END CASE;

  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- Grant execute on part-2 RPCs
GRANT EXECUTE ON FUNCTION public.universe_start_round(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_apply_gift(UUID, UUID, UUID, UUID, UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_claim_troll_bag(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_activate_ability(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_finalize_round(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_set_champion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_admin_action(UUID, TEXT, UUID, JSONB) TO authenticated;
