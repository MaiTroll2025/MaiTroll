-- Seed 20+ premium broadcast frames and add CEO purchase perk grant
BEGIN;

-- Insert/Upsert premium themes (slug must be unique)
INSERT INTO public.broadcast_background_themes (
  slug, name, description, preview_url, background_type, background_asset_url, background_css, price_coins, is_active, rarity, sort_order, asset_type, image_url, reactive_enabled, reactive_style, reactive_intensity
) VALUES
  ('pride_rainbow', 'Pride Rainbow', 'Animated rainbow frame celebrating pride month', '/themes/pride/rainbow/preview.png', 'image', '/themes/pride/rainbow/bg.png', 'background: linear-gradient(90deg, #ff0057, #ff7a00, #ffd300, #00d158, #0096ff, #7a00ff); background-size: 400% 400%; animation: gradientShift 8s linear infinite;', 1500, true, 'legendary', 10, 'theme', '/themes/pride/rainbow/preview.png', true, 'gradient', 0.6),
  ('pride_glow', 'Pride Glow', 'Soft glowing pride frame with subtle motion', '/themes/pride/glow/preview.png', 'image', '/themes/pride/glow/bg.png', 'background: radial-gradient(circle at 10% 10%, rgba(255,0,123,.25), transparent), radial-gradient(circle at 90% 90%, rgba(0,200,255,.25), transparent); animation: pulse 4s ease-in-out infinite;', 1200, true, 'epic', 11, 'theme', '/themes/pride/glow/preview.png', true, 'pulse', 0.4),
  ('holiday_snow', 'Holiday Snow', 'Festive snow with animated falling flakes', '/themes/holidays/snow/preview.png', 'image', '/themes/holidays/snow/bg.png', 'background: url("/themes/holidays/snow/bg.png") center/cover no-repeat; --snow-animation', 900, true, 'epic', 12, 'theme', '/themes/holidays/snow/preview.png', true, 'particles', 0.5),
  ('holiday_hollywood', 'Holiday Lights', 'Colorful holiday lights around the frame with motion', '/themes/holidays/lights/preview.png', 'image', '/themes/holidays/lights/bg.png', 'background: url("/themes/holidays/lights/bg.png") center/cover no-repeat; --lights-animation', 900, true, 'epic', 13, 'theme', '/themes/holidays/lights/preview.png', true, 'lights', 0.5),
  ('funny_balloons', 'Balloons & Confetti', 'Joyful balloons and confetti with gentle motion', '/themes/funny/balloons/preview.png', 'image', '/themes/funny/balloons/bg.png', 'background: url("/themes/funny/balloons/bg.png") center/cover no-repeat; --confetti', 700, true, 'rare', 14, 'theme', '/themes/funny/balloons/preview.png', true, 'confetti', 0.4),
  ('funny_meme', 'Meme Madness', 'Animated meme stickers around the frame', '/themes/funny/meme/preview.png', 'image', '/themes/funny/meme/bg.png', 'background: url("/themes/funny/meme/bg.png") center/cover no-repeat; --stickers', 800, true, 'rare', 15, 'theme', '/themes/funny/meme/preview.png', true, 'stickers', 0.3),
  ('cool_neon', 'Cool Neon', 'Electric neon borders with animated flicker', '/themes/cool/neon/preview.png', 'image', '/themes/cool/neon/bg.png', 'background: linear-gradient(90deg,#00ffd5,#6a00ff); filter: drop-shadow(0 0 12px rgba(106,0,255,0.6)); animation: neonFlicker 3s infinite;', 1100, true, 'epic', 16, 'theme', '/themes/cool/neon/preview.png', true, 'flicker', 0.6),
  ('cool_matrix', 'Cool Matrix', 'Matrix code rain plus subtle frame motion', '/themes/cool/matrix/preview.png', 'image', '/themes/cool/matrix/bg.png', 'background: url("/themes/cool/matrix/bg.png") center/cover no-repeat; --matrix', 1000, true, 'epic', 17, 'theme', '/themes/cool/matrix/preview.png', true, 'matrix', 0.5),
  ('troll_neon_crown', 'Troll Neon Crown', 'Neon green + peon purple frame with crown on top', '/themes/troll/neon_crown/preview.png', 'image', '/themes/troll/neon_crown/bg.png', 'background: linear-gradient(90deg,#00ff5a,#9b00ff); box-shadow: 0 0 18px rgba(0,255,90,0.45), 0 0 12px rgba(155,0,255,0.35); --crown-overlay', 2000, true, 'legendary', 18, 'theme', '/themes/troll/neon_crown/preview.png', true, 'dual-neon', 0.8),
  ('holiday_spooky', 'Spooky Night', 'Animated bats and candle glow for Halloween', '/themes/holidays/spooky/preview.png', 'image', '/themes/holidays/spooky/bg.png', 'background: url("/themes/holidays/spooky/bg.png") center/cover no-repeat; --bats', 900, true, 'epic', 19, 'theme', '/themes/holidays/spooky/preview.png', true, 'particles', 0.5),
  ('funny_polka', 'Polka Funk', 'Playful polka dots with animated movement', '/themes/funny/polka/preview.png', 'image', '/themes/funny/polka/bg.png', 'background: radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 40%); animation: polkaMove 6s linear infinite;', 600, true, 'rare', 20, 'theme', '/themes/funny/polka/preview.png', true, 'polka', 0.2),
  ('pride_aurora', 'Pride Aurora', 'Slow-moving aurora rainbow shimmer', '/themes/pride/aurora/preview.png', 'image', '/themes/pride/aurora/bg.png', 'background: linear-gradient(90deg, #ff4d8d, #ffb14d, #fff44d, #4dff9e, #4db7ff, #b84dff); background-size: 600% 600%; animation: auroraShift 12s ease-in-out infinite;', 1600, true, 'legendary', 21, 'theme', '/themes/pride/aurora/preview.png', true, 'aurora', 0.7),
  ('holiday_fireworks', 'Fireworks Gala', 'Colorful fireworks looping in corners', '/themes/holidays/fireworks/preview.png', 'image', '/themes/holidays/fireworks/bg.png', 'background: url("/themes/holidays/fireworks/bg.png") center/cover no-repeat; --fireworks', 1300, true, 'legendary', 22, 'theme', '/themes/holidays/fireworks/preview.png', true, 'fireworks', 0.6),
  ('cool_3dframe', '3D Frame', 'Subtle 3D parallax frame movement', '/themes/cool/3dframe/preview.png', 'image', '/themes/cool/3dframe/bg.png', 'background: url("/themes/cool/3dframe/bg.png") center/cover no-repeat; --parallax', 1200, true, 'epic', 23, 'theme', '/themes/cool/3dframe/preview.png', true, 'parallax', 0.5),
  ('pride_stars', 'Pride Stars', 'Stars that cycle through pride colors', '/themes/pride/stars/preview.png', 'image', '/themes/pride/stars/bg.png', 'background: radial-gradient(circle at top left, rgba(255,0,102,0.12), transparent), linear-gradient(90deg,#ff0057,#ff7a00,#ffd300,#00d158,#0096ff,#7a00ff); animation: starsTwinkle 9s infinite;', 1400, true, 'legendary', 24, 'theme', '/themes/pride/stars/preview.png', true, 'stars', 0.6),
  ('funny_googly', 'Googly Eyes', 'Googly eyes animate around the frame', '/themes/funny/googly/preview.png', 'image', '/themes/funny/googly/bg.png', 'background: url("/themes/funny/googly/bg.png") center/cover no-repeat; --googly', 700, true, 'rare', 25, 'theme', '/themes/funny/googly/preview.png', true, 'animated', 0.3),
  ('cool_space', 'Cosmic Drift', 'Slow-moving nebula and starfield', '/themes/cool/space/preview.png', 'image', '/themes/cool/space/bg.png', 'background: url("/themes/cool/space/bg.png") center/cover no-repeat; animation: spaceDrift 18s linear infinite;', 1250, true, 'epic', 26, 'theme', '/themes/cool/space/preview.png', true, 'nebula', 0.5),
  ('pride_prismatic', 'Prismatic Pride', 'Geometric prismatic motion with pride colors', '/themes/pride/prismatic/preview.png', 'image', '/themes/pride/prismatic/bg.png', 'background: linear-gradient(90deg,#ff6aa3,#ffb86a,#ffe86a,#7ef0a6,#66c7ff,#b06bff); animation: prismaticShift 10s linear infinite;', 1700, true, 'legendary', 27, 'theme', '/themes/pride/prismatic/preview.png', true, 'prismatic', 0.7),
  ('holiday_heart', 'Holiday Heart', 'Heart animations and sparkles for romantic holidays', '/themes/holidays/heart/preview.png', 'image', '/themes/holidays/heart/bg.png', 'background: url("/themes/holidays/heart/bg.png") center/cover no-repeat; --hearts', 800, true, 'rare', 28, 'theme', '/themes/holidays/heart/preview.png', true, 'hearts', 0.4),
  ('legendary_frame_glow', 'Legendary Glow', 'High-end animated glow and motion', '/themes/legendary/glow/preview.png', 'image', '/themes/legendary/glow/bg.png', 'background: linear-gradient(120deg,#ffd27a,#ff7ab8); filter: drop-shadow(0 0 18px rgba(255,122,184,0.5)); animation: slowPulse 8s infinite;', 2200, true, 'legendary', 29, 'theme', '/themes/legendary/glow/preview.png', true, 'glow', 0.8)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  preview_url = EXCLUDED.preview_url,
  background_asset_url = EXCLUDED.background_asset_url,
  background_css = EXCLUDED.background_css,
  price_coins = EXCLUDED.price_coins,
  is_active = EXCLUDED.is_active,
  rarity = EXCLUDED.rarity,
  sort_order = EXCLUDED.sort_order,
  image_url = EXCLUDED.image_url,
  reactive_enabled = EXCLUDED.reactive_enabled,
  reactive_style = EXCLUDED.reactive_style,
  reactive_intensity = EXCLUDED.reactive_intensity;

-- Ensure CEO theme exists and is priced at 25000 coins
INSERT INTO public.broadcast_background_themes (
  slug, name, description, preview_url, background_type, background_asset_url, background_css, price_coins, is_active, rarity, sort_order, asset_type, image_url, is_exclusive, is_system_locked
) VALUES (
  'ceo_gold_premium', 'CEO Gold Premium', 'Exclusive ultra-luxury gold broadcast theme for the CEO', '/assets/themes/ceo_gold/preview.png', 'image', '/assets/themes/ceo_gold/background.png', 'background: url("/assets/themes/ceo_gold/background.png") center/cover no-repeat; filter: brightness(1.2) contrast(1.1);', 25000, true, 'legendary', -1, 'background_image', '/assets/themes/ceo_gold/background.png', true, true
) ON CONFLICT (slug) DO UPDATE SET price_coins = EXCLUDED.price_coins, is_exclusive = EXCLUDED.is_exclusive, is_system_locked = EXCLUDED.is_system_locked, name = EXCLUDED.name, description = EXCLUDED.description;

-- Create helper function to grant all active perks to a user for N days (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.grant_temporary_all_perks(target_user uuid, days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_perks (user_id, perk_id, purchased_at, expires_at, is_active, metadata)
  SELECT target_user, p.id, now(), now() + (days || ' days')::interval, true, jsonb_build_object('granted_by','ceo_frame')
  FROM public.perks p
  WHERE p.is_active IS DISTINCT FROM false;
END;
$$;

-- Trigger function: after a theme purchase, if CEO theme was purchased, grant all perks for 30 days
CREATE OR REPLACE FUNCTION public.after_broadcast_theme_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  purchased_slug text;
BEGIN
  SELECT slug INTO purchased_slug FROM public.broadcast_background_themes WHERE id = NEW.theme_id;
  IF purchased_slug = 'ceo_gold_premium' THEN
    PERFORM public.grant_temporary_all_perks(NEW.user_id, 30);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to user_broadcast_theme_purchases so it fires after insert
DROP TRIGGER IF EXISTS trg_after_theme_purchase ON public.user_broadcast_theme_purchases;
CREATE TRIGGER trg_after_theme_purchase
AFTER INSERT ON public.user_broadcast_theme_purchases
FOR EACH ROW
EXECUTE FUNCTION public.after_broadcast_theme_purchase();

COMMIT;
