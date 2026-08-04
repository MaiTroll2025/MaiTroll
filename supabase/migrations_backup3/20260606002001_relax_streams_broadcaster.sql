-- Allow streams to be seeded without broadcaster_id
ALTER TABLE public.streams
  ALTER COLUMN broadcaster_id DROP NOT NULL;
