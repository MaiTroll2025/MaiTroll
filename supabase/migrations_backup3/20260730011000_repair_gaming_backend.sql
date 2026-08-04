-- ============================================================================
-- Migration: repair_gaming_backend
-- Adds gaming-specific columns and tables for the Hytro gaming system
-- Applied: 2026-07-30
-- ============================================================================

-- streams table already has stream_type, game_title, game_category, gaming_platform,
-- mature_content, chat_enabled, community_enabled, monetization_enabled, tags, thumbnail_url
-- Added in repair_replay_and_stream_backend.sql

-- ============================================================================
-- 1. Gaming applications and contracts tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gaming_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  game_title TEXT NOT NULL,
  game_category TEXT DEFAULT 'general',
  gaming_platform TEXT DEFAULT 'pc',
  application_text TEXT,
  experience_years INTEGER DEFAULT 0,
  equipment TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gaming_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own applications"
  ON public.gaming_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON public.gaming_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON public.gaming_applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gaming_applications_user_id ON public.gaming_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_gaming_applications_status ON public.gaming_applications(status);

CREATE TABLE IF NOT EXISTS public.gaming_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.gaming_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  contract_type TEXT DEFAULT 'standard'
    CHECK (contract_type IN ('standard', 'exclusive', 'partnership', 'trial')),
  terms JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gaming_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contracts"
  ON public.gaming_contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contracts"
  ON public.gaming_contracts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts"
  ON public.gaming_contracts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gaming_contracts_user_id ON public.gaming_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_gaming_contracts_application_id ON public.gaming_contracts(application_id);

-- ============================================================================
-- 2. Gaming store configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gaming_store_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  store_name TEXT DEFAULT 'Gaming Store',
  items JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gaming_store_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stream owner can view store config"
  ON public.gaming_store_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Stream owner can update store config"
  ON public.gaming_store_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gaming_store_config_stream_id ON public.gaming_store_config(stream_id);
CREATE INDEX IF NOT EXISTS idx_gaming_store_config_user_id ON public.gaming_store_config(user_id);