BEGIN;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
