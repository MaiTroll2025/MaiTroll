BEGIN;

DO $$
DECLARE
  constraint_name text;
BEGIN
  UPDATE public.streams
  SET seat_count = 4
  WHERE seat_count > 4;

  UPDATE public.streams
  SET box_count = 5
  WHERE box_count > 5;

  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.streams'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%seat_count%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.streams DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  ALTER TABLE public.streams
    ADD CONSTRAINT streams_seat_count_range
    CHECK (seat_count >= 0 AND seat_count <= 4);
END $$;

COMMENT ON COLUMN public.streams.seat_count IS
  'Number of guest seats (0-4). Broadcaster is NOT counted. Total boxes = seat_count + 1.';

INSERT INTO public.admin_settings (setting_key, setting_value, description, updated_at)
VALUES (
  'broadcast_seat_cap_max',
  '{"value": 4}',
  'Max guest seats per broadcast, not including broadcaster',
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = NOW();

DO $$
DECLARE
  constraint_name text;
BEGIN
  UPDATE public.stream_smoke_events
  SET seat_count = 4
  WHERE seat_count > 4;

  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.stream_smoke_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%seat_count%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.stream_smoke_events DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  ALTER TABLE public.stream_smoke_events
    ADD CONSTRAINT stream_smoke_events_seat_count_range
    CHECK (seat_count >= 0 AND seat_count <= 4);
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  IF to_regclass('public.stream_seat_sessions') IS NOT NULL THEN
    FOR constraint_name IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.stream_seat_sessions'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%seat_index%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.stream_seat_sessions DROP CONSTRAINT %I',
        constraint_name
      );
    END LOOP;

    ALTER TABLE public.stream_seat_sessions
      ADD CONSTRAINT stream_seat_sessions_seat_index_range
      CHECK (seat_index BETWEEN 1 AND 4) NOT VALID;
  END IF;
END $$;

COMMIT;
