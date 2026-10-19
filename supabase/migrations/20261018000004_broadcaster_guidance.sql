BEGIN;

CREATE TABLE IF NOT EXISTS public.broadcaster_guidance_sequences (
  stream_id uuid PRIMARY KEY REFERENCES public.streams(id) ON DELETE CASCADE,
  broadcaster_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  client_type text NOT NULL CHECK (client_type IN ('web_desktop', 'mobile_web', 'native')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.broadcaster_guidance_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.broadcaster_guidance_sequences(stream_id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  account_id uuid NOT NULL REFERENCES public.automated_audience_accounts(user_id) ON DELETE RESTRICT,
  topic text NOT NULL,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'rejected', 'cancelled')),
  chat_message_id uuid REFERENCES public.stream_messages(id) ON DELETE SET NULL,
  failure_reason text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream_id, position),
  UNIQUE (stream_id, topic),
  UNIQUE (stream_id, account_id)
);

CREATE INDEX IF NOT EXISTS broadcaster_guidance_pending_idx
  ON public.broadcaster_guidance_deliveries (stream_id, scheduled_at)
  WHERE status = 'pending';

ALTER TABLE public.broadcaster_guidance_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcaster_guidance_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.broadcaster_guidance_sequences FROM anon, authenticated;
REVOKE ALL ON public.broadcaster_guidance_deliveries FROM anon, authenticated;
GRANT ALL ON public.broadcaster_guidance_sequences TO service_role;
GRANT ALL ON public.broadcaster_guidance_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.start_broadcaster_guidance(
  p_stream_id uuid,
  p_broadcaster_id uuid,
  p_client_type text,
  p_plan jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
  v_stream jsonb;
  v_started_at timestamptz;
  v_sequence_id uuid;
  v_plan_count integer;
BEGIN
  IF p_stream_id IS NULL OR p_broadcaster_id IS NULL
     OR p_client_type IS NULL
     OR p_client_type NOT IN ('web_desktop', 'mobile_web', 'native')
     OR jsonb_typeof(p_plan) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid broadcaster guidance request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_stream_id::text, 0));

  SELECT to_jsonb(s) INTO v_stream
  FROM public.streams s
  WHERE s.id = p_stream_id;

  IF v_stream IS NULL THEN
    RAISE EXCEPTION 'Broadcast not found';
  END IF;

  v_owner_id := COALESCE(
    NULLIF(v_stream->>'broadcaster_id', '')::uuid,
    NULLIF(v_stream->>'user_id', '')::uuid
  );
  IF v_owner_id IS DISTINCT FROM p_broadcaster_id
     OR lower(COALESCE(v_stream->>'status', '')) <> 'live'
     OR lower(COALESCE(v_stream->>'is_live', 'false')) <> 'true' THEN
    RAISE EXCEPTION 'Broadcast is not live for this broadcaster';
  END IF;

  SELECT stream_id INTO v_sequence_id
  FROM public.broadcaster_guidance_sequences
  WHERE stream_id = p_stream_id;

  IF v_sequence_id IS NOT NULL THEN
    RETURN jsonb_build_object('sequence_id', v_sequence_id, 'created', false);
  END IF;

  v_started_at := NULLIF(v_stream->>'started_at', '')::timestamptz;
  IF v_started_at IS NULL OR v_started_at < now() - interval '120 seconds' THEN
    RAISE EXCEPTION 'Guidance can only start shortly after a new broadcast goes live';
  END IF;

  SELECT count(*) INTO v_plan_count
  FROM jsonb_to_recordset(p_plan) AS plan(
    position integer,
    account_id uuid,
    topic text,
    content text,
    delay_seconds integer
  );

  IF v_plan_count NOT BETWEEN 1 AND 3
     OR EXISTS (
       SELECT 1
       FROM jsonb_to_recordset(p_plan) AS plan(
         position integer,
         account_id uuid,
         topic text,
         content text,
         delay_seconds integer
       )
       WHERE position IS NULL OR position NOT BETWEEN 1 AND 3
          OR account_id IS NULL
          OR topic IS NULL OR length(trim(topic)) = 0
          OR content IS NULL OR length(trim(content)) NOT BETWEEN 1 AND 500
          OR delay_seconds IS NULL OR delay_seconds NOT BETWEEN 0 AND 60
     )
     OR (SELECT count(DISTINCT plan.position)
         FROM jsonb_to_recordset(p_plan) AS plan(
           position integer, account_id uuid, topic text,
           content text, delay_seconds integer
         )) <> v_plan_count
     OR (SELECT count(DISTINCT plan.account_id)
         FROM jsonb_to_recordset(p_plan) AS plan(
           position integer, account_id uuid, topic text,
           content text, delay_seconds integer
         )) <> v_plan_count
     OR (SELECT count(DISTINCT plan.topic)
         FROM jsonb_to_recordset(p_plan) AS plan(
           position integer, account_id uuid, topic text,
           content text, delay_seconds integer
         )) <> v_plan_count THEN
    RAISE EXCEPTION 'Invalid broadcaster guidance plan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_plan) AS plan(
      position integer, account_id uuid, topic text,
      content text, delay_seconds integer
    )
    LEFT JOIN public.automated_audience_accounts a
      ON a.user_id = plan.account_id AND a.enabled
    LEFT JOIN public.user_profiles p ON p.id = a.user_id
    WHERE a.user_id IS NULL OR p.id IS NULL
      OR NULLIF(trim(p.username), '') IS NULL
      OR NULLIF(trim(p.avatar_url), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Guidance plan contains an unavailable account identity';
  END IF;

  INSERT INTO public.broadcaster_guidance_sequences (
    stream_id, broadcaster_id, client_type
  )
  VALUES (p_stream_id, p_broadcaster_id, p_client_type)
  RETURNING stream_id INTO v_sequence_id;

  INSERT INTO public.broadcaster_guidance_deliveries (
    stream_id, position, account_id, topic, content, scheduled_at
  )
  SELECT
    p_stream_id,
    plan.position::smallint,
    plan.account_id,
    plan.topic,
    trim(plan.content),
    now() + make_interval(secs => plan.delay_seconds)
  FROM jsonb_to_recordset(p_plan) AS plan(
    position integer,
    account_id uuid,
    topic text,
    content text,
    delay_seconds integer
  )
  ORDER BY plan.position;

  RETURN jsonb_build_object('sequence_id', v_sequence_id, 'created', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_broadcaster_guidance(
  p_stream_id uuid,
  p_message_id uuid,
  p_broadcaster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery public.broadcaster_guidance_deliveries%ROWTYPE;
  v_stream jsonb;
  v_stream_owner_id uuid;
  v_sequence_status text;
  v_account record;
  v_host_profile jsonb;
  v_restriction jsonb;
  v_moderation jsonb;
  v_message public.stream_messages%ROWTYPE;
  v_message_json jsonb;
BEGIN
  SELECT * INTO v_delivery
  FROM public.broadcaster_guidance_deliveries
  WHERE id = p_message_id AND stream_id = p_stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guidance message not found';
  END IF;

  SELECT status INTO v_sequence_status
  FROM public.broadcaster_guidance_sequences
  WHERE stream_id = p_stream_id AND broadcaster_id = p_broadcaster_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guidance sequence is not owned by this broadcaster';
  END IF;

  IF v_delivery.status = 'delivered' AND v_delivery.chat_message_id IS NOT NULL THEN
    SELECT * INTO v_message
    FROM public.stream_messages
    WHERE id = v_delivery.chat_message_id;

    SELECT a.user_id, p.username, p.avatar_url, p.role, p.troll_role, p.created_at
      INTO v_account
    FROM public.automated_audience_accounts a
    JOIN public.user_profiles p ON p.id = a.user_id
    WHERE a.user_id = v_delivery.account_id;

    IF v_message.id IS NULL OR v_account.user_id IS NULL THEN
      RAISE EXCEPTION 'Previously delivered guidance message is unavailable';
    END IF;

    v_message_json := jsonb_build_object(
      'id', v_message.id,
      'txn_id', v_message.id,
      'stream_id', v_message.stream_id,
      'user_id', v_message.user_id,
      'content', v_message.content,
      'created_at', v_message.created_at,
      'type', 'chat',
      'username', v_account.username,
      'user_name', v_account.username,
      'user_avatar', v_account.avatar_url,
      'user_role', v_account.role,
      'user_troll_role', v_account.troll_role,
      'user_created_at', v_account.created_at,
      'user_profiles', jsonb_build_object(
        'username', v_account.username,
        'avatar_url', v_account.avatar_url,
        'role', v_account.role,
        'troll_role', v_account.troll_role,
        'created_at', v_account.created_at
      )
    );

    RETURN jsonb_build_object('status', 'delivered', 'message', v_message_json);
  END IF;

  IF v_delivery.status <> 'pending' OR v_sequence_status <> 'active' THEN
    RETURN jsonb_build_object('status', v_delivery.status);
  END IF;

  SELECT to_jsonb(s) INTO v_stream
  FROM public.streams s
  WHERE s.id = p_stream_id;

  IF v_stream IS NULL
     OR lower(COALESCE(v_stream->>'status', '')) <> 'live'
     OR lower(COALESCE(v_stream->>'is_live', 'false')) <> 'true' THEN
    UPDATE public.broadcaster_guidance_sequences
    SET status = 'cancelled'
    WHERE stream_id = p_stream_id AND status = 'active';
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'cancelled', failure_reason = 'broadcast_ended'
    WHERE stream_id = p_stream_id AND status = 'pending';
    RETURN jsonb_build_object('status', 'cancelled');
  END IF;

  v_stream_owner_id := COALESCE(
    NULLIF(v_stream->>'broadcaster_id', '')::uuid,
    NULLIF(v_stream->>'user_id', '')::uuid
  );
  IF v_stream_owner_id IS DISTINCT FROM p_broadcaster_id THEN
    RAISE EXCEPTION 'Broadcast is not owned by this broadcaster';
  END IF;

  IF v_delivery.scheduled_at > now() + interval '1 second' THEN
    RETURN jsonb_build_object(
      'status', 'pending',
      'scheduled_at', v_delivery.scheduled_at
    );
  END IF;

  IF COALESCE(v_stream->>'subscriber_only_chat', 'false') = 'true' THEN
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'rejected', failure_reason = 'subscriber_only_chat'
    WHERE id = v_delivery.id;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'subscriber_only_chat');
  END IF;

  IF COALESCE(v_stream->>'is_chat_locked', 'false') = 'true'
     OR EXISTS (
       SELECT 1 FROM public.stream_settings s
       WHERE s.stream_id = p_stream_id
         AND COALESCE(s.paid_chat_enabled, false)
     ) THEN
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'rejected', failure_reason = 'chat_unavailable'
    WHERE id = v_delivery.id;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'chat_unavailable');
  END IF;

  SELECT a.user_id, p.username, p.avatar_url, p.role, p.troll_role, p.created_at
    INTO v_account
  FROM public.automated_audience_accounts a
  JOIN public.user_profiles p ON p.id = a.user_id
  WHERE a.user_id = v_delivery.account_id AND a.enabled;

  IF NOT FOUND OR NULLIF(trim(v_account.username), '') IS NULL
     OR NULLIF(trim(v_account.avatar_url), '') IS NULL THEN
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'rejected', failure_reason = 'account_unavailable'
    WHERE id = v_delivery.id;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'account_unavailable');
  END IF;

  SELECT public.check_user_chat_restriction(v_account.user_id, p_stream_id)
    INTO v_restriction;
  IF COALESCE((v_restriction->>'restricted')::boolean, true) THEN
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'rejected', failure_reason = 'sender_restricted'
    WHERE id = v_delivery.id;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'sender_restricted');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stream_bans b
    WHERE b.stream_id = p_stream_id
      AND b.user_id = v_account.user_id
      AND (b.expires_at IS NULL OR b.expires_at > now())
  ) OR EXISTS (
    SELECT 1
    FROM public.broadcast_mod_actions m
    WHERE m.target_user_id = v_account.user_id
      AND m.action_type = 'disable_chat'
      AND m.status = 'active'
      AND (m.expires_at IS NULL OR m.expires_at > now())
  ) THEN
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'rejected', failure_reason = 'chat_moderation'
    WHERE id = v_delivery.id;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'chat_moderation');
  END IF;

  SELECT to_jsonb(p) INTO v_host_profile
  FROM public.user_profiles p
  WHERE p.id = p_broadcaster_id;

  IF COALESCE((v_host_profile->>'broadcast_chat_disabled')::boolean, false)
     AND (
       NULLIF(v_host_profile->>'broadcast_chat_disabled_stream_id', '') IS NULL
       OR (v_host_profile->>'broadcast_chat_disabled_stream_id')::uuid = p_stream_id
     )
     AND (
       NULLIF(v_host_profile->>'broadcast_chat_disabled_until', '') IS NULL
       OR (v_host_profile->>'broadcast_chat_disabled_until')::timestamptz > now()
     ) THEN
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'rejected', failure_reason = 'broadcaster_chat_disabled'
    WHERE id = v_delivery.id;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'broadcaster_chat_disabled');
  END IF;

  SELECT public.moderate_user_content(
    v_account.user_id,
    v_delivery.content,
    'send_message',
    jsonb_build_object('stream_id', p_stream_id)
  ) INTO v_moderation;
  IF COALESCE((v_moderation->>'allowed')::boolean, false) IS NOT TRUE THEN
    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'rejected', failure_reason = 'content_moderation'
    WHERE id = v_delivery.id;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'content_moderation');
  END IF;

  INSERT INTO public.stream_messages (
    stream_id, user_id, content, type, username
  )
  VALUES (
    p_stream_id, v_account.user_id, v_delivery.content, 'chat', v_account.username
  )
  RETURNING * INTO v_message;

  UPDATE public.broadcaster_guidance_deliveries
  SET status = 'delivered',
      chat_message_id = v_message.id,
      delivered_at = now()
  WHERE id = v_delivery.id;

  v_message_json := jsonb_build_object(
    'id', v_message.id,
    'txn_id', v_message.id,
    'stream_id', v_message.stream_id,
    'user_id', v_message.user_id,
    'content', v_message.content,
    'created_at', v_message.created_at,
    'type', 'chat',
    'username', v_account.username,
    'user_name', v_account.username,
    'user_avatar', v_account.avatar_url,
    'user_role', v_account.role,
    'user_troll_role', v_account.troll_role,
    'user_created_at', v_account.created_at,
    'user_profiles', jsonb_build_object(
      'username', v_account.username,
      'avatar_url', v_account.avatar_url,
      'role', v_account.role,
      'troll_role', v_account.troll_role,
      'created_at', v_account.created_at
    )
  );

  RETURN jsonb_build_object('status', 'delivered', 'message', v_message_json);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcaster_guidance_mark_sequence_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status <> 'pending'
     AND NOT EXISTS (
       SELECT 1
       FROM public.broadcaster_guidance_deliveries
       WHERE stream_id = NEW.stream_id AND status = 'pending'
     ) THEN
    UPDATE public.broadcaster_guidance_sequences
    SET status = 'completed', completed_at = now()
    WHERE stream_id = NEW.stream_id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS broadcaster_guidance_mark_sequence_complete
  ON public.broadcaster_guidance_deliveries;
CREATE TRIGGER broadcaster_guidance_mark_sequence_complete
AFTER UPDATE OF status ON public.broadcaster_guidance_deliveries
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.broadcaster_guidance_mark_sequence_complete();

CREATE OR REPLACE FUNCTION public.broadcaster_guidance_cancel_on_broadcast_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF lower(COALESCE(NEW.status, '')) = 'ended' OR NEW.is_live IS FALSE THEN
    UPDATE public.broadcaster_guidance_sequences
    SET status = 'cancelled'
    WHERE stream_id = NEW.id AND status = 'active';

    UPDATE public.broadcaster_guidance_deliveries
    SET status = 'cancelled', failure_reason = 'broadcast_ended'
    WHERE stream_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS broadcaster_guidance_cancel_on_broadcast_end
  ON public.streams;
CREATE TRIGGER broadcaster_guidance_cancel_on_broadcast_end
AFTER UPDATE OF status, is_live ON public.streams
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.is_live IS DISTINCT FROM NEW.is_live)
EXECUTE FUNCTION public.broadcaster_guidance_cancel_on_broadcast_end();

REVOKE ALL ON FUNCTION public.start_broadcaster_guidance(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dispatch_broadcaster_guidance(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_broadcaster_guidance(uuid, uuid, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_broadcaster_guidance(uuid, uuid, uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.broadcaster_guidance_cancel_on_broadcast_end()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcaster_guidance_mark_sequence_complete()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
