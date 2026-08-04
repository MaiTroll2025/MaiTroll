BEGIN;

-- Fix agency_members table to support both original agency system and hytro gaming system.
-- The hytro migration created agency_members without agency_id and status columns,
-- but approve_agency_application_atomic (and other RPCs) expect them.

-- Ensure the agencies table has all columns expected by send_gift_in_stream and other RPCs.
-- These columns are defined in src/sql/agency/agency_schema.sql but may be missing on
-- databases initialized from older migrations that did not include them.
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS default_split_percent INTEGER DEFAULT 10 CHECK (default_split_percent >= 0 AND default_split_percent <= 50),
  ADD COLUMN IF NOT EXISTS agency_fee_percent INTEGER DEFAULT 0 CHECK (agency_fee_percent >= 0 AND agency_fee_percent <= 100),
  ADD COLUMN IF NOT EXISTS platform_fee_percent INTEGER DEFAULT 0 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  ADD COLUMN IF NOT EXISTS leader_commission_percent INTEGER DEFAULT 0 CHECK (leader_commission_percent >= 0 AND leader_commission_percent <= 100),
  ADD COLUMN IF NOT EXISTS recruiter_commission_percent INTEGER DEFAULT 0 CHECK (recruiter_commission_percent >= 0 AND recruiter_commission_percent <= 100),
  ADD COLUMN IF NOT EXISTS fee_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_updated_by UUID REFERENCES auth.users(id);

-- Add agency_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agency_members'
      AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE public.agency_members
      ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add status column if missing (hytro uses is_active boolean instead)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agency_members'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.agency_members
      ADD COLUMN status TEXT CHECK (status IN ('active', 'removed', 'left', 'suspended')) DEFAULT 'active';
    -- Backfill: set status based on is_active
    UPDATE public.agency_members SET status = 'active' WHERE is_active = true;
    UPDATE public.agency_members SET status = 'removed' WHERE is_active = false;
  END IF;
END $$;

-- Add removed_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agency_members'
      AND column_name = 'removed_at'
  ) THEN
    ALTER TABLE public.agency_members
      ADD COLUMN removed_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Update the unique constraint to include agency_id for proper multi-agency support
-- Drop the old UNIQUE(user_id) if it exists and replace with UNIQUE(agency_id, user_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'agency_members'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%user_id%'
  ) THEN
    -- Find and drop the old unique constraint on just user_id
    DECLARE
      cname TEXT;
    BEGIN
      FOR cname IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'agency_members'
          AND tc.constraint_type = 'UNIQUE'
        GROUP BY tc.constraint_name
        HAVING COUNT(ccu.column_name) = 1
           AND MAX(ccu.column_name) = 'user_id'
      ) LOOP
        EXECUTE format('ALTER TABLE public.agency_members DROP CONSTRAINT %I', cname);
      END LOOP;
    END;
  END IF;
END $$;

-- Add the proper unique constraint on (agency_id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'agency_members'
      AND constraint_name = 'agency_members_agency_id_user_id_key'
  ) THEN
    ALTER TABLE public.agency_members
      ADD CONSTRAINT agency_members_agency_id_user_id_key UNIQUE (agency_id, user_id);
  END IF;
END $$;

-- Create index on agency_id if not exists
CREATE INDEX IF NOT EXISTS idx_agency_members_agency_id ON public.agency_members(agency_id);

-- Add missing stream_gifts columns needed by send_gift_in_stream and related RPCs
ALTER TABLE public.stream_gifts
  ADD COLUMN IF NOT EXISTS gift_type TEXT,
  ADD COLUMN IF NOT EXISTS coins_spent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trollmonds_transferred INTEGER DEFAULT 0;

-- Ensure purchasable_items table exists (fallback cost lookup source)
CREATE TABLE IF NOT EXISTS public.purchasable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('coin_pack', 'gift', 'seat', 'stream_feature', 'badge', 'vehicle', 'house', 'upgrade', 'admin_feature', 'other')),
  coin_price INTEGER,
  usd_price NUMERIC,
  is_coin_pack BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  frontend_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Ensure gift_items table exists with columns needed for coin price lookups.
-- This table is referenced by send_gift_in_stream when looking up gift costs.
-- It may not exist if the database was initialized from a partial migration set.
CREATE TABLE IF NOT EXISTS public.gift_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coin_cost INTEGER DEFAULT 0,
  value INTEGER DEFAULT 0,
  gift_slug TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
  icon TEXT,
  icon_url TEXT,
  category TEXT DEFAULT 'Common',
  currency TEXT DEFAULT 'troll_coins',
  animation_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gift_items
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS coin_cost INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS value INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Common',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'troll_coins',
  ADD COLUMN IF NOT EXISTS animation_type TEXT;

-- Ensure gifts table has slug column referenced by send_gift_in_stream fallback lookup
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Change agency_earnings.source_id from UUID to TEXT to accommodate stream_gifts.id (BIGINT)
-- The send_gift_in_stream function stores the stream_gifts.id (BIGINT) into v_existing_id (TEXT)
-- and uses it as source_id in agency_earnings inserts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agency_earnings'
      AND column_name = 'source_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.agency_earnings
      ALTER COLUMN source_id TYPE TEXT;
  END IF;
END $$;

-- Create/update indexes for gift lookups
CREATE INDEX IF NOT EXISTS idx_gift_items_gift_slug ON public.gift_items(gift_slug);
CREATE INDEX IF NOT EXISTS idx_gift_items_status ON public.gift_items(status);
CREATE INDEX IF NOT EXISTS idx_gift_items_coin_cost ON public.gift_items(coin_cost);
CREATE INDEX IF NOT EXISTS idx_gifts_slug ON public.gifts(slug);

-- Enable RLS on gift_items and add deny_all policy (access is via RPCs only)
ALTER TABLE public.gift_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON public.gift_items
  FOR ALL USING (false) WITH CHECK (false);

COMMIT;
