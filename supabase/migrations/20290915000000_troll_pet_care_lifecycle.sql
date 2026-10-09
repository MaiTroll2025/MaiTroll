BEGIN;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS hunger_status INTEGER NOT NULL DEFAULT 100
    CHECK (hunger_status BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS walk_status INTEGER NOT NULL DEFAULT 100
    CHECK (walk_status BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS attention_status INTEGER NOT NULL DEFAULT 100
    CHECK (attention_status BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS next_hunger_decay_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_walk_decay_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attention_decay_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_offline_care_notification_at TIMESTAMPTZ;

UPDATE public.pets
SET hunger_status = care_status,
    walk_status = care_status,
    attention_status = care_status,
next_hunger_decay_at = now() + random() * interval '30 minutes',
    next_walk_decay_at = now() + random() * interval '30 minutes',
    next_attention_decay_at = now() + random() * interval '30 minutes'
WHERE next_hunger_decay_at IS NULL
   OR next_walk_decay_at IS NULL
   OR next_attention_decay_at IS NULL;

ALTER TABLE public.pets
  ALTER COLUMN next_hunger_decay_at SET DEFAULT (now() + random() * interval '30 minutes'),
  ALTER COLUMN next_walk_decay_at SET DEFAULT (now() + random() * interval '30 minutes'),
  ALTER COLUMN next_attention_decay_at SET DEFAULT (now() + random() * interval '30 minutes'),
  ALTER COLUMN next_hunger_decay_at SET NOT NULL,
  ALTER COLUMN next_walk_decay_at SET NOT NULL,
  ALTER COLUMN next_attention_decay_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.pet_care_lifecycle_state (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  last_seen_online BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO public.pet_care_lifecycle_state (id, last_seen_online)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pet_care_lifecycle_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pet_care_lifecycle_state FROM PUBLIC, anon, authenticated;

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'pets'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pets';
  END IF;
END;
$publication$;

CREATE OR REPLACE FUNCTION public.pet_sync_interaction_care_bars()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hunger INTEGER;
  v_walk INTEGER;
  v_attention INTEGER;
BEGIN
  UPDATE public.pets
  SET hunger_status = CASE WHEN NEW.interaction_type = 'feed'
        THEN LEAST(100, hunger_status + NEW.status_delta) ELSE hunger_status END,
      walk_status = CASE WHEN NEW.interaction_type = 'walk'
        THEN LEAST(100, walk_status + NEW.status_delta) ELSE walk_status END,
      attention_status = CASE WHEN NEW.interaction_type = 'care'
        THEN LEAST(100, attention_status + NEW.status_delta) ELSE attention_status END
  WHERE id = NEW.pet_id
  RETURNING hunger_status, walk_status, attention_status
  INTO v_hunger, v_walk, v_attention;

  UPDATE public.pets
  SET care_status = round((v_hunger + v_walk + v_attention)::NUMERIC / 3)::INTEGER,
      needs = jsonb_set(
        jsonb_set(
          jsonb_set(COALESCE(needs, '{}'::jsonb), '{hunger}', to_jsonb(v_hunger <= 30), true),
          '{walk}', to_jsonb(v_walk <= 30), true
        ),
        '{care}', to_jsonb(v_attention <= 30), true
      ),
      updated_at = now()
  WHERE id = NEW.pet_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pet_sync_interaction_care_bars() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pet_sync_interaction_care_bars ON public.pet_interactions;
CREATE TRIGGER trg_pet_sync_interaction_care_bars
  AFTER INSERT ON public.pet_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.pet_sync_interaction_care_bars();

CREATE OR REPLACE FUNCTION public.pet_process_care_lifecycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.pet_care_lifecycle_state%ROWTYPE;
  v_pet public.pets%ROWTYPE;
  v_online BOOLEAN;
  v_hunger INTEGER;
  v_walk INTEGER;
  v_attention INTEGER;
  v_hunger_due BOOLEAN;
  v_walk_due BOOLEAN;
  v_attention_due BOOLEAN;
  v_lowest_need TEXT;
  v_lowest_status INTEGER;
  v_processed INTEGER := 0;
  v_notifications INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('troll_pet_care_lifecycle')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_running');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE is_online IS TRUE
  ) INTO v_online;

  SELECT * INTO v_state
  FROM public.pet_care_lifecycle_state
  WHERE id = true
  FOR UPDATE;

  IF NOT v_online THEN
    UPDATE public.pet_care_lifecycle_state
    SET last_seen_online = false
    WHERE id = true;
    RETURN jsonb_build_object('skipped', true, 'reason', 'nobody_online');
  END IF;

  IF NOT v_state.last_seen_online THEN
    UPDATE public.pets
    SET next_hunger_decay_at = now() + random() * interval '30 minutes',
        next_walk_decay_at = now() + random() * interval '30 minutes',
        next_attention_decay_at = now() + random() * interval '30 minutes'
    WHERE is_active IS TRUE;

    UPDATE public.pet_care_lifecycle_state
    SET last_seen_online = true
    WHERE id = true;
    RETURN jsonb_build_object('started', true, 'reason', 'presence_resumed');
  END IF;

  FOR v_pet IN
    SELECT *
    FROM public.pets
    WHERE is_active IS TRUE
      AND (
        next_hunger_decay_at <= now()
        OR next_walk_decay_at <= now()
        OR next_attention_decay_at <= now()
      )
    ORDER BY id
    FOR UPDATE SKIP LOCKED
  LOOP
    v_hunger := v_pet.hunger_status;
    v_walk := v_pet.walk_status;
    v_attention := v_pet.attention_status;
    v_hunger_due := v_pet.next_hunger_decay_at <= now();
    v_walk_due := v_pet.next_walk_decay_at <= now();
    v_attention_due := v_pet.next_attention_decay_at <= now();

    IF v_hunger_due THEN
      v_hunger := GREATEST(0, v_hunger - (15 + floor(random() * 12)::INTEGER));
    END IF;
    IF v_walk_due THEN
      v_walk := GREATEST(0, v_walk - (5 + floor(random() * 4)::INTEGER));
    END IF;
    IF v_attention_due THEN
      v_attention := GREATEST(0, v_attention - (5 + floor(random() * 4)::INTEGER));
    END IF;

    UPDATE public.pets
    SET hunger_status = v_hunger,
        walk_status = v_walk,
        attention_status = v_attention,
        care_status = round((v_hunger + v_walk + v_attention)::NUMERIC / 3)::INTEGER,
        needs = jsonb_set(
          jsonb_set(
            jsonb_set(COALESCE(needs, '{}'::jsonb), '{hunger}', to_jsonb(v_hunger <= 30), true),
            '{walk}', to_jsonb(v_walk <= 30), true
          ),
          '{care}', to_jsonb(v_attention <= 30), true
        ),
        next_hunger_decay_at = CASE WHEN v_hunger_due
          THEN GREATEST(next_hunger_decay_at + interval '30 minutes', now() + interval '1 minute')
          ELSE next_hunger_decay_at END,
        next_walk_decay_at = CASE WHEN v_walk_due
          THEN GREATEST(next_walk_decay_at + interval '30 minutes', now() + interval '1 minute')
          ELSE next_walk_decay_at END,
        next_attention_decay_at = CASE WHEN v_attention_due
          THEN GREATEST(next_attention_decay_at + interval '30 minutes', now() + interval '1 minute')
          ELSE next_attention_decay_at END,
        updated_at = now()
    WHERE id = v_pet.id
    RETURNING * INTO v_pet;

    v_processed := v_processed + 1;

    SELECT need, status
    INTO v_lowest_need, v_lowest_status
    FROM (VALUES
      ('hunger', v_pet.hunger_status),
      ('walk', v_pet.walk_status),
      ('attention', v_pet.attention_status)
    ) AS care(need, status)
    ORDER BY status, need
    LIMIT 1;

    IF v_lowest_status <= 20
       AND (v_pet.last_offline_care_notification_at IS NULL
            OR v_pet.last_offline_care_notification_at <= now() - interval '24 hours')
       AND NOT EXISTS (
         SELECT 1
         FROM public.user_profiles
         WHERE id = v_pet.owner_id
           AND is_online IS TRUE
       ) THEN
      PERFORM public.create_notification(
        v_pet.owner_id,
        'pet_care',
        'Your Troll Pet needs care',
        v_pet.name || ' is low on ' || v_lowest_need || ' (' || v_lowest_status || '%). Visit the Troll Animal Shelter to help.',
        jsonb_build_object(
          'source', 'pet_care_lifecycle',
          'pet_id', v_pet.id,
          'need', v_lowest_need,
          'need_status', v_lowest_status,
          'care_status', v_pet.care_status,
          'route', '/troll-animal-shelter'
        )
      );

      UPDATE public.pets
      SET last_offline_care_notification_at = now()
      WHERE id = v_pet.id;
      v_notifications := v_notifications + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_pets', v_processed,
    'offline_notifications', v_notifications
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pet_process_care_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pet_process_care_lifecycle() TO service_role;

DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1'
      USING 'troll-pet-care-lifecycle';
    EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING 'troll-pet-care-lifecycle', '* * * * *',
            'SELECT public.pet_process_care_lifecycle()';
  ELSE
    RAISE NOTICE 'pg_cron is unavailable; schedule public.pet_process_care_lifecycle() once per minute.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule Troll Pet care lifecycle; schedule public.pet_process_care_lifecycle() once per minute: %', SQLERRM;
END;
$schedule$;

COMMIT;
