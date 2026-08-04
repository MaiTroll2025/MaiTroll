-- Register the stream_audience_presence.user_id -> user_profiles.id relationship
-- that PostgREST requires for embedded selects like user_profiles:user_id(...).

ALTER TABLE public.stream_audience_presence
  DROP CONSTRAINT IF EXISTS stream_audience_presence_user_id_fkey;

ALTER TABLE public.stream_audience_presence
  ADD CONSTRAINT stream_audience_presence_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.user_profiles(id)
  ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stream_audience_presence'::regclass
      AND conname = 'stream_audience_presence_stream_user_unique'
  ) THEN
    ALTER TABLE public.stream_audience_presence
      ADD CONSTRAINT stream_audience_presence_stream_user_unique
      UNIQUE (stream_id, user_id);
  END IF;
END$$;
