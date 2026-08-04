-- Remove CEO Gold Premium theme from the requesting user's account
-- Run this as the CEO user you want to remove it from

-- Delete purchase record for CEO theme
DELETE FROM public.user_broadcast_theme_purchases
WHERE user_id = auth.uid()
  AND theme_id = (
    SELECT id FROM public.broadcast_background_themes WHERE slug = 'ceo_gold_premium'
  );

-- Clear active theme if it was set to CEO theme
UPDATE public.user_broadcast_theme_state
SET active_theme_id = NULL,
    updated_at = NOW()
WHERE user_id = auth.uid()
  AND active_theme_id = (
    SELECT id FROM public.broadcast_background_themes WHERE slug = 'ceo_gold_premium'
  );
