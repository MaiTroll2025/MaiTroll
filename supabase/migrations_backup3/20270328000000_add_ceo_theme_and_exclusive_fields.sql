-- Simplified migration: Just add theme data without schema changes
-- This avoids all foreign key and type conversion issues

-- Add new columns to broadcast_background_themes (safe additions)
ALTER TABLE public.broadcast_background_themes
ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT false NOT NULL;

-- Add theme reference columns (safe additions)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS selected_theme_slug TEXT;

ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS broadcast_theme_slug TEXT;

-- Insert all broadcast themes
INSERT INTO public.broadcast_background_themes (
  slug,
  name,
  description,
  preview_url,
  background_type,
  background_asset_url,
  background_css,
  price_coins,
  is_active,
  rarity,
  sort_order,
  asset_type,
  image_url,
  is_exclusive,
  is_system_locked
) VALUES
  -- Existing themes (update if they exist)
  ('purple', 'Royal Purple', 'Elegant, premium regal theme with gold ornamental corners and velvet glow', '/themes/purple/preview.png', 'image', '/themes/purple/background.png', 'theme-purple', 0, true, 'rare', 1, 'theme', '/themes/purple/preview.png', false, false),
  ('neon', 'Neon Nights', 'Modern city nightlife with dual neon borders and streaming energy effects', '/themes/neon/preview.png', 'image', '/themes/neon/background.png', 'theme-neon', 0, true, 'rare', 2, 'theme', '/themes/neon/preview.png', false, false),

  -- New themes
  ('ice', 'Ice Cold', 'Frozen, high-detail ice/glacier aesthetic with translucent icy glass borders and frost shimmer', '/themes/ice/preview.png', 'image', '/themes/ice/background.png', 'theme-ice', 0, true, 'epic', 3, 'theme', '/themes/ice/preview.png', false, false),
  ('fire', 'Inferno', 'Aggressive fire theme with metallic frames, lava veins, and flickering embers', '/themes/fire/preview.png', 'image', '/themes/fire/background.png', 'theme-fire', 0, true, 'epic', 4, 'theme', '/themes/fire/preview.png', false, false),
  ('gold', 'Golden Luxury', 'High-end wealth theme with thick polished gold frames and premium effects', '/themes/gold/preview.png', 'image', '/themes/gold/background.png', 'theme-gold', 0, true, 'epic', 5, 'theme', '/themes/gold/preview.png', false, false),
  ('matrix', 'The Matrix', 'Cyber hacker theme with digital rain, metallic green frames, and matrix code', '/themes/matrix/preview.png', 'image', '/themes/matrix/background.png', 'theme-matrix', 0, true, 'epic', 6, 'theme', '/themes/matrix/preview.png', false, false),
  ('retro', 'Retro Wave', '80s synthwave vaporwave with neon gradients and retro glow effects', '/themes/retro/preview.png', 'image', '/themes/retro/background.png', 'theme-retro', 0, true, 'epic', 7, 'theme', '/themes/retro/preview.png', false, false),
  ('ocean', 'Ocean Blue', 'Deep sea fluid theme with water-glass borders and calm power effects', '/themes/ocean/preview.png', 'image', '/themes/ocean/background.png', 'theme-ocean', 0, true, 'epic', 8, 'theme', '/themes/ocean/preview.png', false, false),

  -- CEO theme
  ('ceo_gold_premium', 'CEO Gold Premium', 'Exclusive ultra-luxury gold broadcast theme for the CEO', '/assets/themes/ceo_gold/preview.png', 'image', '/assets/themes/ceo_gold/background.png', 'background: url("/assets/themes/ceo_gold/background.png") center/cover no-repeat; filter: brightness(1.2) contrast(1.1);', 0, true, 'legendary', -1, 'background_image', '/assets/themes/ceo_gold/background.png', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  preview_url = EXCLUDED.preview_url,
  background_asset_url = EXCLUDED.background_asset_url,
  background_css = EXCLUDED.background_css,
  price_coins = EXCLUDED.price_coins,
  rarity = EXCLUDED.rarity,
  sort_order = EXCLUDED.sort_order,
  is_exclusive = EXCLUDED.is_exclusive,
  is_system_locked = EXCLUDED.is_system_locked;

-- Add RLS policy to prevent CEO theme from being shown in store for non-CEO users
DROP POLICY IF EXISTS "hide_ceo_theme_from_store" ON public.broadcast_background_themes;
CREATE POLICY "hide_ceo_theme_from_store" ON public.broadcast_background_themes
FOR SELECT TO authenticated
USING (
  slug != 'ceo_gold_premium' OR
  (slug = 'ceo_gold_premium' AND auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'username' = 'ceo'
  ))
);