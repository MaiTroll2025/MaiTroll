-- ============================================================================
-- MAI TROLL — FOUNDER PROGRAM (RPC LAYER)
-- ============================================================================
-- All Founder reads and writes go through SECURITY DEFINER functions.
-- Every function re-derives the actor from auth.uid(); the frontend can never
-- supply an actor id, role or permission field.
--
-- Founder authority is granted by `is_active_founder` only — it never widens
-- `is_modo_role`, so Troll Officers and other staff permissions are unchanged
-- and Founders gain no Admin or financial powers.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PUBLIC / SHARED READS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 Public Founder directory
--     Powers the gold username + Founder badge everywhere (web and phone).
--     Only presentation-safe columns are exposed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.founder_public_directory()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'founders', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id',           f.user_id,
          'username',          up.username,
          'display_name',      up.display_name,
          'avatar_url',        up.avatar_url,
          'start_at',          f.start_at,
          'end_at',            f.end_at,
          'gift_multiplier',   f.gift_multiplier,
          'cashout_multiplier', f.cashout_multiplier,
          -- Admins are never shown the Founder badge / gold username, so the
          -- client needs to know this to suppress the visual treatment.
          -- The Founder ECONOMICS (multipliers) still apply to them.
          'is_admin',          public.founder_user_is_admin(f.user_id)
        )
        ORDER BY f.end_at, up.username
      )
      FROM public.founders f
      JOIN public.user_profiles up ON up.id = f.user_id
      WHERE f.status = 'active'
        AND f.removed_at IS NULL
        AND f.end_at > now()
        AND COALESCE(up.account_deleted_at, NULL::timestamptz) IS NULL
    ), '[]'::jsonb),
    'server_time', now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_public_directory() TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 1.2 My Founder status (drives the Founder Status card + all gating)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.founder_my_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_status  text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  PERFORM public.founder_sync_expirations();

  SELECT * INTO v_founder FROM public.get_founder(v_actor);
  v_status := public.founder_effective_status(v_actor);

  IF v_founder.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_founder', false,
      'founder_status', v_status,
      'can_access_hub', public.can_access_founder_hub(v_actor),
      'is_admin_view', public.can_manage_founders(v_actor),
      'permissions', jsonb_build_object(
        'view_reports', false, 'arrest', false, 'release', false,
        'summon', false, 'schedule_broadcast', false, 'chat', false
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_founder', (v_status = 'active'),
    'founder_status', v_status,
    'founder_id', v_founder.id,
    'start_at', v_founder.start_at,
    'end_at', v_founder.end_at,
    'founder_start_date', v_founder.start_at,
    'founder_end_date', v_founder.end_at,
    'gift_multiplier', v_founder.gift_multiplier,
    'cashout_multiplier', v_founder.cashout_multiplier,
    'founder_multiplier', v_founder.gift_multiplier,
    'founder_cashout_multiplier', v_founder.cashout_multiplier,
    'days_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_founder.end_at - now())) / 86400))::integer,
    'term_months', GREATEST(
      1,
      ROUND(EXTRACT(EPOCH FROM (v_founder.end_at - v_founder.start_at)) / (86400 * 30.4375))::integer
    ),
    'notes', v_founder.notes,
    'created_at', v_founder.created_at,
    'can_access_hub', public.can_access_founder_hub(v_actor),
    'is_admin_view', public.can_manage_founders(v_actor),
    'permissions', jsonb_build_object(
      'view_reports',        public.can_founder_view_reports(v_actor),
      'arrest',              public.can_founder_arrest(v_actor),
      'release',             public.can_founder_release(v_actor),
      'summon',              public.can_founder_summon(v_actor),
      'schedule_broadcast',  public.can_founder_schedule_broadcast(v_actor),
      'chat',                public.can_founder_use_chat(v_actor)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_my_status() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1.3 Upcoming scheduled broadcast for a profile (public banner)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.founder_upcoming_broadcast(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'broadcast', (
      SELECT jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'scheduled_for', s.scheduled_for,
        'duration_minutes', s.duration_minutes,
        'category', s.category,
        'status', s.status,
        'stream_id', s.stream_id,
        'username', up.username,
        'display_name', up.display_name,
        'avatar_url', up.avatar_url,
        'is_founder', public.is_active_founder(s.user_id)
      )
      FROM public.founder_scheduled_broadcasts s
      JOIN public.user_profiles up ON up.id = s.user_id
      WHERE s.user_id = p_user_id
        AND s.status = 'scheduled'
        AND s.scheduled_for >= now() - interval '1 hour'
      ORDER BY s.scheduled_for ASC
      LIMIT 1
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_upcoming_broadcast(uuid) TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 1.4 Founder Hub gate (used by the route guard + nav gating)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.founder_hub_access()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'can_access', public.can_access_founder_hub(auth.uid()),
    'is_active_founder', public.is_active_founder(auth.uid()),
    'is_admin', public.can_manage_founders(auth.uid()),
    'founder_status', public.founder_effective_status(auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_hub_access() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_list_gift_rewards(
  p_founder_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target uuid;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_access_founder_hub(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'Founder access is required.');
  END IF;

  IF public.can_manage_founders(v_actor) THEN
    v_target := p_founder_user_id;
  ELSE
    IF p_founder_user_id IS NOT NULL AND p_founder_user_id <> v_actor THEN
      RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'You can only view your own Founder rewards.');
    END IF;
    v_target := v_actor;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'rewards', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT b.id,
               b.founder_user_id,
               COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown') AS founder_username,
               b.stream_id,
               COALESCE(NULLIF(s.title, ''), 'Broadcast') AS stream_title,
               COALESCE(NULLIF(sg.gift_type, ''), 'Gift') AS gift_name,
               b.gift_amount,
               b.base_creator_reward,
               b.founder_multiplier,
               b.founder_bonus,
               b.final_creator_reward,
               b.credited,
               b.reversed,
               b.created_at
        FROM public.founder_gift_bonuses b
        JOIN public.user_profiles up ON up.id = b.founder_user_id
        LEFT JOIN public.streams s ON s.id = b.stream_id
        LEFT JOIN public.stream_gifts sg ON sg.id = b.stream_gift_id
        WHERE v_target IS NULL OR b.founder_user_id = v_target
        ORDER BY b.created_at DESC
        LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1)
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_list_gift_rewards(uuid, integer) TO authenticated, service_role;

-- ============================================================================
-- 2. FOUNDER CHAT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_send_message(p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_id uuid;
  v_body text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_use_chat(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Founder Chat requires an active Founder role.');
  END IF;

  v_body := trim(COALESCE(p_body, ''));
  IF v_body = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A message cannot be empty.');
  END IF;
  IF length(v_body) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'That message is too long (2000 characters max).');
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  INSERT INTO public.founder_messages (sender_id, body, channel, created_at)
  VALUES (v_actor, v_body, 'founder_chat', now())
  RETURNING id INTO v_id;

  -- Mark the sender's own message as read so unread counts stay accurate.
  INSERT INTO public.founder_message_reads (message_id, user_id, read_at)
  VALUES (v_id, v_actor, now())
  ON CONFLICT DO NOTHING;

  PERFORM public.founder_log_action(
    v_founder.id, 'send_founder_message', NULL, NULL, NULL, NULL, NULL,
    'Founder Chat message sent',
    jsonb_build_object('message_id', v_id)
  );

  RETURN jsonb_build_object('success', true, 'message_id', v_id, 'created_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_send_message(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_list_messages(
  p_limit integer DEFAULT 100,
  p_before timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_use_chat(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Founder Chat requires an active Founder role.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'messages', COALESCE((
      SELECT jsonb_agg(msg)
      FROM (
        SELECT jsonb_build_object(
                 'id', m.id,
                 'sender_id', m.sender_id,
                 'username', COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown'),
                 'avatar_url', up.avatar_url,
                 'body', m.body,
                 'created_at', m.created_at,
                 'is_mine', m.sender_id = v_actor
               ) AS msg
        FROM public.founder_messages m
        JOIN public.user_profiles up ON up.id = m.sender_id
        WHERE m.deleted_at IS NULL
          AND (p_before IS NULL OR m.created_at < p_before)
        ORDER BY m.created_at DESC
        LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 200), 1)
      ) rows
    ), '[]'::jsonb),
    'active_founders', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', f.user_id,
          'username', COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown'),
          'display_name', up.display_name,
          'avatar_url', up.avatar_url,
          'gift_multiplier', f.gift_multiplier,
          'cashout_multiplier', f.cashout_multiplier,
          'is_me', f.user_id = v_actor
        )
        ORDER BY up.username
      )
      FROM public.founders f
      JOIN public.user_profiles up ON up.id = f.user_id
      WHERE f.status = 'active' AND f.removed_at IS NULL AND f.end_at > now()
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_list_messages(integer, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_mark_messages_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_use_chat(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Founder Chat requires an active Founder role.');
  END IF;

  INSERT INTO public.founder_message_reads (message_id, user_id, read_at)
  SELECT m.id, v_actor, now()
    FROM public.founder_messages m
   WHERE m.sender_id <> v_actor
     AND m.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.founder_message_reads r
        WHERE r.message_id = m.id AND r.user_id = v_actor
     )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.founder_messages
     SET read_at = now()
   WHERE sender_id = v_actor AND read_at IS NULL;

  RETURN jsonb_build_object('success', true, 'marked_read', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_mark_messages_read() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_unread_count()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'unread', (
      SELECT COUNT(*)::integer
      FROM public.founder_messages m
      WHERE m.sender_id <> auth.uid()
        AND m.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.founder_message_reads r
           WHERE r.message_id = m.id AND r.user_id = auth.uid()
        )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_unread_count() TO authenticated, service_role;

-- ============================================================================
-- 3. BROADCAST SCHEDULING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_schedule_broadcast(
  p_title text,
  p_description text DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_when timestamptz;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_schedule_broadcast(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Broadcast scheduling requires an active Founder role.');
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A broadcast title is required.');
  END IF;
  IF length(trim(p_title)) > 120 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'The broadcast title is too long.');
  END IF;

  v_when := COALESCE(p_scheduled_for, now() + interval '1 hour');
  IF v_when <= now() THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'The broadcast must be scheduled in the future.');
  END IF;

  IF p_duration_minutes IS NOT NULL AND (p_duration_minutes < 1 OR p_duration_minutes > 600) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'Duration must be between 1 and 600 minutes.');
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  INSERT INTO public.founder_scheduled_broadcasts (
    founder_id, user_id, title, description, scheduled_for,
    duration_minutes, category, status, created_at, updated_at
  )
  VALUES (
    v_founder.id, v_actor, trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''),
    v_when, p_duration_minutes, NULLIF(trim(COALESCE(p_category, '')), ''), 'scheduled', now(), now()
  )
  RETURNING id INTO v_id;

  PERFORM public.founder_log_action(
    v_founder.id, 'schedule_broadcast', v_actor, NULL, NULL, NULL, v_id,
    'Founder scheduled a broadcast',
    jsonb_build_object(
      'title', trim(p_title),
      'scheduled_for', v_when,
      'duration_minutes', p_duration_minutes,
      'category', p_category
    )
  );

  PERFORM public.founder_notify(
    v_actor, 'founder_broadcast_scheduled', 'Broadcast Scheduled',
    format('Your broadcast "%s" is scheduled for %s.', trim(p_title), to_char(v_when, 'MM/DD/YYYY HH12:MI AM')),
    jsonb_build_object('scheduled_broadcast_id', v_id, 'scheduled_for', v_when)
  );

  RETURN jsonb_build_object('success', true, 'id', v_id, 'scheduled_for', v_when);
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_schedule_broadcast(text, text, timestamptz, integer, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_update_scheduled_broadcast(
  p_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_row public.founder_scheduled_broadcasts%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_schedule_broadcast(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Broadcast scheduling requires an active Founder role.');
  END IF;

  SELECT * INTO v_row FROM public.founder_scheduled_broadcasts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
                             'message', 'That scheduled broadcast does not exist.');
  END IF;

  IF v_row.user_id <> v_actor AND NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'You can only edit your own scheduled broadcasts.');
  END IF;

  IF v_row.status <> 'scheduled' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_EDITABLE',
                             'message', 'Only scheduled broadcasts can be edited.');
  END IF;

  IF p_scheduled_for IS NOT NULL AND p_scheduled_for <= now() THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'The broadcast must be scheduled in the future.');
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  UPDATE public.founder_scheduled_broadcasts
     SET title            = COALESCE(NULLIF(trim(p_title), ''), title),
         description      = CASE WHEN p_description IS NULL THEN description
                                 ELSE NULLIF(trim(p_description), '') END,
         scheduled_for    = COALESCE(p_scheduled_for, scheduled_for),
         duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
         category         = CASE WHEN p_category IS NULL THEN category
                                 ELSE NULLIF(trim(p_category), '') END,
         updated_at       = now()
   WHERE id = p_id;

  PERFORM public.founder_log_action(
    v_founder.id, 'edit_broadcast', v_actor, COALESCE(p_reason, 'Founder updated a scheduled broadcast'),
    NULL, NULL, p_id, p_reason,
    jsonb_build_object(
      'previous_scheduled_for', v_row.scheduled_for,
      'new_scheduled_for', COALESCE(p_scheduled_for, v_row.scheduled_for),
      'previous_title', v_row.title,
      'new_title', COALESCE(NULLIF(trim(p_title), ''), v_row.title)
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_update_scheduled_broadcast(uuid, text, text, timestamptz, integer, text, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_cancel_scheduled_broadcast(
  p_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_row public.founder_scheduled_broadcasts%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_schedule_broadcast(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Broadcast scheduling requires an active Founder role.');
  END IF;

  SELECT * INTO v_row FROM public.founder_scheduled_broadcasts WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
                             'message', 'That scheduled broadcast does not exist.');
  END IF;

  IF v_row.user_id <> v_actor AND NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'You can only cancel your own scheduled broadcasts.');
  END IF;

  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CANCELLED',
                             'message', 'That broadcast was already cancelled.');
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  UPDATE public.founder_scheduled_broadcasts
     SET status        = 'cancelled',
         cancelled_at  = now(),
         cancelled_by  = v_actor,
         cancel_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
         updated_at    = now()
   WHERE id = p_id;

  PERFORM public.founder_log_action(
    v_founder.id, 'cancel_broadcast', v_actor,
    COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'No reason provided'),
    NULL, NULL, p_id, p_reason,
    jsonb_build_object('title', v_row.title, 'scheduled_for', v_row.scheduled_for)
  );

  PERFORM public.founder_notify(
    v_row.user_id, 'founder_broadcast_cancelled', 'Broadcast Cancelled',
    format('Your scheduled broadcast "%s" was cancelled.', v_row.title),
    jsonb_build_object('scheduled_broadcast_id', p_id)
  );

  RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_cancel_scheduled_broadcast(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_list_my_scheduled_broadcasts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'broadcasts', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT s.id, s.user_id, s.title, s.description, s.scheduled_for,
               s.duration_minutes, s.category, s.status, s.stream_id,
               s.created_at, s.cancelled_at, s.cancel_reason
        FROM public.founder_scheduled_broadcasts s
        WHERE s.user_id = auth.uid()
          AND s.status = 'scheduled'
        ORDER BY s.scheduled_for ASC
        LIMIT 100
      ) r
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_list_my_scheduled_broadcasts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_list_program_schedule()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'broadcasts', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT s.id, s.user_id, s.title, s.description, s.scheduled_for,
               s.duration_minutes, s.category, s.status,
               COALESCE(NULLIF(up.username, ''), 'Unknown') AS username,
               up.display_name, up.avatar_url
        FROM public.founder_scheduled_broadcasts s
        JOIN public.user_profiles up ON up.id = s.user_id
        WHERE s.status = 'scheduled'
          AND s.scheduled_for >= now() - interval '1 hour'
        ORDER BY s.scheduled_for ASC
        LIMIT 100
      ) r
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_list_program_schedule() TO authenticated, service_role;

-- ============================================================================
-- 4. REPORTS (authorized subset only — no unrelated admin data)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_list_reports(
  p_status text DEFAULT 'pending',
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_status text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_view_reports(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Viewing reports requires an active Founder role.');
  END IF;

  -- Founders only ever see open work. Resolved/rejected history stays with
  -- the existing moderation dashboard.
  v_status := COALESCE(NULLIF(trim(p_status), ''), 'pending');
  IF v_status NOT IN ('pending', 'reviewing') THEN
    v_status := 'pending';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reports', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'report_id', r.id,
        'reporter_id', r.reporter_id,
        'reporter_username', COALESCE(rp.username, rp.full_name, 'Unknown'),
        'reported_user_id', r.target_user_id,
        'reported_username', COALESCE(tp.username, tp.full_name, 'Unknown'),
        'reason', r.report_reason,
        'description', r.report_details,
        'stream_id', r.stream_id,
        'stream_title', s.title,
        'status', r.status,
        'created_at', r.created_at
      ))
      FROM public.moderation_reports r
      LEFT JOIN public.user_profiles rp ON rp.id = r.reporter_id
      LEFT JOIN public.user_profiles tp ON tp.id = r.target_user_id
      LEFT JOIN public.streams s ON s.id = r.stream_id
      WHERE r.status = v_status
      ORDER BY r.created_at DESC
      LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 200), 1)
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_list_reports(text, integer) TO authenticated, service_role;

-- Recording that a Founder opened a report is a server-side audit event.
CREATE OR REPLACE FUNCTION public.founder_log_report_view(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_view_reports(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Viewing reports requires an active Founder role.');
  END IF;

  IF p_report_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.moderation_reports WHERE id = p_report_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
                             'message', 'That report does not exist.');
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  PERFORM public.founder_log_action(
    v_founder.id, 'view_report',
    (SELECT target_user_id FROM public.moderation_reports WHERE id = p_report_id),
    NULL, p_report_id, NULL, NULL, 'Founder viewed a report',
    '{}'::jsonb
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_log_report_view(uuid) TO authenticated, service_role;

-- ============================================================================
-- 5. ARREST
--    Writes into the EXISTING jail / court_cases / court_dockets tables and
--    the EXISTING moderation audit (broadcast_mod_actions via modo_audit).
--    It does NOT widen is_modo_role, so no other moderation surface changes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_arrest_user(
  p_target_user_id uuid,
  p_reason text,
  p_report_id uuid DEFAULT NULL,
  p_severity text DEFAULT 'moderate',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_severity text;
  v_target_display text;
  v_target_role text;
  v_court_date date;
  v_docket_id uuid;
  v_max_cases integer := 20;
  v_bail integer;
  v_jail_id uuid;
  v_case_id uuid;
  v_lat double precision;
  v_lng double precision;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_arrest(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Arresting users requires an active Founder role.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A target user is required.');
  END IF;
  IF p_target_user_id = v_actor THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'You cannot arrest yourself.');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A reason is required.');
  END IF;
  IF length(p_reason) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'The reason is too long.');
  END IF;

  v_severity := COALESCE(NULLIF(trim(p_severity), ''), 'moderate');
  IF v_severity NOT IN ('minor', 'moderate', 'serious', 'severe') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SEVERITY',
                             'message', 'Unsupported severity.');
  END IF;

  SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown'),
         COALESCE(up.role, 'unknown')
    INTO v_target_display, v_target_role
    FROM public.user_profiles up
   WHERE up.id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TARGET_NOT_FOUND',
                             'message', 'That user does not exist.');
  END IF;

  -- A Founder can never arrest another Founder, or any Admin/staff account.
  IF public.is_active_founder(p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Founders cannot arrest another Founder.');
  END IF;
  IF public.founder_user_is_admin(p_target_user_id)
     OR LOWER(COALESCE(v_target_role, '')) IN ('ceo', 'admin', 'superadmin', 'owner', 'troll_officer', 'lead_troll_officer') THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'That account cannot be arrested by a Founder.');
  END IF;

  v_bail := CASE v_severity
              WHEN 'minor'    THEN 100
              WHEN 'serious'  THEN 500
              WHEN 'severe'   THEN 1000
              ELSE 200
            END;

  -- Next valid Tuesday or Thursday, matching the existing arrest flow.
  SELECT CASE
           WHEN EXTRACT(ISODOW FROM now())::int IN (1,2) THEN date_trunc('day', now())::date + (2 - EXTRACT(ISODOW FROM now())::int)
           WHEN EXTRACT(ISODOW FROM now())::int = 3     THEN date_trunc('day', now())::date + 1
           WHEN EXTRACT(ISODOW FROM now())::int = 4     THEN date_trunc('day', now())::date
           WHEN EXTRACT(ISODOW FROM now())::int = 5     THEN date_trunc('day', now())::date + 4
           WHEN EXTRACT(ISODOW FROM now())::int = 6     THEN date_trunc('day', now())::date + 3
           ELSE date_trunc('day', now())::date + 2
         END INTO v_court_date;

  LOOP
    SELECT id INTO v_docket_id
      FROM public.court_dockets
     WHERE court_date = v_court_date
     FOR UPDATE;

    IF v_docket_id IS NULL THEN
      INSERT INTO public.court_dockets (court_date, max_cases, cases_count, status, created_by, created_at, updated_at)
      VALUES (v_court_date, v_max_cases, 0, 'open', v_actor, now(), now())
      RETURNING id INTO v_docket_id;
    END IF;

    IF (SELECT COALESCE(cases_count, 0) FROM public.court_dockets WHERE id = v_docket_id) < v_max_cases THEN
      EXIT;
    END IF;

    v_court_date := v_court_date + CASE WHEN EXTRACT(ISODOW FROM v_court_date)::int = 2 THEN 2 ELSE 5 END;
  END LOOP;

  UPDATE public.court_dockets
     SET cases_count = COALESCE(cases_count, 0) + 1,
         updated_at  = now()
   WHERE id = v_docket_id;

  SELECT latitude, longitude INTO v_lat, v_lng
    FROM public.user_ip_tracking
   WHERE user_id = p_target_user_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- Column list mirrors the canonical arrest in
  -- 20260809000001_moderation_actions_backend.sql exactly. Timestamps are left
  -- to column defaults rather than assumed.
  INSERT INTO public.jail (
    user_id, release_time, reason, sentence_days, bond_amount,
    severity, status, arrested_by, court_date, arrest_latitude, arrest_longitude
  )
  VALUES (
    p_target_user_id, now() + interval '24 hours', trim(p_reason), 1, v_bail,
    v_severity, 'jailed', v_actor, v_court_date, v_lat, v_lng
  )
  RETURNING id INTO v_jail_id;

  INSERT INTO public.court_cases (docket_id, defendant_id, plaintiff_id, reason, status, case_type)
  VALUES (v_docket_id, p_target_user_id, v_actor, trim(p_reason), 'pending', 'criminal')
  RETURNING id INTO v_case_id;

  -- Resolve the linked report through the existing report pipeline.
  IF p_report_id IS NOT NULL THEN
    UPDATE public.moderation_reports
       SET status = 'action_taken',
           resolved_by = v_actor,
           resolved_at = now(),
           updated_at = now()
     WHERE id = p_report_id
       AND status IN ('pending', 'reviewing');
  END IF;

  PERFORM public.founder_notify(
    p_target_user_id, 'jail_sentence_started', 'Arrested',
    format('You were arrested by the Founder Program: %s. Court date: %s.',
           trim(p_reason), to_char(v_court_date, 'MM/DD/YYYY')),
    jsonb_build_object('severity', v_severity, 'bail', v_bail, 'court_date', v_court_date,
                       'founder_action', 'arrest', 'founder_id', v_actor)
  );

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'modo_audit' AND pronamespace = 'public'::regnamespace) THEN
    PERFORM public.modo_audit(
      'arrest', 'Founder Arrest', v_actor, p_target_user_id, v_target_display,
      v_target_role, v_target_role, NULL, NULL, trim(p_reason), NULL,
      'active', 'jailed', NULL, true, NULL,
      jsonb_build_object('severity', v_severity, 'bail', v_bail, 'court_date', v_court_date,
                         'docket_id', v_docket_id, 'source', 'founder_program')
    );
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  PERFORM public.founder_log_action(
    v_founder.id, 'arrest', p_target_user_id, trim(p_reason), p_report_id, v_case_id, NULL, p_notes,
    jsonb_build_object(
      'jail_id', v_jail_id, 'docket_id', v_docket_id, 'court_date', v_court_date,
      'severity', v_severity, 'bail', v_bail, 'target_username', v_target_display
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'ACTION_COMPLETED',
    'message', 'User arrested successfully.',
    'data', jsonb_build_object(
      'jail_id', v_jail_id, 'case_id', v_case_id,
      'court_date', v_court_date, 'docket_id', v_docket_id,
      'bail', v_bail, 'severity', v_severity
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_arrest_user(uuid, text, uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 6. RELEASE
--    Reuses public.mod_release_jail's semantics but gates on Founder authority
--    so is_modo_role is untouched. The original arrest row is never deleted.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_release_user(
  p_jail_id uuid,
  p_reason text DEFAULT 'Founder release',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_jail record;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_release(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Releasing users requires an active Founder role.');
  END IF;

  IF p_jail_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A jail record is required.');
  END IF;

  SELECT * INTO v_jail FROM public.jail WHERE id = p_jail_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'JAIL_NOT_FOUND',
                             'message', 'That jail record does not exist.');
  END IF;

  IF v_jail.status = 'released' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_RELEASED',
                             'message', 'That user has already been released.');
  END IF;

  UPDATE public.jail
     SET status       = 'released',
         released_at  = now(),
         release_type = 'moderator_release',
         updated_at   = now()
   WHERE id = p_jail_id;

  -- Mirrors mod_release_jail exactly: jailed state is derived from
  -- current_jail_id / jailed_until, and there is no is_jailed column.
  UPDATE public.user_profiles
     SET jailed_until    = NULL,
         current_jail_id = NULL,
         updated_at      = now()
   WHERE id = v_jail.user_id;

  INSERT INTO public.moderation_audit_log (
    action, actor_user_id, target_user_id, reason, success,
    discipline_level, jail_id, metadata, created_at
  )
  VALUES (
    'FOUNDER_RELEASE', v_actor, v_jail.user_id, trim(COALESCE(p_reason, 'Founder release')), true,
    v_jail.discipline_level, p_jail_id,
    jsonb_build_object('source', 'founder_program'), now()
  );

  PERFORM public.founder_notify(
    v_jail.user_id, 'jail_released', 'Released',
    format('You were released: %s.', trim(COALESCE(p_reason, 'Founder release'))),
    jsonb_build_object('founder_action', 'release', 'founder_id', v_actor)
  );

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  PERFORM public.founder_log_action(
    v_founder.id, 'release', v_jail.user_id, trim(COALESCE(p_reason, 'Founder release')),
    NULL, NULL, NULL, p_notes,
    jsonb_build_object(
      'jail_id', p_jail_id,
      'original_arrest', jsonb_build_object(
        'jail_id', p_jail_id,
        'arrested_by', v_jail.arrested_by,
        'jailed_at', v_jail.jailed_at,
        'reason', v_jail.reason,
        'sentence_days', v_jail.sentence_days,
        'court_date', v_jail.court_date
      )
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'JAIL_RELEASED',
    'message', 'User released successfully.',
    'data', jsonb_build_object('jail_id', p_jail_id, 'released_at', now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_release_user(uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 7. COURT SUMMONS
--    Reuses manage_court_case_safe (which writes court_cases + court_summons +
--    court_audit_log) and adds the notification + Founder audit.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_summon_to_court(
  p_target_user_id uuid,
  p_reason text,
  p_court_date date DEFAULT NULL,
  p_court_time time DEFAULT NULL,
  p_report_id uuid DEFAULT NULL,
  p_case_type text DEFAULT 'civil',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
  v_result jsonb;
  v_case_id uuid;
  v_docket_id uuid;
  v_summons_id uuid;
  v_date date;
  v_when text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_founder_summon(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Summoning users requires an active Founder role.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A target user is required.');
  END IF;
  IF p_target_user_id = v_actor THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'You cannot summon yourself.');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A reason is required.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'TARGET_NOT_FOUND',
                             'message', 'That user does not exist.');
  END IF;

  v_date := COALESCE(p_court_date, CURRENT_DATE + 1);

  -- Reuse the existing court intake so we never fork a second court system.
  v_result := public.manage_court_case_safe(
    p_target_user_id, trim(p_reason), v_date,
    CASE WHEN p_case_type IN ('non_payment','eviction','lease_violation','criminal','civil')
         THEN p_case_type ELSE 'civil' END
  );

  IF COALESCE((v_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'COURT_ERROR',
      'message', COALESCE(v_result ->> 'message', 'The court case could not be created.')
    );
  END IF;

  v_case_id    := NULLIF(v_result ->> 'case_id', '')::uuid;
  v_docket_id  := NULLIF(v_result ->> 'docket_id', '')::uuid;
  v_summons_id := NULLIF(v_result ->> 'summons_id', '')::uuid;

  IF p_court_time IS NOT NULL THEN
    BEGIN
      UPDATE public.court_summons
         SET notes = COALESCE(notes || E'\n', '') || format('Scheduled time: %s', p_court_time),
             updated_at = now()
       WHERE id = v_summons_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  v_when := CASE WHEN p_court_time IS NOT NULL
                 THEN to_char(v_date, 'MM/DD/YYYY') || ' at ' || to_char(p_court_time, 'HH12:MI AM')
                 ELSE to_char(v_date, 'MM/DD/YYYY') END;

  PERFORM public.founder_notify(
    p_target_user_id, 'court_summon', 'You Have Been Summoned To Court',
    format('The Founder Program has summoned you to court for %s on %s.', trim(p_reason), v_when),
    jsonb_build_object(
      'case_id', v_case_id, 'summons_id', v_summons_id, 'docket_id', v_docket_id,
      'court_date', v_date, 'court_time', p_court_time,
      'founder_action', 'summon', 'founder_id', v_actor
    )
  );

  IF p_report_id IS NOT NULL THEN
    UPDATE public.moderation_reports
       SET status = 'reviewing',
           updated_at = now()
     WHERE id = p_report_id
       AND status = 'pending';
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_actor);

  PERFORM public.founder_log_action(
    v_founder.id, 'summon', p_target_user_id, trim(p_reason), p_report_id, v_case_id, NULL, p_notes,
    jsonb_build_object(
      'court_date', v_date, 'court_time', p_court_time,
      'docket_id', v_docket_id, 'summons_id', v_summons_id, 'case_type', p_case_type
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUMMON_ISSUED',
    'message', format('Court summons issued for %s.', v_when),
    'data', jsonb_build_object(
      'case_id', v_case_id, 'docket_id', v_docket_id, 'summons_id', v_summons_id,
      'court_date', v_date, 'court_time', p_court_time
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_summon_to_court(uuid, text, date, time, uuid, text, text)
  TO authenticated, service_role;

-- ============================================================================
-- 8. MY ACTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_my_actions(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'actions', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT a.id, a.action_type, a.target_user_id, a.target_username,
               a.report_id, a.case_id, a.scheduled_broadcast_id,
               a.reason, a.notes, a.details, a.status, a.created_at
        FROM public.founder_actions a
        WHERE a.founder_user_id = auth.uid()
        ORDER BY a.created_at DESC
        LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1)
      ) r
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_my_actions(integer) TO authenticated, service_role;

-- ============================================================================
-- 9. ADMIN: USER SEARCH (no manual UUID entry)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_admin_search_users(
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_exclude_founders boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_q text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Admin access required.');
  END IF;

  v_q := trim(COALESCE(p_query, ''));

  RETURN jsonb_build_object(
    'success', true,
    'users', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT up.id AS user_id,
               up.username,
               up.display_name,
               up.full_name,
               up.avatar_url,
               up.role,
               up.troll_role,
               COALESCE(up.is_broadcaster, false) AS is_broadcaster,
               COALESCE(up.is_verified, false) AS is_verified,
               up.created_at,
               public.founder_effective_status(up.id) AS founder_status,
               public.is_active_founder(up.id)       AS is_founder,
               -- Lets the admin UI warn that an Admin candidate will keep their
               -- Admin presentation instead of the Founder badge/gold username.
               public.founder_user_is_admin(up.id)   AS is_admin
        FROM public.user_profiles up
        WHERE (v_q = ''
               OR COALESCE(up.username, '') ILIKE '%' || v_q || '%'
               OR COALESCE(up.display_name, '') ILIKE '%' || v_q || '%'
               OR COALESCE(up.full_name, '') ILIKE '%' || v_q || '%')
          AND (NOT COALESCE(p_exclude_founders, true)
               OR NOT EXISTS (
                    SELECT 1 FROM public.founders f
                     WHERE f.user_id = up.id AND f.removed_at IS NULL
                 ))
        ORDER BY COALESCE(up.username, '')
        LIMIT GREATEST(LEAST(COALESCE(p_limit, 25), 100), 1)
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_search_users(text, integer, boolean) TO authenticated, service_role;

-- ============================================================================
-- 10. ADMIN: LIST / ADD / UPDATE / REMOVE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_admin_list(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_status text;
  v_capacity integer;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Admin access required.');
  END IF;

  PERFORM public.founder_sync_expirations();

  v_status := NULLIF(trim(COALESCE(p_status, '')), '');

  SELECT s.capacity INTO v_capacity
    FROM public.founder_program_settings s
   WHERE s.id = true;

  RETURN jsonb_build_object(
    'success', true,
    'capacity', COALESCE(v_capacity, 5),
    'active_count', (
      SELECT COUNT(*)::integer
      FROM public.founders f
      WHERE f.status = 'active' AND f.removed_at IS NULL AND f.end_at > now()
    ),
    'founders', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT f.id, f.user_id, f.status, f.start_at, f.end_at,
               f.gift_multiplier, f.cashout_multiplier,
               f.previous_role, f.previous_troll_role,
               f.created_at, f.updated_at,
               f.removed_at, f.removed_by, f.removal_reason, f.notes,
               COALESCE(NULLIF(up.username, ''), 'Unknown') AS username,
               up.display_name, up.avatar_url, up.role, up.troll_role,
               COALESCE(up.is_broadcaster, false) AS is_broadcaster,
               GREATEST(0, CEIL(EXTRACT(EPOCH FROM (f.end_at - now())) / 86400))::integer AS days_remaining,
               (f.status = 'active' AND f.removed_at IS NULL AND f.end_at > now()) AS is_active
        FROM public.founders f
        JOIN public.user_profiles up ON up.id = f.user_id
        WHERE (v_status IS NULL
               OR (v_status = 'active'
                   AND f.status = 'active' AND f.removed_at IS NULL AND f.end_at > now())
               OR f.status = v_status)
        ORDER BY
          (f.status = 'active' AND f.end_at > now()) DESC,
          f.end_at ASC,
          f.created_at DESC
        LIMIT 500
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_list(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_admin_add(
  p_user_id uuid,
  p_duration_months integer DEFAULT NULL,
  p_gift_multiplier numeric DEFAULT NULL,
  p_cashout_multiplier numeric DEFAULT NULL,
  p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_settings public.founder_program_settings%ROWTYPE;
  v_founder public.founders%ROWTYPE;
  v_user public.user_profiles%ROWTYPE;
  v_active integer;
  v_start timestamptz;
  v_end timestamptz;
  v_months integer;
  v_gift numeric(6,2);
  v_cashout numeric(6,2);
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Admin access required.');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A user is required.');
  END IF;

  SELECT * INTO v_settings FROM public.founder_program_settings WHERE id = true;

  IF NOT COALESCE(v_settings.program_enabled, true) THEN
    RETURN jsonb_build_object('success', false, 'code', 'PROGRAM_DISABLED',
                             'message', 'The Founder Program is currently disabled.');
  END IF;

  SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND',
                             'message', 'That user does not exist.');
  END IF;

  IF COALESCE(v_user.account_deleted_at, NULL::timestamptz) IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_INACTIVE',
                             'message', 'That account has been deleted or deactivated.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.founders f
     WHERE f.user_id = p_user_id AND f.removed_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_FOUNDER',
                             'message', 'This user already has a Founder record. Edit it instead.');
  END IF;

  -- Capacity
  SELECT COUNT(*)::integer INTO v_active
    FROM public.founders f
   WHERE f.status = 'active' AND f.removed_at IS NULL AND f.end_at > now();

  IF v_active >= COALESCE(v_settings.capacity, 5) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'CAPACITY_REACHED',
      'message', format('The Founder limit has been reached (%s / %s). Increase the capacity or remove a Founder first.',
                        v_active, COALESCE(v_settings.capacity, 5)),
      'active_count', v_active, 'capacity', v_settings.capacity
    );
  END IF;

  -- Multipliers
  v_gift := COALESCE(p_gift_multiplier, v_settings.default_gift_multiplier, 2);
  v_cashout := COALESCE(p_cashout_multiplier, v_settings.default_cashout_multiplier, 1);

  IF v_gift < v_settings.min_multiplier OR v_gift > v_settings.max_multiplier
     OR NOT (v_gift = ANY (v_settings.allowed_multipliers)) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_MULTIPLIER',
                             'message', format('Gift multiplier must be one of: %s.',
                                               array_to_string(v_settings.allowed_multipliers, ', ')));
  END IF;

  IF v_cashout < v_settings.min_multiplier OR v_cashout > v_settings.max_multiplier
     OR NOT (v_cashout = ANY (v_settings.allowed_multipliers)) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_MULTIPLIER',
                             'message', format('Cashout multiplier must be one of: %s.',
                                               array_to_string(v_settings.allowed_multipliers, ', ')));
  END IF;

  -- Term
  v_months := COALESCE(p_duration_months, v_settings.default_duration_months, 6);
  IF v_months < 1 OR v_months > 120 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_DURATION',
                             'message', 'Founder duration must be between 1 and 120 months.');
  END IF;

  v_start := COALESCE(p_start_at, now());

  IF p_end_at IS NOT NULL THEN
    IF NOT COALESCE(v_settings.allow_manual_expiration, true) THEN
      RETURN jsonb_build_object('success', false, 'code', 'MANUAL_EXPIRATION_DISABLED',
                               'message', 'Manual expiration override is disabled for your permission level.');
    END IF;
    IF p_end_at <= v_start THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_EXPIRATION',
                               'message', 'The expiration date must be after the start date.');
    END IF;
    v_end := p_end_at;
  ELSE
    v_end := (v_start + make_interval(months => v_months))::timestamptz;
  END IF;

  INSERT INTO public.founders (
    user_id, status, start_at, end_at, gift_multiplier, cashout_multiplier,
    previous_role, previous_troll_role, created_by, created_at, updated_at, notes
  )
  VALUES (
    p_user_id, 'active', v_start, v_end, v_gift, v_cashout,
    v_user.role, v_user.troll_role, v_actor, now(), now(),
    NULLIF(trim(COALESCE(p_notes, '')), '')
  )
  RETURNING * INTO v_founder;

  PERFORM public.founder_log_action(
    v_founder.id, 'founder_created', p_user_id,
    COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'Founder granted'),
    NULL, NULL, NULL, p_notes,
    jsonb_build_object(
      'start_at', v_start, 'end_at', v_end, 'duration_months', v_months,
      'gift_multiplier', v_gift, 'cashout_multiplier', v_cashout,
      'previous_role', v_user.role, 'previous_troll_role', v_user.troll_role
    )
  );

  PERFORM public.founder_notify(
    p_user_id, 'founder_status_changed', 'Welcome to the Founder Program',
    format('You are now a Mai Troll Founder. Your Founder term runs until %s. Gift rewards %sx, Cashout %sx.',
           to_char(v_end, 'Month DD, YYYY'), v_gift, v_cashout),
    jsonb_build_object('founder_id', v_founder.id, 'end_at', v_end,
                       'gift_multiplier', v_gift, 'cashout_multiplier', v_cashout)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Founder added. Term ends %s.', to_char(v_end, 'Month DD, YYYY')),
    'founder', jsonb_build_object(
      'id', v_founder.id, 'user_id', v_founder.user_id, 'status', v_founder.status,
      'start_at', v_founder.start_at, 'end_at', v_founder.end_at,
      'gift_multiplier', v_founder.gift_multiplier,
      'cashout_multiplier', v_founder.cashout_multiplier,
      'days_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_founder.end_at - now())) / 86400))::integer
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_add(uuid, integer, numeric, numeric, timestamptz, timestamptz, text, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_admin_update(
  p_founder_id uuid,
  p_gift_multiplier numeric DEFAULT NULL,
  p_cashout_multiplier numeric DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_settings public.founder_program_settings%ROWTYPE;
  v_founder public.founders%ROWTYPE;
  v_changes jsonb := '{}'::jsonb;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Admin access required.');
  END IF;

  IF p_founder_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A Founder record is required.');
  END IF;

  SELECT * INTO v_settings FROM public.founder_program_settings WHERE id = true;
  SELECT * INTO v_founder FROM public.founders WHERE id = p_founder_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
                             'message', 'That Founder record does not exist.');
  END IF;

  v_reason := COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'Administrative update');

  -- Never allow silent historical changes.
  IF (p_gift_multiplier IS NOT NULL OR p_cashout_multiplier IS NOT NULL
      OR p_end_at IS NOT NULL OR p_status IS NOT NULL)
     AND length(v_reason) < 3 THEN
    RETURN jsonb_build_object('success', false, 'code', 'REASON_REQUIRED',
                             'message', 'A reason is required for Founder changes.');
  END IF;

  IF p_gift_multiplier IS NOT NULL THEN
    IF p_gift_multiplier < v_settings.min_multiplier
       OR p_gift_multiplier > v_settings.max_multiplier
       OR NOT (p_gift_multiplier = ANY (v_settings.allowed_multipliers)) THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_MULTIPLIER',
                               'message', format('Gift multiplier must be one of: %s.',
                                                 array_to_string(v_settings.allowed_multipliers, ', ')));
    END IF;
    IF p_gift_multiplier <> v_founder.gift_multiplier THEN
      v_changes := v_changes || jsonb_build_object(
        'gift_multiplier', jsonb_build_object('previous', v_founder.gift_multiplier, 'new', p_gift_multiplier)
      );
    END IF;
  END IF;

  IF p_cashout_multiplier IS NOT NULL THEN
    IF p_cashout_multiplier < v_settings.min_multiplier
       OR p_cashout_multiplier > v_settings.max_multiplier
       OR NOT (p_cashout_multiplier = ANY (v_settings.allowed_multipliers)) THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_MULTIPLIER',
                               'message', format('Cashout multiplier must be one of: %s.',
                                                 array_to_string(v_settings.allowed_multipliers, ', ')));
    END IF;
    IF p_cashout_multiplier <> v_founder.cashout_multiplier THEN
      v_changes := v_changes || jsonb_build_object(
        'cashout_multiplier', jsonb_build_object('previous', v_founder.cashout_multiplier, 'new', p_cashout_multiplier)
      );
    END IF;
  END IF;

  IF p_end_at IS NOT NULL THEN
    IF p_end_at <= v_founder.start_at THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_EXPIRATION',
                               'message', 'The expiration date must be after the start date.');
    END IF;
    IF p_end_at <> v_founder.end_at THEN
      v_changes := v_changes || jsonb_build_object(
        'end_at', jsonb_build_object('previous', v_founder.end_at, 'new', p_end_at)
      );
    END IF;
  END IF;

  IF p_status IS NOT NULL AND p_status <> v_founder.status THEN
    IF p_status NOT IN ('active', 'expired', 'removed', 'suspended') THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
                               'message', 'Unsupported Founder status.');
    END IF;
    IF p_status = 'active' AND v_founder.removed_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
                               'message', 'A removed Founder cannot be reactivated. Add them as a new Founder.');
    END IF;
    IF p_status = 'active' AND v_founder.end_at <= now() THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
                               'message', 'Extend the expiration date before reactivating.');
    END IF;
    v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('previous', v_founder.status, 'new', p_status));
  END IF;

  UPDATE public.founders
     SET gift_multiplier    = COALESCE(p_gift_multiplier, gift_multiplier),
         cashout_multiplier = COALESCE(p_cashout_multiplier, cashout_multiplier),
         end_at             = COALESCE(p_end_at, end_at),
         status             = COALESCE(p_status, status),
         notes              = COALESCE(p_notes, notes),
         suspended_at       = CASE WHEN p_status = 'suspended' THEN now()
                                   WHEN p_status = 'active'  THEN NULL
                                   ELSE suspended_at END,
         updated_at         = now()
   WHERE id = p_founder_id;

  IF v_changes = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', true, 'message', 'No changes were made.');
  END IF;

  PERFORM public.founder_log_action(
    v_founder.id,
    CASE
      WHEN v_changes ? 'status' AND (v_changes -> 'status' ->> 'new') = 'suspended' THEN 'founder_suspended'
      WHEN v_changes ? 'status' AND (v_changes -> 'status' ->> 'new') = 'active'   THEN 'founder_resumed'
      ELSE 'founder_updated'
    END,
    v_founder.user_id, v_reason, NULL, NULL, NULL, p_notes,
    jsonb_build_object('changed_by', v_actor, 'reason', v_reason, 'changes', v_changes)
  );

  PERFORM public.founder_notify(
    v_founder.user_id, 'founder_status_changed', 'Founder Program Update',
    format('Your Founder record was updated: %s.', v_reason),
    jsonb_build_object('founder_id', v_founder.id, 'changes', v_changes)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Founder updated.',
    'changes', v_changes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_update(uuid, numeric, numeric, timestamptz, text, text, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_admin_remove(
  p_founder_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_founder public.founders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Admin access required.');
  END IF;

  IF p_founder_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'A Founder record is required.');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'code', 'REASON_REQUIRED',
                             'message', 'A reason for removal is required.');
  END IF;

  SELECT * INTO v_founder FROM public.founders WHERE id = p_founder_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
                             'message', 'That Founder record does not exist.');
  END IF;

  IF v_founder.removed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_REMOVED',
                             'message', 'That Founder was already removed.');
  END IF;

  -- Never delete: mark removed so all historical actions stay auditable.
  UPDATE public.founders
     SET status         = 'removed',
         removed_at     = now(),
         removed_by     = v_actor,
         removal_reason = trim(p_reason),
         updated_at     = now()
   WHERE id = p_founder_id;

  PERFORM public.founder_log_action(
    v_founder.id, 'founder_removed', v_founder.user_id, trim(p_reason), NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'removed_by', v_actor,
      'previous_status', v_founder.status,
      'previous_gift_multiplier', v_founder.gift_multiplier,
      'previous_cashout_multiplier', v_founder.cashout_multiplier,
      'started_at', v_founder.start_at,
      'was_expiring_at', v_founder.end_at
    )
  );

  PERFORM public.founder_notify(
    v_founder.user_id, 'founder_status_changed', 'Founder Program',
    format('Your Founder status has ended. Reason: %s', trim(p_reason)),
    jsonb_build_object('founder_id', v_founder.id, 'status', 'removed')
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Founder removed. Historical records were retained for auditing.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_remove(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 11. ADMIN: ACTION AUDIT SCREEN + SETTINGS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_admin_list_actions(
  p_founder_user_id uuid DEFAULT NULL,
  p_action_type text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_type text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Admin access required.');
  END IF;

  v_type := NULLIF(trim(COALESCE(p_action_type, '')), '');

  RETURN jsonb_build_object(
    'success', true,
    'actions', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT a.id, a.action_type, a.founder_id, a.founder_user_id, a.founder_username,
               a.target_user_id, a.target_username, a.report_id, a.case_id,
               a.scheduled_broadcast_id, a.reason, a.notes, a.details, a.status,
               a.actor_role, a.created_at
        FROM public.founder_actions a
        WHERE (p_founder_user_id IS NULL OR a.founder_user_id = p_founder_user_id)
          AND (v_type IS NULL OR a.action_type = v_type)
          AND (p_target_user_id IS NULL OR a.target_user_id = p_target_user_id)
          AND (p_from IS NULL OR a.created_at >= p_from)
          AND (p_to IS NULL OR a.created_at <= p_to)
        ORDER BY a.created_at DESC
        LIMIT GREATEST(LEAST(COALESCE(p_limit, 200), 1000), 1)
      ) r
    ), '[]'::jsonb),
    'action_types', COALESCE((
      SELECT jsonb_agg(DISTINCT a.action_type ORDER BY a.action_type)
      FROM public.founder_actions a
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_list_actions(uuid, text, uuid, timestamptz, timestamptz, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_admin_get_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'settings', (
      SELECT jsonb_build_object(
        'program_enabled', s.program_enabled,
        'capacity', s.capacity,
        'active_count', (
          SELECT COUNT(*)::integer FROM public.founders f
           WHERE f.status = 'active' AND f.removed_at IS NULL AND f.end_at > now()
        ),
        'default_duration_months', s.default_duration_months,
        'default_gift_multiplier', s.default_gift_multiplier,
        'default_cashout_multiplier', s.default_cashout_multiplier,
        'allowed_multipliers', s.allowed_multipliers,
        'min_multiplier', s.min_multiplier,
        'max_multiplier', s.max_multiplier,
        'allow_manual_expiration', s.allow_manual_expiration,
        'notes', s.notes,
        'updated_at', s.updated_at
      )
      FROM public.founder_program_settings s
      WHERE s.id = true
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_get_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_admin_update_settings(
  p_program_enabled boolean DEFAULT NULL,
  p_capacity integer DEFAULT NULL,
  p_default_duration_months integer DEFAULT NULL,
  p_default_gift_multiplier numeric DEFAULT NULL,
  p_default_cashout_multiplier numeric DEFAULT NULL,
  p_allowed_multipliers numeric[] DEFAULT NULL,
  p_max_multiplier numeric DEFAULT NULL,
  p_allow_manual_expiration boolean DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
                             'message', 'You must be signed in.');
  END IF;

  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'Admin access required.');
  END IF;

  IF p_capacity IS NOT NULL AND p_capacity < 1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'Capacity must be at least 1.');
  END IF;

  IF p_default_duration_months IS NOT NULL
     AND (p_default_duration_months < 1 OR p_default_duration_months > 120) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                             'message', 'Default duration must be between 1 and 120 months.');
  END IF;

  IF p_allowed_multipliers IS NOT NULL AND array_length(p_allowed_multipliers, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_MULTIPLIER',
                             'message', 'At least one allowed multiplier is required.');
  END IF;

  IF p_allowed_multipliers IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM unnest(p_allowed_multipliers) m WHERE m < 1 OR m > 10) THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_MULTIPLIER',
                               'message', 'Multipliers must be between 1x and 10x.');
    END IF;
  END IF;

  UPDATE public.founder_program_settings
     SET program_enabled            = COALESCE(p_program_enabled, program_enabled),
         capacity                   = COALESCE(p_capacity, capacity),
         default_duration_months    = COALESCE(p_default_duration_months, default_duration_months),
         default_gift_multiplier    = COALESCE(p_default_gift_multiplier, default_gift_multiplier),
         default_cashout_multiplier = COALESCE(p_default_cashout_multiplier, default_cashout_multiplier),
         allowed_multipliers        = COALESCE(p_allowed_multipliers::numeric(6,2)[], allowed_multipliers),
         max_multiplier             = COALESCE(p_max_multiplier, max_multiplier),
         allow_manual_expiration    = COALESCE(p_allow_manual_expiration, allow_manual_expiration),
         notes                      = COALESCE(p_notes, notes),
         updated_by                 = v_actor,
         updated_at                 = now()
   WHERE id = true;

  -- Program-wide rule changes are audited so capacity / multiplier policy
  -- changes always have an attributable actor and reason.
  INSERT INTO public.founder_actions (
    founder_user_id, founder_username, action_type, reason, details, status, actor_role, created_at
  )
  SELECT v_actor,
         (SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Admin')
            FROM public.user_profiles up WHERE up.id = v_actor),
         'settings_updated',
         COALESCE(NULLIF(trim(p_reason), ''), 'Program settings updated'),
         jsonb_build_object(
           'program_enabled',            s.program_enabled,
           'capacity',                   s.capacity,
           'default_duration_months',    s.default_duration_months,
           'default_gift_multiplier',    s.default_gift_multiplier,
           'default_cashout_multiplier', s.default_cashout_multiplier,
           'allowed_multipliers',        s.allowed_multipliers
         ),
         'completed',
         'admin',
         now()
    FROM public.founder_program_settings s
   WHERE s.id = true;

  RETURN jsonb_build_object('success', true, 'message', 'Founder Program settings updated.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_admin_update_settings(
  boolean, integer, integer, numeric, numeric, numeric[], numeric, boolean, text, text
) TO authenticated, service_role;

-- ============================================================================
-- 12. REALTIME
-- ============================================================================

DO $realtime$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'founder_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.founder_messages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'founders') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.founders';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'founder_scheduled_broadcasts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.founder_scheduled_broadcasts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'founder_actions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.founder_actions';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Realtime publication is best-effort; RLS still protects every table.
    RAISE NOTICE 'Founder realtime publication skipped: %', SQLERRM;
END;
$realtime$;

COMMIT;

NOTIFY pgrst, 'reload schema';