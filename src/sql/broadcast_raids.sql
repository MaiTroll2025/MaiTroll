-- ============================================================
-- Broadcast Raid + Blocker System
-- ============================================================

-- 1. Add blockers column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS blockers INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_blocker_grant_at TIMESTAMPTZ;

-- 2. Create broadcast_raids table
CREATE TABLE IF NOT EXISTS broadcast_raids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  raider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id TEXT NOT NULL,
  coins_spent INTEGER NOT NULL DEFAULT 25,
  blocked BOOLEAN DEFAULT FALSE,
  blocked_by_blocker BOOLEAN DEFAULT FALSE,
  remaining_blockers INTEGER DEFAULT 0,
  coins_recipient UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  repaired BOOLEAN DEFAULT FALSE,
  repaired_at TIMESTAMPTZ,
  raided_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_raids_broadcaster ON broadcast_raids(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_raids_stream ON broadcast_raids(stream_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_raids_raider ON broadcast_raids(raider_id);

-- Enable RLS
ALTER TABLE broadcast_raids ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view broadcast raids" ON broadcast_raids FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert broadcast raids" ON broadcast_raids FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Broadcasters can update own raids" ON broadcast_raids FOR UPDATE USING (broadcaster_id = auth.uid());

-- 3. RPCs

-- Grant daily blockers (5 per 24h, minimum guarantee)
CREATE OR REPLACE FUNCTION grant_daily_blockers(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_last_grant TIMESTAMPTZ;
  v_blockers INTEGER := 0;
BEGIN
  SELECT last_blocker_grant_at, blockers INTO v_last_grant
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_last_grant IS NULL OR v_last_grant < NOW() - INTERVAL '24 hours' THEN
    v_blockers := 5;
    UPDATE user_profiles
    SET blockers = COALESCE(blockers, 0) + 5,
        last_blocker_grant_at = NOW()
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'blockers_granted', v_blockers,
    'total_blockers', (SELECT blockers FROM user_profiles WHERE id = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Raid broadcast
CREATE OR REPLACE FUNCTION raid_broadcast(
  p_broadcaster_id UUID,
  p_raider_id UUID,
  p_stream_id TEXT,
  p_coins_spent INTEGER DEFAULT 25
)
RETURNS JSONB AS $$
DECLARE
  v_broadcaster_blockers INTEGER;
  v_blocked BOOLEAN := FALSE;
  v_recipient_id UUID;
  v_raider_coins INTEGER;
BEGIN
  -- Check broadcaster blockers
  SELECT blockers INTO v_broadcaster_blockers
  FROM user_profiles
  WHERE id = p_broadcaster_id;

  IF v_broadcaster_blockers IS NULL THEN
    v_broadcaster_blockers := 0;
  END IF;

  -- Determine if blocked
  IF v_broadcaster_blockers >= 5 THEN
    v_blocked := TRUE;
    v_recipient_id := p_broadcaster_id;
    
    -- Consume one blocker from broadcaster
    UPDATE user_profiles
    SET blockers = GREATEST(0, blockers - 1)
    WHERE id = p_broadcaster_id;
  ELSE
    v_blocked := FALSE;
    v_recipient_id := p_broadcaster_id;
  END IF;

  -- Spend coins from raider
  UPDATE user_profiles
  SET hype_coins = GREATEST(0, hype_coins - p_coins_spent)
  WHERE id = p_raider_id
  RETURNING hype_coins INTO v_raider_coins;

  IF v_raider_coins IS NULL THEN
    RAISE EXCEPTION 'Raider not found or insufficient coins';
  END IF;

  IF v_raider_coins < 0 THEN
    RAISE EXCEPTION 'Insufficient coins for raid';
  END IF;

  -- Give coins to broadcaster
  UPDATE user_profiles
  SET hype_coins = hype_coins + p_coins_spent
  WHERE id = v_recipient_id;

  -- Record raid
  INSERT INTO broadcast_raids (
    broadcaster_id,
    raider_id,
    stream_id,
    coins_spent,
    blocked,
    blocked_by_blocker,
    remaining_blockers,
    coins_recipient_id,
    repaired
  ) VALUES (
    p_broadcaster_id,
    p_raider_id,
    p_stream_id,
    p_coins_spent,
    v_blocked,
    v_blocked,
    GREATEST(0, v_broadcaster_blockers - 1),
    v_recipient_id,
    FALSE
  );

  RETURN jsonb_build_object(
    'success', true,
    'blocked', v_blocked,
    'remaining_blockers', GREATEST(0, v_broadcaster_blockers - 1),
    'coins_spent', p_coins_spent
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Repair broadcast
CREATE OR REPLACE FUNCTION repair_broadcast(
  p_broadcast_id UUID,
  p_repairer_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_raid RECORD;
  v_repair_cost INTEGER := 25;
  v_repairer_coins INTEGER;
BEGIN
  -- Find the most recent un-repaired raid for this broadcast
  SELECT * INTO v_raid
  FROM broadcast_raids
  WHERE id = p_broadcast_id
    AND repaired = FALSE
  ORDER BY raided_at DESC
  LIMIT 1;

  IF v_raid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active raid found');
  END IF;

  -- Spend coins from repairer
  UPDATE user_profiles
  SET hype_coins = GREATEST(0, hype_coins - v_repair_cost)
  WHERE id = p_repairer_id
  RETURNING hype_coins INTO v_repairer_coins;

  IF v_repairer_coins IS NULL OR v_repairer_coins < 0 THEN
    RAISE EXCEPTION 'Insufficient coins for repair';
  END IF;

  -- Give coins to broadcaster
  UPDATE user_profiles
  SET hype_coins = hype_coins + v_repair_cost
  WHERE id = v_raid.broadcaster_id;

  -- Mark as repaired
  UPDATE broadcast_raids
  SET repaired = TRUE,
      repaired_at = NOW()
  WHERE id = p_broadcast_id;

  RETURN jsonb_build_object(
    'success', true,
    'coins_spent', v_repair_cost,
    'message', 'Broadcast repaired!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_raids;
