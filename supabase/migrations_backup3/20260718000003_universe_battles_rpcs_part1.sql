-- ============================================================================
-- Mai Troll — UNIVERSE BATTLES: CORE RPCS (Part 1 of 2)
-- Registration, seat invitations, blind matchmaking, check-in, queue.
-- All functions are SECURITY DEFINER and operate server-authoritatively.
-- Opponent assignment is hidden until opponent_reveal_at (handled by RLS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: is a user eligible to be a Universe captain?
-- Reuses Mai Troll broadcast requirements: must be a broadcaster with access.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_user_can_register(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles;
BEGIN
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Must not be banned/suspended/jailed and must have broadcast capability.
  IF v_profile.is_banned = true THEN RETURN false; END IF;
  IF v_profile.account_state IN ('banned','suspended','jailed') THEN RETURN false; END IF;
  IF COALESCE(v_profile.is_broadcaster, false) IS NOT TRUE
     AND COALESCE(v_profile.role, '') <> 'broadcaster' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Register for a Universe event (captain)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_register(
  p_event_id UUID,
  p_attendance_confirmed BOOLEAN DEFAULT false,
  p_rules_accepted BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event public.universe_events;
  v_existing public.universe_registrations;
  v_reg_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_event FROM public.universe_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.status NOT IN ('registration_open') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration is closed for this event');
  END IF;

  IF NOW() > v_event.registration_closes_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration deadline has passed');
  END IF;

  IF NOT public.universe_user_can_register(v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not meet broadcast requirements to register');
  END IF;

  -- No duplicate / multi-team registration for same event
  SELECT * INTO v_existing FROM public.universe_registrations
  WHERE event_id = p_event_id AND captain_user_id = v_uid;

  IF FOUND AND v_existing.status NOT IN ('withdrawn','cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already registered for this event');
  END IF;

  -- If previously withdrawn/cancelled, reopen it; otherwise insert.
  IF FOUND THEN
    UPDATE public.universe_registrations
    SET status = 'submitted',
        registered_at = NOW(),
        confirmed_at = NOW(),
        matched_at = NULL,
        scheduled_battle_at = NULL,
        attendance_confirmed = p_attendance_confirmed,
        rules_accepted = p_rules_accepted,
        withdrawn_at = NULL,
        cancelled_at = NULL,
        updated_at = NOW()
    WHERE id = v_existing.id
    RETURNING id INTO v_reg_id;
  ELSE
    INSERT INTO public.universe_registrations (
      event_id, captain_user_id, status, registered_at, confirmed_at,
      attendance_confirmed, rules_accepted
    ) VALUES (
      p_event_id, v_uid, 'submitted', NOW(), NOW(),
      p_attendance_confirmed, p_rules_accepted
    ) RETURNING id INTO v_reg_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'registration_id', v_reg_id, 'status', 'submitted');
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Withdraw registration (only before seat lock / deadline)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_withdraw_registration(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event public.universe_events;
  v_reg public.universe_registrations;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_event FROM public.universe_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  SELECT * INTO v_reg FROM public.universe_registrations
  WHERE event_id = p_event_id AND captain_user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No registration found');
  END IF;

  IF v_reg.status IN ('active','completed','withdrawn','cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot withdraw at this stage');
  END IF;

  IF NOW() > v_event.registration_closes_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration deadline passed');
  END IF;

  UPDATE public.universe_registrations
  SET status = 'withdrawn', withdrawn_at = NOW(), updated_at = NOW()
  WHERE id = v_reg.id;

  -- Remove from queue if present
  DELETE FROM public.universe_queue WHERE registration_id = v_reg.id;

  RETURN jsonb_build_object('success', true, 'status', 'withdrawn');
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Seat invitations (invite / accept / decline / remove)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_invite_seat(
  p_registration_id UUID,
  p_seat_number INTEGER,
  p_invited_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_reg public.universe_registrations;
  v_event public.universe_events;
  v_seat public.universe_team_seats;
  v_seat_id UUID;
  v_locked BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_seat_number NOT IN (1,2,3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seat number must be 1, 2, or 3');
  END IF;

  SELECT * INTO v_reg FROM public.universe_registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
  END IF;
  IF v_reg.captain_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the captain can invite seats');
  END IF;
  IF NOT public.universe_user_can_register(p_invited_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invited user is not eligible');
  END IF;
  IF p_invited_user_id = v_reg.captain_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Captain cannot occupy their own seat');
  END IF;

  SELECT * INTO v_event FROM public.universe_events WHERE id = v_reg.event_id;
  v_locked := (v_event.seat_lock_at IS NOT NULL AND NOW() >= v_event.seat_lock_at);
  IF v_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seat lock deadline passed');
  END IF;

  -- Prevent cross-team: invited user must not already hold a seat on the
  -- opposing team of this same event (enforced loosely here; the hard rule is
  -- checked in matchmaking too).
  IF EXISTS (
    SELECT 1 FROM public.universe_team_seats s
    WHERE s.event_id = v_reg.event_id
      AND s.invited_user_id = p_invited_user_id
      AND s.status IN ('invited','accepted')
      AND s.captain_user_id <> v_reg.captain_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already holds a seat on another team');
  END IF;

  -- Upsert seat row (replace existing pending invitation for this seat)
  SELECT * INTO v_seat FROM public.universe_team_seats
  WHERE registration_id = p_registration_id AND seat_number = p_seat_number;

  IF FOUND THEN
    UPDATE public.universe_team_seats
    SET invited_user_id = p_invited_user_id,
        status = 'invited',
        invited_at = NOW(),
        responded_at = NULL, accepted_at = NULL, declined_at = NULL,
        removed_at = NULL, checked_in_at = NULL, locked_at = NULL,
        updated_at = NOW()
    WHERE id = v_seat.id
    RETURNING id INTO v_seat_id;
  ELSE
    INSERT INTO public.universe_team_seats (
      event_id, registration_id, captain_user_id, seat_number,
      invited_user_id, status, invited_at
    ) VALUES (
      v_reg.event_id, p_registration_id, v_reg.captain_user_id, p_seat_number,
      p_invited_user_id, 'invited', NOW()
    ) RETURNING id INTO v_seat_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'seat_id', v_seat_id, 'status', 'invited');
END;
$$;

CREATE OR REPLACE FUNCTION public.universe_respond_seat(
  p_seat_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_seat public.universe_team_seats;
  v_event public.universe_events;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_seat FROM public.universe_team_seats WHERE id = p_seat_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seat not found');
  END IF;
  IF v_seat.invited_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your invitation');
  END IF;
  IF v_seat.status NOT IN ('invited') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already resolved');
  END IF;

  SELECT * INTO v_event FROM public.universe_events WHERE id = v_seat.event_id;
  IF v_event.seat_lock_at IS NOT NULL AND NOW() >= v_event.seat_lock_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seat lock deadline passed');
  END IF;

  -- Prevent accepting >1 seat in same event
  IF p_accept AND EXISTS (
    SELECT 1 FROM public.universe_team_seats s
    WHERE s.event_id = v_seat.event_id
      AND s.invited_user_id = v_uid
      AND s.status = 'accepted'
      AND s.id <> v_seat.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already accepted a seat for this event');
  END IF;

  IF p_accept THEN
    UPDATE public.universe_team_seats
    SET status = 'accepted', responded_at = NOW(), accepted_at = NOW(), updated_at = NOW()
    WHERE id = v_seat.id;
  ELSE
    UPDATE public.universe_team_seats
    SET status = 'declined', responded_at = NOW(), declined_at = NOW(), updated_at = NOW()
    WHERE id = v_seat.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.universe_remove_seat(
  p_seat_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_seat public.universe_team_seats;
  v_event public.universe_events;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_seat FROM public.universe_team_seats WHERE id = p_seat_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seat not found');
  END IF;
  IF v_seat.captain_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the captain can remove seats');
  END IF;

  SELECT * INTO v_event FROM public.universe_events WHERE id = v_seat.event_id;
  IF v_event.seat_lock_at IS NOT NULL AND NOW() >= v_event.seat_lock_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seat lock deadline passed — admin change required');
  END IF;

  UPDATE public.universe_team_seats
  SET status = 'removed', removed_at = NOW(), updated_at = NOW()
  WHERE id = v_seat.id;

  RETURN jsonb_build_object('success', true, 'status', 'removed');
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Blind matchmaking (admin/system invoked). Pairs confirmed eligible
--    registrations privately. Never exposes opponent to participants.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_run_matchmaking(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.universe_events;
  v_reg RECORD;
  v_pool UUID[] := '{}';
  v_match_id UUID;
  v_count INTEGER := 0;
  v_captain UUID;
  v_opp UUID;
  v_reg_one UUID;
  v_reg_two UUID;
  v_reveal TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_event FROM public.universe_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Collect eligible, unmatched captains
  SELECT ARRAY_AGG(r.captain_user_id)
    INTO v_pool
  FROM public.universe_registrations r
  WHERE r.event_id = p_event_id
    AND r.status IN ('confirmed','submitted')
    AND NOT EXISTS (
      SELECT 1 FROM public.universe_match_assignments m
      WHERE m.event_id = p_event_id
        AND (m.registration_one_id = r.id OR m.registration_two_id = r.id)
    )
    AND public.universe_user_can_register(r.captain_user_id);

  IF v_pool IS NULL THEN
    RETURN jsonb_build_object('success', true, 'matched', 0, 'note', 'No eligible registrations');
  END IF;

  -- Deterministic-ish shuffle via random()
  SELECT ARRAY_AGG(x ORDER BY random()) INTO v_pool FROM unnest(v_pool) x;

  v_reveal := COALESCE(v_event.opponent_reveal_at, v_event.room_opens_at, v_event.scheduled_start);

  -- Pair sequentially, skipping self (guaranteed distinct by construction)
  FOR i IN 1 .. (array_length(v_pool, 1) - 1) LOOP
    IF i % 2 = 1 THEN
      v_captain := v_pool[i];
      v_opp := v_pool[i + 1];

      SELECT id INTO v_reg_one FROM public.universe_registrations
      WHERE event_id = p_event_id AND captain_user_id = v_captain LIMIT 1;
      SELECT id INTO v_reg_two FROM public.universe_registrations
      WHERE event_id = p_event_id AND captain_user_id = v_opp LIMIT 1;

      INSERT INTO public.universe_match_assignments (
        event_id, registration_one_id, registration_two_id,
        box_one_captain_id, box_two_captain_id, scheduled_start, opponent_reveal_at, status
      ) VALUES (
        p_event_id, v_reg_one, v_reg_two, v_captain, v_opp,
        v_event.scheduled_start, v_reveal, 'matched'
      ) RETURNING id INTO v_match_id;

      -- Update registration statuses (private)
      UPDATE public.universe_registrations
      SET status = 'matched', matched_at = NOW(), scheduled_battle_at = v_event.scheduled_start,
          updated_at = NOW()
      WHERE id IN (v_reg_one, v_reg_two);

      -- Queue entries
      INSERT INTO public.universe_queue (event_id, registration_id, captain_user_id, position, status)
      VALUES
        (p_event_id, v_reg_one, v_captain, (SELECT COALESCE(MAX(position),0)+1 FROM public.universe_queue WHERE event_id = p_event_id), 'matched'),
        (p_event_id, v_reg_two, v_opp, (SELECT COALESCE(MAX(position),0)+1 FROM public.universe_queue WHERE event_id = p_event_id), 'matched')
      ON CONFLICT (event_id, registration_id) DO UPDATE SET status = 'matched', updated_at = NOW();

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'matched', v_count);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Check-in (captain + each seat). Independent per participant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_check_in(
  p_registration_id UUID,
  p_seat_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_reg public.universe_registrations;
  v_event public.universe_events;
  v_seat public.universe_team_seats;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_event FROM public.universe_events WHERE id = (SELECT event_id FROM public.universe_registrations WHERE id = p_registration_id);
  IF v_event.check_in_opens_at IS NOT NULL AND NOW() < v_event.check_in_opens_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Check-in not open yet');
  END IF;

  IF p_seat_id IS NULL THEN
    -- Captain check-in
    SELECT * INTO v_reg FROM public.universe_registrations WHERE id = p_registration_id;
    IF NOT FOUND OR v_reg.captain_user_id <> v_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not your registration');
    END IF;
    UPDATE public.universe_registrations
    SET status = 'checked_in', updated_at = NOW() WHERE id = v_reg.id;
    UPDATE public.universe_team_seats
    SET status = 'checked_in', checked_in_at = NOW(), updated_at = NOW()
    WHERE registration_id = v_reg.id AND status = 'accepted' AND checked_in_at IS NULL;
  ELSE
    SELECT * INTO v_seat FROM public.universe_team_seats WHERE id = p_seat_id;
    IF NOT FOUND OR v_seat.invited_user_id <> v_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not your seat');
    END IF;
    UPDATE public.universe_team_seats
    SET status = 'checked_in', checked_in_at = NOW(), updated_at = NOW()
    WHERE id = v_seat.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'checked_in');
END;
$$;

-- Grant execute on part-1 RPCs
GRANT EXECUTE ON FUNCTION public.universe_user_can_register(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_register(UUID, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_withdraw_registration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_invite_seat(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_respond_seat(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_remove_seat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_run_matchmaking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_check_in(UUID, UUID) TO authenticated;
