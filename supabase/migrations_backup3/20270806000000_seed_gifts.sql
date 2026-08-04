-- Seed gifts into purchasable_items and gift_items
-- This ensures gifts are available in the GiftTray

-- 0. Ensure schema consistency
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'troll_coins';
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_type TEXT;

-- 1. Seed purchasable_items (Preferred source)
-- Check if table exists first (it should, but safety first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchasable_items') THEN
        INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_active, metadata)
        VALUES
        ('gift_rose', 'Rose', 'gift', 1, true, '{"icon": "🌹", "subcategory": "Common"}'),
        ('gift_coffee', 'Coffee', 'gift', 10, true, '{"icon": "☕", "subcategory": "Common"}'),
        ('gift_heart', 'Heart', 'gift', 50, true, '{"icon": "❤️", "subcategory": "Love"}'),
        ('gift_fire', 'Fire', 'gift', 100, true, '{"icon": "🔥", "subcategory": "Hype"}'),
        ('gift_diamond', 'Diamond', 'gift', 500, true, '{"icon": "💎", "subcategory": "Luxury"}'),
        ('gift_rocket', 'Rocket', 'gift', 1000, true, '{"icon": "🚀", "subcategory": "Luxury"}'),
        ('gift_dragon', 'Dragon', 'gift', 5000, true, '{"icon": "🐉", "subcategory": "Legendary"}')
        ON CONFLICT (item_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            coin_price = EXCLUDED.coin_price,
            is_active = EXCLUDED.is_active,
            metadata = EXCLUDED.metadata;
    END IF;
END $$;

-- 2. Seed gift_items (Fallback source)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gift_items') THEN
        -- Check if gift_slug column exists (it might not if migration was skipped)
        -- Based on code, it uses gift_slug.
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_items' AND column_name = 'gift_slug') THEN
             ALTER TABLE public.gift_items ADD COLUMN gift_slug TEXT;
        END IF;

        -- Now insert (coin_cost populated to match value for new-style lookups)
        INSERT INTO public.gift_items (name, value, coin_cost, icon, gift_slug, category, currency)
        VALUES
        ('Rose', 1, 1, '🌹', 'gift_rose', 'Common', 'troll_coins'),
        ('Coffee', 10, 10, '☕', 'gift_coffee', 'Common', 'troll_coins'),
        ('Heart', 50, 50, '❤️', 'gift_heart', 'Love', 'troll_coins'),
        ('Fire', 100, 100, '🔥', 'gift_fire', 'Hype', 'troll_coins'),
        ('Diamond', 500, 500, '💎', 'gift_diamond', 'Luxury', 'troll_coins'),
        ('Rocket', 1000, 1000, '🚀', 'gift_rocket', 'Luxury', 'troll_coins'),
        ('Dragon', 5000, 5000, '🐉', 'gift_dragon', 'Legendary', 'troll_coins')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
