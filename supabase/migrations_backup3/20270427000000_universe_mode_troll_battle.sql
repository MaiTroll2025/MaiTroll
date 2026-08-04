-- ============================================================================
-- UNIVERSE MODE: TROLL BATTLE PARTICIPANTS TABLE & FUNCTIONS
-- ============================================================================
-- Migration for 4v4 Troll Battle system with real-time scoring

-- 1. Battle Participants Table (For Universe Mode Troll Battles)
CREATE TABLE IF NOT EXISTS public.troll_battle_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Battle Reference
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Team Assignment
  team TEXT NOT NULL CHECK (team IN ('A', 'B')),
  seat_index INTEGER NOT NULL CHECK (seat_index >= 1 AND seat_index <= 4),
  
  -- LiveKit Integration
  livekit_identity TEXT UNIQUE,
  
  -- Scoring & Status
  coins_earned INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(stream_id, team, seat_index),
  UNIQUE(stream_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_troll_battle_participants_stream_id ON public.troll_battle_participants(stream_id);
CREATE INDEX IF NOT EXISTS idx_troll_battle_participants_user_id ON public.troll_battle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_battle_participants_team ON public.troll_battle_participants(stream_id, team);

-- RLS Policies
ALTER TABLE public.troll_battle_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view battle participants" ON public.troll_battle_participants
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join battle" ON public.troll_battle_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation" ON public.troll_battle_participants
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM public.streams WHERE id = stream_id
  ));

-- ============================================================================
-- 2. REWARDS FUNCTIONS
-- ============================================================================

-- Award crowns to winners
CREATE OR REPLACE FUNCTION public.award_battle_crowns(
  p_user_id UUID,
  p_crown_amount INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_crowns INTEGER;
BEGIN
  UPDATE public.user_profiles
  SET battle_crowns = COALESCE(battle_crowns, 0) + p_crown_amount,
      battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1,
      total_battle_wins = COALESCE(total_battle_wins, 0) + 1,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING battle_crowns INTO v_new_crowns;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_crowns', v_new_crowns,
    'crown_gain', p_crown_amount
  );
END;
$$;

-- Award bonus coins to participants
CREATE OR REPLACE FUNCTION public.award_battle_bonus_coins(
  p_user_id UUID,
  p_base_coins INTEGER,
  p_bonus_percentage NUMERIC DEFAULT 2.0,
  p_battle_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bonus_amount INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Calculate bonus (e.g., 2% of earned coins)
  v_bonus_amount := FLOOR(p_base_coins * (p_bonus_percentage / 100.0))::INTEGER;

  IF v_bonus_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'bonus_amount', 0,
      'note', 'Base coins too low for bonus'
    );
  END IF;

  -- Insert transaction record
  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    v_bonus_amount,
    'battle_bonus',
    jsonb_build_object(
      'battle_id', p_battle_id,
      'bonus_percentage', p_bonus_percentage,
      'base_coins', p_base_coins
    ),
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Update user coin balance (if coin_balance column exists)
  UPDATE public.user_profiles
  SET paid_coins = COALESCE(paid_coins, 0) + v_bonus_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_bonus_amount,
    'transaction_id', v_transaction_id,
    'bonus_percentage', p_bonus_percentage
  );
END;
$$;

-- Award all rewards (crowns + bonus coins) to winner
CREATE OR REPLACE FUNCTION public.award_battle_winner_rewards(
  p_user_id UUID,
  p_earned_coins INTEGER,
  p_battle_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_crowns_result JSONB;
  v_bonus_result JSONB;
BEGIN
  -- Award crowns
  SELECT public.award_battle_crowns(p_user_id, 2) INTO v_crowns_result;

  -- Award bonus coins (2%)
  SELECT public.award_battle_bonus_coins(p_user_id, p_earned_coins, 2.0, p_battle_id)
    INTO v_bonus_result;

  RETURN jsonb_build_object(
    'success', true,
    'crowns_awarded', v_crowns_result,
    'bonus_coins_awarded', v_bonus_result
  );
END;
$$;

-- ============================================================================
-- 3. ANTI-ABUSE VALIDATION
-- ============================================================================

-- Check if rewards should be granted (>= 1000 coins OR >= 3 unique gifters)
CREATE OR REPLACE FUNCTION public.is_eligible_for_battle_rewards(
  p_stream_id UUID,
  p_team TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_total_coins INTEGER;
  v_unique_gifters INTEGER;
BEGIN
  -- Sum coins earned by winning team
  SELECT COALESCE(SUM(coins_earned), 0)
  INTO v_team_total_coins
  FROM public.troll_battle_participants
  WHERE stream_id = p_stream_id AND team = p_team;

  -- Count unique gifters for this team in this battle stream
  SELECT COUNT(DISTINCT sender_id)
  INTO v_unique_gifters
  FROM public.stream_gifts
  WHERE stream_id = p_stream_id
    AND sender_id IN (
      SELECT user_id
      FROM public.troll_battle_participants
      WHERE stream_id = p_stream_id AND team = p_team
    );

  -- Eligible if:
  -- - Total coins >= 1000 OR
  -- - Unique gifters >= 3
  RETURN v_team_total_coins >= 1000 OR v_unique_gifters >= 3;
END;
$$;

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Get battle participant by stream and user
CREATE OR REPLACE FUNCTION public.get_battle_participant(
  p_stream_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  team TEXT,
  seat_index INTEGER,
  coins_earned INTEGER,
  is_active BOOLEAN,
  livekit_identity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    troll_battle_participants.id,
    troll_battle_participants.team,
    troll_battle_participants.seat_index,
    troll_battle_participants.coins_earned,
    troll_battle_participants.is_active,
    troll_battle_participants.livekit_identity
  FROM public.troll_battle_participants
  WHERE stream_id = p_stream_id AND user_id = p_user_id
  LIMIT 1;
END;
$$;

-- Get all participants for a stream sorted by team and seat
CREATE OR REPLACE FUNCTION public.get_battle_participants(p_stream_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  team TEXT,
  seat_index INTEGER,
  coins_earned INTEGER,
  is_active BOOLEAN,
  livekit_identity TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    up.username,
    p.team,
    p.seat_index,
    p.coins_earned,
    p.is_active,
    p.livekit_identity,
    up.avatar_url
  FROM public.troll_battle_participants p
  JOIN public.user_profiles up ON p.user_id = up.id
  WHERE p.stream_id = p_stream_id
  ORDER BY p.team, p.seat_index;
END;
$$;

-- Update participant coins earned
CREATE OR REPLACE FUNCTION public.update_participant_coins(
  p_participant_id UUID,
  p_coins_earned INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.troll_battle_participants
  SET coins_earned = p_coins_earned,
      updated_at = NOW()
  WHERE id = p_participant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Participant not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'participant_id', p_participant_id);
END;
$$;

-- Mark participant as inactive (left battle)
CREATE OR REPLACE FUNCTION public.leave_battle(
  p_participant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.troll_battle_participants
  SET is_active = false,
      left_at = NOW(),
      updated_at = NOW()
  WHERE id = p_participant_id AND auth.uid() = user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Participant not found or unauthorized');
  END IF;

  RETURN jsonb_build_object('success', true, 'participant_id', p_participant_id);
END;
$$;

-- ============================================================================
-- 5. CLEANUP PROCEDURES
-- ============================================================================

-- Auto-cleanup old battle data (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_battles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark participants as inactive if stream ended > 30 days ago
  UPDATE public.troll_battle_participants
  SET is_active = false
  WHERE stream_id IN (
    SELECT id FROM public.streams
    WHERE ended_at < NOW() - INTERVAL '30 days'
      AND status = 'ended'
  );

  -- Could delete old records here if needed:
  -- DELETE FROM public.troll_battle_participants
  -- WHERE stream_id IN (
  --   SELECT id FROM public.streams WHERE ended_at < NOW() - INTERVAL '90 days'
  -- );
END;
$$;

-- ============================================================================
-- COMMIT
-- ============================================================================
-- This migration creates the foundation for Universe Mode Troll Battles
-- Includes: participant tracking, rewards system, anti-abuse checks, helpers
