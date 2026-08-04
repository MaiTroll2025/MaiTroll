-- Broadcast agreement acceptance tracking per stream session
-- Stores proof that the broadcaster accepted the agreement before each live session

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS broadcast_disclaimer_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS broadcast_disclaimer_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_disclaimer_user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_streams_broadcast_disclaimer_accepted
  ON public.streams (broadcast_disclaimer_accepted)
  WHERE broadcast_disclaimer_accepted = true;

CREATE INDEX IF NOT EXISTS idx_streams_broadcast_disclaimer_user_id
  ON public.streams (broadcast_disclaimer_user_id);
