-- ============================================================================
-- Mai Troll — UNIVERSE BATTLES: assign a stable LiveKit room name per round
-- so host + seat users (both teams) can publish, while registered viewers and
-- the queue watch via Mux low-latency playback. Winning users stay on LiveKit.
-- ============================================================================

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
  v_room_name TEXT;
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

  v_room_name := 'universe-round-' || gen_random_uuid();

  -- Build team A from registration_one captain + accepted seats
  SELECT COALESCE(ARRAY_AGG(st ORDER BY st.seat_number), '{}')
    INTO v_seats_one
    FROM public.universe_team_seats st
    WHERE st.registration_id = v_match.registration_one_id AND st.status = 'accepted';

  SELECT COALESCE(ARRAY_AGG(st ORDER BY st.seat_number), '{}')
    INTO v_seats_two
    FROM public.universe_team_seats st
    WHERE st.registration_id = v_match.registration_two_id AND st.status = 'accepted';

  INSERT INTO public.universe_rounds (event_id, round_number, match_id, status, started_at, ends_at, server_end_at, livekit_room_name)
  VALUES (
    v_match.event_id,
    COALESCE((SELECT MAX(round_number) FROM public.universe_rounds WHERE event_id = v_match.event_id), 0) + 1,
    p_match_id, 'active', NOW(),
    NOW() + (v_event.default_round_duration_seconds || ' seconds')::INTERVAL,
    NOW() + (v_event.default_round_duration_seconds || ' seconds')::INTERVAL,
    v_room_name
  ) RETURNING id INTO v_round_id;

  -- Team A
  INSERT INTO public.universe_round_teams (round_id, event_id, side, captain_user_id, seat_one_user_id, seat_two_user_id, seat_three_user_id, livekit_room_name)
  VALUES (
    v_round_id, v_match.event_id, 'A', v_match.box_one_captain_id,
    (SELECT invited_user_id FROM unnest(v_seats_one) st WHERE st.seat_number = 1 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_one) st WHERE st.seat_number = 2 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_one) st WHERE st.seat_number = 3 LIMIT 1),
    v_room_name
  ) RETURNING id INTO v_team_a;

  -- Team B
  INSERT INTO public.universe_round_teams (round_id, event_id, side, captain_user_id, seat_one_user_id, seat_two_user_id, seat_three_user_id, livekit_room_name)
  VALUES (
    v_round_id, v_match.event_id, 'B', v_match.box_two_captain_id,
    (SELECT invited_user_id FROM unnest(v_seats_two) st WHERE st.seat_number = 1 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_two) st WHERE st.seat_number = 2 LIMIT 1),
    (SELECT invited_user_id FROM unnest(v_seats_two) st WHERE st.seat_number = 3 LIMIT 1),
    v_room_name
  ) RETURNING id INTO v_team_b;

  INSERT INTO public.universe_round_scores (round_id, team_id, captain_user_id) VALUES (v_round_id, v_team_a, v_match.box_one_captain_id);
  INSERT INTO public.universe_round_scores (round_id, team_id, captain_user_id) VALUES (v_round_id, v_team_b, v_match.box_two_captain_id);

  UPDATE public.universe_match_assignments SET status = 'active', updated_at = NOW() WHERE id = p_match_id;
  UPDATE public.universe_events SET status = 'active', current_round_id = v_round_id, updated_at = NOW() WHERE id = v_match.event_id;

  RETURN jsonb_build_object('success', true, 'round_id', v_round_id, 'team_a', v_team_a, 'team_b', v_team_b, 'livekit_room_name', v_room_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.universe_start_round(UUID) TO authenticated;
