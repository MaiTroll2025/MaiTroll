-- 20261018000002_add_gaming_stream_verification_columns
-- Adds the columns required by the agora-token edge function to verify public
-- gaming streams (supabase/functions/agora-token/index.ts). Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN category TEXT DEFAULT 'gaming';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'is_live'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN is_live BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'audience_type'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN audience_type TEXT DEFAULT 'public';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN is_private BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'is_paid'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN is_paid BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'pricing_type'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN pricing_type TEXT DEFAULT 'free';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'agora_channel'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN agora_channel TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_streams_category_gaming ON public.streams(category) WHERE category = 'gaming';
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON public.streams(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_streams_agora_channel ON public.streams(agora_channel) WHERE agora_channel IS NOT NULL;

-- Backfill existing streams so public gaming verification works out of the box.
UPDATE public.streams
SET category = COALESCE(category, 'gaming'),
    audience_type = COALESCE(audience_type, 'public'),
    is_private = COALESCE(is_private, false),
    is_paid = COALESCE(is_paid, false),
    pricing_type = COALESCE(pricing_type, 'free'),
    is_live = COALESCE(is_live, status = 'live')
WHERE category IS NULL
   OR audience_type IS NULL
   OR is_private IS NULL
   OR is_paid IS NULL
   OR pricing_type IS NULL
   OR is_live IS NULL;
