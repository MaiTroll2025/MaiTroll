-- Add animation and playback metadata to gift_items

ALTER TABLE public.gift_items
  ADD COLUMN IF NOT EXISTS animation_url TEXT,
  ADD COLUMN IF NOT EXISTS animation_duration_ms INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sound_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS display_mode TEXT DEFAULT 'recipient_box';

CREATE INDEX IF NOT EXISTS idx_gift_items_animation_url ON public.gift_items(animation_url) WHERE animation_url IS NOT NULL;

-- Grant minimal select access for frontend when appropriate (keeps existing RLS in place)
GRANT SELECT (animation_url, animation_duration_ms, sound_url, display_mode) ON public.gift_items TO authenticated;
GRANT SELECT (animation_url, animation_duration_ms, sound_url, display_mode) ON public.gift_items TO anon;
