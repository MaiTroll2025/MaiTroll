ALTER TABLE public.mai_calendar_events
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agora_channel text,
  ADD COLUMN IF NOT EXISTS official_host_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS live_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_guest_slots smallint NOT NULL DEFAULT 8;

CREATE UNIQUE INDEX IF NOT EXISTS mai_calendar_events_agora_channel_unique
  ON public.mai_calendar_events(agora_channel)
  WHERE agora_channel IS NOT NULL;

ALTER TABLE public.mai_calendar_events
  DROP CONSTRAINT IF EXISTS mai_calendar_events_max_guest_slots_check;
ALTER TABLE public.mai_calendar_events
  ADD CONSTRAINT mai_calendar_events_max_guest_slots_check
  CHECK (max_guest_slots BETWEEN 1 AND 8);

CREATE OR REPLACE FUNCTION public.guard_mai_official_event_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.is_official THEN
    RAISE EXCEPTION 'Official events must be created by the server';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.is_official IS DISTINCT FROM OLD.is_official
    OR NEW.agora_channel IS DISTINCT FROM OLD.agora_channel
    OR NEW.official_host_id IS DISTINCT FROM OLD.official_host_id
    OR NEW.live_started_at IS DISTINCT FROM OLD.live_started_at
    OR NEW.live_ended_at IS DISTINCT FROM OLD.live_ended_at
    OR NEW.max_guest_slots IS DISTINCT FROM OLD.max_guest_slots
  ) THEN
    RAISE EXCEPTION 'Official event controls are server-managed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_mai_official_event_fields
  ON public.mai_calendar_events;
CREATE TRIGGER guard_mai_official_event_fields
  BEFORE INSERT OR UPDATE ON public.mai_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_mai_official_event_fields();
REVOKE ALL ON FUNCTION public.guard_mai_official_event_fields()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.mai_official_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.mai_calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'removed')),
  assigned_slot smallint CHECK (assigned_slot BETWEEN 1 AND 8),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id),
  CONSTRAINT mai_official_event_participants_slot_state_check
    CHECK ((status = 'approved' AND assigned_slot IS NOT NULL)
      OR (status <> 'approved' AND assigned_slot IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS mai_official_event_participant_slot_unique
  ON public.mai_official_event_participants(event_id, assigned_slot)
  WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS public.mai_official_event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.mai_calendar_events(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mai_official_event_messages_event_created_idx
  ON public.mai_official_event_messages(event_id, created_at);

CREATE TABLE IF NOT EXISTS public.mai_official_event_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  event_id uuid NOT NULL REFERENCES public.mai_calendar_events(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mai_official_event_gifts_no_self_gift CHECK (sender_id <> recipient_id)
);

ALTER TABLE public.mai_official_event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_official_event_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_official_event_gifts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mai_official_event_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mai_official_event_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mai_official_event_gifts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mai_official_event_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mai_official_event_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mai_official_event_gifts TO service_role;

CREATE OR REPLACE FUNCTION public.approve_mai_official_event_participant(
  p_event_id uuid,
  p_user_id uuid
)
RETURNS TABLE(assigned_slot smallint, free_coin_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_event public.mai_calendar_events%ROWTYPE;
  v_participant public.mai_official_event_participants%ROWTYPE;
  v_slot smallint;
  v_balance bigint;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT * INTO v_event
  FROM public.mai_calendar_events
  WHERE id = p_event_id AND is_official
  FOR UPDATE;
  IF NOT FOUND OR v_event.visibility <> 'public'
    OR v_event.status NOT IN ('upcoming', 'live') THEN
    RAISE EXCEPTION 'Official event is not accepting participants';
  END IF;

  SELECT * INTO v_participant
  FROM public.mai_official_event_participants
  WHERE event_id = p_event_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant request not found';
  END IF;

  IF v_participant.status = 'approved' THEN
    SELECT up.free_coin_balance INTO v_balance
    FROM public.user_profiles up WHERE up.id = p_user_id;
    RETURN QUERY SELECT v_participant.assigned_slot, COALESCE(v_balance, 0);
    RETURN;
  END IF;
  IF v_participant.status <> 'requested' THEN
    RAISE EXCEPTION 'Participant request is not pending';
  END IF;

  SELECT candidate.slot::smallint INTO v_slot
  FROM generate_series(1, v_event.max_guest_slots) AS candidate(slot)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.mai_official_event_participants p
    WHERE p.event_id = p_event_id
      AND p.status = 'approved'
      AND p.assigned_slot = candidate.slot
  )
  ORDER BY candidate.slot
  LIMIT 1;
  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'All guest camera slots are full';
  END IF;

  UPDATE public.mai_official_event_participants
  SET status = 'approved',
      assigned_slot = v_slot,
      approved_at = now(),
      updated_at = now()
  WHERE id = v_participant.id;

  UPDATE public.user_profiles
  SET free_coin_balance = COALESCE(free_coin_balance, 0) + 100,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING free_coin_balance INTO v_balance;

  IF FOUND THEN
    INSERT INTO public.coin_ledger(user_id, delta, bucket, source, ref_id, reason, metadata)
    VALUES (
      p_user_id,
      100,
      'free',
      'mai_official_event',
      p_event_id::text,
      'Official event participant starter balance',
      jsonb_build_object('participant_id', v_participant.id)
    );
  END IF;

  RETURN QUERY SELECT v_slot, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_mai_official_event_participant(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mai_official_event_participant(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.post_mai_official_event_message(
  p_event_id uuid,
  p_sender_id uuid,
  p_display_name text,
  p_content text
)
RETURNS TABLE(id uuid, sender_id uuid, display_name text, content text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count integer;
  v_status text;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_content IS NULL OR char_length(btrim(p_content)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Message must be 1 to 1000 characters';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_event_id::text), hashtext(p_sender_id::text));

  SELECT e.status INTO v_status
  FROM public.mai_calendar_events e
  WHERE e.id = p_event_id AND e.is_official AND e.visibility = 'public';
  IF v_status IS DISTINCT FROM 'live' THEN
    RAISE EXCEPTION 'Event chat is only available while the event is live';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.mai_official_event_messages m
  WHERE m.event_id = p_event_id
    AND m.sender_id = p_sender_id
    AND m.created_at >= now() - interval '10 seconds';
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Please wait before sending another message';
  END IF;

  RETURN QUERY
  INSERT INTO public.mai_official_event_messages(event_id, sender_id, display_name, content)
  VALUES (p_event_id, p_sender_id, left(btrim(p_display_name), 80), btrim(p_content))
  RETURNING
    mai_official_event_messages.id,
    mai_official_event_messages.sender_id,
    mai_official_event_messages.display_name,
    mai_official_event_messages.content,
    mai_official_event_messages.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.post_mai_official_event_message(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_mai_official_event_message(uuid, uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.send_mai_official_event_gift(
  p_event_id uuid,
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount integer,
  p_request_id uuid
)
RETURNS TABLE(free_coin_balance bigint, duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_event public.mai_calendar_events%ROWTYPE;
  v_existing public.mai_official_event_gifts%ROWTYPE;
  v_balance bigint;
  v_inserted_id uuid;
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100
    OR p_sender_id = p_recipient_id OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Invalid gift request';
  END IF;

  SELECT * INTO v_event
  FROM public.mai_calendar_events
  WHERE id = p_event_id AND is_official
  FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'live' THEN
    RAISE EXCEPTION 'Official event is not live';
  END IF;

  SELECT * INTO v_existing
  FROM public.mai_official_event_gifts
  WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.event_id <> p_event_id
      OR v_existing.sender_id <> p_sender_id
      OR v_existing.recipient_id <> p_recipient_id
      OR v_existing.amount <> p_amount THEN
      RAISE EXCEPTION 'Gift request ID does not match the original transaction';
    END IF;
    SELECT up.free_coin_balance INTO v_balance
    FROM public.user_profiles up WHERE up.id = p_sender_id;
    RETURN QUERY SELECT COALESCE(v_balance, 0), true;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mai_official_event_participants
    WHERE event_id = p_event_id AND user_id = p_sender_id AND status = 'approved'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.mai_official_event_participants
    WHERE event_id = p_event_id AND user_id = p_recipient_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Both gift participants must be approved guests';
  END IF;

  UPDATE public.user_profiles
  SET free_coin_balance = free_coin_balance - p_amount,
      updated_at = now()
  WHERE id = p_sender_id AND free_coin_balance >= p_amount
  RETURNING free_coin_balance INTO v_balance;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough free coins';
  END IF;

  UPDATE public.user_profiles
  SET free_coin_balance = free_coin_balance + p_amount,
      updated_at = now()
  WHERE id = p_recipient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift recipient profile not found';
  END IF;

  INSERT INTO public.mai_official_event_gifts(request_id, event_id, sender_id, recipient_id, amount)
  VALUES (p_request_id, p_event_id, p_sender_id, p_recipient_id, p_amount)
  RETURNING id INTO v_inserted_id;

  INSERT INTO public.coin_ledger(user_id, delta, bucket, source, ref_id, reason, metadata)
  VALUES
    (p_sender_id, -p_amount, 'free', 'mai_official_event_gift', v_inserted_id::text,
      'Official event gift sent', jsonb_build_object('event_id', p_event_id, 'recipient_id', p_recipient_id)),
    (p_recipient_id, p_amount, 'free', 'mai_official_event_gift', v_inserted_id::text,
      'Official event gift received', jsonb_build_object('event_id', p_event_id, 'sender_id', p_sender_id));

  RETURN QUERY SELECT v_balance, false;
END;
$$;

REVOKE ALL ON FUNCTION public.send_mai_official_event_gift(uuid, uuid, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_mai_official_event_gift(uuid, uuid, uuid, integer, uuid)
  TO service_role;
