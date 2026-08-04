-- Hype Coins System Migration
-- Adds watch-time earning currency system for viewers
-- Created: May 19, 2026
-- Fixed: May 20, 2026 - Added proper daily cap handling with partial awards and row-level locking

-- ============================================================================
-- 1. ADD HYPE_COINS COLUMN TO USER_PROFILES
-- ============================================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS hype_coins integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_hype_coins_nonnegative'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_hype_coins_nonnegative
    CHECK (hype_coins >= 0);
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE HYPE_COIN_LEDGER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hype_coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id uuid,
  broadcaster_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_user_id ON public.hype_coin_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_stream_id ON public.hype_coin_ledger(stream_id);
CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_broadcaster_id ON public.hype_coin_ledger(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_created_at ON public.hype_coin_ledger(created_at);

-- Enable RLS on hype_coin_ledger
ALTER TABLE public.hype_coin_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own hype coin ledger rows
CREATE POLICY "hype_coin_ledger_user_read" ON public.hype_coin_ledger
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- RLS Policy: Prevent normal users from inserting/updating/deleting
-- (Only RPC functions can modify ledger)
CREATE POLICY "hype_coin_ledger_prevent_direct_modify" ON public.hype_coin_ledger
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "hype_coin_ledger_prevent_direct_update" ON public.hype_coin_ledger
  FOR UPDATE
  USING (false);

CREATE POLICY "hype_coin_ledger_prevent_direct_delete" ON public.hype_coin_ledger
  FOR DELETE
  USING (false);

-- ============================================================================
-- 3. RPC: EARN_HYPE_COIN_WATCH_REWARD
-- ============================================================================

CREATE OR REPLACE FUNCTION public.earn_hype_coin_watch_reward(p_stream_id uuid)
RETURNS TABLE(
  success boolean,
  hype_coins bigint,
  earned_amount integer,
  daily_earned integer,
  daily_cap integer,
  weekly_earned integer,
  weekly_cap integer,
  message text
) AS $$
DECLARE
  v_user_id uuid;
  v_stream record;
  v_daily_earned integer;
  v_weekly_earned integer;
  v_last_award_time timestamptz;
  v_current_user_hype integer;
  v_earning_window_start timestamptz;
  v_error_msg text;
  v_attempted_amount integer := 1;
  v_awarded_amount integer;
  v_remaining_allowance integer;
BEGIN
  -- 1. Check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Not authenticated'::text;
    RETURN;
  END IF;

  -- 2. Fetch stream details
  SELECT id, user_id, status, is_live, ended_at
  INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF v_stream IS NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Stream not found'::text;
    RETURN;
  END IF;

  -- 3. Verify stream is live
  IF (v_stream.status != 'live' AND v_stream.is_live != true) OR v_stream.ended_at IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Stream is not live'::text;
    RETURN;
  END IF;

  -- 4. Verify viewer is not the broadcaster
  IF v_stream.user_id = v_user_id THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Cannot earn from your own stream'::text;
    RETURN;
  END IF;

  -- 5. Lock user's profile to prevent concurrent awards for the same user
  -- This prevents race conditions where multiple concurrent calls could exceed the daily cap
  SELECT user_profiles.hype_coins
  INTO v_current_user_hype
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  -- 6. Check daily cap (25 Hype Coins per day)
  SELECT COALESCE(SUM(amount), 0)::integer
  INTO v_daily_earned
  FROM public.hype_coin_ledger
  WHERE user_id = v_user_id
    AND action = 'hype_watch_earned'
    AND created_at >= NOW()::date;

  -- Calculate remaining daily allowance
  v_remaining_allowance := 25 - v_daily_earned;
  
  IF v_remaining_allowance <= 0 THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0, -- earned_amount
      v_daily_earned,
      25,
      0,
      175,
      'Daily earning cap reached'::text;
    RETURN;
  END IF;

  -- 7. Check weekly cap (175 Hype Coins per week)
  SELECT COALESCE(SUM(amount), 0)::integer
  INTO v_weekly_earned
  FROM public.hype_coin_ledger
  WHERE user_id = v_user_id
    AND action = 'hype_watch_earned'
    AND created_at >= NOW() - interval '7 days';

  IF v_weekly_earned >= 175 THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      v_daily_earned,
      25,
      v_weekly_earned,
      175,
      'Weekly earning cap reached'::text;
    RETURN;
  END IF;

  -- 8. Check for duplicate rewards in same 5-minute window
  v_earning_window_start := to_timestamp(EXTRACT(EPOCH FROM NOW())::integer / 300 * 300);

  SELECT created_at
  INTO v_last_award_time
  FROM public.hype_coin_ledger
  WHERE user_id = v_user_id
    AND action = 'hype_watch_earned'
    AND created_at >= v_earning_window_start
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_award_time IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      v_daily_earned,
      25,
      v_weekly_earned,
      175,
      'Already earned in this 5-minute window'::text;
    RETURN;
  END IF;

  -- 9. Calculate actual awarded amount (respect daily cap)
  v_awarded_amount := LEAST(v_attempted_amount, v_remaining_allowance);

  -- 10. Credit awarded Hype Coins
  IF v_awarded_amount > 0 THEN
    UPDATE public.user_profiles
    SET hype_coins = hype_coins + v_awarded_amount
    WHERE id = v_user_id;
  END IF;

  -- 11. Insert ledger entry with actual awarded amount
  IF v_awarded_amount > 0 THEN
    INSERT INTO public.hype_coin_ledger (user_id, stream_id, broadcaster_id, amount, action, metadata)
    VALUES (v_user_id, p_stream_id, v_stream.user_id, v_awarded_amount, 'hype_watch_earned', jsonb_build_object(
      'stream_title', v_stream.id,
      'earned_at', NOW(),
      'attempted_amount', v_attempted_amount,
      'awarded_amount', v_awarded_amount,
      'earned_today_before', v_daily_earned,
      'daily_cap', 25
    ));
  END IF;

  -- 12. Fetch updated balance
  SELECT user_profiles.hype_coins INTO v_current_user_hype
  FROM public.user_profiles
  WHERE id = v_user_id;

  -- 13. Return success
  IF v_awarded_amount > 0 THEN
    RETURN QUERY SELECT
      true,
      v_current_user_hype::bigint,
      v_awarded_amount,
      v_daily_earned + v_awarded_amount,
      25,
      v_weekly_earned + v_awarded_amount,
      175,
      'Hype Coin earned'::text;
  ELSE
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      v_daily_earned,
      25,
      0,
      175,
      'Daily earning cap reached'::text;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RPC: CONVERT_HYPE_COINS_TO_TROLL_COINS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.convert_hype_coins_to_troll_coins(p_amount integer)
RETURNS TABLE(
  success boolean,
  hype_coins_after bigint,
  troll_coins_after bigint,
  converted_amount integer,
  message text
) AS $$
DECLARE
  v_user_id uuid;
  v_current_hype integer;
  v_current_troll bigint;
  v_error_msg text;
BEGIN
  -- 1. Check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0::bigint,
      0,
      'Not authenticated'::text;
    RETURN;
  END IF;

  -- 2. Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0::bigint,
      0,
      'Amount must be greater than 0'::text;
    RETURN;
  END IF;

  -- 3. Check user has enough hype coins
  SELECT user_profiles.hype_coins, user_profiles.troll_coins
  INTO v_current_hype, v_current_troll
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_current_hype < p_amount THEN
    RETURN QUERY SELECT
      false,
      v_current_hype::bigint,
      v_current_troll::bigint,
      0,
      'Insufficient Hype Coins'::text;
    RETURN;
  END IF;

  -- 4. Perform atomic update: subtract hype coins, add troll coins
  PERFORM set_config('app.bypass_coin_protection', 'true', true);
  UPDATE public.user_profiles
  SET
    hype_coins = hype_coins - p_amount,
    troll_coins = troll_coins + p_amount
  WHERE id = v_user_id;

  -- 5. Insert conversion ledger entries
  INSERT INTO public.hype_coin_ledger (user_id, amount, action, metadata)
  VALUES (v_user_id, -p_amount, 'hype_converted_to_troll', jsonb_build_object(
    'converted_at', NOW(),
    'troll_coins_gained', p_amount
  ));

  INSERT INTO public.coin_ledger (user_id, delta, bucket, source, created_at)
  VALUES (v_user_id, p_amount::bigint, 'gifted', 'hype_conversion', NOW());

  -- 6. Fetch updated balances
  SELECT user_profiles.hype_coins, user_profiles.troll_coins
  INTO v_current_hype, v_current_troll
  FROM public.user_profiles
  WHERE id = v_user_id;

  -- 7. Return success
  RETURN QUERY SELECT
    true,
    v_current_hype::bigint,
    v_current_troll::bigint,
    p_amount,
    'Hype Coins converted to Troll Coins'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANTS FOR RPC FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.earn_hype_coin_watch_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_hype_coins_to_troll_coins(integer) TO authenticated;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.hype_coin_ledger IS 'Ledger of all Hype Coin transactions. Users earn 1 Hype Coin per 5 verified minutes watched in live broadcasts.';
COMMENT ON COLUMN public.hype_coin_ledger.action IS 'Type of transaction: hype_watch_earned, hype_converted_to_troll';
COMMENT ON COLUMN public.user_profiles.hype_coins IS 'User balance of Hype Coins earned from watching live broadcasts';
COMMENT ON FUNCTION public.earn_hype_coin_watch_reward(uuid) IS 'RPC to award Hype Coins after 5 verified minutes watching a live broadcast. Enforces daily (25) and weekly (175) caps with row-level locking to prevent race conditions. Supports partial awards when daily cap would be exceeded.';
COMMENT ON FUNCTION public.convert_hype_coins_to_troll_coins(integer) IS 'RPC to convert Hype Coins to Troll Coins at 1:1 rate. Updated balances are returned.';

-- ============================================================================
-- 7. RPC: GIFT_HYPE_COIN_TO_VIEWER (Broadcaster gifts hype coin to viewer)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gift_hype_coin_to_viewer(p_stream_id uuid, p_viewer_id uuid)
RETURNS TABLE(
  success boolean,
  hype_coins bigint,
  earned_amount integer,
  daily_earned integer,
  daily_cap integer,
  weekly_earned integer,
  weekly_cap integer,
  message text
) AS $$
DECLARE
  v_broadcaster_id uuid;
  v_viewer_record record;
  v_stream record;
  v_daily_earned integer;
  v_weekly_earned integer;
  v_last_award_time timestamptz;
  v_current_viewer_hype integer;
  v_earning_window_start timestamptz;
  v_attempted_amount integer := 1;
  v_awarded_amount integer;
  v_remaining_allowance integer;
  v_existing_balance integer;
BEGIN
  -- 1. Check authentication
  v_broadcaster_id := auth.uid();
  IF v_broadcaster_id IS NULL THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, 0, 25, 0, 175, 'Not authenticated'::text;
    RETURN;
  END IF;

  -- 2. Fetch stream details and verify broadcaster owns it
  SELECT id, user_id, status, is_live, ended_at
  INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF v_stream IS NULL THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, 0, 25, 0, 175, 'Stream not found'::text;
    RETURN;
  END IF;

  -- Only the broadcaster can gift hype coins
  IF v_stream.user_id != v_broadcaster_id THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, 0, 25, 0, 175, 'Only the broadcaster can gift hype coins'::text;
    RETURN;
  END IF;

  -- 3. Verify stream is live
  IF (v_stream.status != 'live' AND v_stream.is_live != true) OR v_stream.ended_at IS NOT NULL THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, 0, 25, 0, 175, 'Stream is not live'::text;
    RETURN;
  END IF;

  -- 4. Verify viewer is not the broadcaster
  IF p_viewer_id = v_broadcaster_id THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, 0, 25, 0, 175, 'Cannot gift hype coins to yourself'::text;
    RETURN;
  END IF;

  -- 5. Lock viewer's profile to prevent concurrent awards
  SELECT hype_coins
  INTO v_existing_balance
  FROM public.user_profiles
  WHERE id = p_viewer_id
  FOR UPDATE;

  IF v_existing_balance IS NULL THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, 0, 25, 0, 175, 'Viewer not found'::text;
    RETURN;
  END IF;

  -- 6. Check daily cap (25 Hype Coins per day per viewer)
  SELECT COALESCE(SUM(amount), 0)::integer
  INTO v_daily_earned
  FROM public.hype_coin_ledger
  WHERE user_id = p_viewer_id
    AND action = 'hype_gift_received'
    AND created_at >= NOW()::date;

  v_remaining_allowance := 25 - v_daily_earned;

  IF v_remaining_allowance <= 0 THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, v_daily_earned, 25, 0, 175, 'Viewer daily hype cap reached'::text;
    RETURN;
  END IF;

  -- 7. Check weekly cap (175 Hype Coins per week per viewer)
  SELECT COALESCE(SUM(amount), 0)::integer
  INTO v_weekly_earned
  FROM public.hype_coin_ledger
  WHERE user_id = p_viewer_id
    AND action = 'hype_gift_received'
    AND created_at >= NOW() - interval '7 days';

  IF v_weekly_earned >= 175 THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, v_daily_earned, 25, v_weekly_earned, 175, 'Viewer weekly hype cap reached'::text;
    RETURN;
  END IF;

  -- 8. Check for duplicate gifts in same 5-minute window (per viewer)
  v_earning_window_start := to_timestamp(EXTRACT(EPOCH FROM NOW())::integer / 300 * 300);

  SELECT created_at
  INTO v_last_award_time
  FROM public.hype_coin_ledger
  WHERE user_id = p_viewer_id
    AND action = 'hype_gift_received'
    AND created_at >= v_earning_window_start
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_award_time IS NOT NULL THEN
    RETURN QUERY SELECT
      false, 0::bigint, 0, v_daily_earned, 25, v_weekly_earned, 175,
      'Hype coin already gifted to this viewer in the last 5 minutes'::text;
    RETURN;
  END IF;

  -- 9. Calculate actual awarded amount (respect daily cap)
  v_awarded_amount := LEAST(v_attempted_amount, v_remaining_allowance);

  -- 10. Credit awarded Hype Coins to viewer
  IF v_awarded_amount > 0 THEN
    UPDATE public.user_profiles
    SET hype_coins = hype_coins + v_awarded_amount
    WHERE id = p_viewer_id;
  END IF;

  -- 11. Insert ledger entry
  IF v_awarded_amount > 0 THEN
    INSERT INTO public.hype_coin_ledger (user_id, stream_id, broadcaster_id, amount, action, metadata)
    VALUES (p_viewer_id, p_stream_id, v_broadcaster_id, v_awarded_amount, 'hype_gift_received', jsonb_build_object(
      'stream_id', p_stream_id,
      'gifted_at', NOW(),
      'broadcaster_id', v_broadcaster_id,
      'awarded_amount', v_awarded_amount
    ));
  END IF;

  -- 12. Fetch updated balance
  SELECT user_profiles.hype_coins INTO v_current_viewer_hype
  FROM public.user_profiles
  WHERE id = p_viewer_id;

  -- 13. Return success
  IF v_awarded_amount > 0 THEN
    RETURN QUERY SELECT
      true,
      v_current_viewer_hype::bigint,
      v_awarded_amount,
      v_daily_earned + v_awarded_amount,
      25,
      v_weekly_earned + v_awarded_amount,
      175,
      'Hype Coin gifted to viewer'::text;
  ELSE
    RETURN QUERY SELECT
      false,
      v_current_viewer_hype::bigint,
      0,
      v_daily_earned,
      25,
      v_weekly_earned,
      175,
      'Viewer daily hype cap reached'::text;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.gift_hype_coin_to_viewer(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.gift_hype_coin_to_viewer(uuid, uuid) IS 'RPC for broadcasters to gift 1 hype coin to a viewer. Enforces 5-min cooldown per viewer, daily (25) and weekly (175) caps. Row-level locking prevents race conditions.';
