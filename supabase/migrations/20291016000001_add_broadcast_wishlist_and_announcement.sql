-- Broadcast Ticker: Add wishlist_url and announcement columns to streams table
-- These fields power the per-broadcast ticker system:
--   - announcement: broadcaster's text announcement shown in the ticker
--   - wishlist_url: broadcaster's valid HTTPS URL shown as a clickable dropdown in the ticker
-- Double-tap/double-click on the ticker opens the edit flow for the wishlist URL.

BEGIN;

-- Add columns to streams table (idempotent).
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS announcement TEXT,
  ADD COLUMN IF NOT EXISTS wishlist_url TEXT;

-- Add columns to stream_settings for tracking whether the ticker is enabled per-broadcast.
ALTER TABLE public.stream_settings
  ADD COLUMN IF NOT EXISTS ticker_enabled BOOLEAN DEFAULT false;

-- Enable realtime for the new columns by ensuring the streams table is in the
-- publication. Supabase tracks whole-row changes, so existing realtime
-- subscriptions on `streams` will automatically propagate these new fields.

-- RLS: ensure the streams table remains readable by authenticated users.
-- (No policy changes needed; existing SELECT policies already cover the table.)

-- Helpful indexes for lookups by broadcaster (user_id).
CREATE INDEX IF NOT EXISTS idx_streams_wishlist_url ON public.streams(user_id) WHERE wishlist_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_streams_announcement ON public.streams(user_id) WHERE announcement IS NOT NULL;

COMMIT;