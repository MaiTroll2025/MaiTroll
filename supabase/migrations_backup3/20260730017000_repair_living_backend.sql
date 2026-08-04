-- ============================================================================
-- Migration: repair_living_backend
-- Ensures living, neighborhood, vehicle, insurance, credit tables exist
-- Applied: 2026-07-30
-- ============================================================================

-- neighborhoods: ensure unique constraint on leader_user_id
-- First remove duplicate leader_user_id values (keep the one with the most recent updated_at)
DELETE FROM public.neighborhoods
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY leader_user_id ORDER BY updated_at DESC NULLS LAST) as rn
    FROM public.neighborhoods
    WHERE leader_user_id IS NOT NULL
  ) t WHERE t.rn = 1
)
AND leader_user_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'neighborhoods' AND constraint_name = 'neighborhoods_leader_user_id_key'
  ) THEN
    ALTER TABLE public.neighborhoods ADD CONSTRAINT neighborhoods_leader_user_id_key UNIQUE (leader_user_id);
  END IF;
END $$;

-- properties: ensure key columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN owner_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'neighborhood_id'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'max_tenants'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN max_tenants integer DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'current_tenants'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN current_tenants integer DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'occupancy'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN occupancy numeric DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_owner_user_id ON public.properties(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood_id ON public.properties(neighborhood_id);

-- vehicles: ensure key columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.vehicles ADD COLUMN user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'license_plate'
  ) THEN
    ALTER TABLE public.vehicles ADD COLUMN license_plate text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.vehicles ADD COLUMN status text DEFAULT 'owned'
      CHECK (status IN ('owned', 'leased', 'sold', 'junk'));
  END IF;
END $$;

-- user_vehicles: ensure columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'is_primary'
  ) THEN
    ALTER TABLE public.user_vehicles ADD COLUMN is_primary boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_id ON public.user_vehicles(user_id);

-- insurance: ensure columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insurances' AND column_name = 'coverage_type'
  ) THEN
    ALTER TABLE public.user_insurances ADD COLUMN coverage_type text DEFAULT 'basic';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insurances' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.user_insurances ADD COLUMN status text DEFAULT 'active'
      CHECK (status IN ('active', 'expired', 'cancelled'));
  END IF;
END $$;

-- user_credit: ensure correct balance/credit logic columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_credit' AND column_name = 'credit_limit'
  ) THEN
    ALTER TABLE public.user_credit ADD COLUMN credit_limit bigint DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_credit' AND column_name = 'balance'
  ) THEN
    ALTER TABLE public.user_credit ADD COLUMN balance bigint DEFAULT 0;
  END IF;
END $$;

-- available_credit = credit_limit - balance (computed view or function)
CREATE OR REPLACE VIEW public.v_user_credit_summary AS
SELECT
  uc.user_id,
  uc.credit_limit,
  uc.balance,
  uc.credit_limit - uc.balance AS available_credit,
  uc.updated_at
FROM public.user_credit uc;

-- credit_events: ensure columns for purchase tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_events' AND column_name = 'purchase_amount'
  ) THEN
    ALTER TABLE public.credit_events ADD COLUMN purchase_amount bigint DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_events' AND column_name = 'remaining_balance'
  ) THEN
    ALTER TABLE public.credit_events ADD COLUMN remaining_balance bigint DEFAULT 0;
  END IF;
END $$;