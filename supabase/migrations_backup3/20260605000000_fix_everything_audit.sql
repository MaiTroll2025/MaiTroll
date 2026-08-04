-- 1. Create vehicle_listings
CREATE TABLE IF NOT EXISTS vehicle_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES user_profiles(id),
  vehicle_id INTEGER NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'auction')),
  price INTEGER NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vehicle_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view active listings" ON vehicle_listings FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create listings" ON vehicle_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Sellers can update their listings" ON vehicle_listings FOR UPDATE USING (auth.uid() = seller_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create vehicle_upgrades
CREATE TABLE IF NOT EXISTS vehicle_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  vehicle_id INTEGER NOT NULL,
  upgrade_type TEXT NOT NULL,
  cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed',
  tasks_required_total INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vehicle_upgrades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own upgrades" ON vehicle_upgrades FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own upgrades" ON vehicle_upgrades FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Alter troll_court_cases
DO $$ BEGIN
  ALTER TABLE troll_court_cases ADD COLUMN category TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE troll_court_cases ADD COLUMN evidence_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE troll_court_cases ADD COLUMN claim_amount INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 4. Create RPC
CREATE OR REPLACE FUNCTION file_civil_lawsuit(
  p_defendant_id UUID,
  p_category TEXT,
  p_description TEXT,
  p_evidence_url TEXT,
  p_claim_amount INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_case_id UUID;
BEGIN
  INSERT INTO troll_court_cases (
    plaintiff_id,
    defendant_id,
    category,
    accusation, -- mapping description to accusation
    evidence_url,
    claim_amount,
    status,
    created_at
  ) VALUES (
    auth.uid(),
    p_defendant_id,
    p_category,
    p_description,
    p_evidence_url,
    p_claim_amount,
    'pending',
    NOW()
  ) RETURNING id INTO v_case_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$func$;

-- 5. Vehicle auction bids table
CREATE TABLE IF NOT EXISTS vehicle_auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES vehicle_listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES user_profiles(id),
  bid_amount INTEGER NOT NULL CHECK (bid_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vehicle_auction_bids ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view bids they are involved in" ON vehicle_auction_bids
  FOR SELECT USING (
    auth.uid() = bidder_id
    OR auth.uid() IN (SELECT seller_id FROM vehicle_listings WHERE id = listing_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can place bids" ON vehicle_auction_bids
  FOR INSERT WITH CHECK (auth.uid() = bidder_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Auction engine: place bid RPC
CREATE OR REPLACE FUNCTION place_vehicle_bid(
  p_listing_id UUID,
  p_bid_amount INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_listing vehicle_listings%ROWTYPE;
  v_highest_bid INTEGER;
  v_user user_profiles%ROWTYPE;
BEGIN
  IF p_bid_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bid amount must be positive');
  END IF;

  SELECT *
  INTO v_listing
  FROM vehicle_listings
  WHERE id = p_listing_id
    AND listing_type = 'auction'
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Auction not found or not active');
  END IF;

  IF v_listing.seller_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sellers cannot bid on their own auctions');
  END IF;

  SELECT COALESCE(MAX(bid_amount), v_listing.price)
  INTO v_highest_bid
  FROM vehicle_auction_bids
  WHERE listing_id = p_listing_id;

  IF p_bid_amount <= v_highest_bid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bid must be higher than current price');
  END IF;

  SELECT *
  INTO v_user
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
  END IF;

  IF v_user.troll_coins IS NOT NULL AND v_user.troll_coins < p_bid_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient TrollCoins for this bid');
  END IF;

  INSERT INTO vehicle_auction_bids (listing_id, bidder_id, bid_amount)
  VALUES (p_listing_id, auth.uid(), p_bid_amount);

  SELECT COALESCE(MAX(bid_amount), v_listing.price)
  INTO v_highest_bid
  FROM vehicle_auction_bids
  WHERE listing_id = p_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'highest_bid', v_highest_bid
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$func$;

-- 7. Trolls Town parcels and houses
CREATE TABLE IF NOT EXISTS town_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_x NUMERIC NOT NULL,
  center_z NUMERIC NOT NULL,
  size_x NUMERIC NOT NULL DEFAULT 12,
  size_z NUMERIC NOT NULL DEFAULT 12,
  parcel_type TEXT NOT NULL DEFAULT 'residential',
  building_style TEXT DEFAULT 'house',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE town_parcels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view town parcels" ON town_parcels FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS town_houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES user_profiles(id),
  parcel_id UUID NOT NULL REFERENCES town_parcels(id) ON DELETE CASCADE,
  position_x NUMERIC NOT NULL,
  position_z NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE town_houses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view town houses" ON town_houses FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert houses" ON town_houses
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update houses" ON town_houses
  FOR UPDATE USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS town_player_state (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  position_x NUMERIC NOT NULL,
  position_z NUMERIC NOT NULL,
  rotation_y NUMERIC NOT NULL,
  vehicle TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE town_player_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view town player state" ON town_player_state
  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own player state" ON town_player_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own player state" ON town_player_state
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS town_raids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raider_user_id UUID NOT NULL REFERENCES user_profiles(id),
  target_house_id UUID NOT NULL REFERENCES town_houses(id) ON DELETE CASCADE,
  outcome TEXT,
  loot INTEGER,
  heat_delta INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE town_raids ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their raids" ON town_raids
  FOR SELECT USING (
    auth.uid() = raider_user_id
    OR auth.uid() IN (SELECT owner_user_id FROM town_houses WHERE id = target_house_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own raids" ON town_raids
  FOR INSERT WITH CHECK (auth.uid() = raider_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. Trolls Town RPCs
CREATE OR REPLACE FUNCTION get_town_houses()
RETURNS TABLE (
  id UUID,
  owner_user_id UUID,
  parcel_id UUID,
  position_x NUMERIC,
  position_z NUMERIC,
  metadata JSONB,
  parcel_center_x NUMERIC,
  parcel_center_z NUMERIC,
  parcel_size_x NUMERIC,
  parcel_size_z NUMERIC,
  parcel_building_style TEXT,
  owner_username TEXT,
  is_own BOOLEAN,
  last_raid_at TIMESTAMPTZ,
  last_raid_outcome TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_house town_houses%ROWTYPE;
  v_parcel town_parcels%ROWTYPE;
  v_house_count INTEGER;
  v_row INTEGER;
  v_col INTEGER;
  v_spacing NUMERIC := 40;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_house
  FROM town_houses
  WHERE owner_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT COUNT(*) INTO v_house_count FROM town_houses;

    v_row := v_house_count / 10;
    v_col := v_house_count % 10;

    INSERT INTO town_parcels (center_x, center_z, size_x, size_z, parcel_type)
    VALUES (
      (v_col - 5) * v_spacing,
      (v_row - 5) * v_spacing,
      12,
      12,
      'residential'
    )
    RETURNING * INTO v_parcel;

    INSERT INTO town_houses (owner_user_id, parcel_id, position_x, position_z, metadata)
    VALUES (
      auth.uid(),
      v_parcel.id,
      v_parcel.center_x,
      v_parcel.center_z,
      jsonb_build_object(
        'level', 1,
        'defense_rating', 1.0
      )
    )
    RETURNING * INTO v_house;
  ELSE
    SELECT *
    INTO v_parcel
    FROM town_parcels
    WHERE id = v_house.parcel_id;
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.owner_user_id,
    h.parcel_id,
    h.position_x,
    h.position_z,
    h.metadata,
    p.center_x AS parcel_center_x,
    p.center_z AS parcel_center_z,
    p.size_x AS parcel_size_x,
    p.size_z AS parcel_size_z,
    p.building_style AS parcel_building_style,
    up.username AS owner_username,
    h.owner_user_id = auth.uid() AS is_own,
    r.created_at AS last_raid_at,
    r.outcome AS last_raid_outcome
  FROM town_houses h
  JOIN town_parcels p ON p.id = h.parcel_id
  LEFT JOIN user_profiles up ON up.id = h.owner_user_id
  LEFT JOIN LATERAL (
    SELECT r2.*
    FROM town_raids r2
    WHERE r2.target_house_id = h.id
    ORDER BY r2.created_at DESC
    LIMIT 1
  ) r ON TRUE;
END;
$func$;

CREATE OR REPLACE FUNCTION update_player_state(
  p_position_x NUMERIC,
  p_position_z NUMERIC,
  p_rotation_y NUMERIC,
  p_vehicle TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO town_player_state (user_id, position_x, position_z, rotation_y, vehicle, updated_at)
  VALUES (auth.uid(), p_position_x, p_position_z, p_rotation_y, p_vehicle, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET position_x = EXCLUDED.position_x,
        position_z = EXCLUDED.position_z,
        rotation_y = EXCLUDED.rotation_y,
        vehicle = EXCLUDED.vehicle,
        updated_at = EXCLUDED.updated_at;
END;
$func$;

CREATE OR REPLACE FUNCTION start_raid(
  p_target_house_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_house town_houses%ROWTYPE;
  v_raid_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT *
  INTO v_house
  FROM town_houses
  WHERE id = p_target_house_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target house not found');
  END IF;

  IF v_house.owner_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot raid your own house');
  END IF;

  INSERT INTO town_raids (raider_user_id, target_house_id)
  VALUES (auth.uid(), p_target_house_id)
  RETURNING id INTO v_raid_id;

  RETURN jsonb_build_object(
    'success', true,
    'raid_id', v_raid_id,
    'duration_seconds', 30
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$func$;

CREATE OR REPLACE FUNCTION finish_raid(
  p_raid_id UUID,
  p_outcome TEXT,
  p_loot INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_raid town_raids%ROWTYPE;
  v_new_balance INTEGER;
  v_heat_delta INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT *
  INTO v_raid
  FROM town_raids
  WHERE id = p_raid_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Raid not found');
  END IF;

  IF v_raid.raider_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot finish raid you do not own');
  END IF;

  IF v_raid.outcome IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Raid already completed');
  END IF;

  IF p_outcome NOT IN ('success', 'failure') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid outcome');
  END IF;

  IF p_outcome = 'success' AND p_loot > 0 THEN
    UPDATE user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + p_loot
    WHERE id = auth.uid()
    RETURNING troll_coins INTO v_new_balance;
  ELSE
    SELECT troll_coins
    INTO v_new_balance
    FROM user_profiles
    WHERE id = auth.uid();

    v_heat_delta := 1;
  END IF;

  UPDATE town_raids
  SET outcome = p_outcome,
      loot = GREATEST(p_loot, 0),
      heat_delta = v_heat_delta,
      completed_at = NOW()
  WHERE id = p_raid_id;

  RETURN jsonb_build_object(
    'success', true,
    'outcome', p_outcome,
    'loot', GREATEST(p_loot, 0),
    'new_balance', v_new_balance,
    'heat_delta', v_heat_delta
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$func$;
