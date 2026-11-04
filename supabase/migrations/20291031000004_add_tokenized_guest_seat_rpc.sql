-- Anonymous seat access uses a server-issued, short-lived bearer identity.
-- The client never chooses the guest_id stored in a seat session.

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_seat_identities (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  last_join_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guest_seat_identity_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issue_count INTEGER NOT NULL DEFAULT 0 CHECK (issue_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_guest_seat_identities_expires_at
  ON public.guest_seat_identities (expires_at);

ALTER TABLE public.guest_seat_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_seat_identity_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_seat_identities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.guest_seat_identity_rate_limits FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stream_seat_sessions'
      AND column_name = 'guest_id'
  ) THEN
    ALTER TABLE public.stream_seat_sessions ADD COLUMN guest_id TEXT;
  END IF;

  ALTER TABLE public.stream_seat_sessions ALTER COLUMN user_id DROP NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_guest_seat_identity(p_rate_key TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
  v_guest_id TEXT;
  v_rate_limit public.guest_seat_identity_rate_limits;
BEGIN
  IF p_rate_key IS NULL OR length(trim(p_rate_key)) < 8 OR length(p_rate_key) > 200 THEN
    RAISE EXCEPTION 'A valid guest identity rate key is required';
  END IF;

  INSERT INTO public.guest_seat_identity_rate_limits (rate_key)
  VALUES (trim(p_rate_key))
  ON CONFLICT (rate_key) DO NOTHING;

  SELECT *
  INTO v_rate_limit
  FROM public.guest_seat_identity_rate_limits
  WHERE rate_key = trim(p_rate_key)
  FOR UPDATE;

  IF v_rate_limit.window_started_at <= now() - interval '1 hour' THEN
    UPDATE public.guest_seat_identity_rate_limits
    SET window_started_at = now(), issue_count = 0
    WHERE rate_key = trim(p_rate_key);
    v_rate_limit.issue_count := 0;
  END IF;

  IF v_rate_limit.issue_count >= 10 THEN
    RAISE EXCEPTION 'Guest identity issuance rate limit exceeded';
  END IF;

  UPDATE public.guest_seat_identity_rate_limits
  SET issue_count = issue_count + 1
  WHERE rate_key = trim(p_rate_key);

  v_token := gen_random_uuid();
  v_guest_id := 'guest-' || gen_random_uuid()::TEXT;

  INSERT INTO public.guest_seat_identities (token, guest_id)
  VALUES (v_token, v_guest_id);

  RETURN jsonb_build_object(
    'token', v_token,
    'guest_id', v_guest_id,
    'expires_at', now() + interval '2 hours'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_guest_seat_identities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.guest_seat_identities
  WHERE expires_at <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.guest_seat_identity_rate_limits
  WHERE window_started_at <= now() - interval '2 hours';

  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_guest_seat_atomic(
  p_stream_id UUID,
  p_seat_index INTEGER,
  p_guest_token UUID,
  p_price INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity public.guest_seat_identities;
  v_stream JSONB;
  v_seat_locked BOOLEAN;
  v_price_text TEXT;
  v_server_price INTEGER;
  v_session_id UUID;
BEGIN
  IF p_seat_index IS NULL OR p_seat_index < 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid seat index');
  END IF;

  UPDATE public.guest_seat_identities
  SET last_join_at = now()
  WHERE token = p_guest_token
    AND expires_at > now()
    AND (last_join_at IS NULL OR last_join_at < now() - interval '2 seconds')
  RETURNING * INTO v_identity;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or rate-limited guest identity');
  END IF;

  SELECT to_jsonb(s), COALESCE(s.are_seats_locked, false)
  INTO v_stream, v_seat_locked
  FROM public.streams AS s
  WHERE s.id = p_stream_id
  FOR UPDATE;

  IF v_stream IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
  END IF;
  IF v_seat_locked THEN
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

  IF v_server_price > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Anonymous guests cannot join paid seats'
    );
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

  INSERT INTO public.stream_seat_sessions (
    stream_id, seat_index, user_id, guest_id, price_paid, status, joined_at
  )
  VALUES (
    p_stream_id, p_seat_index, NULL, v_identity.guest_id, v_server_price, 'active', now()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_guest_seat_identity(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_guest_seat_identities() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_guest_seat_atomic(UUID, INTEGER, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_guest_seat_identity(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_guest_seat_identities() TO service_role;
GRANT EXECUTE ON FUNCTION public.join_guest_seat_atomic(UUID, INTEGER, UUID, INTEGER) TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stream_seat_sessions
    WHERE status IN ('reserved', 'camera_starting', 'active', 'live')
    GROUP BY stream_id, seat_index
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add active-seat uniqueness index while duplicate active seats exist';
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.idx_unique_active_seat;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_occupied_seat
  ON public.stream_seat_sessions (stream_id, seat_index)
  WHERE status IN ('reserved', 'camera_starting', 'active', 'live');

COMMIT;
