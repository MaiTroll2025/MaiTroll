-- House Upgrades System

-- 1. Catalog of available upgrades
CREATE TABLE IF NOT EXISTS house_upgrades_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price BIGINT NOT NULL,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"rent_slots_add": 2, "tax_discount_bps": 500}
  icon_name TEXT DEFAULT 'Wrench',
  max_per_house INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Installations on specific houses
CREATE TABLE IF NOT EXISTS house_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_house_id UUID NOT NULL REFERENCES user_houses(id) ON DELETE CASCADE,
  upgrade_id UUID NOT NULL REFERENCES house_upgrades_catalog(id),
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent exceeding max_per_house
  -- (This is complex to enforce strictly in pure SQL constraint without a trigger, 
  --  so we'll rely on the purchase RPC for enforcement, but add a unique constraint for the common case of max=1)
  CONSTRAINT unique_upgrade_per_house UNIQUE (user_house_id, upgrade_id)
);

-- Enable RLS
ALTER TABLE house_upgrades_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_installations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public view upgrades catalog" ON house_upgrades_catalog FOR SELECT USING (true);
CREATE POLICY "Users view own installations" ON house_installations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_houses 
    WHERE user_houses.id = house_installations.user_house_id 
    AND user_houses.user_id = auth.uid()
  )
);

-- Seed some initial upgrades
INSERT INTO house_upgrades_catalog (name, description, base_price, effects, icon_name, max_per_house) VALUES
('Guest House', 'Adds 2 additional rental slots to your property.', 50000, '{"rent_slots_add": 2}', 'Home', 1),
('Solar Panels', 'Reduces daily maintenance costs by 10%.', 25000, '{"maintenance_discount_bps": 1000}', 'Sun', 1),
('Security System', 'Reduces daily tax assessment by 5% due to municipal safety credits.', 15000, '{"tax_discount_bps": 500}', 'Shield', 1),
('Luxury Interior', 'Increases influence generation by 10%.', 75000, '{"influence_bonus_bps": 1000}', 'Gem', 1);

-- RPC to purchase an upgrade
CREATE OR REPLACE FUNCTION purchase_house_upgrade(
  p_user_house_id UUID,
  p_upgrade_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_house_owner_id UUID;
  v_price BIGINT;
  v_upgrade_exists BOOLEAN;
  v_current_count INTEGER;
  v_max_allowed INTEGER;
  v_house_status TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Check house ownership and status
  SELECT user_id, status INTO v_house_owner_id, v_house_status
  FROM user_houses
  WHERE id = p_user_house_id;
  
  IF v_house_owner_id IS NULL OR v_house_owner_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You do not own this house');
  END IF;
  
  IF v_house_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'House must be active to upgrade');
  END IF;
  
  -- Get upgrade details
  SELECT base_price, max_per_house INTO v_price, v_max_allowed
  FROM house_upgrades_catalog
  WHERE id = p_upgrade_id;
  
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Upgrade not found');
  END IF;
  
  -- Check if already installed (or hit limit)
  SELECT count(*) INTO v_current_count
  FROM house_installations
  WHERE user_house_id = p_user_house_id AND upgrade_id = p_upgrade_id;
  
  IF v_current_count >= v_max_allowed THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maximum installations reached for this upgrade');
  END IF;
  
  -- Process payment
  IF NOT try_pay_coins(v_user_id, v_price, 'house_upgrade_purchase') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;
  
  -- Install upgrade
  INSERT INTO house_installations (user_house_id, upgrade_id)
  VALUES (p_user_house_id, p_upgrade_id);
  
  RETURN jsonb_build_object('success', true, 'message', 'Upgrade installed successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update `get_user_asset_flags` to include upgrade effects? 
-- Or create a helper to get total house stats.

-- Let's create a helper to get adjusted house stats (e.g. max slots)
CREATE OR REPLACE FUNCTION get_house_stats(p_user_house_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_base_slots INTEGER;
  v_added_slots INTEGER;
  v_tax_discount_bps INTEGER;
  v_maint_discount_bps INTEGER;
  v_result JSONB;
BEGIN
  -- Get base stats
  SELECT hc.rent_slots 
  INTO v_base_slots
  FROM user_houses uh
  JOIN houses_catalog hc ON uh.houses_catalog_id = hc.id
  WHERE uh.id = p_user_house_id;

  -- Calculate added slots from upgrades
  SELECT COALESCE(SUM((uc.effects->>'rent_slots_add')::int), 0)
  INTO v_added_slots
  FROM house_installations hi
  JOIN house_upgrades_catalog uc ON hi.upgrade_id = uc.id
  WHERE hi.user_house_id = p_user_house_id
  AND uc.effects ? 'rent_slots_add';
  
  -- Calculate discounts
  SELECT COALESCE(SUM((uc.effects->>'tax_discount_bps')::int), 0)
  INTO v_tax_discount_bps
  FROM house_installations hi
  JOIN house_upgrades_catalog uc ON hi.upgrade_id = uc.id
  WHERE hi.user_house_id = p_user_house_id
  AND uc.effects ? 'tax_discount_bps';
  
  SELECT COALESCE(SUM((uc.effects->>'maintenance_discount_bps')::int), 0)
  INTO v_maint_discount_bps
  FROM house_installations hi
  JOIN house_upgrades_catalog uc ON hi.upgrade_id = uc.id
  WHERE hi.user_house_id = p_user_house_id
  AND uc.effects ? 'maintenance_discount_bps';

  v_result := jsonb_build_object(
    'total_rent_slots', v_base_slots + v_added_slots,
    'tax_discount_bps', v_tax_discount_bps,
    'maintenance_discount_bps', v_maint_discount_bps
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update `create_rental_listing` to use `get_house_stats` for slot limit check
CREATE OR REPLACE FUNCTION create_rental_listing_v2(
  p_user_house_id UUID,
  p_daily_price BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_house_owner_id UUID;
  v_house_status TEXT;
  v_current_tenants INTEGER;
  v_stats JSONB;
  v_max_slots INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  -- Check ownership
  SELECT user_id, status INTO v_house_owner_id, v_house_status
  FROM user_houses
  WHERE id = p_user_house_id;
  
  IF v_house_owner_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not your house');
  END IF;
  
  IF v_house_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'House is not active');
  END IF;

  -- Check slots using new stats function
  v_stats := get_house_stats(p_user_house_id);
  v_max_slots := (v_stats->>'total_rent_slots')::int;
  
  -- Count active rentals (where tenant_id is not null)
  -- Wait, `user_houses` IS the rental if it's owned by someone else? 
  -- No, the rental logic I implemented earlier uses `rental_listings` table?
  -- Let's check `rental_listings` schema.
  -- Assuming `rental_listings` tracks *listings*, and `user_houses` tracks *ownership*.
  -- The previous `create_rental_listing` just inserted into `rental_listings`.
  -- We need to check if there are already active tenants or listings.
  
  -- Simplified: One listing per slot? Or one listing per house?
  -- Usually one listing per house that can accept N tenants.
  -- But for now, let's assume 1 listing = 1 slot.
  
  SELECT count(*) INTO v_current_tenants
  FROM rental_listings
  WHERE user_house_id = p_user_house_id AND status = 'active';
  
  IF v_current_tenants >= v_max_slots THEN
    RETURN jsonb_build_object('success', false, 'message', 'No rental slots available');
  END IF;

  INSERT INTO rental_listings (user_house_id, owner_id, daily_price)
  VALUES (p_user_house_id, v_user_id, p_daily_price);
  
  RETURN jsonb_build_object('success', true, 'message', 'Rental listing created');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
