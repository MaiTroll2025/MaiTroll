-- Update prices for Royal Purple and Default Dark broadcast themes
-- Both were previously 0, now set to 10 troll coins

UPDATE public.broadcast_background_themes
SET price_coins = 10
WHERE slug = 'purple' 
   OR name ILIKE 'Default Dark' 
   OR slug = 'default_dark'
   OR slug = 'default-dark';
