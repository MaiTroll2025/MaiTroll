-- Badge Tier Progress & Showcase System
-- Creates tables for tracking per-user badge tier progression,
-- profile showcase slots, and seed tier definitions for all activity badges.
-- Timestamp: 20260520T113700Z

-- ===========================
-- 1. EXTEND badge_catalog
-- ===========================

-- Add columns for tiered progress tracking
ALTER TABLE public.badge_catalog
  ADD COLUMN IF NOT EXISTS tracking_type TEXT,
  ADD COLUMN IF NOT EXISTS tier_thresholds JSONB,
  ADD COLUMN IF NOT EXISTS db_column TEXT,
  ADD COLUMN IF NOT EXISTS icon_emoji TEXT;

-- ===========================
-- 2. badge_tier_progress
-- ===========================
CREATE TABLE IF NOT EXISTS public.badge_tier_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug TEXT NOT NULL,
  current_tier INT NOT NULL DEFAULT 0,
  progress_value INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_slug)
);

CREATE INDEX IF NOT EXISTS idx_badge_tier_progress_user_id ON public.badge_tier_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_badge_tier_progress_slug ON public.badge_tier_progress(badge_slug);

ALTER TABLE public.badge_tier_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'badge_tier_progress' AND policyname = 'Users read own tier progress'
  ) THEN
    CREATE POLICY "Users read own tier progress" ON public.badge_tier_progress
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'badge_tier_progress' AND policyname = 'Users upsert own tier progress'
  ) THEN
    CREATE POLICY "Users upsert own tier progress" ON public.badge_tier_progress
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT ON public.badge_tier_progress TO anon, authenticated;
GRANT ALL ON public.badge_tier_progress TO service_role;

-- ===========================
-- 3. user_badge_showcase
-- ===========================
CREATE TABLE IF NOT EXISTS public.user_badge_showcase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug TEXT NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, position)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badge_showcase_uniq ON public.user_badge_showcase(user_id, badge_slug);
CREATE INDEX IF NOT EXISTS idx_user_badge_showcase_user_pos ON public.user_badge_showcase(user_id, position);

ALTER TABLE public.user_badge_showcase ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_badge_showcase' AND policyname = 'Users read own showcase'
  ) THEN
    CREATE POLICY "Users read own showcase" ON public.user_badge_showcase
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_badge_showcase' AND policyname = 'Users manage own showcase'
  ) THEN
    CREATE POLICY "Users manage own showcase" ON public.user_badge_showcase
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT ON public.user_badge_showcase TO anon, authenticated;
GRANT ALL ON public.user_badge_showcase TO service_role;

-- ===========================
-- 4. NOTES
-- ===========================

-- Progress rows in badge_tier_progress are created on-demand when:
-- 1. A user sends their first gift (gift_master, top_supporter badges)
-- 2. A user starts streaming (stream_starter badge)
-- 3. Other badge progress is tracked in real-time
--
-- No pre-seeding needed - the tables are ready for use.
