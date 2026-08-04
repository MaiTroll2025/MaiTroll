-- Deactivate specific gaming gifts: Clutch, Penta Kill, Raid Boss, Legendary Play
UPDATE public.gift_items
SET status = 'inactive'
WHERE gift_slug IN ('gaming-clutch', 'gaming-penta', 'gaming-raidboss', 'gaming-legendary');
