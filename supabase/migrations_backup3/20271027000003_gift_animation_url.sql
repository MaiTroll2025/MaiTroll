-- Add animation_url column to gift_items for WebM video overlays
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_url TEXT;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_gift_items_animation_url ON public.gift_items(animation_url) WHERE animation_url IS NOT NULL;

-- Grant permissions for reading
GRANT SELECT (animation_url) ON public.gift_items TO authenticated;
GRANT SELECT (animation_url) ON public.gift_items TO anon;