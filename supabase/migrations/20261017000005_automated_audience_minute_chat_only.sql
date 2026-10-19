BEGIN;

ALTER TABLE public.automated_audience_settings
  DROP CONSTRAINT IF EXISTS automated_audience_settings_chat_min_interval_minutes_check,
  DROP CONSTRAINT IF EXISTS automated_audience_settings_chat_max_interval_minutes_check;

UPDATE public.automated_audience_settings
SET chat_min_interval_minutes = 1,
    chat_max_interval_minutes = 1,
    updated_at = now()
WHERE singleton;

ALTER TABLE public.automated_audience_settings
  ADD CONSTRAINT automated_audience_settings_chat_min_interval_minutes_check
    CHECK (chat_min_interval_minutes BETWEEN 1 AND 60),
  ADD CONSTRAINT automated_audience_settings_chat_max_interval_minutes_check
    CHECK (chat_max_interval_minutes BETWEEN 1 AND 60);

CREATE OR REPLACE FUNCTION public.automated_audience_set_settings(
  p_admin_user_id uuid,
  p_enabled boolean,
  p_chat_min_interval_minutes integer,
  p_chat_max_interval_minutes integer,
  p_gift_cooldown_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_chat_min_interval_minutes IS DISTINCT FROM 1
     OR p_chat_max_interval_minutes IS DISTINCT FROM 1
     OR p_gift_cooldown_minutes NOT BETWEEN 15 AND 240 THEN
    RAISE EXCEPTION 'Automated audience chat cadence is fixed at one minute';
  END IF;

  INSERT INTO public.automated_audience_settings (
    singleton, enabled, chat_min_interval_minutes, chat_max_interval_minutes,
    gift_cooldown_minutes, updated_by, updated_at
  )
  VALUES (
    true, p_enabled, 1, 1, p_gift_cooldown_minutes, p_admin_user_id, now()
  )
  ON CONFLICT (singleton) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      chat_min_interval_minutes = 1,
      chat_max_interval_minutes = 1,
      gift_cooldown_minutes = EXCLUDED.gift_cooldown_minutes,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  INSERT INTO public.automated_audience_logs (actor_id, event_type, details)
  VALUES (
    p_admin_user_id, 'settings_updated',
    jsonb_build_object('enabled', p_enabled, 'chat_interval_minutes', 1)
  );

  IF NOT p_enabled THEN
    UPDATE public.automated_audience_sessions
    SET status = 'paused', updated_at = now()
    WHERE status = 'active';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.automated_audience_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_account record;
  v_owner_id uuid;
  v_category text;
  v_title text;
  v_content text;
  v_event_id uuid;
  v_sequence bigint;
  v_stream_state jsonb;
  v_username text;
  v_display_name text;
  v_timestamp text;
  v_template integer;
  v_delivery_ok boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.automated_audience_settings
    WHERE singleton AND enabled
  ) THEN
    RETURN;
  END IF;

  FOR v_session IN
    SELECT s.id, s.stream_id
    FROM public.automated_audience_sessions s
    WHERE s.status = 'active'
      AND s.next_action_at <= now()
    ORDER BY s.next_action_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT to_jsonb(st) INTO v_stream_state
    FROM public.streams st
    WHERE st.id = v_session.stream_id;

    IF v_stream_state IS NULL
       OR lower(COALESCE(v_stream_state->>'status', '')) <> 'live'
       OR lower(COALESCE(v_stream_state->>'is_live', 'false')) <> 'true' THEN
      UPDATE public.automated_audience_sessions
      SET status = 'ended', ended_at = now(), updated_at = now()
      WHERE id = v_session.id;
      INSERT INTO public.automated_audience_logs (session_id, stream_id, event_type)
      VALUES (v_session.id, v_session.stream_id, 'inactive_broadcast_detected');
      CONTINUE;
    END IF;

    v_owner_id := COALESCE(
      v_stream_state->>'broadcaster_id',
      v_stream_state->>'user_id'
    )::uuid;
    v_category := LEFT(COALESCE(v_stream_state->>'category', 'live broadcast'), 60);
    v_title := LEFT(COALESCE(NULLIF(v_stream_state->>'title', ''), v_category), 100);

    SELECT a.user_id, p.username, p.avatar_url
    INTO v_account
    FROM public.automated_audience_accounts a
    JOIN public.user_profiles p ON p.id = a.user_id
    WHERE a.enabled
    ORDER BY random()
    LIMIT 1;

    IF NOT FOUND THEN
      UPDATE public.automated_audience_sessions
      SET next_action_at = now() + interval '1 minute', updated_at = now()
      WHERE id = v_session.id;
      INSERT INTO public.automated_audience_logs (session_id, stream_id, event_type)
      VALUES (v_session.id, v_session.stream_id, 'no_enabled_accounts');
      CONTINUE;
    END IF;

    v_username := COALESCE(NULLIF(v_account.username, ''), 'MaiTroll Audience');
    v_display_name := v_username || ' · automated';
    v_timestamp := clock_timestamp()::text;
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
    v_content := LEFT(v_content, 500);

    UPDATE public.automated_audience_sessions
    SET action_sequence = action_sequence + 1,
        last_action_at = now(),
        next_action_at = now() + interval '1 minute',
        updated_at = now()
    WHERE id = v_session.id
    RETURNING action_sequence INTO v_sequence;

    v_event_id := gen_random_uuid();
    INSERT INTO public.automated_audience_events (
      id, session_id, stream_id, account_id, event_type, content, idempotency_key
    )
    VALUES (
      v_event_id, v_session.id, v_session.stream_id, v_account.user_id,
      'chat', v_content, v_session.id::text || ':' || v_sequence::text
    );

    v_delivery_ok := true;
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object(
          'v', 1,
          't', 'chat',
          'stream_id', v_session.stream_id,
          'txn_id', v_event_id,
          'ts', v_timestamp,
          's', v_account.user_id,
          'd', jsonb_build_object(
            'content', v_content,
            'user_name', v_display_name,
            'user_avatar', v_account.avatar_url,
            'user_role', 'platform_controlled',
            'platform_controlled', true
          )
        ),
        'message',
        'broadcast-stream-' || v_session.stream_id::text,
        false
      );

      PERFORM realtime.send(
        jsonb_build_object(
          'id', v_event_id,
          'username', v_display_name,
          'content', v_content,
          'createdAt', (extract(epoch FROM now()) * 1000)::bigint,
          'avatarUrl', v_account.avatar_url,
          'is_platform_controlled', true
        ),
        'floating_chat',
        'floating-chat:' || v_session.stream_id::text,
        false
      );

      PERFORM realtime.send(
        jsonb_build_object(
          'id', v_event_id,
          'username', v_display_name,
          'content', v_content,
          'createdAt', (extract(epoch FROM now()) * 1000)::bigint,
          'avatarUrl', v_account.avatar_url,
          'is_platform_controlled', true
        ),
        'floating_chat',
        'stream-realtime:' || v_session.stream_id::text,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      v_delivery_ok := false;
      INSERT INTO public.automated_audience_logs (
        session_id, stream_id, actor_id, event_type, details
      )
      VALUES (
        v_session.id, v_session.stream_id, v_account.user_id,
        'realtime_delivery_failed',
        jsonb_build_object(
          'event_id', v_event_id,
          'action_type', 'chat',
          'error', SQLERRM,
          'sqlstate', SQLSTATE
        )
      );
    END;

    INSERT INTO public.automated_audience_logs (
      session_id, stream_id, actor_id, event_type, details
    )
    VALUES (
      v_session.id, v_session.stream_id, v_account.user_id,
      CASE WHEN v_delivery_ok THEN 'action_dispatched' ELSE 'action_delivery_failed' END,
      jsonb_build_object('event_id', v_event_id, 'action_type', 'chat')
    );
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.automated_audience_logs (event_type, details)
  VALUES (
    'scheduler_error',
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
END;
$$;

UPDATE public.automated_audience_sessions
SET next_action_at = now(), updated_at = now()
WHERE status = 'active';

COMMIT;
