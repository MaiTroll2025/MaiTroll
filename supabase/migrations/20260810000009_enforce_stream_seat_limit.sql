-- Migration: Enforce max 3 seats per user per broadcast (admin exempt)
-- Description: Prevents regular users from joining more than 3 active seats
--              in a single broadcast. Admins are exempt.

CREATE OR REPLACE FUNCTION public.join_seat_atomic(
  p_stream_id UUID,
  p_seat_index INTEGER,
  p_price INTEGER DEFAULT 0,
  p_user_id UUID DEFAULT NULL,
  p_guest_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_user_balance BIGINT;
  v_effective_price INTEGER := COALESCE(p_price, 0);
  v_has_paid BOOLEAN := FALSE;
  v_are_seats_locked BOOLEAN := FALSE;
  v_is_admin BOOLEAN := FALSE;
  v_active_seat_count INTEGER := 0;
BEGIN
  -- Check if seats are locked for this stream
  SELECT COALESCE(are_seats_locked, false) INTO v_are_seats_locked
  FROM public.streams
  WHERE id = p_stream_id;

  IF v_are_seats_locked THEN
    RETURN jsonb_build_object('success', false, 'message', 'Seats are currently locked');
  END IF;

  -- Validate inputs
  IF p_user_id IS NULL AND p_guest_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User ID or Guest ID required');
  END IF;

  -- Check if seat is occupied
  IF EXISTS (
    SELECT 1 FROM public.stream_seat_sessions
    WHERE stream_id = p_stream_id
    AND seat_index = p_seat_index
    AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Seat is occupied');
  END IF;

  -- Admin bypass: admins can join unlimited seats
  IF p_user_id IS NOT NULL THEN
    SELECT (
      is_admin = true OR
      role = 'admin' OR
      role = 'superadmin' OR
      role = 'ceo' OR
      is_superadmin = true
    ) INTO v_is_admin
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT v_is_admin THEN
      -- Count active seats for this user in this stream
      SELECT COUNT(*) INTO v_active_seat_count
      FROM public.stream_seat_sessions
      WHERE stream_id = p_stream_id
        AND user_id = p_user_id
        AND status IN ('reserved', 'camera_starting', 'active', 'live');

      IF v_active_seat_count >= 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'You have reached the maximum of 3 seats per broadcast');
      END IF;
    END IF;
  END IF;

  -- If user/guest already paid in this stream, skip charging again
  IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.stream_seat_sessions
      WHERE stream_id = p_stream_id
        AND user_id = p_user_id
        AND COALESCE(price_paid, 0) > 0
    ) INTO v_has_paid;
  ELSIF p_guest_id IS NOT NULL AND v_effective_price > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.stream_seat_sessions
      WHERE stream_id = p_stream_id
        AND guest_id = p_guest_id
        AND COALESCE(price_paid, 0) > 0
    ) INTO v_has_paid;
  END IF;

  IF v_has_paid THEN
    v_effective_price := 0;
  END IF;

  -- If Registered User -> Check Balance for Price
  IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
    IF COALESCE(v_user_balance, 0) < v_effective_price THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_effective_price
    WHERE id = p_user_id;
  END IF;

  -- Insert Session
  INSERT INTO public.stream_seat_sessions (stream_id, seat_index, user_id, guest_id, price_paid, status, joined_at)
  VALUES (p_stream_id, p_seat_index, p_user_id, p_guest_id, v_effective_price, 'active', NOW())
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_seat_atomic(UUID, INTEGER, INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_seat_atomic(UUID, INTEGER, INTEGER, UUID, TEXT) TO anon;
