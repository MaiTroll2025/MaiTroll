-- ============================================================
-- COMPLETE FIX: Profile Frame System Tables
-- Run this to fix all profile frame related tables
-- Handles: profile_frame_tiers (old), profile_frames (catalog), user_profile_frames (ownership)
-- ============================================================

-- 1. Drop old profile_frame_tiers table if it exists (replaced by profile_frames)
DROP TABLE IF EXISTS public.profile_frame_tiers CASCADE;

-- 2. Fix profile_frames table: ensure id is text type
DO $$
BEGIN
  -- Create the table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.profile_frames (
    id                text PRIMARY KEY,
    name              text NOT NULL,
    description       text NOT NULL DEFAULT '',
    icon              text NOT NULL DEFAULT '✨',
    animation_type    text NOT NULL DEFAULT 'shimmer',
    frame_style       text NOT NULL DEFAULT 'premium',
    border_color      text NOT NULL DEFAULT '#ffd700',
    border_gradient   text,
    glow_color        text,
    glow_intensity    real NOT NULL DEFAULT 0.5,
    animation_speed   text NOT NULL DEFAULT 'normal',
    has_particles     boolean NOT NULL DEFAULT false,
    particle_color    text,
    particle_count    smallint NOT NULL DEFAULT 5,
    has_sparkles      boolean NOT NULL DEFAULT false,
    has_energy_rings  boolean NOT NULL DEFAULT false,
    rarity            text NOT NULL DEFAULT 'rare',
    coin_cost         integer NOT NULL DEFAULT 0,
    is_active         boolean NOT NULL DEFAULT true,
    is_limited        boolean NOT NULL DEFAULT false,
    limited_quantity  integer,
    sort_order        integer NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
  );

  -- Fix column type if it was created as uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_frames'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.profile_frames ALTER COLUMN id TYPE text;
    RAISE NOTICE 'Fixed profile_frames.id: uuid -> text';
  END IF;

  RAISE NOTICE 'profile_frames table ready';
END $$;

-- 3. Fix user_profile_frames table: ensure frame_id is text type
DO $$
BEGIN
  -- Create the table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.user_profile_frames (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    frame_id        text NOT NULL,
    is_equipped     boolean NOT NULL DEFAULT false,
    purchased_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, frame_id)
  );

  -- Add foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'user_profile_frames'
      AND constraint_name = 'user_profile_frames_frame_id_fkey'
  ) THEN
    ALTER TABLE public.user_profile_frames
      ADD CONSTRAINT user_profile_frames_frame_id_fkey
      FOREIGN KEY (frame_id) REFERENCES public.profile_frames(id) ON DELETE CASCADE;
  END IF;

  -- Fix column type if it was created as uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profile_frames'
      AND column_name = 'frame_id'
      AND data_type = 'uuid'
  ) THEN
    -- Drop the old FK constraint first
    ALTER TABLE public.user_profile_frames
      DROP CONSTRAINT IF EXISTS user_profile_frames_frame_id_fkey;

    -- Alter the column type
    ALTER TABLE public.user_profile_frames
      ALTER COLUMN frame_id TYPE text;

    -- Re-add the FK constraint
    ALTER TABLE public.user_profile_frames
      ADD CONSTRAINT user_profile_frames_frame_id_fkey
      FOREIGN KEY (frame_id) REFERENCES public.profile_frames(id) ON DELETE CASCADE;

    RAISE NOTICE 'Fixed user_profile_frames.frame_id: uuid -> text';
  END IF;

  RAISE NOTICE 'user_profile_frames table ready';
END $$;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profile_frames_user_id ON public.user_profile_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_frames_equipped ON public.user_profile_frames(user_id, is_equipped) WHERE is_equipped = true;
CREATE INDEX IF NOT EXISTS idx_profile_frames_rarity ON public.profile_frames(rarity);
CREATE INDEX IF NOT EXISTS idx_profile_frames_active ON public.profile_frames(is_active) WHERE is_active = true;

-- 5. Enable RLS
ALTER TABLE public.profile_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_frames ENABLE ROW LEVEL SECURITY;

-- 6. Create policies (idempotent)
DO $$
BEGIN
  -- Profile frames: publicly readable
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_frames' AND policyname = 'Frames are publicly readable') THEN
    CREATE POLICY "Frames are publicly readable" ON public.profile_frames FOR SELECT USING (true);
  END IF;

  -- User profile frames: users can manage their own
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
END $$;

-- 7. Seed the launch collection (only inserts if not exists)
INSERT INTO public.profile_frames
  (id, name, description, icon, animation_type, frame_style, border_color, border_gradient, glow_color, glow_intensity, animation_speed, has_particles, particle_color, particle_count, has_sparkles, has_energy_rings, rarity, coin_cost, sort_order)
VALUES
  ('pride_rainbow',    'Pride Rainbow',    'Animated flowing rainbow border celebrating pride',              '🏳️‍🌈', 'rainbow',     'premium',    '#ff0000', 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)', '#ff00ff', 0.7,  'normal', true,  '#ffffff', 6,  true,  false, 'rare',       2500,  1),
  ('gold_vip',         'Gold VIP',         'Luxury gold shimmer fit for royalty',                           '👑',   'gold_shimmer','premium',   '#ffd700', 'linear-gradient(135deg, #ffd700, #ffaa00, #ffd700, #ffe066)',                        '#ffd700', 0.8,  'normal', true,  '#ffd700', 5,  true,  false, 'epic',       5000,  2),
  ('diamond_elite',    'Diamond Elite',    'Sparkling crystal diamond effect',                              '💎',   'diamond_sparkle','legendary','#00d4ff','linear-gradient(135deg, #00d4ff, #ffffff, #00d4ff, #80f0ff)',                      '#00d4ff', 1.0,  'fast',   true,  '#ffffff', 8,  true,  true,  'legendary',  10000, 3),
  ('neon_cyber',       'Neon Cyber',       'Rotating neon cyberpunk glow',                                   '⚡',   'neon_glow',  'animated',   '#00ff88', 'linear-gradient(90deg, #00ff88, #ff00ff, #0088ff, #00ff88)',                      '#00ff88', 0.9,  'fast',   true,  '#00ff88', 6,  false, true,  'epic',       6000,  4),
  ('fire_lord',        'Fire Lord',        'Animated flames dancing around your avatar',                     '🔥',   'fire',       'premium',    '#ff4400', 'linear-gradient(135deg, #ff4400, #ff8800, #ffcc00, #ff4400)',                      '#ff4400', 1.0,  'fast',   true,  '#ffcc00', 7,  true,  false, 'legendary',  12000, 5),
  ('ice_king',         'Ice King',         'Frost crystals and snow particles',                              '❄️',   'ice',        'premium',    '#88ccff', 'linear-gradient(135deg, #88ccff, #ffffff, #aaddff, #88ccff)',                      '#88ccff', 0.8,  'normal', true,  '#ffffff', 6,  true,  false, 'legendary',  12000, 6),
  ('electric_storm',   'Electric Storm',   'Crackling lightning pulses',                                     '⚡',   'electric',   'animated',   '#ffee00', 'linear-gradient(90deg, #ffee00, #ff8800, #ffee00, #ffff88)',                      '#ffee00', 1.1,  'fast',   true,  '#ffff88', 5,  false, true,  'epic',       8000,  7),
  ('galaxy',           'Galaxy',           'Swirling cosmic stars and nebula particles',                     '🌌',   'galaxy',     'legendary',  '#8800ff', 'linear-gradient(135deg, #8800ff, #ff0088, #0088ff, #8800ff)',                    '#8800ff', 1.2,  'slow',   true,  '#ff88ff', 9,  true,  true,  'mythic',     20000, 8),
  ('verified_creator', 'Verified Creator', 'Premium verification glow for creators',                         '✅',   'verified',   'premium',    '#1d9bf0', 'linear-gradient(135deg, #1d9bf0, #1a8cd8, #1d9bf0)',                                '#1d9bf0', 0.6,  'normal', false, null,       0,  true,  false, 'rare',       3000,  9),
  ('family_leader',    'Family Leader',    'Royal crown aura for family leaders',                            '👑',   'crown',      'premium',    '#cc8800', 'linear-gradient(135deg, #cc8800, #ffcc44, #cc8800, #ffdd66)',                    '#ffcc44', 0.7,  'normal', true,  '#ffdd66', 4,  true,  false, 'epic',       7500,  10),
  ('battle_champion',  'Battle Champion',  'Gold rotating trophy aura from battle victories',               '🏆',   'trophy',     'animated',   '#ffd700', 'linear-gradient(135deg, #ffd700, #b8860b, #ffd700, #daa520)',                    '#ffd700', 0.9,  'normal', true,  '#ffd700', 5,  true,  true,  'legendary',  15000, 11),
  ('troll_city_founder','Mai Troll Founder','Exclusive founder badge — only for the original trolls',       '🧌',   'founder',    'legendary',  '#ff3366', 'linear-gradient(135deg, #ff3366, #ffd700, #00ff88, #ff3366)',                  '#ff3366', 1.5,  'fast',   true,  '#ffd700', 10, true,  true,  'founder',    50000, 12)
ON CONFLICT (id) DO NOTHING;

-- 8. Add active_frame_id to user_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'active_frame_id'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN active_frame_id text REFERENCES public.profile_frames(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added active_frame_id column to user_profiles';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Profile frame system setup complete!';
END $$;
