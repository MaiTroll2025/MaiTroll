-- ============================================================================
-- Migration: repair_badge_backend
-- Ensures badge_catalog and user_badges support the UserBadge component
-- Applied: 2026-07-30
-- ============================================================================

-- Ensure badge_catalog has all required columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_catalog' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.badge_catalog ADD COLUMN display_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_catalog' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.badge_catalog ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_catalog' AND column_name = 'icon'
  ) THEN
    ALTER TABLE public.badge_catalog ADD COLUMN icon text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_catalog' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.badge_catalog ADD COLUMN image_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_catalog' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.badge_catalog ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_catalog' AND column_name = 'key'
  ) THEN
    ALTER TABLE public.badge_catalog ADD COLUMN key text UNIQUE;
  END IF;
END $$;

-- Ensure user_badges has all required columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'issued_by'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN issued_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'issued_at'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN issued_at timestamptz DEFAULT NOW();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'revoked_at'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN revoked_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'revocation_reason'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN revocation_reason text;
  END IF;
END $$;

-- Add remaining columns that may be missing from existing user_badges table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'badge_catalog_id'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN badge_catalog_id uuid REFERENCES public.badge_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'badge_key'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN badge_key text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'badge_name'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN badge_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'icon'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN icon text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN image_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.user_badges ADD COLUMN created_at timestamptz DEFAULT NOW();
  END IF;
END $$;

-- Create user_badges table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  badge_catalog_id UUID REFERENCES public.badge_catalog(id) ON DELETE SET NULL,
  badge_key text,
  badge_name text NOT NULL,
  description text,
  icon text,
  image_url text,
  is_active boolean DEFAULT true,
  issued_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  issued_at timestamptz DEFAULT NOW(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own badges"
  ON public.user_badges FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_key ON public.user_badges(badge_key);