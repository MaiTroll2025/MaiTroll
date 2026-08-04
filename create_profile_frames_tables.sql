-- ============================================================
-- Mai Troll — PROFILE FRAME SYSTEM
-- Premium animated avatar frames with rarity tiers
-- ============================================================

-- 1. Master frame catalog
CREATE TABLE IF NOT EXISTS public.profile_frames (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  icon              text NOT NULL DEFAULT '✨',
  animation_type    text NOT NULL DEFAULT 'shimmer',
  -- shimmer | rainbow | gold_shimmer | diamond_sparkle | neon_glow
  -- fire | smoke | snow | ice | electric | galaxy | crown | trophy | verified
  -- founder | aurora | lava | rain | starfall | bubbles | hearts | lightning
  -- confetti | matrix | ocean | cherry_blossom | halloween
  frame_style       text NOT NULL DEFAULT 'premium',
  -- flat | beveled | glowing | animated | premium | legendary
  border_color      text NOT NULL DEFAULT '#ffd700',
  border_gradient   text,
  glow_color        text,
  glow_intensity    real NOT NULL DEFAULT 0.5 CHECK (glow_intensity >= 0 AND glow_intensity <= 2),
  animation_speed   text NOT NULL DEFAULT 'normal',
  -- slow | normal | fast
  has_particles     boolean NOT NULL DEFAULT false,
  particle_color    text,
  particle_count    smallint NOT NULL DEFAULT 5,
  has_sparkles      boolean NOT NULL DEFAULT false,
  has_energy_rings  boolean NOT NULL DEFAULT false,
  rarity            text NOT NULL DEFAULT 'rare',
  -- common | rare | epic | legendary | mythic | founder | limited_edition
  coin_cost         integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  is_limited        boolean NOT NULL DEFAULT false,
  limited_quantity  integer,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. User-owned frames
CREATE TABLE IF NOT EXISTS public.user_profile_frames (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  frame_id        text NOT NULL REFERENCES public.profile_frames(id) ON DELETE CASCADE,
  is_equipped     boolean NOT NULL DEFAULT false,
  purchased_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, frame_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_user_profile_frames_user_id
  ON public.user_profile_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_frames_equipped
  ON public.user_profile_frames(user_id, is_equipped) WHERE is_equipped = true;
CREATE INDEX IF NOT EXISTS idx_profile_frames_rarity
  ON public.profile_frames(rarity);
CREATE INDEX IF NOT EXISTS idx_profile_frames_active
  ON public.profile_frames(is_active) WHERE is_active = true;

-- 4. Seed the launch collection
INSERT INTO public.profile_frames
  (id, name, description, icon, animation_type, frame_style, border_color, border_gradient, glow_color, glow_intensity, animation_speed, has_particles, particle_color, particle_count, has_sparkles, has_energy_rings, rarity, coin_cost, sort_order)
VALUES
  ('pride_rainbow',    'Pride Rainbow',    'Animated flowing rainbow border celebrating pride',              '🏳️‍🌈', 'rainbow',     'premium',    '#ff0000', 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)', '#ff00ff', 0.7,  'normal', true,  '#ffffff', 6,  true,  false, 'rare',       250,  1),
  ('gold_vip',         'Gold VIP',         'Luxury gold shimmer fit for royalty',                           '👑',   'gold_shimmer','premium',   '#ffd700', 'linear-gradient(135deg, #ffd700, #ffaa00, #ffd700, #ffe066)',                        '#ffd700', 0.8,  'normal', true,  '#ffd700', 5,  true,  false, 'epic',       400,  2),
  ('diamond_elite',    'Diamond Elite',    'Sparkling crystal diamond effect',                              '💎',   'diamond_sparkle','legendary','#00d4ff','linear-gradient(135deg, #00d4ff, #ffffff, #00d4ff, #80f0ff)',                      '#00d4ff', 1.0,  'fast',   true,  '#ffffff', 8,  true,  true,  'legendary',  700,  3),
  ('neon_cyber',       'Neon Cyber',       'Rotating neon cyberpunk glow',                                   '⚡',   'neon_glow',  'animated',   '#00ff88', 'linear-gradient(90deg, #00ff88, #ff00ff, #0088ff, #00ff88)',                      '#00ff88', 0.9,  'fast',   true,  '#00ff88', 6,  false, true,  'epic',       500,  4),
  ('fire_lord',        'Fire Lord',        'Animated flames dancing around your avatar',                     '🔥',   'fire',       'premium',    '#ff4400', 'linear-gradient(135deg, #ff4400, #ff8800, #ffcc00, #ff4400)',                      '#ff4400', 1.0,  'fast',   true,  '#ffcc00', 7,  true,  false, 'legendary',  800,  5),
  ('ice_king',         'Ice King',         'Frost crystals and snow particles',                              '❄️',   'ice',        'premium',    '#88ccff', 'linear-gradient(135deg, #88ccff, #ffffff, #aaddff, #88ccff)',                      '#88ccff', 0.8,  'normal', true,  '#ffffff', 6,  true,  false, 'legendary',  750,  6),
  ('electric_storm',   'Electric Storm',   'Crackling lightning pulses',                                     '⚡',   'electric',   'animated',   '#ffee00', 'linear-gradient(90deg, #ffee00, #ff8800, #ffee00, #ffff88)',                      '#ffee00', 1.1,  'fast',   true,  '#ffff88', 5,  false, true,  'epic',       600,  7),
  ('galaxy',           'Galaxy',           'Swirling cosmic stars and nebula particles',                     '🌌',   'galaxy',     'legendary',  '#8800ff', 'linear-gradient(135deg, #8800ff, #ff0088, #0088ff, #8800ff)',                    '#8800ff', 1.2,  'slow',   true,  '#ff88ff', 9,  true,  true,  'mythic',     900,  8),
  ('verified_creator', 'Verified Creator', 'Premium verification glow for creators',                         '✅',   'verified',   'premium',    '#1d9bf0', 'linear-gradient(135deg, #1d9bf0, #1a8cd8, #1d9bf0)',                                '#1d9bf0', 0.6,  'normal', false, null,       0,  true,  false, 'rare',       300,  9),
  ('family_leader',    'Family Leader',    'Royal crown aura for family leaders',                            '👑',   'crown',      'premium',    '#cc8800', 'linear-gradient(135deg, #cc8800, #ffcc44, #cc8800, #ffdd66)',                    '#ffcc44', 0.7,  'normal', true,  '#ffdd66', 4,  true,  false, 'epic',       550,  10),
  ('battle_champion',  'Battle Champion',  'Gold rotating trophy aura from battle victories',               '🏆',   'trophy',     'animated',   '#ffd700', 'linear-gradient(135deg, #ffd700, #b8860b, #ffd700, #daa520)',                    '#ffd700', 0.9,  'normal', true,  '#ffd700', 5,  true,  true,  'legendary',  850,  11),
  ('troll_city_founder','Mai Troll Founder','Exclusive founder badge — only for the original trolls',       '🧌',   'founder',    'legendary',  '#ff3366', 'linear-gradient(135deg, #ff3366, #ffd700, #00ff88, #ff3366)',                  '#ff3366', 1.5,  'fast',   true,  '#ffd700', 10, true,  true,  'founder',    1000, 12),
  -- Visual FX Collection (all ≤ 1,000 coins)
  ('inferno_blaze',       'Inferno Blaze',       'Real animated flames lick and dance around your avatar border',   '🔥',   'fire',       'legendary',  '#ff2200', 'linear-gradient(180deg, #ff6600, #ff2200, #ff8800, #ff4400, #ffcc00)',         '#ff4400', 1.4,  'fast',   true,  '#ffcc00', 10, true,  false, 'legendary',  1000, 13),
  ('phantom_smoke',       'Phantom Smoke',       'Ethereal smoke wisps curl and drift around your profile',        '💨',   'smoke',      'legendary',  '#6b7280', 'linear-gradient(135deg, #9ca3af, #4b5563, #d1d5db, #6b7280)',               '#9ca3af', 0.8,  'slow',   true,  '#d1d5db', 8,  false, false, 'epic',       800,  14),
  ('winter_snowfall',     'Winter Snowfall',     'Gentle snowflakes drift down over your avatar inside the frame', '❄️',   'snow',       'premium',    '#a5d8ff', 'linear-gradient(135deg, #a5d8ff, #e7f5ff, #74c0fc, #a5d8ff)',                 '#a5d8ff', 0.9,  'slow',   true,  '#ffffff', 12, true,  false, 'epic',       850,  15),
  ('northern_aurora',     'Northern Aurora',     'Shimmering northern lights ripple across your frame',            '🌌',   'aurora',     'legendary',  '#00cc66', 'linear-gradient(90deg, #00cc66, #8800ff, #00ffaa, #cc00ff, #00cc66)',        '#00ff88', 1.1,  'slow',   true,  '#88ffcc', 7,  true,  true,  'legendary',  1000, 16),
  ('volcanic_lava',       'Volcanic Lava',       'Molten lava flows and bubbles around your avatar',               '🌋',   'lava',       'legendary',  '#cc3300', 'linear-gradient(180deg, #ff6600, #cc0000, #ff4400, #990000)',                 '#ff4400', 1.3,  'normal', true,  '#ff8800', 8,  false, false, 'epic',       900,  17),
  ('monsoon_rain',        'Monsoon Rain',        'Raindrops fall and splash around your profile frame',            '🌧️',   'rain',       'premium',    '#3b82f6', 'linear-gradient(180deg, #3b82f6, #1d4ed8, #60a5fa, #2563eb)',                 '#60a5fa', 0.7,  'fast',   true,  '#93c5fd', 10, false, false, 'rare',       600,  18),
  ('cosmic_starfall',     'Cosmic Starfall',     'Shooting stars streak across your frame with glowing trails',   '🌠',   'starfall',   'legendary',  '#7c3aed', 'linear-gradient(135deg, #7c3aed, #2563eb, #a855f7, #1d4ed8)',              '#a855f7', 1.2,  'normal', true,  '#fbbf24', 8,  true,  true,  'legendary',  1000, 19),
  ('deep_sea_bubbles',    'Deep Sea Bubbles',    'Iridescent bubbles float upward around your avatar',             '🫧',   'bubbles',    'premium',    '#06b6d4', 'linear-gradient(135deg, #06b6d4, #0891b2, #22d3ee, #0e7490)',                '#22d3ee', 0.8,  'slow',   true,  '#a5f3fc', 9,  true,  false, 'epic',       750,  20),
  ('love_hearts',         'Love Hearts',         'Floating hearts drift upward around your profile',               '💕',   'hearts',     'premium',    '#ec4899', 'linear-gradient(135deg, #ec4899, #f472b6, #db2777, #f9a8d4)',                 '#f472b6', 0.9,  'normal', true,  '#f9a8d4', 8,  true,  false, 'rare',       500,  21),
  ('thunder_strike',      'Thunder Strike',      'Crackling lightning bolts flash and pulse around your frame',   '⚡',   'lightning',  'animated',   '#fbbf24', 'linear-gradient(135deg, #fbbf24, #f59e0b, #fde68a, #d97706)',               '#fde68a', 1.3,  'fast',   true,  '#fef3c7', 6,  false, true,  'epic',       900,  22),
  ('party_confetti',      'Party Confetti',      'Colorful confetti bursts and swirls around your profile',        '🎉',   'confetti',   'animated',   '#f472b6', 'linear-gradient(90deg, #f472b6, #fbbf24, #34d399, #60a5fa, #a78bfa)',       '#f472b6', 0.8,  'normal', true,  '#fbbf24', 12, true,  false, 'rare',       650,  23),
  ('matrix_code',         'Matrix Code',         'Digital rain cascades down your frame in matrix style',          '🟢',   'matrix',     'animated',   '#22c55e', 'linear-gradient(180deg, #22c55e, #15803d, #4ade80, #166534)',               '#4ade80', 1.0,  'fast',   true,  '#86efac', 10, false, false, 'epic',       850,  24),
  ('ocean_waves',         'Ocean Waves',         'Flowing ocean waves lap at your frame with sea foam',            '🌊',   'ocean',      'premium',    '#0ea5e9', 'linear-gradient(90deg, #0ea5e9, #0284c7, #38bdf8, #0369a1)',                 '#38bdf8', 0.9,  'slow',   true,  '#bae6fd', 7,  true,  false, 'epic',       800,  25),
  ('sakura_blossom',      'Sakura Blossom',      'Delicate cherry blossom petals drift around your avatar',        '🌸',   'cherry_blossom','premium', '#f9a8d4', 'linear-gradient(135deg, #f9a8d4, #fbb6ce, #f687b3, #ed64a6)',              '#f687b3', 0.7,  'slow',   true,  '#fce7f3', 10, true,  false, 'rare',       700,  26),
  ('haunted_halloween',   'Haunted Halloween',   'Spooky ghosts and bats float around your frame',                 '🎃',   'halloween',  'legendary',  '#9333ea', 'linear-gradient(135deg, #9333ea, #581c87, #c026d3, #7e22ce)',               '#c084fc', 1.1,  'normal', true,  '#e9d5ff', 8,  false, true,  'limited_edition', 1000, 27),
  ('frost_crystal',       'Frost Crystal',       'Ice crystals form and shimmer on your frame',                    '🧊',   'ice',        'legendary',  '#38bdf8', 'linear-gradient(135deg, #38bdf8, #bae6fd, #0ea5e9, #7dd3fc)',             '#7dd3fc', 1.0,  'normal', true,  '#e0f2fe', 9,  true,  true,  'epic',       900,  28),
  ('neon_dreams',         'Neon Dreams',         'Vibrant neon tubes pulse and glow around your avatar',           '💜',   'neon_glow',  'animated',   '#e879f9', 'linear-gradient(90deg, #e879f9, #22d3ee, #a3e635, #e879f9)',                '#e879f9', 1.2,  'fast',   true,  '#f0abfc', 7,  false, true,  'epic',       850,  29),
  ('golden_royalty',      'Golden Royalty',      'Luxurious gold leaf patterns shimmer around your profile',       '👑',   'gold_shimmer','legendary', '#f59e0b', 'linear-gradient(135deg, #f59e0b, #fbbf24, #d97706, #fde68a)',             '#fbbf24', 1.1,  'normal', true,  '#fde68a', 8,  true,  true,  'legendary',  1000, 30),
  ('diamond_prism',       'Diamond Prism',       'Prismatic diamond light refracts and sparkles around you',       '💎',   'diamond_sparkle','legendary','#67e8f9','linear-gradient(135deg, #67e8f9, #c4b5fd, #f9a8d4, #fde68a)',            '#c4b5fd', 1.3,  'fast',   true,  '#ffffff', 10, true,  true,  'mythic',     1000, 31),
  ('shadow_void',         'Shadow Void',         'Dark energy swirls and pulses around your frame',                '🖤',   'smoke',      'legendary',  '#581c87', 'linear-gradient(135deg, #581c87, #7c3aed, #3b0764, #8b5cf6)',              '#8b5cf6', 1.4,  'slow',   true,  '#c4b5fd', 9,  false, true,  'mythic',     1000, 32)
ON CONFLICT (id) DO NOTHING;

-- 5. Enable RLS
ALTER TABLE public.profile_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_frames ENABLE ROW LEVEL SECURITY;

-- Frames catalog is publicly readable
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_frames' AND policyname = 'Frames are publicly readable') THEN
    CREATE POLICY "Frames are publicly readable" ON public.profile_frames FOR SELECT USING (true);
  END IF;
END$$;

-- Users can read their own frames
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_frames' AND policyname = 'Users can read own frames') THEN
     CREATE POLICY "Users can read own frames" ON public.user_profile_frames FOR SELECT USING (auth.uid() = user_id);
   END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_frames' AND policyname = 'Anyone can view equipped frames') THEN
     CREATE POLICY "Anyone can view equipped frames" ON public.user_profile_frames FOR SELECT USING (is_equipped = true);
   END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_frames' AND policyname = 'Users can insert own frames') THEN
    CREATE POLICY "Users can insert own frames" ON public.user_profile_frames FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_frames' AND policyname = 'Users can update own frames') THEN
    CREATE POLICY "Users can update own frames" ON public.user_profile_frames FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_frames' AND policyname = 'Users can delete own frames') THEN
    CREATE POLICY "Users can delete own frames" ON public.user_profile_frames FOR DELETE USING (auth.uid() = user_id);
  END IF;
END$$;
