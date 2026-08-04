-- Profile Frame price correction and Visual FX collection
-- 1) Update all existing frame prices to ≤ 1,000 coins
-- 2) Insert 20 new visual FX frames with real animated effects

BEGIN;

-- Update old frame prices
UPDATE public.profile_frames SET coin_cost = 250  WHERE id = 'pride_rainbow';
UPDATE public.profile_frames SET coin_cost = 400  WHERE id = 'gold_vip';
UPDATE public.profile_frames SET coin_cost = 700  WHERE id = 'diamond_elite';
UPDATE public.profile_frames SET coin_cost = 500  WHERE id = 'neon_cyber';
UPDATE public.profile_frames SET coin_cost = 800  WHERE id = 'fire_lord';
UPDATE public.profile_frames SET coin_cost = 750  WHERE id = 'ice_king';
UPDATE public.profile_frames SET coin_cost = 600  WHERE id = 'electric_storm';
UPDATE public.profile_frames SET coin_cost = 900  WHERE id = 'galaxy';
UPDATE public.profile_frames SET coin_cost = 300  WHERE id = 'verified_creator';
UPDATE public.profile_frames SET coin_cost = 550  WHERE id = 'family_leader';
UPDATE public.profile_frames SET coin_cost = 850  WHERE id = 'battle_champion';
UPDATE public.profile_frames SET coin_cost = 1000 WHERE id = 'troll_city_founder';

-- Insert 20 new Visual FX frames
INSERT INTO public.profile_frames
  (id, name, description, icon, animation_type, frame_style, border_color, border_gradient, glow_color, glow_intensity, animation_speed, has_particles, particle_color, particle_count, has_sparkles, has_energy_rings, rarity, coin_cost, sort_order)
VALUES
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
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  description       = EXCLUDED.description,
  icon              = EXCLUDED.icon,
  animation_type    = EXCLUDED.animation_type,
  frame_style       = EXCLUDED.frame_style,
  border_color      = EXCLUDED.border_color,
  border_gradient   = EXCLUDED.border_gradient,
  glow_color        = EXCLUDED.glow_color,
  glow_intensity    = EXCLUDED.glow_intensity,
  animation_speed   = EXCLUDED.animation_speed,
  has_particles     = EXCLUDED.has_particles,
  particle_color    = EXCLUDED.particle_color,
  particle_count    = EXCLUDED.particle_count,
  has_sparkles      = EXCLUDED.has_sparkles,
  has_energy_rings  = EXCLUDED.has_energy_rings,
  rarity            = EXCLUDED.rarity,
  coin_cost         = EXCLUDED.coin_cost,
  sort_order        = EXCLUDED.sort_order,
  is_active         = true,
  updated_at        = now();

COMMIT;
