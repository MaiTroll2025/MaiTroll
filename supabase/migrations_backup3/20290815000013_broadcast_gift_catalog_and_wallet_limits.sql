-- Broadcast gift catalog expansion for viewer and broadcast pages
-- Seeds 60 premium gifts with categories and visual assets, and ensures wallet balance supports large values.

ALTER TABLE public.user_profiles
  ALTER COLUMN troll_coins TYPE BIGINT USING COALESCE(troll_coins, 0)::BIGINT;

ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS coin_cost BIGINT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS value BIGINT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS gift_slug TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'troll_coins';
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_type TEXT DEFAULT 'emoji';
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_key TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common';
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_url TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_duration_ms INTEGER DEFAULT 4500;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS sound_url TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS is_fullscreen BOOLEAN DEFAULT false;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS tray_visual_url TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS tray_gradient TEXT;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 12;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_items_gift_slug_unique
    ON public.gift_items (gift_slug)
    WHERE gift_slug IS NOT NULL;
END $$;

-- Gift catalog items are global (not owned by a specific user). Relax the
-- user_id NOT NULL constraint so catalog seed rows can be inserted without an
-- owner. Guarded so it is a no-op where the column does not exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gift_items'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.gift_items ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- Backfill legacy `value` column from `coin_cost` for any existing gift_items
UPDATE public.gift_items
  SET value = coin_cost
  WHERE value IS NULL
    AND coin_cost IS NOT NULL;

-- Grant seat join permission for the 4-param signature used by the frontend
GRANT EXECUTE ON FUNCTION public.join_seat_atomic(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_seat_atomic(uuid, integer, integer, uuid) TO service_role;
INSERT INTO public.gift_items (
  gift_slug, name, coin_cost, value, icon, category, currency, description, animation_type, rarity, status, is_active, animation_url, tray_visual_url, tray_gradient
)
SELECT
  gift_slug,
  name,
  coin_cost,
  coin_cost,
  icon,
  category,
  currency,
  description,
  animation_type,
  rarity,
  status,
  is_active,
  animation_url,
  tray_visual_url,
  tray_gradient
FROM (
  VALUES
    ('gift_glow-coin-01', 'Glow Coin', 10, '✨', 'General', 'troll_coins', 'A bright coin burst for quick hype.', 'emoji', 'common', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'),
    ('gift_solar-spark-02', 'Solar Spark', 15, '⚡', 'General', 'troll_coins', 'A crisp sparkle for fast reaction moments.', 'emoji', 'common', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)'),
    ('gift_crown-pulse-03', 'Crown Pulse', 20, '👑', 'Royalty', 'troll_coins', 'A royal burst fit for premium recognition.', 'emoji', 'uncommon', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'),
    ('gift_royal-halo-04', 'Royal Halo', 25, '👑', 'Royalty', 'troll_coins', 'A luminous halo that commands the room.', 'emoji', 'uncommon', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #fbbf24 0%, #fb923c 100%)'),
    ('gift_diamond-rain-05', 'Diamond Rain', 30, '💎', 'Luxury', 'troll_coins', 'A cascade of luxury for elite appreciation.', 'emoji', 'rare', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #60a5fa 0%, #818cf8 100%)'),
    ('gift_luxe-ember-06', 'Luxe Ember', 40, '🔥', 'Luxury', 'troll_coins', 'Luxury heat with a polished edge.', 'emoji', 'rare', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #f472b6 0%, #a855f7 100%)'),
    ('gift_skyline-beam-07', 'Skyline Beam', 50, '🌆', 'Luxury', 'troll_coins', 'An upscale beam for showstopper moments.', 'emoji', 'rare', 'active', true, '/gifts/luxury-yacht.svg', '/gifts/luxury-yacht.svg', 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)'),
    ('gift_golden-echo-08', 'Golden Echo', 60, '💛', 'Luxury', 'troll_coins', 'Golden audio feedback for top-tier hype.', 'emoji', 'rare', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)'),
    ('gift_neon-prism-09', 'Neon Prism', 75, '🌈', 'Luxury', 'troll_coins', 'A vivid prism for modern broadcast flair.', 'emoji', 'epic', 'active', true, '/gifts/neon-halo.svg', '/gifts/neon-halo.svg', 'linear-gradient(135deg, #34d399 0%, #0f766e 100%)'),
    ('gift_velvet-vault-10', 'Velvet Vault', 80, '🧿', 'Luxury', 'troll_coins', 'An elegant vault of prestige.', 'emoji', 'epic', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)'),
    ('gift_midas-rush-11', 'Midas Rush', 100, '💰', 'General', 'troll_coins', 'Rich and immediate gold rush energy.', 'emoji', 'epic', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fde68a 0%, #d97706 100%)'),
    ('gift_apex-aura-12', 'Apex Aura', 120, '☄️', 'General', 'troll_coins', 'A premium aura for high-impact entrances.', 'emoji', 'epic', 'active', true, '/gifts/starlight.svg', '/gifts/starlight.svg', 'linear-gradient(135deg, #fbbf24 0%, #fb923c 100%)'),
    ('gift_galaxy-thread-13', 'Galaxy Thread', 150, '🌌', 'General', 'troll_coins', 'A cosmic gift made for big screens.', 'emoji', 'legendary', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)'),
    ('gift_platinum-pulse-14', 'Platinum Pulse', 180, '🥇', 'Royalty', 'troll_coins', 'Platinum prestige with a polished glow.', 'emoji', 'legendary', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)'),
    ('gift_mirror-crest-15', 'Mirror Crest', 200, '🪞', 'Royalty', 'troll_coins', 'A crest for high-end fan appreciation.', 'emoji', 'legendary', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #e2e8f0 0%, #475569 100%)'),
    ('gift_starfall-crown-16', 'Starfall Crown', 250, '👑', 'Royalty', 'troll_coins', 'Crowned stardust with elite shine.', 'emoji', 'legendary', 'active', true, '/gifts/starlight.svg', '/gifts/starlight.svg', 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)'),
    ('gift_empire-crest-17', 'Empire Crest', 300, '🏛️', 'Luxury', 'troll_coins', 'A sumptuous crest of authority.', 'emoji', 'legendary', 'active', true, '/gifts/mansion-glow.svg', '/gifts/mansion-glow.svg', 'linear-gradient(135deg, #fb923c 0%, #b45309 100%)'),
    ('gift_infinity-ring-18', 'Infinity Ring', 400, '💍', 'Luxury', 'troll_coins', 'A ring of endless prestige.', 'emoji', 'mythic', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #f5d0fe 0%, #db2777 100%)'),
    ('gift_titan-vault-19', 'Titan Vault', 500, '🛡️', 'Luxury', 'troll_coins', 'An armored vault for massive support.', 'emoji', 'mythic', 'active', true, '/gifts/mansion-glow.svg', '/gifts/mansion-glow.svg', 'linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)'),
    ('gift_moonlight-key-20', 'Moonlight Key', 600, '🔑', 'Luxury', 'troll_coins', 'Unlocks premium spotlight energy.', 'emoji', 'mythic', 'active', true, '/gifts/private-jet.svg', '/gifts/private-jet.svg', 'linear-gradient(135deg, #a78bfa 0%, #4c1d95 100%)'),
    ('gift_nova-bloom-21', 'Nova Bloom', 750, '🌸', 'Luxury', 'troll_coins', 'A blooming burst for standout appreciation.', 'emoji', 'mythic', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #f0abfc 0%, #9d174d 100%)'),
    ('gift_silver-strike-22', 'Silver Strike', 900, '⚪', 'General', 'troll_coins', 'High-value silver energy for big moments.', 'emoji', 'mythic', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #f8fafc 0%, #64748b 100%)'),
    ('gift_golden-orbit-23', 'Golden Orbit', 1000, '🪩', 'General', 'troll_coins', 'A dazzling orbit of gold.', 'emoji', 'legendary', 'active', true, '/gifts/starlight.svg', '/gifts/starlight.svg', 'linear-gradient(135deg, #fde68a 0%, #d97706 100%)'),
    ('gift_royal-ledger-24', 'Royal Ledger', 1250, '📒', 'Royalty', 'troll_coins', 'Ledger of high-end fandom.', 'emoji', 'legendary', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #fcd34d 0%, #92400e 100%)'),
    ('gift_treasure-pulse-25', 'Treasure Pulse', 1500, '🪙', 'Luxury', 'troll_coins', 'A pulse of treasure for massive support.', 'emoji', 'legendary', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fde68a 0%, #ca8a04 100%)'),
    ('gift_elite-charge-26', 'Elite Charge', 1800, '⚡', 'Luxury', 'troll_coins', 'Elite charge for powerful appreciation.', 'emoji', 'legendary', 'active', true, '/gifts/rocketflare.svg', '/gifts/rocketflare.svg', 'linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)'),
    ('gift_luxury-burst-27', 'Luxury Burst', 2000, '💸', 'Luxury', 'troll_coins', 'A burst of prestige and class.', 'emoji', 'legendary', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #f0abfc 0%, #7c3aed 100%)'),
    ('gift_diamond-pulse-28', 'Diamond Pulse', 2500, '💎', 'Luxury', 'troll_coins', 'Premium diamond pulse for elite fans.', 'emoji', 'mythic', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #38bdf8 0%, #312e81 100%)'),
    ('gift_jetstream-29', 'Jetstream', 3000, '✈️', 'Luxury', 'troll_coins', 'The energy of a luxury takeoff.', 'emoji', 'mythic', 'active', true, '/gifts/private-jet.svg', '/gifts/private-jet.svg', 'linear-gradient(135deg, #93c5fd 0%, #1d4ed8 100%)'),
    ('gift_skyline-crown-30', 'Skyline Crown', 4000, '👑', 'Royalty', 'troll_coins', 'A crown fit for broadcast royalty.', 'emoji', 'mythic', 'active', true, '/gifts/mansion-glow.svg', '/gifts/mansion-glow.svg', 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'),
    ('gift_empire-halo-31', 'Empire Halo', 5000, '👁️', 'Royalty', 'troll_coins', 'A halo from a powerful empire.', 'emoji', 'mythic', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #c084fc 0%, #6d28d9 100%)'),
    ('gift_crystal-beam-32', 'Crystal Beam', 6000, '🔮', 'Luxury', 'troll_coins', 'A futuristic beam with crystal polish.', 'emoji', 'mythic', 'active', true, '/gifts/neon-halo.svg', '/gifts/neon-halo.svg', 'linear-gradient(135deg, #a7f3d0 0%, #059669 100%)'),
    ('gift_crown-jewel-33', 'Crown Jewel', 7500, '💎', 'Royalty', 'troll_coins', 'The jewel of every dramatic broadcast.', 'emoji', 'mythic', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #f0abfc 0%, #9d174d 100%)'),
    ('gift_mansion-glow-34', 'Mansion Glow', 8000, '🏠', 'Luxur', 'troll_coins', 'A lavish mansion-worthy shimmer.', 'emoji', 'mythic', 'active', true, '/gifts/mansion-glow.svg', '/gifts/mansion-glow.svg', 'linear-gradient(135deg, #fb923c 0%, #b45309 100%)'),
    ('gift_champagne-arc-35', 'Champagne Arc', 10000, '🥂', 'Luxury', 'troll_coins', 'A champagne arc of delight.', 'emoji', 'epic', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)'),
    ('gift_treasure-lattice-36', 'Treasure Lattice', 12000, '🧩', 'Luxury', 'troll_coins', 'A lattice of treasure and strategy.', 'emoji', 'epic', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fcd34d 0%, #92400e 100%)'),
    ('gift_apex-prism-37', 'Apex Prism', 15000, '🔷', 'Luxury', 'troll_coins', 'The apex of luxury light.', 'emoji', 'epic', 'active', true, '/gifts/starlight.svg', '/gifts/starlight.svg', 'linear-gradient(135deg, #38bdf8 0%, #4338ca 100%)'),
    ('gift_golden-lift-38', 'Golden Lift', 18000, '🛗', 'Luxury', 'troll_coins', 'A lift of genuine golden energy.', 'emoji', 'epic', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fde68a 0%, #ca8a04 100%)'),
    ('gift_moonlit-halo-39', 'Moonlit Halo', 20000, '🌙', 'Luxury', 'troll_coins', 'An elegant halo for late-night streams.', 'emoji', 'epic', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #c7d2fe 0%, #4338ca 100%)'),
    ('gift_rocket-bloom-40', 'Rocket Bloom', 25000, '🚀', 'Luxury', 'troll_coins', 'A premium bloom that launches the room.', 'emoji', 'epic', 'active', true, '/gifts/rocketflare.svg', '/gifts/rocketflare.svg', 'linear-gradient(135deg, #a7f3d0 0%, #059669 100%)'),
    ('gift_midas-wave-41', 'Midas Wave', 30000, '🌊', 'Luxury', 'troll_coins', 'The wave of gold that changes the room.', 'emoji', 'legendary', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fde68a 0%, #d97706 100%)'),
    ('gift_diamond-bloom-42', 'Diamond Bloom', 40000, '💠', 'Luxury', 'troll_coins', 'A bloom of diamonds for lavish fans.', 'emoji', 'legendary', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #93c5fd 0%, #1d4ed8 100%)'),
    ('gift_crown-arc-43', 'Crown Arc', 50000, '🏰', 'Royalty', 'troll_coins', 'An arc of royal prestige.', 'emoji', 'legendary', 'active', true, '/gifts/mansion-glow.svg', '/gifts/mansion-glow.svg', 'linear-gradient(135deg, #fde047 0%, #b45309 100%)'),
    ('gift_echo-vault-44', 'Echo Vault', 60000, '🪄', 'Luxury', 'troll_coins', 'A vault of echoes and elevated energy.', 'emoji', 'legendary', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)'),
    ('gift_royal-prism-45', 'Royal Prism', 75000, '💫', 'Royalty', 'troll_coins', 'Royal light in prism form.', 'emoji', 'legendary', 'active', true, '/gifts/starlight.svg', '/gifts/starlight.svg', 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)'),
    ('gift_celestial-ledger-46', 'Celestial Ledger', 100000, '📜', 'Royalty', 'troll_coins', 'A dazzling ledger of celestial support.', 'emoji', 'mythic', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #f0abfc 0%, #a855f7 100%)'),
    ('gift_platinum-arc-47', 'Platinum Arc', 125000, '🪐', 'Luxury', 'troll_coins', 'Pure platinum arc for elite viewers.', 'emoji', 'mythic', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #cbd5e1 0%, #334155 100%)'),
    ('gift_starlight-crown-48', 'Starlight Crown', 150000, '✨', 'Royalty', 'troll_coins', 'A crown made from starlight.', 'emoji', 'mythic', 'active', true, '/gifts/trophy-shine.svg', '/gifts/trophy-shine.svg', 'linear-gradient(135deg, #f5d0fe 0%, #db2777 100%)'),
    ('gift_aurora-vault-49', 'Aurora Vault', 200000, '🪶', 'Luxury', 'troll_coins', 'A vault of aurora energy.', 'emoji', 'mythic', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #a7f3d0 0%, #047857 100%)'),
    ('gift_nebula-crest-50', 'Nebula Crest', 250000, '☄️', 'Luxury', 'troll_coins', 'A crest from the edge of the galaxy.', 'emoji', 'mythic', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)'),
    ('gift_titan-crown-51', 'Titan Crown', 300000, '👑', 'Royalty', 'troll_coins', 'A crown built for titan-level support.', 'emoji', 'mythic', 'active', true, '/gifts/trophy-shine.svg', '/gifts/trophy-shine.svg', 'linear-gradient(135deg, #fde68a 0%, #b45309 100%)'),
    ('gift_royal-burst-52', 'Royal Burst', 400000, '💥', 'Royalty', 'troll_coins', 'A definitive royal burst.', 'emoji', 'mythic', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)'),
    ('gift_golden-gate-53', 'Golden Gate', 500000, '🚪', 'Luxury', 'troll_coins', 'The gate to lavish broadcast success.', 'emoji', 'legendary', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fde68a 0%, #d97706 100%)'),
    ('gift_luxe-beacon-54', 'Luxe Beacon', 600000, '📡', 'Luxury', 'troll_coins', 'A beacon that marks elite support.', 'emoji', 'legendary', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)'),
    ('gift_diamond-halo-55', 'Diamond Halo', 750000, '💎', 'Luxury', 'troll_coins', 'A halo with diamond precision.', 'emoji', 'legendary', 'active', true, '/gifts/diamond-crest.svg', '/gifts/diamond-crest.svg', 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)'),
    ('gift_infinity-crown-56', 'Infinity Crown', 1000000, '👑', 'Royalty', 'troll_coins', 'A crown for infinite support.', 'emoji', 'legendary', 'active', true, '/gifts/starlight.svg', '/gifts/starlight.svg', 'linear-gradient(135deg, #fde68a 0%, #ca8a04 100%)'),
    ('gift_galaxy-vault-57', 'Galaxy Vault', 1500000, '🪐', 'Luxury', 'troll_coins', 'The vault of a galaxy-wide fanbase.', 'emoji', 'legendary', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #818cf8 0%, #312e81 100%)'),
    ('gift_royal-stream-58', 'Royal Stream', 2500000, '🌊', 'Royalty', 'troll_coins', 'A royal stream of endless appreciation.', 'emoji', 'mythic', 'active', true, '/gifts/coin-burst.svg', '/gifts/coin-burst.svg', 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)'),
    ('gift_midas-crown-59', 'Midas Crown', 5000000, '👑', 'Royalty', 'troll_coins', 'A crown touched by Midas himself.', 'emoji', 'mythic', 'active', true, '/gifts/gold-bar.svg', '/gifts/gold-bar.svg', 'linear-gradient(135deg, #fde68a 0%, #d97706 100%)'),
    ('gift_aurora-crest-60', 'Aurora Crest', 1000000000, '🌅', 'Royalty', 'troll_coins', 'A crest for true one-billion coin power.', 'emoji', 'mythic', 'active', true, '/gifts/aurora.svg', '/gifts/aurora.svg', 'linear-gradient(135deg, #f0abfc 0%, #7c3aed 100%)'),
    ('gift_weed-leaf-61', 'Weed Leaf', 420, '🌿', 'General', 'troll_coins', 'A leafy gift for laid-back vibes.', 'emoji', 'common', 'active', true, '/gifts/weed-leaf.svg', '/gifts/weed-leaf.svg', 'linear-gradient(135deg, #86efac 0%, #15803d 100%)'),
    ('gift_pack-of-cigs-62', 'Pack of Cigs', 10, '🚬', 'General', 'troll_coins', 'A simple pack for a quick smoke break.', 'emoji', 'common', 'active', true, '/gifts/cig-pack.svg', '/gifts/cig-pack.svg', 'linear-gradient(135deg, #f5f5f4 0%, #78716c 100%)')
  ) AS seed (
    gift_slug,
    name,
    coin_cost,
    icon,
    category,
    currency,
    description,
    animation_type,
    rarity,
    status,
    is_active,
    animation_url,
    tray_visual_url,
    tray_gradient
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.gift_items existing
  WHERE existing.gift_slug = seed.gift_slug
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchasable_items') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_purchasable_items_item_key_unique
      ON public.purchasable_items (item_key)
      WHERE item_key IS NOT NULL;

    INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_active, metadata)
SELECT
  item_key,
  display_name,
  category,
  coin_price,
  is_active,
  metadata::jsonb
FROM (
  VALUES
    ('gift_glow-coin-01', 'Glow Coin', 'gift', 10, true, '{"icon": "✨", "subcategory": "General", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_solar-spark-02', 'Solar Spark', 'gift', 15, true, '{"icon": "⚡", "subcategory": "General", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_crown-pulse-03', 'Crown Pulse', 'gift', 20, true, '{"icon": "👑", "subcategory": "Royalty", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_royal-halo-04', 'Royal Halo', 'gift', 25, true, '{"icon": "👑", "subcategory": "Royalty", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_diamond-rain-05', 'Diamond Rain', 'gift', 30, true, '{"icon": "💎", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_luxe-ember-06', 'Luxe Ember', 'gift', 40, true, '{"icon": "🔥", "subcategory": "Luxury", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_skyline-beam-07', 'Skyline Beam', 'gift', 50, true, '{"icon": "🌆", "subcategory": "Luxury", "animation_url": "/gifts/luxury-yacht.svg"}'),
    ('gift_golden-echo-08', 'Golden Echo', 'gift', 60, true, '{"icon": "💛", "subcategory": "Luxury", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_neon-prism-09', 'Neon Prism', 'gift', 75, true, '{"icon": "🌈", "subcategory": "Luxury", "animation_url": "/gifts/neon-halo.svg"}'),
    ('gift_velvet-vault-10', 'Velvet Vault', 'gift', 80, true, '{"icon": "🧿", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_midas-rush-11', 'Midas Rush', 'gift', 100, true, '{"icon": "💰", "subcategory": "General", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_apex-aura-12', 'Apex Aura', 'gift', 120, true, '{"icon": "☄️", "subcategory": "General", "animation_url": "/gifts/starlight.svg"}'),
    ('gift_galaxy-thread-13', 'Galaxy Thread', 'gift', 150, true, '{"icon": "🌌", "subcategory": "General", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_platinum-pulse-14', 'Platinum Pulse', 'gift', 180, true, '{"icon": "🥇", "subcategory": "Royalty", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_mirror-crest-15', 'Mirror Crest', 'gift', 200, true, '{"icon": "🪞", "subcategory": "Royalty", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_starfall-crown-16', 'Starfall Crown', 'gift', 250, true, '{"icon": "👑", "subcategory": "Royalty", "animation_url": "/gifts/starlight.svg"}'),
    ('gift_empire-crest-17', 'Empire Crest', 'gift', 300, true, '{"icon": "🏛️", "subcategory": "Luxury", "animation_url": "/gifts/mansion-glow.svg"}'),
    ('gift_infinity-ring-18', 'Infinity Ring', 'gift', 400, true, '{"icon": "💍", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_titan-vault-19', 'Titan Vault', 'gift', 500, true, '{"icon": "🛡️", "subcategory": "Luxury", "animation_url": "/gifts/mansion-glow.svg"}'),
    ('gift_moonlight-key-20', 'Moonlight Key', 'gift', 600, true, '{"icon": "🔑", "subcategory": "Luxury", "animation_url": "/gifts/private-jet.svg"}'),
    ('gift_nova-bloom-21', 'Nova Bloom', 'gift', 750, true, '{"icon": "🌸", "subcategory": "Luxury", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_silver-strike-22', 'Silver Strike', 'gift', 900, true, '{"icon": "⚪", "subcategory": "General", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_golden-orbit-23', 'Golden Orbit', 'gift', 1000, true, '{"icon": "🪩", "subcategory": "General", "animation_url": "/gifts/starlight.svg"}'),
    ('gift_royal-ledger-24', 'Royal Ledger', 'gift', 1250, true, '{"icon": "📒", "subcategory": "Royalty", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_treasure-pulse-25', 'Treasure Pulse', 'gift', 1500, true, '{"icon": "🪙", "subcategory": "Luxury", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_elite-charge-26', 'Elite Charge', 'gift', 1800, true, '{"icon": "⚡", "subcategory": "Luxury", "animation_url": "/gifts/rocketflare.svg"}'),
    ('gift_luxury-burst-27', 'Luxury Burst', 'gift', 2000, true, '{"icon": "💸", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_diamond-pulse-28', 'Diamond Pulse', 'gift', 2500, true, '{"icon": "💎", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_jetstream-29', 'Jetstream', 'gift', 3000, true, '{"icon": "✈️", "subcategory": "Luxury", "animation_url": "/gifts/private-jet.svg"}'),
    ('gift_skyline-crown-30', 'Skyline Crown', 'gift', 4000, true, '{"icon": "👑", "subcategory": "Royalty", "animation_url": "/gifts/mansion-glow.svg"}'),
    ('gift_empire-halo-31', 'Empire Halo', 'gift', 5000, true, '{"icon": "👁️", "subcategory": "Royalty", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_crystal-beam-32', 'Crystal Beam', 'gift', 6000, true, '{"icon": "🔮", "subcategory": "Luxury", "animation_url": "/gifts/neon-halo.svg"}'),
    ('gift_crown-jewel-33', 'Crown Jewel', 'gift', 7500, true, '{"icon": "💎", "subcategory": "Royalty", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_mansion-glow-34', 'Mansion Glow', 'gift', 8000, true, '{"icon": "🏠", "subcategory": "Luxur", "animation_url": "/gifts/mansion-glow.svg"}'),
    ('gift_champagne-arc-35', 'Champagne Arc', 'gift', 10000, true, '{"icon": "🥂", "subcategory": "Luxury", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_treasure-lattice-36', 'Treasure Lattice', 'gift', 12000, true, '{"icon": "🧩", "subcategory": "Luxury", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_apex-prism-37', 'Apex Prism', 'gift', 15000, true, '{"icon": "🔷", "subcategory": "Luxury", "animation_url": "/gifts/starlight.svg"}'),
    ('gift_golden-lift-38', 'Golden Lift', 'gift', 18000, true, '{"icon": "🛗", "subcategory": "Luxury", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_moonlit-halo-39', 'Moonlit Halo', 'gift', 20000, true, '{"icon": "🌙", "subcategory": "Luxury", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_rocket-bloom-40', 'Rocket Bloom', 'gift', 25000, true, '{"icon": "🚀", "subcategory": "Luxury", "animation_url": "/gifts/rocketflare.svg"}'),
    ('gift_midas-wave-41', 'Midas Wave', 'gift', 30000, true, '{"icon": "🌊", "subcategory": "Luxury", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_diamond-bloom-42', 'Diamond Bloom', 'gift', 40000, true, '{"icon": "💠", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_crown-arc-43', 'Crown Arc', 'gift', 50000, true, '{"icon": "🏰", "subcategory": "Royalty", "animation_url": "/gifts/mansion-glow.svg"}'),
    ('gift_echo-vault-44', 'Echo Vault', 'gift', 60000, true, '{"icon": "🪄", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_royal-prism-45', 'Royal Prism', 'gift', 75000, true, '{"icon": "💫", "subcategory": "Royalty", "animation_url": "/gifts/starlight.svg"}'),
    ('gift_celestial-ledger-46', 'Celestial Ledger', 'gift', 100000, true, '{"icon": "📜", "subcategory": "Royalty", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_platinum-arc-47', 'Platinum Arc', 'gift', 125000, true, '{"icon": "🪐", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_starlight-crown-48', 'Starlight Crown', 'gift', 150000, true, '{"icon": "✨", "subcategory": "Royalty", "animation_url": "/gifts/trophy-shine.svg"}'),
    ('gift_aurora-vault-49', 'Aurora Vault', 'gift', 200000, true, '{"icon": "🪶", "subcategory": "Luxury", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_nebula-crest-50', 'Nebula Crest', 'gift', 250000, true, '{"icon": "☄️", "subcategory": "Luxury", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_titan-crown-51', 'Titan Crown', 'gift', 300000, true, '{"icon": "👑", "subcategory": "Royalty", "animation_url": "/gifts/trophy-shine.svg"}'),
    ('gift_royal-burst-52', 'Royal Burst', 'gift', 400000, true, '{"icon": "💥", "subcategory": "Royalty", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_golden-gate-53', 'Golden Gate', 'gift', 500000, true, '{"icon": "🚪", "subcategory": "Luxury", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_luxe-beacon-54', 'Luxe Beacon', 'gift', 600000, true, '{"icon": "📡", "subcategory": "Luxury", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_diamond-halo-55', 'Diamond Halo', 'gift', 750000, true, '{"icon": "💎", "subcategory": "Luxury", "animation_url": "/gifts/diamond-crest.svg"}'),
    ('gift_infinity-crown-56', 'Infinity Crown', 'gift', 1000000, true, '{"icon": "👑", "subcategory": "Royalty", "animation_url": "/gifts/starlight.svg"}'),
    ('gift_galaxy-vault-57', 'Galaxy Vault', 'gift', 1500000, true, '{"icon": "🪐", "subcategory": "Luxury", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_royal-stream-58', 'Royal Stream', 'gift', 2500000, true, '{"icon": "🌊", "subcategory": "Royalty", "animation_url": "/gifts/coin-burst.svg"}'),
    ('gift_midas-crown-59', 'Midas Crown', 'gift', 5000000, true, '{"icon": "👑", "subcategory": "Royalty", "animation_url": "/gifts/gold-bar.svg"}'),
    ('gift_aurora-crest-60', 'Aurora Crest', 'gift', 1000000000, true, '{"icon": "🌅", "subcategory": "Royalty", "animation_url": "/gifts/aurora.svg"}'),
    ('gift_weed-leaf-61', 'Weed Leaf', 'gift', 420, true, '{"icon": "🌿", "subcategory": "General", "animation_url": "/gifts/weed-leaf.svg"}'),
    ('gift_pack-of-cigs-62', 'Pack of Cigs', 'gift', 10, true, '{"icon": "🚬", "subcategory": "General", "animation_url": "/gifts/cig-pack.svg"}')
  ) AS seed (
    item_key,
    display_name,
    category,
    coin_price,
    is_active,
    metadata
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.purchasable_items existing
  WHERE existing.item_key = seed.item_key
);
  END IF;
END $$;
