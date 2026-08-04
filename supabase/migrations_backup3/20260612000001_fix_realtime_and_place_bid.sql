-- =============================================================================
-- Migration: Fix Realtime Publications & Update place_bid for Anonymous Rounds
-- Description: 
--   1. Add auction_watchlist to realtime publication (was missing)
--   2. Update place_bid RPC to auto-mark bids as anonymous during anonymous rounds
--   3. Add helper RPC for anonymous bid label assignment
-- Date: 2026-06-12
-- =============================================================================

-- =============================================================================
-- 1. Fix missing realtime publications
-- =============================================================================

DO $$
BEGIN
  -- auction_watchlist (only if table exists)
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'auction_watchlist'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'auction_watchlist'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_watchlist;
  END IF;

  -- auction_prediction_settings (only if table exists)
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'auction_prediction_settings'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'auction_prediction_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_prediction_settings;
  END IF;
END;
$$;

-- =============================================================================
-- 2. Update place_bid to handle anonymous rounds
-- =============================================================================

-- Drop all existing place_bid function variants to avoid signature conflicts
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS fn_sig
    FROM pg_proc
    WHERE proname = 'place_bid'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn_sig || ' CASCADE';
  END LOOP;
END;
$$;

-- Recreate place_bid with anonymous round support
CREATE FUNCTION place_bid(
  p_show_id uuid,
  p_lot_id uuid,
  p_bid_amount int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_record record;
  v_lot_record record;
  v_user_coins int;
  v_min_bid int;
  v_bid_id uuid;
  v_is_anonymous boolean := false;
  v_anonymous_label text;
BEGIN
  -- Get show
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('accepted', false, 'reason', 'Show not found');
  END IF;

  -- Check if anonymous round is active for this show
  IF v_show_record.is_anonymous_round_active = true THEN
    -- Check if anonymous round hasn't expired
    IF v_show_record.anonymous_round_ends_at IS NOT NULL AND v_show_record.anonymous_round_ends_at > now() THEN
      v_is_anonymous := true;
      -- Generate anonymous label
      v_anonymous_label := 'Anonymous Bidder #' || (
        SELECT COUNT(DISTINCT bidder_id) + 1
        FROM auction_bids
        WHERE auction_show_id = p_show_id AND is_anonymous = true
      );
    END IF;
  END IF;

  -- Get lot
  SELECT * INTO v_lot_record FROM auction_lots WHERE id = p_lot_id;
  IF NOT FOUND THEN
    RETURN json_build_object('accepted', false, 'reason', 'Lot not found');
  END IF;

  IF v_lot_record.status != 'live' THEN
    RETURN json_build_object('accepted', false, 'reason', 'Lot is not accepting bids');
  END IF;

  -- Calculate minimum bid
  v_min_bid := COALESCE(v_lot_record.current_highest_bid + v_lot_record.bid_increment, v_lot_record.starting_bid);

  -- Validate bid amount
  IF p_bid_amount < v_min_bid THEN
    RETURN json_build_object('accepted', false, 'reason', 'Bid too low. Minimum is ' || v_min_bid || ' coins');
  END IF;

  -- Check user balance
  SELECT troll_coins INTO v_user_coins FROM user_profiles WHERE id = auth.uid();
  IF v_user_coins IS NULL OR v_user_coins < p_bid_amount THEN
    RETURN json_build_object('accepted', false, 'reason', 'Insufficient troll coins');
  END IF;

  -- Deduct coins
  UPDATE user_profiles SET
    troll_coins = troll_coins - p_bid_amount,
    updated_at = now()
  WHERE id = auth.uid();

  -- Insert bid (with anonymous flag if applicable)
  INSERT INTO auction_bids (lot_id, auction_show_id, bidder_id, bid_amount, is_anonymous, anonymous_label, created_at)
  VALUES (p_lot_id, p_show_id, auth.uid(), p_bid_amount, v_is_anonymous, v_anonymous_label, now())
  RETURNING id INTO v_bid_id;

  -- Update lot
  UPDATE auction_lots SET
    current_highest_bid = p_bid_amount,
    current_highest_bidder_id = auth.uid(),
    updated_at = now()
  WHERE id = p_lot_id;

  -- Log transaction
  INSERT INTO coin_transactions (user_id, amount, direction, type, reference_id, description)
  VALUES (auth.uid(), p_bid_amount, 'OUT', 'auction_bid', v_bid_id, 'Bid on lot: ' || v_lot_record.title);

  RETURN json_build_object(
    'accepted', true,
    'bid_id', v_bid_id,
    'new_highest_bid', p_bid_amount,
    'is_anonymous', v_is_anonymous,
    'anonymous_label', v_anonymous_label
  );
END;
$$;

COMMENT ON FUNCTION place_bid IS 'Place a bid on a live auction lot (auto-handles anonymous rounds)';

-- =============================================================================
-- 3. Helper: Get anonymous round state for a show
-- =============================================================================

CREATE OR REPLACE FUNCTION get_anonymous_round_state(p_show_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_show_record record;
  v_seconds_remaining int;
BEGIN
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('active', false, 'reason', 'Show not found');
  END IF;

  v_seconds_remaining := 0;
  IF v_show_record.anonymous_round_ends_at IS NOT NULL THEN
    v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_show_record.anonymous_round_ends_at - now()))::int);
  END IF;

  RETURN json_build_object(
    'active', v_show_record.is_anonymous_round_active AND v_seconds_remaining > 0,
    'ends_at', v_show_record.anonymous_round_ends_at,
    'seconds_remaining', v_seconds_remaining,
    'duration_seconds', v_show_record.anonymous_round_duration_seconds,
    'max_duration', v_show_record.anonymous_round_max_duration
  );
END;
$$;

COMMENT ON FUNCTION get_anonymous_round_state IS 'Get the current anonymous round state for a show';

-- =============================================================================
-- 4. Auto-expire anonymous rounds (can be called by a cron or manually)
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_anonymous_rounds()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE auction_shows SET
    is_anonymous_round_active = false,
    anonymous_round_ends_at = NULL,
    updated_at = now()
  WHERE is_anonymous_round_active = true
    AND anonymous_round_ends_at IS NOT NULL
    AND anonymous_round_ends_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_anonymous_rounds IS 'Auto-expire anonymous rounds that have passed their end time';

-- =============================================================================
-- 5. Update get_live_auction_state to include anonymous round state
--    and handle anonymous bidder display
-- =============================================================================

CREATE OR REPLACE FUNCTION get_live_auction_state(p_show_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_lot auction_lots%ROWTYPE;
  v_bids JSONB;
  v_viewer_count INTEGER;
  v_anonymous_active BOOLEAN;
  v_anonymous_ends_at TIMESTAMPTZ;
BEGIN
  -- Get current lot
  SELECT * INTO v_current_lot
  FROM auction_lots
  WHERE auction_show_id = p_show_id
    AND status = 'live'
  ORDER BY queue_position NULLS LAST
  LIMIT 1;

  -- Get anonymous round state
  SELECT is_anonymous_round_active, anonymous_round_ends_at
  INTO v_anonymous_active, v_anonymous_ends_at
  FROM auction_shows
  WHERE id = p_show_id;

  -- Get recent bids (handle anonymous display)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ab.id,
      'lot_id', ab.lot_id,
      'bidder_id', ab.bidder_id,
      'bid_amount', ab.bid_amount,
      'created_at', ab.created_at,
      'is_anonymous', COALESCE(ab.is_anonymous, false),
      'anonymous_label', ab.anonymous_label,
      'is_boost_bid', COALESCE(ab.is_boost_bid, false),
      'boost_amount', COALESCE(ab.boost_amount, 0),
      'bidder', CASE
        WHEN COALESCE(ab.is_anonymous, false) AND v_anonymous_active THEN
          jsonb_build_object(
            'username', COALESCE(ab.anonymous_label, 'Anonymous'),
            'display_name', COALESCE(ab.anonymous_label, 'Anonymous'),
            'avatar_url', NULL
          )
        ELSE
          jsonb_build_object(
            'username', up.username,
            'display_name', up.display_name,
            'avatar_url', up.avatar_url
          )
      END
    ) ORDER BY ab.created_at DESC
  ), '[]'::JSONB)
  INTO v_bids
  FROM auction_bids ab
  LEFT JOIN user_profiles up ON up.id = ab.bidder_id
  WHERE ab.auction_show_id = p_show_id
    AND ab.created_at > now() - interval '5 minutes';

  -- Get viewer count
  SELECT COUNT(DISTINCT user_id) INTO v_viewer_count
  FROM auction_presence
  WHERE auction_show_id = p_show_id AND is_active = true;

  RETURN jsonb_build_object(
    'current_lot', CASE WHEN v_current_lot.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_current_lot.id,
        'title', v_current_lot.title,
        'description', v_current_lot.description,
        'image_url', v_current_lot.image_url,
        'starting_bid', v_current_lot.starting_bid,
        'bid_increment', v_current_lot.bid_increment,
        'current_highest_bid', v_current_lot.current_highest_bid,
        'current_highest_bidder_id', v_current_lot.current_highest_bidder_id,
        'status', v_current_lot.status,
        'countdown_end_at', v_current_lot.countdown_end_at,
        'condition', v_current_lot.condition,
        'quantity', v_current_lot.quantity
      )
    ELSE NULL END,
    'recent_bids', v_bids,
    'viewer_count', v_viewer_count,
    'anonymous_round', jsonb_build_object(
      'active', COALESCE(v_anonymous_active, false),
      'ends_at', v_anonymous_ends_at,
      'seconds_remaining', CASE
        WHEN v_anonymous_ends_at IS NOT NULL THEN
          GREATEST(0, EXTRACT(EPOCH FROM (v_anonymous_ends_at - now()))::int)
        ELSE 0
      END
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_live_auction_state IS 'Get live auction state including anonymous round info';
