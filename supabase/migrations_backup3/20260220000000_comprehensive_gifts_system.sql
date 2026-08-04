-- Comprehensive Gifts System Migration
-- Adds categories, rarity, and 100+ gifts across all required categories

BEGIN;

-- Ensure gifts table exists with proper schema
CREATE TABLE IF NOT EXISTS public.gifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT DEFAULT '🎁',
    animation_url TEXT,
    cost INTEGER DEFAULT 0 NOT NULL,
    category TEXT NOT NULL,
    rarity TEXT DEFAULT 'common',
    class TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'category') THEN
        ALTER TABLE public.gifts ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'rarity') THEN
        ALTER TABLE public.gifts ADD COLUMN rarity TEXT DEFAULT 'common';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'class') THEN
        ALTER TABLE public.gifts ADD COLUMN class TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'is_active') THEN
        ALTER TABLE public.gifts ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'animation_url') THEN
        ALTER TABLE public.gifts ADD COLUMN animation_url TEXT;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can read gifts" ON public.gifts
    FOR SELECT USING (true);

-- Delete existing gifts to start fresh with comprehensive list
DELETE FROM public.gifts;

-- ==========================================
-- LOW VALUE GIFTS (1-50 coins)
-- ==========================================
INSERT INTO public.gifts (name, icon_url, cost, category, rarity, class, animation_type) VALUES
-- General Low Value
('Rose', '🌹', 10, 'general', 'common', 'romance', 'float_up'),
('Coffee', '☕', 15, 'general', 'common', 'food', 'steam'),
('Pizza', '🍕', 20, 'general', 'common', 'food', 'bounce'),
('Cookie', '🍪', 10, 'general', 'common', 'food', 'crumb'),
('Candy', '🍬', 15, 'general', 'common', 'food', 'wrapper'),
('Heart', '❤️', 25, 'general', 'common', 'romance', 'pulse'),
('Star', '⭐', 20, 'general', 'common', 'magic', 'twinkle'),
('Thumbs Up', '👍', 25, 'general', 'common', 'social', 'bounce'),
('High Five', '✋', 30, 'general', 'common', 'social', 'slap'),
('Wave', '👋', 20, 'general', 'common', 'social', 'wave'),

-- Funny Low Value
('Laugh', '😂', 15, 'funny', 'common', 'emoji', 'tear'),
('ROFL', '🤣', 20, 'funny', 'common', 'emoji', 'cry'),
('Clown', '🤡', 25, 'funny', 'common', 'character', 'horn'),
('Poop', '💩', 30, 'funny', 'common', 'emoji', 'poof'),
('Whoops', '🙈', 15, 'funny', 'common', 'emoji', 'hide'),

-- Smoking Low Value
('Cigarette', '🚬', 25, 'smoking', 'common', 'tobacco', 'smoke'),
('Lighter', '🔥', 20, 'smoking', 'common', 'accessory', 'flame'),
('Smoke Ring', '💨', 30, 'smoking', 'common', 'effect', 'ring'),

-- Drinking Low Value
('Beer', '🍺', 25, 'drinking', 'common', 'alcohol', 'foam'),
('Wine', '🍷', 30, 'drinking', 'common', 'alcohol', 'swirl'),
('Cheers', '🥂', 35, 'drinking', 'common', 'toast', 'clink'),
('Shot', '🥃', 40, 'drinking', 'common', 'alcohol', 'gulp');

-- ==========================================
-- MEDIUM VALUE GIFTS (50-200 coins)
-- ==========================================
INSERT INTO public.gifts (name, icon_url, cost, category, rarity, class, animation_type) VALUES
-- General Medium
('Bouquet', '💐', 75, 'general', 'uncommon', 'romance', 'bloom'),
('Trophy', '🏆', 100, 'general', 'uncommon', 'award', 'shine'),
('Medal', '🥇', 80, 'general', 'uncommon', 'award', 'glint'),
('Crown', '👑', 150, 'general', 'rare', 'royal', 'sparkle'),
('Diamond', '💎', 200, 'general', 'rare', 'gem', 'refract'),

-- Men Medium
('Muscle', '💪', 75, 'men', 'uncommon', 'body', 'flex'),
('Tie', '👔', 100, 'men', 'uncommon', 'clothing', 'flip'),
('Briefcase', '💼', 125, 'men', 'uncommon', 'business', 'open'),
('Watch', '⌚', 150, 'men', 'rare', 'accessory', 'tick'),

-- Women Medium
('Lipstick', '💄', 75, 'women', 'uncommon', 'beauty', 'apply'),
('Dress', '👗', 125, 'women', 'uncommon', 'clothing', 'spin'),
('High Heels', '👠', 100, 'women', 'uncommon', 'clothing', 'click'),
('Purse', '👜', 150, 'women', 'rare', 'accessory', 'shake'),

-- LGBT Medium
('Rainbow', '🌈', 100, 'lgbt', 'uncommon', 'pride', 'wave'),
('Trans Flag', '🏳️‍⚧️', 100, 'lgbt', 'uncommon', 'pride', 'flutter'),
('Pride Heart', '🧡', 125, 'lgbt', 'uncommon', 'pride', 'pulse'),

-- Holiday Medium
('Pumpkin', '🎃', 75, 'holiday', 'uncommon', 'halloween', 'glow'),
('Turkey', '🦃', 100, 'holiday', 'uncommon', 'thanksgiving', 'gobble'),
('Firework', '🎆', 150, 'holiday', 'uncommon', 'celebration', 'burst'),

-- Funny Medium
('Mic Drop', '🎤', 100, 'funny', 'uncommon', 'drama', 'drop'),
('Facepalm', '🤦', 75, 'funny', 'uncommon', 'emoji', 'slap'),
('Eye Roll', '🙄', 80, 'funny', 'uncommon', 'emoji', 'spin');

-- ==========================================
-- HIGH VALUE GIFTS (200-1000 coins)
-- ==========================================
INSERT INTO public.gifts (name, icon_url, cost, category, rarity, class, animation_type) VALUES
-- General High
('Sports Car', '🏎️', 500, 'cars', 'epic', 'vehicle', 'drive'),
('Motorcycle', '🏍️', 400, 'cars', 'epic', 'vehicle', 'rev'),
('Luxury Sedan', '🚗', 600, 'cars', 'legendary', 'vehicle', 'cruise'),

-- Houses High
('Cottage', '🏠', 500, 'houses', 'epic', 'property', 'expand'),
('Mansion', '🏰', 1000, 'houses', 'legendary', 'property', 'grow'),
('Penthouse', '🏙️', 800, 'houses', 'legendary', 'property', 'rise'),

-- Boats High
('Yacht', '🛥️', 750, 'boats', 'legendary', 'vehicle', 'sail'),
('Speedboat', '🚤', 500, 'boats', 'epic', 'vehicle', 'zoom'),
('Sailboat', '⛵', 400, 'boats', 'epic', 'vehicle', 'tack'),

-- Planes High
('Private Jet', '✈️', 1000, 'planes', 'legendary', 'vehicle', 'fly'),
('Helicopter', '🚁', 600, 'planes', 'epic', 'vehicle', 'hover'),
('Hot Air Balloon', '🎈', 400, 'planes', 'rare', 'vehicle', 'float'),

-- Luxury High
('Money Rain', '💰', 500, 'luxury', 'epic', 'effect', 'rain'),
('Gold Chain', '⛓️', 600, 'luxury', 'epic', 'jewelry', 'dangle'),
('Platinum Card', '💳', 750, 'luxury', 'legendary', 'status', 'shine'),

-- Smoking High
('Cigar', '🍺', 300, 'smoking', 'rare', 'tobacco', 'smoke_ring'),
('Hookah', '💨', 400, 'smoking', 'rare', 'device', 'bubble'),

-- Drinking High
('Champagne', '🍾', 350, 'drinking', 'rare', 'alcohol', 'pop'),
('Whiskey Decanter', '🥃', 400, 'drinking', 'rare', 'alcohol', 'pour'),
('Martini', '🍸', 300, 'drinking', 'rare', 'alcohol', 'stir'),

-- Men High
('Gold Watch', '⌚', 500, 'men', 'epic', 'accessory', 'shine'),
('Suit', '🤵', 600, 'men', 'epic', 'clothing', 'transform'),
('Crown', '👑', 800, 'men', 'legendary', 'royal', 'reveal'),

-- Women High
('Engagement Ring', '💍', 750, 'women', 'legendary', 'jewelry', 'sparkle'),
('Fur Coat', '🧥', 600, 'women', 'epic', 'clothing', 'drape'),
('Tiara', '👸', 500, 'women', 'epic', 'jewelry', 'crown'),

-- LGBT High
('Pride Parade', '🏳️‍🌈', 400, 'lgbt', 'epic', 'event', 'march'),
('Rainbow Flag', '🏳️‍🌈', 350, 'lgbt', 'rare', 'pride', 'wave'),

-- Holiday High
('Christmas Tree', '🎄', 400, 'holiday', 'epic', 'seasonal', 'glow'),
('Santa Claus', '🎅', 500, 'holiday', 'epic', 'character', 'ho_ho_ho'),
('Fireworks', '🎆', 600, 'holiday', 'epic', 'celebration', 'explode'),

-- Funny High
('Comedy Gold', '🏆', 400, 'funny', 'epic', 'award', 'laugh'),
('Troll Crown', '😜', 500, 'funny', 'epic', 'title', 'wiggle'),
('Meme Lord', '📱', 350, 'funny', 'rare', 'title', 'viral'),

-- Seasonal High
('Sunny Day', '☀️', 300, 'seasonal', 'rare', 'weather', 'warm'),
('Snow Storm', '❄️', 350, 'seasonal', 'rare', 'weather', 'blizzard'),
('Spring Bloom', '🌸', 300, 'seasonal', 'rare', 'nature', 'bloom');

-- ==========================================
-- LEGENDARY GIFTS (1000+ coins)
-- ==========================================
INSERT INTO public.gifts (name, icon_url, cost, category, rarity, class, animation_type) VALUES
-- Cars Legendary
('Lamborghini', '🏎️', 2500, 'cars', 'legendary', 'vehicle', 'rev_engine'),
('Ferrari', '🏎️', 3000, 'cars', 'legendary', 'vehicle', 'speed_lines'),
('Bugatti', '🏎️', 5000, 'cars', 'mythic', 'vehicle', 'light_trail'),

-- Houses Legendary
('Castle', '🏰', 5000, 'houses', 'mythic', 'property', 'expand_kingdom'),
('Island', '🏝️', 7500, 'houses', 'mythic', 'property', 'emerge'),
('Space Station', '🛸', 10000, 'houses', 'mythic', 'property', 'launch'),

-- Boats Legendary
('Mega Yacht', '🛥️', 5000, 'boats', 'mythic', 'vehicle', 'cruise'),
('Submarine', '⚓', 4000, 'boats', 'legendary', 'vehicle', 'dive'),

-- Planes Legendary
('Space Shuttle', '🚀', 10000, 'planes', 'mythic', 'vehicle', 'launch'),
('Private Jet Fleet', '✈️', 7500, 'planes', 'mythic', 'vehicle', 'formation'),

-- Luxury Legendary
('Bank Vault', '🏦', 5000, 'luxury', 'mythic', 'wealth', 'open'),
('Gold Bar', '🪙', 3000, 'luxury', 'legendary', 'wealth', 'stack'),
('Diamond Mine', '💎', 7500, 'luxury', 'mythic', 'wealth', 'sparkle'),

-- Funny Legendary
('Troll Empire', '👑', 5000, 'funny', 'mythic', 'title', 'dominate'),
('Meme Machine', '📱', 4000, 'funny', 'legendary', 'viral', 'trend'),
('Comedy King', '😆', 3500, 'funny', 'legendary', 'title', 'crown'),

-- Special Legendary
('Love Bomb', '💘', 2500, 'general', 'legendary', 'romance', 'explosion'),
('Dream Come True', '✨', 5000, 'general', 'mythic', 'magic', 'grant'),
('World Peace', '🕊️', 10000, 'general', 'mythic', 'peace', 'radiate');

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_gifts_category ON public.gifts(category);
CREATE INDEX IF NOT EXISTS idx_gifts_rarity ON public.gifts(rarity);
CREATE INDEX IF NOT EXISTS idx_gifts_active ON public.gifts(is_active);

-- Grant permissions
GRANT SELECT ON public.gifts TO authenticated;
GRANT SELECT ON public.gifts TO anon;

COMMIT;
