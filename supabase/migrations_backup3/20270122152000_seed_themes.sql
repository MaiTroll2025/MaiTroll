-- Seed Broadcast Themes
-- Only inserts if they don't exist

INSERT INTO public.broadcast_background_themes (slug, name, description, price_coins, image_url, background_css)
VALUES 
  ('purple', 'Royal Purple', 'The classic Mai Troll look.', 0, '/assets/themes/theme_purple.svg', 'theme-purple'),
  ('neon', 'Cyber Neon', 'High contrast neon styling.', 100, '/assets/themes/theme_neon.svg', 'theme-neon'),
  ('rgb', 'Gamer RGB', 'Animated RGB flow for true gamers.', 500, '/assets/themes/theme_rgb.svg', 'theme-rgb')
ON CONFLICT (slug) DO UPDATE 
SET 
  image_url = EXCLUDED.image_url,
  background_css = EXCLUDED.background_css,
  price_coins = EXCLUDED.price_coins;
