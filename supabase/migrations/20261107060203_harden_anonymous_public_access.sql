-- Harden anonymous access while preserving anonymous LiveKit viewer tokens.
BEGIN;

REVOKE ALL ON TABLE public.user_profiles FROM anon;

-- Payment records are written only by trusted payment/webhook workflows.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payment_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.payment_logs FROM PUBLIC;
GRANT SELECT ON TABLE public.payment_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_logs TO service_role;
DROP POLICY IF EXISTS "admins_can_update_payments" ON public.payment_logs;

-- Treelz tips must be initiated by the authenticated sender. Anonymous users
-- may still read public Treelz content, but cannot move coins.
CREATE OR REPLACE FUNCTION public.send_treelz_tip(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_post_id UUID,
  p_amount BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_balance BIGINT;
  v_post_author UUID;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR p_from_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Sender must match authenticated user';
  END IF;
  IF p_to_user_id IS NULL OR p_from_user_id IS NOT DISTINCT FROM p_to_user_id THEN
    RAISE EXCEPTION 'Invalid tip recipient';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'Invalid tip amount';
  END IF;

  SELECT user_id
  INTO v_post_author
  FROM public.treelz_posts
  WHERE id = p_post_id
  FOR SHARE;

  IF v_post_author IS NULL OR v_post_author IS DISTINCT FROM p_to_user_id THEN
    RAISE EXCEPTION 'Invalid Treelz post recipient';
  END IF;

  SELECT troll_coins
  INTO v_from_balance
  FROM public.user_profiles
  WHERE id = p_from_user_id
  FOR UPDATE;

  IF COALESCE(v_from_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_amount
  WHERE id = p_from_user_id;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins + p_amount
  WHERE id = p_to_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, type, source, description, related_post_id)
  VALUES
    (p_from_user_id, -p_amount, 'spend', 'treelz_tip', 'Treelz tip to user', p_post_id),
    (p_to_user_id, p_amount, 'earn', 'treelz_tip', 'Received Treelz tip', p_post_id);

  INSERT INTO public.treelz_tips (from_user_id, to_user_id, post_id, amount)
  VALUES (p_from_user_id, p_to_user_id, p_post_id, p_amount);

  UPDATE public.treelz_posts
  SET gifts_received = gifts_received + 1,
      coins_received = coins_received + p_amount,
      updated_at = NOW()
  WHERE id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_treelz_tip(UUID, UUID, UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_treelz_tip(UUID, UUID, UUID, BIGINT) TO authenticated, service_role;

-- Seat joins are authenticated-only. The function derives the price from the
-- stream row and ignores the caller's advisory p_price value.
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
  IF auth.role() <> 'service_role' AND auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;
  IF p_seat_index IS NULL OR p_seat_index < 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid seat index');
  END IF;
  IF p_user_id IS NULL OR (
    auth.role() <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authenticated user does not match seat owner');
  END IF;
  IF p_guest_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Guest identity must use the guest seat endpoint');
  END IF;

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

  SELECT EXISTS (
    SELECT 1
    FROM public.stream_seat_sessions
    WHERE stream_id = p_stream_id
      AND user_id = p_user_id
      AND COALESCE(price_paid, 0) > 0
  )
  INTO v_has_paid;

  v_effective_price := CASE WHEN v_has_paid THEN 0 ELSE v_server_price END;
  IF v_effective_price > 0 THEN
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
    p_stream_id, p_seat_index, p_user_id, NULL, v_effective_price, 'active', NOW()
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
