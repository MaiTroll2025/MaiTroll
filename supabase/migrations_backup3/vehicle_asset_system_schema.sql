-- =====================================================
-- VEHICLE ASSET SYSTEM - Cars Page (Bottom Navigation)
-- =====================================================
-- This system is INDEPENDENT from:
--   - Neighborhood System
--   - Starter Car System
--   - Free Starter Vehicle
--   - Neighborhood Garage Logic
--   - Neighborhood Vehicle Ownership
--   - Neighborhood Vehicle Rewards
-- =====================================================

-- Vehicle catalog for the Cars page marketplace
CREATE TABLE IF NOT EXISTS public.vehicle_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT UNIQUE NOT NULL, -- Stable ID for referencing (e.g., 'honda_civic', 'corvette')
  name TEXT NOT NULL,
  description TEXT,
  tier TEXT DEFAULT 'Common', -- Common, Rare, Epic, Legendary, Mythic, Special, Limited, Holiday, Founder
  image_url TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  buyback_percentage NUMERIC NOT NULL DEFAULT 75, -- Percentage user receives back (0-100)
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT -1, -- -1 for unlimited
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.user_profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb -- For future extensibility (speed, armor, etc.)
);

-- Index for active vehicles
CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_active ON public.vehicle_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_tier ON public.vehicle_catalog(tier);
CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_price ON public.vehicle_catalog(base_price);

-- User's owned vehicles from the Cars page
CREATE TABLE IF NOT EXISTS public.user_vehicle_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES public.vehicle_catalog(id),
  vehicle_name TEXT NOT NULL, -- Snapshot at time of purchase
  purchase_price NUMERIC NOT NULL,
  purchase_date TIMESTAMPTZ DEFAULT now(),
  buyback_percentage NUMERIC NOT NULL DEFAULT 75,
  status TEXT NOT NULL DEFAULT 'owned', -- owned, sold
  sold_at TIMESTAMPTZ,
  sale_price NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for user's vehicles
CREATE INDEX IF NOT EXISTS idx_user_vehicle_assets_user ON public.user_vehicle_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vehicle_assets_status ON public.user_vehicle_assets(status);
CREATE INDEX IF NOT EXISTS idx_user_vehicle_assets_catalog ON public.user_vehicle_assets(catalog_id);

-- Vehicle transaction history
CREATE TABLE IF NOT EXISTS public.vehicle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES public.vehicle_catalog(id),
  asset_id UUID REFERENCES public.user_vehicle_assets(id),
  transaction_type TEXT NOT NULL, -- purchase, sale, buyback
  vehicle_name TEXT NOT NULL,
  amount NUMERIC NOT NULL, -- Positive for sales, negative for purchases
  balance_before NUMERIC,
  balance_after NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for transaction history
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_user ON public.vehicle_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_type ON public.vehicle_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_date ON public.vehicle_transactions(created_at);

-- Enable RLS
ALTER TABLE public.vehicle_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vehicle_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_catalog
DROP POLICY IF EXISTS "Anyone can view active vehicles" ON public.vehicle_catalog;
CREATE POLICY "Anyone can view active vehicles"
ON public.vehicle_catalog FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage vehicle catalog" ON public.vehicle_catalog;
CREATE POLICY "Admins can manage vehicle catalog"
ON public.vehicle_catalog FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND (user_profiles.is_admin = true OR user_profiles.role = 'admin' OR user_profiles.role = 'superadmin')
  )
);

-- RLS Policies for user_vehicle_assets
DROP POLICY IF EXISTS "Users can view own vehicle assets" ON public.user_vehicle_assets;
CREATE POLICY "Users can view own vehicle assets"
ON public.user_vehicle_assets FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own vehicle assets" ON public.user_vehicle_assets;
CREATE POLICY "Users can insert own vehicle assets"
ON public.user_vehicle_assets FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vehicle assets" ON public.user_vehicle_assets;
CREATE POLICY "Users can update own vehicle assets"
ON public.user_vehicle_assets FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all vehicle assets" ON public.user_vehicle_assets;
CREATE POLICY "Admins can view all vehicle assets"
ON public.user_vehicle_assets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND (user_profiles.is_admin = true OR user_profiles.role = 'admin' OR user_profiles.role = 'superadmin')
  )
);

-- RLS Policies for vehicle_transactions
DROP POLICY IF EXISTS "Users can view own vehicle transactions" ON public.vehicle_transactions;
CREATE POLICY "Users can view own vehicle transactions"
ON public.vehicle_transactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own vehicle transactions" ON public.vehicle_transactions;
CREATE POLICY "Users can insert own vehicle transactions"
ON public.vehicle_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all vehicle transactions" ON public.vehicle_transactions;
CREATE POLICY "Admins can view all vehicle transactions"
ON public.vehicle_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND (user_profiles.is_admin = true OR user_profiles.role = 'admin' OR user_profiles.role = 'superadmin')
  )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_vehicle_catalog_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicle_catalog_updated ON public.vehicle_catalog;
CREATE TRIGGER trg_vehicle_catalog_updated
BEFORE UPDATE ON public.vehicle_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_catalog_timestamp();

-- =====================================================
-- DEFAULT VEHICLE CATALOG DATA
-- =====================================================
INSERT INTO public.vehicle_catalog (vehicle_id, name, tier, base_price, buyback_percentage, is_active, stock_quantity) VALUES
  ('honda_civic', 'Honda Civic', 'Common', 10000, 75, true, -1),
  ('toyota_camry', 'Toyota Camry', 'Common', 15000, 75, true, -1),
  ('ford_mustang', 'Ford Mustang', 'Rare', 50000, 75, true, -1),
  ('corvette', 'Corvette', 'Rare', 100000, 75, true, -1),
  ('porsche_911', 'Porsche 911', 'Epic', 200000, 80, true, -1),
  ('bmw_m5', 'BMW M5', 'Epic', 180000, 80, true, -1),
  ('mercedes_amg', 'Mercedes-AMG GT', 'Epic', 220000, 80, true, -1),
  ('lamborghini', 'Lamborghini', 'Legendary', 500000, 85, true, 100),
  ('ferrari', 'Ferrari', 'Legendary', 600000, 85, true, 100),
  ('rolls_royce', 'Rolls Royce', 'Legendary', 1000000, 85, true, 50),
  ('bugatti', 'Bugatti', 'Mythic', 2500000, 90, true, 10),
  ('koenigsegg', 'Koenigsegg', 'Mythic', 3000000, 90, true, 5)
ON CONFLICT (vehicle_id) DO NOTHING;
