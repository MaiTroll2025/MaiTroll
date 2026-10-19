BEGIN;

-- Allow 10-second chat cadence instead of forcing 1 minute
CREATE OR REPLACE FUNCTION public.automated_audience_set_settings(
  p_admin_user_id uuid,
  p_enabled boolean,
  p_chat_min_interval_seconds integer,
  p_chat_max_interval_seconds integer,
  p_gift_cooldown_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_chat_min_interval_seconds IS DISTINCT FROM 10
     OR p_chat_max_interval_seconds IS DISTINCT FROM 10
     OR p_gift_cooldown_seconds NOT BETWEEN 5 AND 14400 THEN
    RAISE EXCEPTION 'Automated audience chat cadence is fixed at ten seconds';
  END IF;

  INSERT INTO public.automated_audience_settings (
    singleton, enabled, chat_min_interval_seconds, chat_max_interval_seconds,
    gift_cooldown_seconds, updated_by, updated_at
  )
  VALUES (true, p_enabled, 10, 10, p_gift_cooldown_seconds, p_admin_user_id, now())
  ON CONFLICT (singleton) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      chat_min_interval_seconds = EXCLUDED.chat_min_interval_seconds,
      chat_max_interval_seconds = EXCLUDED.chat_max_interval_seconds,
      gift_cooldown_seconds = EXCLUDED.gift_cooldown_seconds,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  IF p_enabled THEN
    UPDATE public.automated_audience_sessions s
    SET status = 'active', next_action_at = now(), updated_at = now()
    FROM public.streams st
    WHERE s.stream_id = st.id
      AND s.admin_user_id = p_admin_user_id
      AND s.status = 'paused'
      AND lower(COALESCE(to_jsonb(st)->>'status', '')) = 'live'
      AND lower(COALESCE(to_jsonb(st)->>'is_live', 'false')) = 'true';
  ELSE
    UPDATE public.automated_audience_sessions
    SET status = 'paused', updated_at = now()
    WHERE status = 'active' AND admin_user_id = p_admin_user_id;
  END IF;

  INSERT INTO public.automated_audience_logs (actor_id, event_type, details)
  VALUES (
    p_admin_user_id, 'settings_updated',
    jsonb_build_object('enabled', p_enabled, 'chat_interval_seconds', 10)
  );
END;
$$;

-- Update dispatch session to use 10-second next_action_at and cooldown
CREATE OR REPLACE FUNCTION public.automated_audience_dispatch_session(
  p_session_id uuid,
  p_force_chat boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_account record;
  v_stream jsonb;
  v_action_type text;
  v_owner_id text;
  v_category text;
  v_title text;
  v_content text;
  v_event_id uuid;
  v_sequence bigint;
  v_roll double precision;
  v_template integer;
  v_gift record;
  v_username text;
  v_display_name text;
  v_timestamp text;
  v_delivery_ok boolean := true;
  v_delivery_error text;
BEGIN
  PERFORM pg_advisory_xact_lock(1800123456);

  IF NOT EXISTS (
    SELECT 1 FROM public.automated_audience_settings
    WHERE singleton AND enabled
  ) THEN
    RETURN;
  END IF;

  SELECT s.id, s.stream_id, s.status
  INTO v_session
  FROM public.automated_audience_sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'active' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.automated_audience_events e
    WHERE e.created_at > now() - interval '10 seconds'
      AND e.event_type IN ('chat', 'virtual_like', 'virtual_gift')
  ) THEN
    UPDATE public.automated_audience_sessions
    SET next_action_at = (
          SELECT max(e.created_at) + interval '10 seconds'
          FROM public.automated_audience_events e
          WHERE e.created_at > now() - interval '10 seconds'
            AND e.event_type IN ('chat', 'virtual_like', 'virtual_gift')
        ),
        updated_at = now()
    WHERE id = v_session.id;

    INSERT INTO public.automated_audience_logs (session_id, stream_id, event_type)
    VALUES (v_session.id, v_session.stream_id, 'global_action_cooldown');
    RETURN;
  END IF;

  SELECT to_jsonb(st) INTO v_stream
  FROM public.streams st
  WHERE st.id = v_session.stream_id;

  IF v_stream IS NULL
     OR lower(COALESCE(v_stream->>'status', '')) <> 'live'
     OR lower(COALESCE(v_stream->>'is_live', 'false')) <> 'true' THEN
    UPDATE public.automated_audience_sessions
    SET status = 'ended', ended_at = now(), updated_at = now()
    WHERE id = v_session.id;
    INSERT INTO public.automated_audience_logs (session_id, stream_id, event_type)
    VALUES (v_session.id, v_session.stream_id, 'inactive_broadcast_detected');
    RETURN;
  END IF;

  SELECT a.user_id, p.username, p.avatar_url
  INTO v_account
  FROM public.automated_audience_accounts a
  JOIN public.user_profiles p ON p.id = a.user_id
  WHERE a.enabled
  ORDER BY random()
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.automated_audience_sessions
    SET next_action_at = now() + interval '10 seconds', updated_at = now()
    WHERE id = v_session.id;
    INSERT INTO public.automated_audience_logs (session_id, stream_id, event_type)
    VALUES (v_session.id, v_session.stream_id, 'no_enabled_accounts');
    RETURN;
  END IF;

  v_owner_id := COALESCE(v_stream->>'broadcaster_id', v_stream->>'user_id');
  v_category := LEFT(COALESCE(v_stream->>'category', 'live broadcast'), 60);
  v_title := LEFT(COALESCE(NULLIF(v_stream->>'title', ''), v_category), 100);
  v_username := COALESCE(NULLIF(v_account.username, ''), 'MaiTroll Audience');
  v_display_name := v_username || ' · automated';
  v_timestamp := clock_timestamp()::text;
  v_roll := random();
  v_action_type := CASE
    WHEN p_force_chat OR v_roll < 0.55 THEN 'chat'
    WHEN v_roll < 0.8 THEN 'virtual_like'
    ELSE 'virtual_gift'
  END;

  IF v_action_type = 'virtual_gift' THEN
    SELECT gi.id, gi.name, gi.icon, COALESCE(gi.coin_cost, gi.value, 0)::bigint
    INTO v_gift
    FROM public.gift_items gi
    WHERE gi.status = 'active'
      AND COALESCE(gi.coin_cost, gi.value, 0) > 0
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_action_type = 'chat' THEN
    v_template := 1 + floor(random() * 12)::integer;
    v_content := CASE v_template
      WHEN 1 THEN 'Dude, you did it—I can’t believe it’s finally done!'
      WHEN 2 THEN 'How long did it take to finish ' || v_title || '?'
      WHEN 3 THEN 'Could this work in the app too?'
      WHEN 4 THEN 'Any idea when it might be available on iOS?'
      WHEN 5 THEN 'Is there AI built into the system?'
      WHEN 6 THEN 'What part of ' || v_title || ' took the longest to get right?'
      WHEN 7 THEN 'How long have you been working on this?'
      WHEN 8 THEN 'This came together really nicely!'
      WHEN 9 THEN 'What made you decide to build this?'
      WHEN 10 THEN 'Are you planning to add more features?'
      WHEN 11 THEN 'Can people use this on their phones?'
      ELSE 'What are you thinking of working on next?'
    END;
  ELSIF v_action_type = 'virtual_like' THEN
    v_content := 'sent a virtual demo like';
  ELSE
    v_content := 'sent a virtual demo gift 🎁';
  END IF;

  UPDATE public.automated_audience_sessions
  SET action_sequence = action_sequence + 1,
      last_action_at = now(),
      next_action_at = now() + interval '10 seconds',
      updated_at = now()
  WHERE id = v_session.id
  RETURNING action_sequence INTO v_sequence;

  v_event_id := gen_random_uuid();
  INSERT INTO public.automated_audience_events (
    id, session_id, stream_id, account_id, event_type, content, idempotency_key
  )
  VALUES (
    v_event_id, v_session.id, v_session.stream_id, v_account.user_id,
    v_action_type, v_content, v_session.id::text || ':' || v_sequence::text
  );

  BEGIN
    IF v_action_type = 'chat' THEN
      PERFORM realtime.send(
        jsonb_build_object(
          'v', 1, 't', 'chat', 'stream_id', v_session.stream_id,
          'txn_id', v_event_id, 'ts', v_timestamp, 's', v_account.user_id,
          'd', jsonb_build_object(
            'content', v_content, 'user_name', v_display_name,
            'user_avatar', v_account.avatar_url,
            'user_role', 'platform_controlled', 'platform_controlled', true
          )
        ),
        'message',
        'broadcast-stream-' || v_session.stream_id::text,
        false
      );

      PERFORM realtime.send(
        jsonb_build_object(
          'v', 1, 't', 'chat', 'stream_id', v_session.stream_id,
          'txn_id', v_event_id, 'ts', v_timestamp, 's', v_account.user_id,
          'd', jsonb_build_object(
            'content', v_content, 'user_name', v_display_name,
            'user_avatar', v_account.avatar_url,
            'user_role', 'platform_controlled', 'platform_controlled', true
          )
        ),
        'chat',
        'stream-chat:' || v_session.stream_id::text,
        false
      );

      PERFORM realtime.send(
        jsonb_build_object(
          'id', v_event_id, 'username', v_display_name,
          'content', v_content,
          'createdAt', (extract(epoch FROM now()) * 1000)::bigint,
          'avatarUrl', v_account.avatar_url,
          'is_platform_controlled', true
        ),
        'floating_chat',
        'floating-chat:' || v_session.stream_id::text,
        false
      );

    ELSE
      PERFORM realtime.send(
        jsonb_build_object(
          'stream_id', v_session.stream_id,
          'event_id', v_event_id,
          'activity', v_action_type,
          'account_id', v_account.user_id,
          'username', v_username,
          'avatar_url', v_account.avatar_url,
          'label', 'VIRTUAL AUDIENCE DEMO',
          'message', v_username || ' ' || v_content,
          'created_at', v_timestamp
        ),
        'virtual_audience_activity',
        'virtual-audience:' || v_session.stream_id::text,
        false
      );

      IF v_action_type = 'virtual_like' THEN
        PERFORM realtime.send(
          jsonb_build_object(
            'user_id', v_account.user_id,
            'stream_id', v_session.stream_id,
            'timestamp', v_timestamp
          ),
          'like_sent',
          'broadcast-stream-' || v_session.stream_id::text,
          false
        );

        PERFORM realtime.send(
          jsonb_build_object(
            'user_id', v_account.user_id,
            'stream_id', v_session.stream_id,
            'timestamp', v_timestamp
          ),
          'like_sent',
          'stream-realtime:' || v_session.stream_id::text,
          false
        );
      ELSIF v_action_type = 'virtual_gift' AND v_gift.id IS NOT NULL THEN
        INSERT INTO public.stream_gifts (
          stream_id, sender_id, receiver_id, gift_id, quantity, txn_key, metadata
        )
        VALUES (
          v_session.stream_id, v_account.user_id, v_owner_id::uuid, v_gift.id, 1,
          v_session.id::text || ':' || v_sequence::text,
          jsonb_build_object(
            'platform_controlled', true,
            'automated_audience', true,
            'gift_name', v_gift.name,
            'gift_icon', COALESCE(v_gift.icon, '🎁'),
            'txn_id', v_event_id
          )
        )
        ON CONFLICT (sender_id, txn_key) DO NOTHING;

        PERFORM realtime.send(
          jsonb_build_object(
            'id', v_event_id,
            'stream_id', v_session.stream_id,
            'gift_id', v_gift.id,
            'gift_name', v_gift.name,
            'gift_icon', COALESCE(v_gift.icon, '🎁'),
            'sender_id', v_account.user_id,
            'sender_name', v_display_name,
            'receiver_id', v_owner_id::uuid,
            'receiver_name', COALESCE(NULLIF(v_owner_id::text, ''), 'Broadcaster'),
            'amount', v_gift.cost,
            'quantity', 1,
            'timestamp', v_timestamp,
            'created_at', v_timestamp,
            'metadata', jsonb_build_object(
              'platform_controlled', true,
              'automated_audience', true,
              'gift_name', v_gift.name,
              'gift_icon', COALESCE(v_gift.icon, '🎁')
            )
          ),
          'gift_sent',
          'broadcast-stream-' || v_session.stream_id::text,
          false
        );

        PERFORM realtime.send(
          jsonb_build_object(
            'id', v_event_id,
            'stream_id', v_session.stream_id,
            'gift_id', v_gift.id,
            'gift_name', v_gift.name,
            'gift_icon', COALESCE(v_gift.icon, '🎁'),
            'sender_id', v_account.user_id,
            'sender_name', v_display_name,
            'receiver_id', v_owner_id::uuid,
            'receiver_name', COALESCE(NULLIF(v_owner_id::text, ''), 'Broadcaster'),
            'amount', v_gift.cost,
            'quantity', 1,
            'timestamp', v_timestamp,
            'created_at', v_timestamp,
            'metadata', jsonb_build_object(
              'platform_controlled', true,
              'automated_audience', true,
              'gift_name', v_gift.name,
              'gift_icon', COALESCE(v_gift.icon, '🎁')
            )
          ),
          'gift_sent',
          'stream-realtime:' || v_session.stream_id::text,
          false
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_delivery_ok := false;
    v_delivery_error := SQLERRM;
    INSERT INTO public.automated_audience_logs (
      session_id, stream_id, actor_id, event_type, details
    )
    VALUES (
      v_session.id, v_session.stream_id, v_account.user_id,
      'realtime_delivery_failed',
      jsonb_build_object(
        'event_id', v_event_id, 'action_type', v_action_type,
        'error', v_delivery_error, 'sqlstate', SQLSTATE
      )
    );
  END;

  INSERT INTO public.automated_audience_logs (
    session_id, stream_id, actor_id, event_type, details
  )
  VALUES (
    v_session.id, v_session.stream_id, v_account.user_id,
    CASE WHEN v_delivery_ok THEN 'action_dispatched' ELSE 'action_dispatch_failed' END,
    jsonb_build_object(
      'event_id', v_event_id,
      'action_type', v_action_type,
      'delivery_error', v_delivery_error
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.automated_audience_dispatch_session(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automated_audience_dispatch_session(uuid, boolean)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
