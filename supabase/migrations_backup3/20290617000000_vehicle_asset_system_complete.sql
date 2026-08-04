-- =====================================================
-- VEHICLE ASSET SYSTEM - SAFE MIGRATION
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Drop existing tables if they exist (clean slate)
-- =====================================================
DROP TABLE IF EXISTS public.vehicle_transactions CASCADE;
DROP TABLE IF EXISTS public.user_vehicle_assets CASCADE;
DROP TABLE IF EXISTS public.vehicle_catalog CASCADE;

-- =====================================================
-- STEP 2: Create tables
-- =====================================================

-- Vehicle catalog for the Cars page marketplace
CREATE TABLE public.vehicle_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tier TEXT DEFAULT 'Common',
  image_url TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  buyback_percentage NUMERIC NOT NULL DEFAULT 75,
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT -1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.user_profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_vehicle_catalog_active ON public.vehicle_catalog(is_active);
CREATE INDEX idx_vehicle_catalog_tier ON public.vehicle_catalog(tier);
CREATE INDEX idx_vehicle_catalog_price ON public.vehicle_catalog(base_price);

-- User's owned vehicles from the Cars page
CREATE TABLE public.user_vehicle_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES public.vehicle_catalog(id),
  vehicle_name TEXT NOT NULL,
  purchase_price NUMERIC NOT NULL,
  purchase_date TIMESTAMPTZ DEFAULT now(),
  buyback_percentage NUMERIC NOT NULL DEFAULT 75,
  status TEXT NOT NULL DEFAULT 'owned',
  sold_at TIMESTAMPTZ,
  sale_price NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_user_vehicle_assets_user ON public.user_vehicle_assets(user_id);
CREATE INDEX idx_user_vehicle_assets_status ON public.user_vehicle_assets(status);
CREATE INDEX idx_user_vehicle_assets_catalog ON public.user_vehicle_assets(catalog_id);

-- Vehicle transaction history
CREATE TABLE public.vehicle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES public.vehicle_catalog(id),
  asset_id UUID REFERENCES public.user_vehicle_assets(id),
  transaction_type TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  balance_before NUMERIC,
  balance_after NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicle_transactions_user ON public.vehicle_transactions(user_id);
CREATE INDEX idx_vehicle_transactions_type ON public.vehicle_transactions(transaction_type);
CREATE INDEX idx_vehicle_transactions_date ON public.vehicle_transactions(created_at);

-- =====================================================
-- STEP 3: Enable RLS
-- =====================================================
ALTER TABLE public.vehicle_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vehicle_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: Create RLS Policies
-- =====================================================

-- vehicle_catalog policies
CREATE POLICY "Anyone can view active vehicles"
ON public.vehicle_catalog FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage vehicle catalog"
ON public.vehicle_catalog FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND (user_profiles.is_admin = true OR user_profiles.role = 'admin' OR user_profiles.role = 'superadmin')
  )
);

-- user_vehicle_assets policies
CREATE POLICY "Users can view own vehicle assets"
ON public.user_vehicle_assets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicle assets"
ON public.user_vehicle_assets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicle assets"
ON public.user_vehicle_assets FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all vehicle assets"
ON public.user_vehicle_assets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND (user_profiles.is_admin = true OR user_profiles.role = 'admin' OR user_profiles.role = 'superadmin')
  )
);

-- vehicle_transactions policies
CREATE POLICY "Users can view own vehicle transactions"
ON public.vehicle_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicle transactions"
ON public.vehicle_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all vehicle transactions"
ON public.vehicle_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND (user_profiles.is_admin = true OR user_profiles.role = 'admin' OR user_profiles.role = 'superadmin')
  )
);

-- =====================================================
-- STEP 5: Create trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_vehicle_catalog_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_catalog_updated
BEFORE UPDATE ON public.vehicle_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_catalog_timestamp();

-- =====================================================
-- STEP 6: Insert default vehicle catalog data
-- =====================================================
INSERT INTO public.vehicle_catalog (vehicle_id, name, tier, base_price, buyback_percentage, is_active, stock_quantity, image_url) VALUES
  ('troll_compact', 'Troll Compact', 'Common', 10000, 75, true, -1, '/assets/cars/troll_compact_s1.png'),
  ('troll_sedan', 'Troll Sedan', 'Common', 15000, 75, true, -1, '/assets/cars/midline_xr.png'),
  ('troll_coupe', 'Troll Coupe', 'Rare', 50000, 75, true, -1, '/assets/cars/urban_drift_r.png'),
  ('troll_sport', 'Troll Sport', 'Rare', 100000, 75, true, -1, '/assets/cars/ironclad_gt.png'),
  ('troll_gt', 'Troll GT', 'Epic', 200000, 80, true, -1, '/assets/cars/phantom_x.png'),
  ('troll_racing', 'Troll Racing', 'Epic', 180000, 80, true, -1, '/assets/cars/vanta_lx.png'),
  ('troll_luxury', 'Troll Luxury', 'Epic', 220000, 80, true, -1, '/assets/cars/vehicle_1_original.png'),
  ('troll_exotic', 'Troll Exotic', 'Legendary', 500000, 85, true, 100, '/assets/cars/vehicle_2_original.png'),
  ('troll_supercar', 'Troll Supercar', 'Legendary', 600000, 85, true, 100, '/assets/cars/vehicle_3_original.png'),
  ('troll_royale', 'Troll Royale', 'Legendary', 1000000, 85, true, 50, '/assets/cars/vehicle_4_original.png'),
  ('troll_hyper', 'Troll Hyper', 'Mythic', 2500000, 90, true, 10, '/assets/cars/vehicle_5_original.png'),
  ('troll_apex', 'Troll Apex', 'Mythic', 3000000, 90, true, 5, '/assets/cars/vehicle_6_original.png')
ON CONFLICT (vehicle_id) DO NOTHING;

-- =====================================================
-- STEP 7: Create RPC functions
-- =====================================================

-- Function: purchase_vehicle_asset
CREATE OR REPLACE FUNCTION public.purchase_vehicle_asset(
  p_vehicle_id TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_catalog RECORD;
  v_user_coins NUMERIC;
  v_asset_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Set bypass flag for coin protection trigger
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  SELECT * INTO v_catalog
  FROM public.vehicle_catalog
  WHERE vehicle_id = p_vehicle_id AND is_active = true;

  IF v_catalog IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found or not available');
  END IF;

  IF v_catalog.stock_quantity >= 0 AND v_catalog.stock_quantity = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle out of stock');
  END IF;

  SELECT COALESCE(troll_coins, 0) INTO v_user_coins
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_user_coins IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF v_user_coins < v_catalog.base_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_catalog.base_price
  WHERE id = p_user_id AND troll_coins >= v_catalog.base_price;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Failed to deduct coins');
  END IF;

  INSERT INTO public.user_vehicle_assets (
    user_id, catalog_id, vehicle_name, purchase_price, buyback_percentage
  ) VALUES (
    p_user_id, v_catalog.id, v_catalog.name, v_catalog.base_price, v_catalog.buyback_percentage
  ) RETURNING id INTO v_asset_id;

  IF v_catalog.stock_quantity > 0 THEN
    UPDATE public.vehicle_catalog
    SET stock_quantity = stock_quantity - 1
    WHERE id = v_catalog.id;
  END IF;

  INSERT INTO public.vehicle_transactions (
    user_id, catalog_id, asset_id, transaction_type, vehicle_name, amount, metadata
  ) VALUES (
    p_user_id, v_catalog.id, v_asset_id, 'purchase', v_catalog.name, -v_catalog.base_price,
    jsonb_build_object('buyback_percentage', v_catalog.buyback_percentage, 'tier', v_catalog.tier)
  );

  RETURN json_build_object(
    'success', true, 'asset_id', v_asset_id, 'vehicle_name', v_catalog.name,
    'purchase_price', v_catalog.base_price, 'buyback_percentage', v_catalog.buyback_percentage,
    'buyback_value', ROUND(v_catalog.base_price * v_catalog.buyback_percentage / 100)
  );
END;
$$;

-- Function: sell_vehicle_asset
CREATE OR REPLACE FUNCTION public.sell_vehicle_asset(
  p_asset_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_asset RECORD;
  v_buyback_value NUMERIC;
  v_catalog_name TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Set bypass flag for coin protection trigger
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  SELECT * INTO v_asset
  FROM public.user_vehicle_assets
  WHERE id = p_asset_id AND user_id = p_user_id AND status = 'owned';

  IF v_asset IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found or already sold');
  END IF;

  SELECT name INTO v_catalog_name
  FROM public.vehicle_catalog
  WHERE id = v_asset.catalog_id;

  IF v_catalog_name IS NULL THEN
    v_catalog_name := v_asset.vehicle_name;
  END IF;

  v_buyback_value := ROUND(v_asset.purchase_price * v_asset.buyback_percentage / 100);

  UPDATE public.user_vehicle_assets
  SET status = 'sold', sold_at = now(), sale_price = v_buyback_value
  WHERE id = p_asset_id;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_buyback_value
  WHERE id = p_user_id;

  INSERT INTO public.vehicle_transactions (
    user_id, catalog_id, asset_id, transaction_type, vehicle_name, amount, metadata
  ) VALUES (
    p_user_id, v_asset.catalog_id, p_asset_id, 'sale', v_catalog_name, v_buyback_value,
    jsonb_build_object(
      'purchase_price', v_asset.purchase_price, 'buyback_value', v_buyback_value,
      'buyback_percentage', v_asset.buyback_percentage, 'profit_loss', v_buyback_value - v_asset.purchase_price
    )
  );

  RETURN json_build_object(
    'success', true, 'vehicle_name', v_catalog_name, 'purchase_price', v_asset.purchase_price,
    'buyback_value', v_buyback_value, 'buyback_percentage', v_asset.buyback_percentage
  );
END;
$$;

-- Function: get_user_vehicle_assets
CREATE OR REPLACE FUNCTION public.get_user_vehicle_assets(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  id UUID, vehicle_name TEXT, tier TEXT, purchase_price NUMERIC,
  buyback_value NUMERIC, buyback_percentage NUMERIC, purchase_date TIMESTAMPTZ,
  image_url TEXT, status TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    uva.id, COALESCE(vc.name, uva.vehicle_name), COALESCE(vc.tier, 'Unknown'),
    uva.purchase_price, ROUND(uva.purchase_price * uva.buyback_percentage / 100),
    uva.buyback_percentage, uva.purchase_date, vc.image_url, uva.status
  FROM public.user_vehicle_assets uva
  LEFT JOIN public.vehicle_catalog vc ON uva.catalog_id = vc.id
  WHERE uva.user_id = p_user_id AND uva.status = 'owned'
  ORDER BY uva.purchase_date DESC;
$$;

-- Function: get_vehicle_catalog
CREATE OR REPLACE FUNCTION public.get_vehicle_catalog()
RETURNS TABLE (
  vehicle_id TEXT, name TEXT, description TEXT, tier TEXT, image_url TEXT,
  base_price NUMERIC, buyback_value NUMERIC, buyback_percentage NUMERIC, stock_quantity NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    vc.vehicle_id, vc.name, vc.description, vc.tier, vc.image_url, vc.base_price,
    ROUND(vc.base_price * vc.buyback_percentage / 100), vc.buyback_percentage,
    CASE WHEN vc.stock_quantity < 0 THEN 999999 ELSE vc.stock_quantity END
  FROM public.vehicle_catalog vc
  WHERE vc.is_active = true
  ORDER BY vc.base_price ASC;
$$;

-- Function: get_vehicle_transactions
CREATE OR REPLACE FUNCTION public.get_vehicle_transactions(
  p_user_id UUID DEFAULT auth.uid(),
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, transaction_type TEXT, vehicle_name TEXT, amount NUMERIC, metadata JSONB, created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT vt.id, vt.transaction_type, vt.vehicle_name, vt.amount, vt.metadata, vt.created_at
  FROM public.vehicle_transactions vt
  WHERE vt.user_id = p_user_id
  ORDER BY vt.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Admin Function: admin_create_vehicle
CREATE OR REPLACE FUNCTION public.admin_create_vehicle(
  p_vehicle_id TEXT, p_name TEXT, p_tier TEXT DEFAULT 'Common',
  p_base_price NUMERIC DEFAULT 0, p_buyback_percentage NUMERIC DEFAULT 75,
  p_image_url TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_stock_quantity INTEGER DEFAULT -1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'superadmin'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  INSERT INTO public.vehicle_catalog (vehicle_id, name, tier, base_price, buyback_percentage, image_url, description, stock_quantity)
  VALUES (p_vehicle_id, p_name, p_tier, p_base_price, p_buyback_percentage, p_image_url, p_description, p_stock_quantity)
  ON CONFLICT (vehicle_id) DO UPDATE SET
    name = EXCLUDED.name, tier = EXCLUDED.tier, base_price = EXCLUDED.base_price,
    buyback_percentage = EXCLUDED.buyback_percentage, image_url = EXCLUDED.image_url,
    description = EXCLUDED.description, stock_quantity = EXCLUDED.stock_quantity, is_active = true;

  RETURN json_build_object('success', true, 'vehicle_id', p_vehicle_id);
END;
$$;

-- Admin Function: admin_update_vehicle
CREATE OR REPLACE FUNCTION public.admin_update_vehicle(
  p_vehicle_id TEXT, p_name TEXT DEFAULT NULL, p_tier TEXT DEFAULT NULL,
  p_base_price NUMERIC DEFAULT NULL, p_buyback_percentage NUMERIC DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_stock_quantity INTEGER DEFAULT NULL, p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'superadmin'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE public.vehicle_catalog
  SET name = COALESCE(p_name, name), tier = COALESCE(p_tier, tier),
      base_price = COALESCE(p_base_price, base_price), buyback_percentage = COALESCE(p_buyback_percentage, buyback_percentage),
      image_url = COALESCE(p_image_url, image_url), description = COALESCE(p_description, description),
      stock_quantity = COALESCE(p_stock_quantity, stock_quantity), is_active = COALESCE(p_is_active, is_active)
  WHERE vehicle_id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found');
  END IF;

  RETURN json_build_object('success', true, 'vehicle_id', p_vehicle_id);
END;
$$;

-- Admin Function: admin_delete_vehicle
CREATE OR REPLACE FUNCTION public.admin_delete_vehicle(p_vehicle_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'superadmin'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE public.vehicle_catalog SET is_active = false WHERE vehicle_id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found');
  END IF;

  RETURN json_build_object('success', true, 'vehicle_id', p_vehicle_id);
END;
$$;

-- Admin Function: admin_get_vehicle_stats
CREATE OR REPLACE FUNCTION public.admin_get_vehicle_stats()
RETURNS TABLE (
  vehicle_id TEXT, vehicle_name TEXT, total_purchases BIGINT, total_sales BIGINT,
  currently_owned BIGINT, total_coins_spent NUMERIC, total_coins_returned NUMERIC, net_coin_sink NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    vc.vehicle_id, vc.name,
    COUNT(uva.id) FILTER (WHERE uva.status IN ('owned', 'sold')),
    COUNT(uva.id) FILTER (WHERE uva.status = 'sold'),
    COUNT(uva.id) FILTER (WHERE uva.status = 'owned'),
    COALESCE(SUM(uva.purchase_price) FILTER (WHERE uva.status IN ('owned', 'sold')), 0),
    COALESCE(SUM(uva.sale_price) FILTER (WHERE uva.status = 'sold'), 0),
    COALESCE(SUM(uva.purchase_price) FILTER (WHERE uva.status IN ('owned', 'sold')), 0) -
    COALESCE(SUM(uva.sale_price) FILTER (WHERE uva.status = 'sold'), 0)
  FROM public.vehicle_catalog vc
  LEFT JOIN public.user_vehicle_assets uva ON vc.id = uva.catalog_id
  GROUP BY vc.id, vc.vehicle_id, vc.name
  ORDER BY vc.base_price ASC;
$$;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Tables created successfully' as status;
SELECT * FROM public.vehicle_catalog LIMIT 5;
