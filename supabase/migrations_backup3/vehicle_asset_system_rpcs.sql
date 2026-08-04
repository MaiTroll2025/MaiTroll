-- =====================================================
-- VEHICLE ASSET SYSTEM - RPC Functions
-- =====================================================
-- These functions handle:
--   1. Purchasing vehicles from the Cars page
--   2. Selling vehicles back to Mai Troll (buyback)
--   3. Admin management of the vehicle catalog
-- =====================================================

-- =====================================================
-- Function: purchase_vehicle_asset
-- Allows users to purchase a vehicle from the Cars page
-- =====================================================
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
  -- Validate user
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Set bypass flag for coin protection trigger
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Get vehicle catalog entry
  SELECT * INTO v_catalog
  FROM public.vehicle_catalog
  WHERE vehicle_id = p_vehicle_id AND is_active = true;

  IF v_catalog IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found or not available');
  END IF;

  -- Check stock (if limited)
  IF v_catalog.stock_quantity >= 0 THEN
    IF v_catalog.stock_quantity = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Vehicle out of stock');
    END IF;
  END IF;

  -- Get user's coin balance
  SELECT COALESCE(troll_coins, 0) INTO v_user_coins
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_user_coins IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check sufficient funds
  IF v_user_coins < v_catalog.base_price THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient coins. Need ' || v_catalog.base_price || ' but have ' || v_user_coins
    );
  END IF;

  -- Deduct coins from user
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_catalog.base_price
  WHERE id = p_user_id AND troll_coins >= v_catalog.base_price;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Failed to deduct coins');
  END IF;

  -- Create user vehicle asset
  INSERT INTO public.user_vehicle_assets (
    user_id,
    catalog_id,
    vehicle_name,
    purchase_price,
    buyback_percentage
  ) VALUES (
    p_user_id,
    v_catalog.id,
    v_catalog.name,
    v_catalog.base_price,
    v_catalog.buyback_percentage
  ) RETURNING id INTO v_asset_id;

  -- Decrease stock if limited
  IF v_catalog.stock_quantity > 0 THEN
    UPDATE public.vehicle_catalog
    SET stock_quantity = stock_quantity - 1
    WHERE id = v_catalog.id;
  END IF;

  -- Record transaction
  INSERT INTO public.vehicle_transactions (
    user_id,
    catalog_id,
    asset_id,
    transaction_type,
    vehicle_name,
    amount,
    metadata
  ) VALUES (
    p_user_id,
    v_catalog.id,
    v_asset_id,
    'purchase',
    v_catalog.name,
    -v_catalog.base_price,
    jsonb_build_object(
      'buyback_percentage', v_catalog.buyback_percentage,
      'tier', v_catalog.tier
    )
  );

  RETURN json_build_object(
    'success', true,
    'asset_id', v_asset_id,
    'vehicle_name', v_catalog.name,
    'purchase_price', v_catalog.base_price,
    'buyback_percentage', v_catalog.buyback_percentage,
    'buyback_value', ROUND(v_catalog.base_price * v_catalog.buyback_percentage / 100)
  );
END;
$$;

-- =====================================================
-- Function: sell_vehicle_asset
-- Allows users to sell a vehicle back to Mai Troll
-- =====================================================
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
  -- Validate user
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Set bypass flag for coin protection trigger
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Get user's vehicle asset
  SELECT * INTO v_asset
  FROM public.user_vehicle_assets
  WHERE id = p_asset_id AND user_id = p_user_id AND status = 'owned';

  IF v_asset IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found or already sold');
  END IF;

  -- Get catalog name (use stored name if catalog deleted)
  SELECT name INTO v_catalog_name
  FROM public.vehicle_catalog
  WHERE id = v_asset.catalog_id;

  IF v_catalog_name IS NULL THEN
    v_catalog_name := v_asset.vehicle_name;
  END IF;

  -- Calculate buyback value
  v_buyback_value := ROUND(v_asset.purchase_price * v_asset.buyback_percentage / 100);

  -- Update asset status
  UPDATE public.user_vehicle_assets
  SET
    status = 'sold',
    sold_at = now(),
    sale_price = v_buyback_value
  WHERE id = p_asset_id;

  -- Add coins to user
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_buyback_value
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.vehicle_transactions (
    user_id,
    catalog_id,
    asset_id,
    transaction_type,
    vehicle_name,
    amount,
    metadata
  ) VALUES (
    p_user_id,
    v_asset.catalog_id,
    p_asset_id,
    'sale',
    v_catalog_name,
    v_buyback_value,
    jsonb_build_object(
      'purchase_price', v_asset.purchase_price,
      'buyback_value', v_buyback_value,
      'buyback_percentage', v_asset.buyback_percentage,
      'profit_loss', v_buyback_value - v_asset.purchase_price
    )
  );

  RETURN json_build_object(
    'success', true,
    'vehicle_name', v_catalog_name,
    'purchase_price', v_asset.purchase_price,
    'buyback_value', v_buyback_value,
    'buyback_percentage', v_asset.buyback_percentage
  );
END;
$$;

-- =====================================================
-- Function: get_user_vehicle_assets
-- Returns all owned vehicles for a user
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_vehicle_assets(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  id UUID,
  vehicle_name TEXT,
  tier TEXT,
  purchase_price NUMERIC,
  buyback_value NUMERIC,
  buyback_percentage NUMERIC,
  purchase_date TIMESTAMPTZ,
  image_url TEXT,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    uva.id,
    COALESCE(vc.name, uva.vehicle_name) as vehicle_name,
    COALESCE(vc.tier, 'Unknown') as tier,
    uva.purchase_price,
    ROUND(uva.purchase_price * uva.buyback_percentage / 100) as buyback_value,
    uva.buyback_percentage,
    uva.purchase_date,
    vc.image_url,
    uva.status
  FROM public.user_vehicle_assets uva
  LEFT JOIN public.vehicle_catalog vc ON uva.catalog_id = vc.id
  WHERE uva.user_id = p_user_id AND uva.status = 'owned'
  ORDER BY uva.purchase_date DESC;
$$;

-- =====================================================
-- Function: get_vehicle_catalog
-- Returns active vehicles available for purchase
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_vehicle_catalog()
RETURNS TABLE (
  vehicle_id TEXT,
  name TEXT,
  description TEXT,
  tier TEXT,
  image_url TEXT,
  base_price NUMERIC,
  buyback_value NUMERIC,
  buyback_percentage NUMERIC,
  stock_quantity NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    vc.vehicle_id,
    vc.name,
    vc.description,
    vc.tier,
    vc.image_url,
    vc.base_price,
    ROUND(vc.base_price * vc.buyback_percentage / 100) as buyback_value,
    vc.buyback_percentage,
    CASE WHEN vc.stock_quantity < 0 THEN 999999 ELSE vc.stock_quantity END as stock_quantity
  FROM public.vehicle_catalog vc
  WHERE vc.is_active = true
  ORDER BY vc.base_price ASC;
$$;

-- =====================================================
-- Function: get_vehicle_transactions
-- Returns transaction history for a user
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_vehicle_transactions(
  p_user_id UUID DEFAULT auth.uid(),
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  transaction_type TEXT,
  vehicle_name TEXT,
  amount NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    vt.id,
    vt.transaction_type,
    vt.vehicle_name,
    vt.amount,
    vt.metadata,
    vt.created_at
  FROM public.vehicle_transactions vt
  WHERE vt.user_id = p_user_id
  ORDER BY vt.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- =====================================================
-- ADMIN FUNCTIONS
-- =====================================================

-- Function: admin_create_vehicle
-- Create a new vehicle in the catalog
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_create_vehicle(
  p_vehicle_id TEXT,
  p_name TEXT,
  p_tier TEXT DEFAULT 'Common',
  p_base_price NUMERIC DEFAULT 0,
  p_buyback_percentage NUMERIC DEFAULT 75,
  p_image_url TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_stock_quantity INTEGER DEFAULT -1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role IN ('admin', 'superadmin'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  INSERT INTO public.vehicle_catalog (
    vehicle_id,
    name,
    tier,
    base_price,
    buyback_percentage,
    image_url,
    description,
    stock_quantity
  ) VALUES (
    p_vehicle_id,
    p_name,
    p_tier,
    p_base_price,
    p_buyback_percentage,
    p_image_url,
    p_description,
    p_stock_quantity
  )
  ON CONFLICT (vehicle_id) DO UPDATE SET
    name = EXCLUDED.name,
    tier = EXCLUDED.tier,
    base_price = EXCLUDED.base_price,
    buyback_percentage = EXCLUDED.buyback_percentage,
    image_url = EXCLUDED.image_url,
    description = EXCLUDED.description,
    stock_quantity = EXCLUDED.stock_quantity,
    is_active = true;

  RETURN json_build_object('success', true, 'vehicle_id', p_vehicle_id);
END;
$$;

-- Function: admin_update_vehicle
-- Update an existing vehicle
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_update_vehicle(
  p_vehicle_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_base_price NUMERIC DEFAULT NULL,
  p_buyback_percentage NUMERIC DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_stock_quantity INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role IN ('admin', 'superadmin'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE public.vehicle_catalog
  SET
    name = COALESCE(p_name, name),
    tier = COALESCE(p_tier, tier),
    base_price = COALESCE(p_base_price, base_price),
    buyback_percentage = COALESCE(p_buyback_percentage, buyback_percentage),
    image_url = COALESCE(p_image_url, image_url),
    description = COALESCE(p_description, description),
    stock_quantity = COALESCE(p_stock_quantity, stock_quantity),
    is_active = COALESCE(p_is_active, is_active)
  WHERE vehicle_id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found');
  END IF;

  RETURN json_build_object('success', true, 'vehicle_id', p_vehicle_id);
END;
$$;

-- Function: admin_delete_vehicle
-- Soft delete a vehicle (set inactive)
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_delete_vehicle(
  p_vehicle_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role IN ('admin', 'superadmin'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE public.vehicle_catalog
  SET is_active = false
  WHERE vehicle_id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found');
  END IF;

  RETURN json_build_object('success', true, 'vehicle_id', p_vehicle_id);
END;
$$;

-- Function: admin_get_vehicle_stats
-- Get ownership and purchase statistics
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_get_vehicle_stats()
RETURNS TABLE (
  vehicle_id TEXT,
  vehicle_name TEXT,
  total_purchases BIGINT,
  total_sales BIGINT,
  currently_owned BIGINT,
  total_coins_spent NUMERIC,
  total_coins_returned NUMERIC,
  net_coin_sink NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Check admin permission (will throw if not admin)
  SELECT 1 FROM public.user_profiles
  WHERE id = auth.uid()
  AND (is_admin = true OR role IN ('admin', 'superadmin'));

  SELECT
    vc.vehicle_id,
    vc.name as vehicle_name,
    COUNT(uva.id) FILTER (WHERE uva.status = 'owned' OR uva.status = 'sold') as total_purchases,
    COUNT(uva.id) FILTER (WHERE uva.status = 'sold') as total_sales,
    COUNT(uva.id) FILTER (WHERE uva.status = 'owned') as currently_owned,
    COALESCE(SUM(uva.purchase_price) FILTER (WHERE uva.status = 'owned' OR uva.status = 'sold'), 0) as total_coins_spent,
    COALESCE(SUM(uva.sale_price) FILTER (WHERE uva.status = 'sold'), 0) as total_coins_returned,
    COALESCE(SUM(uva.purchase_price) FILTER (WHERE uva.status = 'owned' OR uva.status = 'sold'), 0) - 
    COALESCE(SUM(uva.sale_price) FILTER (WHERE uva.status = 'sold'), 0) as net_coin_sink
  FROM public.vehicle_catalog vc
  LEFT JOIN public.user_vehicle_assets uva ON vc.id = uva.catalog_id
  GROUP BY vc.id, vc.vehicle_id, vc.name
  ORDER BY vc.base_price ASC;
$$;
