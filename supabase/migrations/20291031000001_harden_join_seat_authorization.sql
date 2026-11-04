-- Prevent callers from joining or charging seats on behalf of another account.
-- Anonymous guest joins use the dedicated tokenized RPC added later.

BEGIN;

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
  v_effective_price INTEGER := 0;
  v_has_paid BOOLEAN := FALSE;
  v_are_seats_locked BOOLEAN := FALSE;
  v_is_admin BOOLEAN := FALSE;
  v_active_seat_count INTEGER := 0;
  v_stream JSONB;
  v_server_price INTEGER := 0;
  v_price_text TEXT;
BEGIN
  IF p_seat_index IS NULL OR p_seat_index < 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid seat index');
  END IF;

  IF p_user_id IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authenticated user does not match seat owner');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registered user required');
  END IF;
  IF p_guest_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Guest identity must use the guest seat endpoint');
  END IF;

  -- Serialize all seat allocation and payment decisions for one stream.
  SELECT to_jsonb(s), COALESCE(s.are_seats_locked, false)
  INTO v_stream, v_are_seats_locked
  FROM public.streams AS s
  WHERE s.id = p_stream_id
  FOR UPDATE;

  IF v_stream IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
  END IF;

  IF v_are_seats_locked THEN
    RETURN jsonb_build_object('success', false, 'message', 'Seats are currently locked');
  END IF;

  v_price_text := COALESCE(
    v_stream -> 'seat_prices' ->> p_seat_index::TEXT,
    v_stream ->> 'seat_price'
  );
  IF v_price_text IS NOT NULL AND v_price_text !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid stream seat price');
  END IF;
  v_server_price := COALESCE(NULLIF(v_price_text, '')::INTEGER, 0);

  IF v_server_price > 0
     AND p_user_id IS DISTINCT FROM NULLIF(
       COALESCE(v_stream ->> 'broadcaster_id', v_stream ->> 'user_id'),
       ''
     )::UUID
     AND EXISTS (
       SELECT 1
       FROM public.user_subscriptions AS subscription
       WHERE subscription.subscriber_id = p_user_id
         AND subscription.broadcaster_id = NULLIF(
           COALESCE(v_stream ->> 'broadcaster_id', v_stream ->> 'user_id'),
           ''
         )::UUID
         AND subscription.is_active = TRUE
     ) THEN
    v_server_price := FLOOR(v_server_price * 0.9)::INTEGER;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stream_seat_sessions
    WHERE stream_id = p_stream_id
      AND seat_index = p_seat_index
      AND status IN ('reserved', 'camera_starting', 'active', 'live')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Seat is occupied');
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT (
      is_admin = true OR
      role IN ('admin', 'superadmin', 'ceo') OR
      is_superadmin = true
    )
    INTO v_is_admin
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT v_is_admin THEN
      SELECT COUNT(*)
      INTO v_active_seat_count
      FROM public.stream_seat_sessions
      WHERE stream_id = p_stream_id
        AND user_id = p_user_id
        AND status IN ('reserved', 'camera_starting', 'active', 'live');

      IF v_active_seat_count >= 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'You have reached the maximum of 3 seats per broadcast');
      END IF;
    END IF;
  END IF;

  IF p_user_id IS NOT NULL AND v_server_price > 0 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.stream_seat_sessions
      WHERE stream_id = p_stream_id
        AND user_id = p_user_id
        AND COALESCE(price_paid, 0) > 0
    )
    INTO v_has_paid;
  END IF;

  v_effective_price := v_server_price;
  IF v_has_paid THEN
    v_effective_price := 0;
  END IF;

  IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
    SELECT troll_coins
    INTO v_user_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF COALESCE(v_user_balance, 0) < v_effective_price THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_effective_price
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.stream_seat_sessions (
    stream_id, seat_index, user_id, guest_id, price_paid, status, joined_at
  )
  VALUES (
    p_stream_id, p_seat_index, p_user_id, p_guest_id, v_effective_price, 'active', NOW()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.join_seat_atomic(UUID, INTEGER, INTEGER, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_seat_atomic(UUID, INTEGER, INTEGER, UUID, TEXT) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.join_seat_atomic(uuid,integer,integer,uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.join_seat_atomic(UUID, INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
  END IF;
END;
$$;

COMMIT;
