-- Add per-format animation URL columns and base_url to gift_items.
-- The gifting pipeline and BroadcastPage enrichment query reference these
-- columns; adding them with IF NOT EXISTS makes the SELECTs safe on databases
-- that already have them and ensures private-bucket URL resolution works.

ALTER TABLE public.gift_items
  ADD COLUMN IF NOT EXISTS animation_url_webm TEXT,
  ADD COLUMN IF NOT EXISTS animation_url_mp4 TEXT,
  ADD COLUMN IF NOT EXISTS animation_url_mov TEXT,
  ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Indexes to speed up lookups by format columns (null-filtered)
CREATE INDEX IF NOT EXISTS idx_gift_items_animation_url_webm
  ON public.gift_items(animation_url_webm) WHERE animation_url_webm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_items_animation_url_mp4
  ON public.gift_items(animation_url_mp4) WHERE animation_url_mp4 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_items_animation_url_mov
  ON public.gift_items(animation_url_mov) WHERE animation_url_mov IS NOT NULL;
