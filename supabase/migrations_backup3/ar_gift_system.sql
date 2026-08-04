-- AR Face & Body Tracking Gift System - Database Migration
-- Adds AR gift items to gift_items table and creates AR-specific tables

-- =====================================================
-- 0. Add missing columns to gift_items if not present
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_items' AND column_name = 'rarity') THEN
    ALTER TABLE public.gift_items ADD COLUMN rarity TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_items' AND column_name = 'animation_key') THEN
    ALTER TABLE public.gift_items ADD COLUMN animation_key TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_items' AND column_name = 'duration') THEN
    ALTER TABLE public.gift_items ADD COLUMN duration INTEGER DEFAULT 15;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_items' AND column_name = 'is_active') THEN
    ALTER TABLE public.gift_items ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_items' AND column_name = 'updated_at') THEN
    ALTER TABLE public.gift_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- =====================================================
-- 1. AR Gift Settings Table (per-streamer preferences)
-- =====================================================
CREATE TABLE IF NOT EXISTS ar_gift_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  face_gifts_enabled BOOLEAN DEFAULT true,
  body_gifts_enabled BOOLEAN DEFAULT true,
  shoulder_gifts_enabled BOOLEAN DEFAULT true,
  legendary_gifts_enabled BOOLEAN DEFAULT true,
  max_active_gifts INTEGER DEFAULT 20,
  quality TEXT DEFAULT 'high' CHECK (quality IN ('low', 'medium', 'high', 'ultra')),
  smoothing REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- =====================================================
-- 2. AR Gift Ledger (tracks AR gift transactions)
-- =====================================================
CREATE TABLE IF NOT EXISTS ar_gift_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  stream_id UUID,
  battle_id UUID,
  gift_id TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  gift_category TEXT NOT NULL,
  tracking_point TEXT NOT NULL,
  amount INTEGER NOT NULL,
  duration_ms INTEGER DEFAULT 15000,
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '15 seconds',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ar_gift_ledger_stream ON ar_gift_ledger(stream_id);
CREATE INDEX IF NOT EXISTS idx_ar_gift_ledger_receiver ON ar_gift_ledger(receiver_id);
CREATE INDEX IF NOT EXISTS idx_ar_gift_ledger_active ON ar_gift_ledger(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_ar_gift_ledger_sender ON ar_gift_ledger(sender_id);

-- =====================================================
-- 3. Insert AR Gift Items into gift_items
-- =====================================================

-- Face Gifts
INSERT INTO gift_items (name, value, icon, gift_slug, animation_type, animation_key, category, rarity, description, is_active, duration)
VALUES
  ('AR Crown', 100, '👑', 'ar_crown', 'ar_face', 'ar_crown', 'AR Face Gifts', 'common', 'Gold crown appears on head with sparkle particles', true, 15),
  ('AR Sunglasses', 250, '🕶️', 'ar_sunglasses', 'ar_face', 'ar_sunglasses', 'AR Face Gifts', 'uncommon', 'Sunglasses lock to eyes with reflection effect', true, 15),
  ('AR Clown Nose', 500, '🔴', 'ar_clown_nose', 'ar_face', 'ar_clown_nose', 'AR Face Gifts', 'rare', 'Red nose attached to nose with bounce animation', true, 15),
  ('AR Troll Mask', 1000, '🎭', 'ar_troll_mask', 'ar_face', 'ar_troll_mask', 'AR Face Gifts', 'rare', 'Animated Mai Troll face mask overlay', true, 15),
  ('AR Halo', 2500, '😇', 'ar_halo', 'ar_face', 'ar_halo', 'AR Face Gifts', 'epic', 'Floating golden halo with light rays', true, 15)
ON CONFLICT (gift_slug) DO UPDATE SET
  value = EXCLUDED.value,
  icon = EXCLUDED.icon,
  animation_type = EXCLUDED.animation_type,
  animation_key = EXCLUDED.animation_key,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description,
  is_active = true,
  duration = EXCLUDED.duration,
  updated_at = now();

-- Body Gifts
INSERT INTO gift_items (name, value, icon, gift_slug, animation_type, animation_key, category, rarity, description, is_active, duration)
VALUES
  ('AR Royal Cape', 5000, '🦸', 'ar_royal_cape', 'ar_body', 'ar_royal_cape', 'AR Body Gifts', 'epic', 'Cape attached to shoulders with cloth physics', true, 15),
  ('AR Presidential Suit', 10000, '🤵', 'ar_presidential_suit', 'ar_body', 'ar_presidential_suit', 'AR Body Gifts', 'legendary', 'Executive suit overlay with purple and gold details', true, 15),
  ('AR Troll King Robe', 25000, '👘', 'ar_troll_king_robe', 'ar_body', 'ar_troll_king_robe', 'AR Body Gifts', 'legendary', 'Royal robe with gold crown and purple aura', true, 15),
  ('AR Angel Wings', 50000, '🪽', 'ar_angel_wings', 'ar_body', 'ar_angel_wings', 'AR Body Gifts', 'mythic', 'Large animated wings attached to shoulders', true, 15)
ON CONFLICT (gift_slug) DO UPDATE SET
  value = EXCLUDED.value,
  icon = EXCLUDED.icon,
  animation_type = EXCLUDED.animation_type,
  animation_key = EXCLUDED.animation_key,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description,
  is_active = true,
  duration = EXCLUDED.duration,
  updated_at = now();

-- Presidential AR Gifts
INSERT INTO gift_items (name, value, icon, gift_slug, animation_type, animation_key, category, rarity, description, is_active, duration)
VALUES
  ('AR Presidential Crown', 25000, '🏛️', 'ar_presidential_crown', 'ar_presidential', 'ar_presidential_crown', 'AR Presidential', 'legendary', 'Massive royal crown with purple gemstones', true, 15),
  ('AR Presidential Seal', 50000, '🦅', 'ar_presidential_seal', 'ar_presidential', 'ar_presidential_seal', 'AR Presidential', 'mythic', 'Presidential seal appears behind streamer', true, 15),
  ('AR President Motorcade', 250000, '🚗', 'ar_president_motorcade', 'ar_presidential', 'ar_president_motorcade', 'AR Presidential', 'mythic', 'Presidential limousine drives across stream', true, 20)
ON CONFLICT (gift_slug) DO UPDATE SET
  value = EXCLUDED.value,
  icon = EXCLUDED.icon,
  animation_type = EXCLUDED.animation_type,
  animation_key = EXCLUDED.animation_key,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description,
  is_active = true,
  duration = EXCLUDED.duration,
  updated_at = now();

-- Mai Troll AR Gifts
INSERT INTO gift_items (name, value, icon, gift_slug, animation_type, animation_key, category, rarity, description, is_active, duration)
VALUES
  ('AR Mini Troll', 1000, '🧌', 'ar_mini_troll', 'ar_troll', 'ar_mini_troll', 'AR Mai Troll', 'rare', 'Tiny Mai Troll mascot sits on shoulder', true, 15),
  ('AR Troll Army', 100000, '🎪', 'ar_troll_army', 'ar_troll', 'ar_troll_army', 'AR Mai Troll', 'mythic', 'Multiple troll mascots march across stream', true, 15),
  ('AR Mai Troll President', 1000000, '🏰', 'ar_troll_city_president', 'ar_legendary', 'ar_troll_city_president', 'AR Legendary', 'mythic', 'LEGENDARY: President Mansion, crown, helicopter, particle storm', true, 20)
ON CONFLICT (gift_slug) DO UPDATE SET
  value = EXCLUDED.value,
  icon = EXCLUDED.icon,
  animation_type = EXCLUDED.animation_type,
  animation_key = EXCLUDED.animation_key,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description,
  is_active = true,
  duration = EXCLUDED.duration,
  updated_at = now();

-- Shoulder Pets
INSERT INTO gift_items (name, value, icon, gift_slug, animation_type, animation_key, category, rarity, description, is_active, duration)
VALUES
  ('AR Falcon', 500, '🦅', 'ar_shoulder_falcon', 'ar_shoulder', 'ar_shoulder_falcon', 'AR Shoulder Pets', 'rare', 'Majestic falcon perches on shoulder', true, 15),
  ('AR Baby Dragon', 5000, '🐉', 'ar_shoulder_dragon', 'ar_shoulder', 'ar_shoulder_dragon', 'AR Shoulder Pets', 'epic', 'Tiny dragon perches on shoulder, breathes small flames', true, 15),
  ('AR Tiger Cub', 3000, '🐅', 'ar_shoulder_tiger', 'ar_shoulder', 'ar_shoulder_tiger', 'AR Shoulder Pets', 'epic', 'Fierce tiger cub sits on shoulder', true, 15)
ON CONFLICT (gift_slug) DO UPDATE SET
  value = EXCLUDED.value,
  icon = EXCLUDED.icon,
  animation_type = EXCLUDED.animation_type,
  animation_key = EXCLUDED.animation_key,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description,
  is_active = true,
  duration = EXCLUDED.duration,
  updated_at = now();

-- =====================================================
-- 4. RPC: Send AR Gift
-- =====================================================
CREATE OR REPLACE FUNCTION send_ar_gift(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID DEFAULT NULL,
  p_battle_id UUID DEFAULT NULL,
  p_gift_id TEXT DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_gift RECORD;
  v_total_cost INTEGER;
  v_sender_coins INTEGER;
  v_transaction_id UUID;
  v_duration_ms INTEGER;
BEGIN
  -- Get gift details
  SELECT * INTO v_gift FROM gift_items WHERE gift_slug = p_gift_id AND is_active = true;

  IF v_gift IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := COALESCE(v_gift.coin_cost, v_gift.value) * p_quantity;
  v_duration_ms := COALESCE(v_gift.duration, 15) * 1000;

  -- Check sender balance
  SELECT troll_coins INTO v_sender_coins FROM user_profiles WHERE id = p_sender_id;

  IF v_sender_coins < v_total_cost THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient coins');
  END IF;

  -- Deduct coins
  UPDATE user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = p_sender_id;

  -- Add coins to receiver
  UPDATE user_profiles SET troll_coins = troll_coins + v_total_cost WHERE id = p_receiver_id;

  -- Generate transaction ID
  v_transaction_id := gen_random_uuid();

  -- Record in AR gift ledger
  INSERT INTO ar_gift_ledger (
    transaction_id, sender_id, receiver_id, stream_id, battle_id,
    gift_id, gift_name, gift_category, tracking_point, amount, duration_ms,
    is_active, activated_at, expires_at
  ) VALUES (
    v_transaction_id, p_sender_id, p_receiver_id, p_stream_id, p_battle_id,
    v_gift.gift_slug, v_gift.name, v_gift.category,
    CASE
      WHEN v_gift.animation_type = 'ar_face' THEN 'face'
      WHEN v_gift.animation_type = 'ar_body' THEN 'body'
      WHEN v_gift.animation_type = 'ar_presidential' THEN 'presidential'
      WHEN v_gift.animation_type = 'ar_troll' THEN 'troll_city'
      WHEN v_gift.animation_type = 'ar_shoulder' THEN 'shoulder'
      WHEN v_gift.animation_type = 'ar_legendary' THEN 'legendary'
      ELSE 'face'
    END,
    v_total_cost, v_duration_ms,
    true, now(), now() + (v_duration_ms || ' milliseconds')::INTERVAL
  );

  -- Also record in existing gift_ledger for compatibility
  INSERT INTO gift_ledger (
    transaction_id, sender_id, receiver_id, stream_id, gift_id, amount, currency_used, status
  ) VALUES (
    v_transaction_id, p_sender_id, p_receiver_id, p_stream_id, v_gift.id, v_total_cost, 'troll_coins', 'processed'
  );

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'gift_value', v_total_cost,
    'duration_ms', v_duration_ms
  );
END;
$$;

-- =====================================================
-- 5. RPC: Get Active AR Gifts for a stream
-- =====================================================
CREATE OR REPLACE FUNCTION get_active_ar_gifts(p_stream_id UUID)
RETURNS TABLE (
  id UUID,
  gift_id TEXT,
  gift_name TEXT,
  gift_category TEXT,
  tracking_point TEXT,
  sender_id UUID,
  amount INTEGER,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
AS $$
  SELECT
    agl.id,
    agl.gift_id,
    agl.gift_name,
    agl.gift_category,
    agl.tracking_point,
    agl.sender_id,
    agl.amount,
    agl.activated_at,
    agl.expires_at
  FROM ar_gift_ledger agl
  WHERE agl.stream_id = p_stream_id
    AND agl.is_active = true
    AND agl.expires_at > now()
  ORDER BY agl.activated_at DESC;
$$;

-- =====================================================
-- 6. RPC: Expire old AR gifts (call periodically)
-- =====================================================
CREATE OR REPLACE FUNCTION expire_ar_gifts()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE ar_gift_ledger
  SET is_active = false
  WHERE is_active = true AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =====================================================
-- 7. RLS Policies
-- =====================================================
ALTER TABLE ar_gift_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_gift_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AR settings"
  ON ar_gift_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view AR gift ledger"
  ON ar_gift_ledger FOR SELECT
  USING (true);

CREATE POLICY "System can insert AR gift ledger"
  ON ar_gift_ledger FOR INSERT
  WITH CHECK (true);
