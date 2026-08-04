-- Fix missing database objects and schema issues
-- Generated: 2026-07-29

-- 1. Fix broadcast_missions: add missing columns
ALTER TABLE public.broadcast_missions
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'viewers',
  ADD COLUMN IF NOT EXISTS target_value INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS current_progress INTEGER NOT NULL DEFAULT 0;

-- 2. Fix stream_seats: change stream_id from TEXT to UUID to match streams.id
ALTER TABLE public.stream_seats
  DROP CONSTRAINT IF EXISTS stream_seats_stream_id_fkey;

ALTER TABLE public.stream_seats
  ALTER COLUMN stream_id TYPE UUID USING stream_id::uuid;

ALTER TABLE public.stream_seats
  ADD CONSTRAINT stream_seats_stream_id_fkey
    FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;

-- 3. Create profile_frames and user_profile_frames tables
CREATE TABLE IF NOT EXISTS public.profile_frames (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '✨',
  animation_type TEXT NOT NULL DEFAULT 'shimmer',
  frame_style TEXT NOT NULL DEFAULT 'premium',
  border_color TEXT NOT NULL DEFAULT '#ffd700',
  border_gradient TEXT,
  glow_color TEXT,
  glow_intensity REAL NOT NULL DEFAULT 0.5 CHECK (glow_intensity >= 0 AND glow_intensity <= 2),
  animation_speed TEXT NOT NULL DEFAULT 'normal',
  has_particles BOOLEAN NOT NULL DEFAULT false,
  particle_color TEXT,
  particle_count SMALLINT NOT NULL DEFAULT 5,
  has_sparkles BOOLEAN NOT NULL DEFAULT false,
  has_energy_rings BOOLEAN NOT NULL DEFAULT false,
  rarity TEXT NOT NULL DEFAULT 'rare',
  coin_cost INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_limited BOOLEAN NOT NULL DEFAULT false,
  limited_quantity INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profile_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  frame_id TEXT NOT NULL REFERENCES public.profile_frames(id) ON DELETE CASCADE,
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, frame_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_frames_user_id
  ON public.user_profile_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_frames_equipped
  ON public.user_profile_frames(user_id, is_equipped) WHERE is_equipped = true;
CREATE INDEX IF NOT EXISTS idx_profile_frames_rarity
  ON public.profile_frames(rarity);
CREATE INDEX IF NOT EXISTS idx_profile_frames_active
  ON public.profile_frames(is_active) WHERE is_active = true;

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
  ('troll_city_founder','maitroll Founder','Exclusive founder badge — only for the original trolls',       '🧌',   'founder',    'legendary',  '#ff3366', 'linear-gradient(135deg, #ff3366, #ffd700, #00ff88, #ff3366)',                  '#ff3366', 1.5,  'fast',   true,  '#ffd700', 10, true,  true,  'founder',    1000, 12),
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

ALTER TABLE public.profile_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_frames ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_frames' AND policyname = 'Frames are publicly readable') THEN
    CREATE POLICY "Frames are publicly readable" ON public.profile_frames FOR SELECT USING (true);
  END IF;
END$$;

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

GRANT ALL ON TABLE public.profile_frames TO anon;
GRANT ALL ON TABLE public.profile_frames TO authenticated;
GRANT ALL ON TABLE public.profile_frames TO service_role;
GRANT ALL ON TABLE public.user_profile_frames TO anon;
GRANT ALL ON TABLE public.user_profile_frames TO authenticated;
GRANT ALL ON TABLE public.user_profile_frames TO service_role;

-- Compatibility fixes for app-shape drift in other systems
ALTER TABLE public.tcnn_articles
  ADD COLUMN IF NOT EXISTS is_breaking BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.user_inventory
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.court_summons
  ADD COLUMN IF NOT EXISTS summoned_user_id UUID,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

UPDATE public.court_summons
SET summoned_user_id = served_to
WHERE summoned_user_id IS NULL AND served_to IS NOT NULL;

UPDATE public.court_summons
SET reason = notes
WHERE reason IS NULL AND notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_court_summons_summoned_user_id
  ON public.court_summons(summoned_user_id);

CREATE OR REPLACE FUNCTION public.sync_court_summons_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.summoned_user_id IS NULL AND NEW.served_to IS NOT NULL THEN
    NEW.summoned_user_id := NEW.served_to;
  ELSIF NEW.served_to IS NULL AND NEW.summoned_user_id IS NOT NULL THEN
    NEW.served_to := NEW.summoned_user_id;
  END IF;

  IF NEW.reason IS NULL AND NEW.notes IS NOT NULL THEN
    NEW.reason := NEW.notes;
  ELSIF NEW.notes IS NULL AND NEW.reason IS NOT NULL THEN
    NEW.notes := NEW.reason;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_court_summons_compat ON public.court_summons;
CREATE TRIGGER trg_court_summons_compat
BEFORE INSERT OR UPDATE ON public.court_summons
FOR EACH ROW
EXECUTE FUNCTION public.sync_court_summons_compat();

-- Helper functions required by join_stream_as_viewer

-- 4a. _cap_setting_bool: read a boolean admin_setting by key with fallback default
CREATE OR REPLACE FUNCTION public._cap_setting_bool(p_key text, p_default boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(
        NULLIF((s.setting_value::jsonb->>'enabled'), '')::boolean,
        NULLIF((s.setting_value::jsonb->>0), '')::boolean
      )
      FROM public.admin_settings s
      WHERE s.setting_key = p_key
      LIMIT 1
    ),
    p_default
  );
$$;

-- 4b. _cap_setting_numeric: reada numeric admin_setting by key with fallback default
CREATE OR REPLACE FUNCTION public._cap_setting_numeric(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(
        NULLIF((s.setting_value::jsonb->>'value'), '')::numeric,
        NULLIF((s.setting_value::jsonb->>0), '')::numeric
      )
      FROM public.admin_settings s
      WHERE s.setting_key = p_key
      LIMIT 1
    ),
    p_default
  );
$$;

-- 4. Create join_stream_as_viewer function
CREATE OR REPLACE FUNCTION public.join_stream_as_viewer(
  p_stream_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_guest_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream public.streams%ROWTYPE;
  v_count integer;
  v_cap integer;
  v_cap_enabled boolean;
  v_restrictions_disabled boolean;
  v_fallback_cap constant integer := 20;
  v_hard_cap constant integer := 100;
BEGIN
  IF p_user_id IS NULL AND (p_guest_id IS NULL OR trim(p_guest_id) = '') THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'missing_identity',
      'viewer_count', 0, 'viewer_cap', v_fallback_cap
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF p_user_id <> auth.uid() THEN
      RETURN jsonb_build_object(
        'allowed', false, 'reason', 'identity_mismatch',
        'viewer_count', 0, 'viewer_cap', v_fallback_cap
      );
    END IF;
  END IF;

  SELECT *
    INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'stream_not_found',
      'viewer_count', 0, 'viewer_cap', v_fallback_cap
    );
  END IF;

  IF v_stream.is_live IS DISTINCT FROM true
     OR COALESCE(v_stream.status, '') <> 'live' THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'stream_not_live',
      'viewer_count', 0, 'viewer_cap', v_fallback_cap
    );
  END IF;

  v_restrictions_disabled := public._cap_setting_bool('broadcast_all_restrictions_disabled', false);
  v_cap_enabled := public._cap_setting_bool('broadcast_viewer_cap_enabled', false);
  v_cap := LEAST(
    v_hard_cap,
    GREATEST(
      1,
      COALESCE(public._cap_setting_numeric('broadcast_viewer_cap_max', v_fallback_cap)::integer, v_fallback_cap)
    )
  );

  IF NOT v_restrictions_disabled AND v_cap_enabled THEN
    SELECT COUNT(*)
      INTO v_count
    FROM public.stream_viewers sv
    WHERE sv.stream_id = p_stream_id
      AND (
        (p_user_id IS NOT NULL AND sv.user_id = p_user_id)
        OR (p_guest_id IS NOT NULL AND sv.guest_id = p_guest_id)
      );

    IF v_count = 0 THEN
      SELECT COUNT(*)
        INTO v_count
      FROM public.stream_viewers sv
      WHERE sv.stream_id = p_stream_id;

      IF v_count >= v_cap THEN
        RETURN jsonb_build_object(
          'allowed', false, 'reason', 'viewer_cap_reached',
          'viewer_count', v_count, 'viewer_cap', v_cap
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.stream_viewers (stream_id, user_id, guest_id, joined_at)
  VALUES (
    p_stream_id,
    p_user_id,
    NULLIF(p_guest_id, ''),
    now()
  )
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*)
    INTO v_count
  FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id;

  RETURN jsonb_build_object(
    'allowed', true, 'reason', null,
    'viewer_count', v_count, 'viewer_cap', v_cap
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;

-- 5. Create leave_stream_as_viewer function
CREATE OR REPLACE FUNCTION public.leave_stream_as_viewer(
  p_stream_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_guest_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('released', false, 'reason', 'identity_mismatch');
  END IF;

  DELETE FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id
    AND (
      (p_user_id IS NOT NULL AND sv.user_id = p_user_id)
      OR (p_guest_id IS NOT NULL AND sv.guest_id = p_guest_id)
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('released', true, 'rows', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;

-- Compatibility fixes for schema drift in officer, court, and broadcast code paths.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS experience TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.empire_applications
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS applicant_id UUID,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.weekly_officer_reports
  ADD COLUMN IF NOT EXISTS lead_officer_id UUID,
  ADD COLUMN IF NOT EXISTS week_start DATE,
  ADD COLUMN IF NOT EXISTS week_end DATE,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS battle_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS broadcaster_id UUID,
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS agora_channel TEXT;

ALTER TABLE public.officer_shift_slots
  ADD COLUMN IF NOT EXISTS officer_id UUID,
  ADD COLUMN IF NOT EXISTS shift_date DATE,
  ADD COLUMN IF NOT EXISTS shift_start_time TIME,
  ADD COLUMN IF NOT EXISTS shift_end_time TIME,
  ADD COLUMN IF NOT EXISTS slot_status TEXT DEFAULT 'open';

ALTER TABLE public.officer_time_off_requests
  ADD COLUMN IF NOT EXISTS officer_id UUID,
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.officer_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  hours_worked NUMERIC(10,2) DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  last_break_start TIMESTAMPTZ,
  auto_clocked_out BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.officer_time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officer_shift_slots_officer_id
  ON public.officer_shift_slots(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_time_off_requests_officer_id
  ON public.officer_time_off_requests(officer_id);
CREATE INDEX IF NOT EXISTS idx_weekly_officer_reports_lead_officer_id
  ON public.weekly_officer_reports(lead_officer_id);
CREATE INDEX IF NOT EXISTS idx_streams_start_time
  ON public.streams(start_time);

-- ============================================================================
-- Row Level Security (RLS) policies for newly-added/modified tables
-- ============================================================================

-- officer_work_sessions: officers may access their own sessions
ALTER TABLE public.officer_work_sessions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_work_sessions' AND policyname = 'Officers can view own sessions') THEN
    CREATE POLICY "Officers can view own sessions" ON public.officer_work_sessions
      FOR SELECT USING (officer_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_work_sessions' AND policyname = 'Officers can insert own sessions') THEN
    CREATE POLICY "Officers can insert own sessions" ON public.officer_work_sessions
      FOR INSERT WITH CHECK (officer_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_work_sessions' AND policyname = 'Officers can update own sessions') THEN
    CREATE POLICY "Officers can update own sessions" ON public.officer_work_sessions
      FOR UPDATE USING (officer_id = auth.uid()) WITH CHECK (officer_id = auth.uid());
  END IF;
END$$;

-- officer_time_off_requests: officers manage their own requests
ALTER TABLE public.officer_time_off_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_time_off_requests' AND policyname = 'Officers can view own time off') THEN
    CREATE POLICY "Officers can view own time off" ON public.officer_time_off_requests
      FOR SELECT USING (officer_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_time_off_requests' AND policyname = 'Officers can insert time off') THEN
    CREATE POLICY "Officers can insert time off" ON public.officer_time_off_requests
      FOR INSERT WITH CHECK (officer_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_time_off_requests' AND policyname = 'Officers can update own time off') THEN
    CREATE POLICY "Officers can update own time off" ON public.officer_time_off_requests
      FOR UPDATE USING (officer_id = auth.uid()) WITH CHECK (officer_id = auth.uid());
  END IF;
END$$;

-- officer_shift_slots: officers can manage their own slots; open slots are visible
ALTER TABLE public.officer_shift_slots ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_shift_slots' AND policyname = 'Officers can view own or open slots') THEN
    CREATE POLICY "Officers can view own or open slots" ON public.officer_shift_slots
      FOR SELECT USING (officer_id = auth.uid() OR slot_status = 'open');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_shift_slots' AND policyname = 'Officers can insert own slots') THEN
    CREATE POLICY "Officers can insert own slots" ON public.officer_shift_slots
      FOR INSERT WITH CHECK (officer_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_shift_slots' AND policyname = 'Officers can update own slots') THEN
    CREATE POLICY "Officers can update own slots" ON public.officer_shift_slots
      FOR UPDATE USING (officer_id = auth.uid()) WITH CHECK (officer_id = auth.uid());
  END IF;
END$$;

-- weekly_officer_reports: lead officers and report owners can view
ALTER TABLE public.weekly_officer_reports ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_officer_reports' AND policyname = 'Leads or owners can view reports') THEN
    CREATE POLICY "Leads or owners can view reports" ON public.weekly_officer_reports
      FOR SELECT USING (lead_officer_id = auth.uid() OR user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_officer_reports' AND policyname = 'Users can insert own reports') THEN
    CREATE POLICY "Users can insert own reports" ON public.weekly_officer_reports
      FOR INSERT WITH CHECK (user_id = auth.uid() OR lead_officer_id = auth.uid());
  END IF;
END$$;

-- empire_applications and applications: owners only
ALTER TABLE public.empire_applications ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'empire_applications' AND policyname = 'Empire apps owner access') THEN
    CREATE POLICY "Empire apps owner access" ON public.empire_applications
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'applications' AND policyname = 'Applications owner access') THEN
    CREATE POLICY "Applications owner access" ON public.applications
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- streams: public can read live streams; broadcaster may update their stream
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Public read live streams') THEN
    CREATE POLICY "Public read live streams" ON public.streams
      FOR SELECT USING (is_live IS TRUE OR broadcaster_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Broadcasters can update their stream') THEN
    CREATE POLICY "Broadcasters can update their stream" ON public.streams
      FOR UPDATE USING (broadcaster_id = auth.uid()) WITH CHECK (broadcaster_id = auth.uid());
  END IF;
END$$;

-- court_summons: allow summoned user to view relevant rows
ALTER TABLE public.court_summons ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'court_summons' AND policyname = 'Summoned user can view') THEN
    CREATE POLICY "Summoned user can view" ON public.court_summons
      FOR SELECT USING (summoned_user_id = auth.uid() OR served_to = auth.uid());
  END IF;
END$$;

ALTER TABLE public.officer_shift_slots
  DROP CONSTRAINT IF EXISTS officer_shift_slots_officer_id_fkey,
  ADD CONSTRAINT officer_shift_slots_officer_id_fkey
    FOREIGN KEY (officer_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.officer_time_off_requests
  DROP CONSTRAINT IF EXISTS officer_time_off_requests_officer_id_fkey,
  ADD CONSTRAINT officer_time_off_requests_officer_id_fkey
    FOREIGN KEY (officer_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.manual_clock_in(p_officer_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_session_id uuid;
BEGIN
  IF p_officer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing officer id');
  END IF;

  SELECT id INTO v_active_session_id
  FROM public.officer_work_sessions
  WHERE officer_id = p_officer_id AND clock_out IS NULL
  LIMIT 1;

  IF v_active_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Officer already has an active session');
  END IF;

  INSERT INTO public.officer_work_sessions (officer_id, clock_in, status)
  VALUES (p_officer_id, NOW(), 'active');

  UPDATE public.user_profiles
  SET is_officer_active = true,
      last_activity_at = NOW()
  WHERE id = p_officer_id;

  RETURN jsonb_build_object('success', true, 'message', 'Clocked in successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.manual_clock_in(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.manual_clock_out(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.officer_work_sessions%ROWTYPE;
  v_now timestamptz := NOW();
  v_hours numeric;
BEGIN
  SELECT * INTO v_session
  FROM public.officer_work_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session not found');
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_now - v_session.clock_in)) / 3600;
  IF v_hours < 0 THEN v_hours := 0; END IF;

  UPDATE public.officer_work_sessions
  SET clock_out = v_now,
      status = 'completed',
      hours_worked = COALESCE(hours_worked, 0) + v_hours,
      updated_at = NOW()
  WHERE id = p_session_id;

  UPDATE public.user_profiles
  SET is_officer_active = false,
      last_activity_at = v_now
  WHERE id = v_session.officer_id;

  RETURN jsonb_build_object('success', true, 'message', 'Clocked out successfully', 'hours', v_hours);
END;
$$;

GRANT EXECUTE ON FUNCTION public.manual_clock_out(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_court_session(
  p_court_session_id uuid,
  p_role text DEFAULT 'observer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.court_participants%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_existing
  FROM public.court_participants
  WHERE court_session_id = p_court_session_id AND user_id = v_user_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.court_participants
    SET role = p_role,
        updated_at = NOW()
    WHERE id = v_existing.id;

    RETURN jsonb_build_object('success', true, 'message', 'Updated participant role', 'role', p_role);
  END IF;

  INSERT INTO public.court_participants (court_session_id, user_id, role, joined_at, updated_at)
  VALUES (p_court_session_id, v_user_id, p_role, NOW(), NOW());

  RETURN jsonb_build_object('success', true, 'message', 'Joined court session', 'role', p_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_court_session(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_court_case(
  p_case_type text,
  p_court_session_id uuid,
  p_defendant_id uuid,
  p_plaintiff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id uuid;
BEGIN
  INSERT INTO public.court_cases (
    case_type,
    defendant_id,
    plaintiff_id,
    status,
    created_at
  )
  VALUES (
    COALESCE(p_case_type, 'general'),
    p_defendant_id,
    COALESCE(p_plaintiff_id, auth.uid()),
    'pending',
    NOW()
  )
  RETURNING id INTO v_case_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_court_case(text, uuid, uuid, uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.join_stream_as_viewer(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.join_stream_as_viewer(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.leave_stream_as_viewer(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.leave_stream_as_viewer(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.join_stream_as_viewer(
  p_stream_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_guest_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream public.streams%ROWTYPE;
  v_count integer;
  v_cap integer;
  v_cap_enabled boolean;
  v_restrictions_disabled boolean;
  v_fallback_cap constant integer := 20;
  v_hard_cap constant integer := 100;
BEGIN
  IF p_user_id IS NULL AND (p_guest_id IS NULL OR trim(p_guest_id) = '') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'missing_identity', 'viewer_count', 0, 'viewer_cap', v_fallback_cap);
  END IF;

  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'stream_not_found', 'viewer_count', 0, 'viewer_cap', v_fallback_cap);
  END IF;

  IF v_stream.is_live IS DISTINCT FROM true OR COALESCE(v_stream.status, '') <> 'live' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'stream_not_live', 'viewer_count', 0, 'viewer_cap', v_fallback_cap);
  END IF;

  v_restrictions_disabled := COALESCE((SELECT setting_value::jsonb->>'enabled'::text FROM public.admin_settings WHERE setting_key = 'broadcast_all_restrictions_disabled' LIMIT 1)::boolean, false);
  v_cap_enabled := COALESCE((SELECT setting_value::jsonb->>'enabled'::text FROM public.admin_settings WHERE setting_key = 'broadcast_viewer_cap_enabled' LIMIT 1)::boolean, false);
  v_cap := LEAST(v_hard_cap, GREATEST(1, COALESCE((SELECT setting_value::jsonb->>'value' FROM public.admin_settings WHERE setting_key = 'broadcast_viewer_cap_max' LIMIT 1)::integer, v_fallback_cap)));

  IF NOT v_restrictions_disabled AND v_cap_enabled THEN
    SELECT COUNT(*) INTO v_count
    FROM public.stream_viewers sv
    WHERE sv.stream_id = p_stream_id;

    IF v_count >= v_cap THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'viewer_cap_reached', 'viewer_count', v_count, 'viewer_cap', v_cap);
    END IF;
  END IF;

  INSERT INTO public.stream_viewers (stream_id, user_id, guest_id, joined_at)
  VALUES (p_stream_id, p_user_id, NULLIF(p_guest_id, ''), now())
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*) INTO v_count
  FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id;

  RETURN jsonb_build_object('allowed', true, 'reason', null, 'viewer_count', v_count, 'viewer_cap', v_cap);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.leave_stream_as_viewer(
  p_stream_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_guest_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id
    AND (
      (p_user_id IS NOT NULL AND sv.user_id = p_user_id)
      OR (p_guest_id IS NOT NULL AND sv.guest_id = p_guest_id)
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('released', true, 'rows', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;
