ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS subscriber_only_chat BOOLEAN NOT NULL DEFAULT false;
