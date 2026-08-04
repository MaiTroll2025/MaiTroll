-- =============================================================================
-- Migration: Auction Interactive Features
-- Description: Adds Anonymous Bid Round, Boost Bid, and Prediction Bid features
-- Date: 2026-06-12
-- =============================================================================

-- =============================================================================
-- 1. ANONYMOUS BID ROUND
-- =============================================================================

-- Add anonymous round columns to auction_shows
ALTER TABLE auction_shows
  ADD COLUMN IF NOT EXISTS is_anonymous_round_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anonymous_round_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS anonymous_round_duration_seconds int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS anonymous_round_max_duration int NOT NULL DEFAULT 120;

COMMENT ON COLUMN auction_shows.is_anonymous_round_active IS 'Whether anonymous bidding is currently active for this show';
COMMENT ON COLUMN auction_shows.anonymous_round_ends_at IS 'When the anonymous round ends';
COMMENT ON COLUMN auction_shows.anonymous_round_duration_seconds IS 'Duration of the anonymous round in seconds';
COMMENT ON COLUMN auction_shows.anonymous_round_max_duration IS 'Maximum allowed anonymous round duration in seconds';

-- Add anonymous flag to auction_bids
ALTER TABLE auction_bids
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anonymous_label text;

COMMENT ON COLUMN auction_bids.is_anonymous IS 'Whether this bid was placed during an anonymous round';
COMMENT ON COLUMN auction_bids.anonymous_label IS 'Display label like "Anonymous Bidder #1"';

-- =============================================================================
-- 2. BOOST BID
-- =============================================================================

-- Add boost bid columns to auctioneer_profiles settings is JSONB, so we add defaults there
-- But we also add a boost_bid_enabled flag to auction_shows for per-show control
ALTER TABLE auction_shows
  ADD COLUMN IF NOT EXISTS boost_bids_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS boost_bid_allowed_increments int[] NOT NULL DEFAULT ARRAY[2, 5, 10],
  ADD COLUMN IF NOT EXISTS boost_bid_max_amount int NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS boost_bid_custom_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN auction_shows.boost_bids_enabled IS 'Whether boost bids are allowed in this show';
COMMENT ON COLUMN auction_shows.boost_bid_allowed_increments IS 'Allowed boost increment values';
COMMENT ON COLUMN auction_shows.boost_bid_max_amount IS 'Maximum boost amount in coins';
COMMENT ON COLUMN auction_shows.boost_bid_custom_enabled IS 'Whether custom boost amounts are allowed';

-- Add boost flag to auction_bids
ALTER TABLE auction_bids
  ADD COLUMN IF NOT EXISTS is_boost_bid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_amount int NOT NULL DEFAULT 0;

COMMENT ON COLUMN auction_bids.is_boost_bid IS 'Whether this bid used a boost';
COMMENT ON COLUMN auction_bids.boost_amount IS 'The boost amount added to the standard increment';

-- =============================================================================
-- 3. PREDICTION BID
-- =============================================================================

-- Global prediction settings table (admin-controlled)
CREATE TABLE IF NOT EXISTS auction_prediction_settings (
  id int PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  enabled_global boolean NOT NULL DEFAULT true,
  lock_before_end_seconds int NOT NULL DEFAULT 30,
  reward_crowns_correct_winner int NOT NULL DEFAULT 10,
  reward_crowns_correct_price int NOT NULL DEFAULT 25,
  reward_crowns_combined int NOT NULL DEFAULT 50,
  reward_xp_correct_winner int NOT NULL DEFAULT 100,
  reward_xp_correct_price int NOT NULL DEFAULT 250,
  reward_xp_combined int NOT NULL DEFAULT 500,
  reward_event_points_correct_winner int NOT NULL DEFAULT 5,
  reward_event_points_correct_price int NOT NULL DEFAULT 10,
  reward_event_points_combined int NOT NULL DEFAULT 20,
  min_entries_for_leaderboard int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE auction_prediction_settings IS 'Global admin settings for auction prediction feature';

-- Insert default settings
INSERT INTO auction_prediction_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Per-show prediction settings
ALTER TABLE auction_shows
  ADD COLUMN IF NOT EXISTS predictions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS predictions_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS predictions_lock_at timestamptz,
  ADD COLUMN IF NOT EXISTS predictions_lock_threshold_coins int;

COMMENT ON COLUMN auction_shows.predictions_enabled IS 'Whether predictions are enabled for this show';
COMMENT ON COLUMN auction_shows.predictions_locked IS 'Whether predictions are locked for this show';
COMMENT ON COLUMN auction_shows.predictions_lock_at IS 'When predictions were locked';
COMMENT ON COLUMN auction_shows.predictions_lock_threshold_coins IS 'Auto-lock when highest bid reaches this amount';

-- Predictions table
CREATE TABLE IF NOT EXISTS auction_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_show_id uuid NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
  predicted_winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  predicted_price int,
  prediction_type text NOT NULL DEFAULT 'combined' CHECK (prediction_type IN ('winner', 'price', 'combined')),
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  is_correct_winner boolean,
  is_correct_price boolean,
  price_accuracy int,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, auction_show_id)
);

COMMENT ON TABLE auction_predictions IS 'User predictions for auction outcomes';

-- Prediction rewards table
CREATE TABLE IF NOT EXISTS auction_prediction_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES auction_predictions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_show_id uuid NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('crowns', 'xp', 'event_points')),
  reward_amount int NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'prediction_correct',
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE auction_prediction_rewards IS 'Rewards granted for correct predictions';

-- Prediction history table (for analytics)
CREATE TABLE IF NOT EXISTS auction_prediction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_show_id uuid NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
  total_predictions int NOT NULL DEFAULT 0,
  total_correct_winner int NOT NULL DEFAULT 0,
  total_correct_price int NOT NULL DEFAULT 0,
  total_combined_correct int NOT NULL DEFAULT 0,
  total_rewards_granted int NOT NULL DEFAULT 0,
  actual_winner_id uuid,
  actual_final_price int,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE auction_prediction_history IS 'Aggregated prediction results per auction show';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- auction_prediction_settings: only admins can modify, everyone can read
ALTER TABLE auction_prediction_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_prediction_settings" ON auction_prediction_settings
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_prediction_settings" ON auction_prediction_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- auction_predictions: users manage their own, everyone can read (for leaderboard)
ALTER TABLE auction_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_predictions" ON auction_predictions
  FOR SELECT USING (true);

CREATE POLICY "users_manage_own_predictions" ON auction_predictions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "admin_manage_predictions" ON auction_predictions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- auction_prediction_rewards: users read their own, system inserts
ALTER TABLE auction_prediction_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_rewards" ON auction_prediction_rewards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_manage_rewards" ON auction_prediction_rewards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- auction_prediction_history: readable by all, writable by system/admin
ALTER TABLE auction_prediction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_prediction_history" ON auction_prediction_history
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_prediction_history" ON auction_prediction_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- =============================================================================
-- RPC FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Anonymous Round Functions
-- -----------------------------------------------------------------------------

-- Start anonymous round
CREATE OR REPLACE FUNCTION start_anonymous_round(
  p_show_id uuid,
  p_duration_seconds int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_record record;
  v_max_duration int;
BEGIN
  -- Get show and verify auctioneer
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'Show not found');
  END IF;

  -- Check if user is the auctioneer or admin
  IF NOT EXISTS (
    SELECT 1 FROM auctioneer_profiles ap
    WHERE ap.id = v_show_record.auctioneer_id AND ap.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  ) THEN
    RETURN json_build_object('success', false, 'reason', 'Only the auctioneer or admin can start an anonymous round');
  END IF;

  -- Validate duration
  v_max_duration := COALESCE(v_show_record.anonymous_round_max_duration, 120);
  IF p_duration_seconds < 10 OR p_duration_seconds > v_max_duration THEN
    RETURN json_build_object('success', false, 'reason', 'Duration must be between 10 and ' || v_max_duration || ' seconds');
  END IF;

  -- Check if show is live
  IF v_show_record.status != 'live' THEN
    RETURN json_build_object('success', false, 'reason', 'Show must be live to start anonymous round');
  END IF;

  -- Activate anonymous round
  UPDATE auction_shows SET
    is_anonymous_round_active = true,
    anonymous_round_ends_at = now() + (p_duration_seconds || ' seconds')::interval,
    anonymous_round_duration_seconds = p_duration_seconds,
    updated_at = now()
  WHERE id = p_show_id;

  RETURN json_build_object(
    'success', true,
    'ends_at', (now() + (p_duration_seconds || ' seconds')::interval)::text,
    'duration', p_duration_seconds
  );
END;
$$;

COMMENT ON FUNCTION start_anonymous_round IS 'Start an anonymous bid round for a live auction show';

-- End anonymous round early
CREATE OR REPLACE FUNCTION end_anonymous_round(p_show_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_record record;
BEGIN
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'Show not found');
  END IF;

  -- Check if user is the auctioneer or admin
  IF NOT EXISTS (
    SELECT 1 FROM auctioneer_profiles ap
    WHERE ap.id = v_show_record.auctioneer_id AND ap.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  ) THEN
    RETURN json_build_object('success', false, 'reason', 'Only the auctioneer or admin can end an anonymous round');
  END IF;

  UPDATE auction_shows SET
    is_anonymous_round_active = false,
    anonymous_round_ends_at = NULL,
    updated_at = now()
  WHERE id = p_show_id;

  RETURN json_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION end_anonymous_round IS 'End an anonymous bid round early';

-- Get anonymous bidder label (used during anonymous rounds)
CREATE OR REPLACE FUNCTION get_anonymous_bidder_label(p_show_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_label text;
  v_count int;
BEGIN
  SELECT COUNT(DISTINCT bidder_id) + 1 INTO v_count
  FROM auction_bids
  WHERE auction_show_id = p_show_id AND is_anonymous = true;

  v_label := 'Anonymous Bidder #' || v_count;
  RETURN v_label;
END;
$$;

COMMENT ON FUNCTION get_anonymous_bidder_label IS 'Generate anonymous bidder label for display';

-- -----------------------------------------------------------------------------
-- Boost Bid Functions
-- -----------------------------------------------------------------------------

-- Place a boost bid (extends place_bid logic, auto-handles anonymous rounds)
CREATE OR REPLACE FUNCTION place_boost_bid(
  p_show_id uuid,
  p_lot_id uuid,
  p_bid_amount int,
  p_boost_amount int DEFAULT 0
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
  v_allowed_increments int[];
  v_max_boost int;
  v_custom_enabled boolean;
  v_bid_id uuid;
  v_is_anonymous boolean := false;
  v_anonymous_label text;
  v_spend_result json;
BEGIN
  -- Get show
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('accepted', false, 'reason', 'Show not found');
  END IF;

  -- Check if anonymous round is active
  IF v_show_record.is_anonymous_round_active = true THEN
    IF v_show_record.anonymous_round_ends_at IS NOT NULL AND v_show_record.anonymous_round_ends_at > now() THEN
      v_is_anonymous := true;
      v_anonymous_label := 'Anonymous Bidder #' || (
        SELECT COUNT(DISTINCT bidder_id) + 1
        FROM auction_bids
        WHERE auction_show_id = p_show_id AND is_anonymous = true
      );
    END IF;
  END IF;

  -- Check if boost bids are enabled
  IF NOT v_show_record.boost_bids_enabled THEN
    RETURN json_build_object('accepted', false, 'reason', 'Boost bids are not enabled for this show');
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

  -- Validate boost amount
  v_allowed_increments := COALESCE(v_show_record.boost_bid_allowed_increments, ARRAY[2, 5, 10]);
  v_max_boost := COALESCE(v_show_record.boost_bid_max_amount, 100);
  v_custom_enabled := COALESCE(v_show_record.boost_bid_custom_enabled, false);

  IF p_boost_amount > 0 THEN
    IF p_boost_amount > v_max_boost THEN
      RETURN json_build_object('accepted', false, 'reason', 'Boost amount exceeds maximum of ' || v_max_boost);
    END IF;
    IF NOT v_custom_enabled AND NOT (p_boost_amount = ANY(v_allowed_increments)) THEN
      RETURN json_build_object('accepted', false, 'reason', 'Boost amount not in allowed increments');
    END IF;
  END IF;

  -- Validate total bid
  IF p_bid_amount < v_min_bid + p_boost_amount THEN
    RETURN json_build_object('accepted', false, 'reason', 'Bid too low. Minimum is ' || (v_min_bid + p_boost_amount) || ' coins');
  END IF;

  -- Check user balance
  SELECT troll_coins INTO v_user_coins FROM user_profiles WHERE id = auth.uid();
  IF v_user_coins IS NULL OR v_user_coins < p_bid_amount THEN
    RETURN json_build_object('accepted', false, 'reason', 'Insufficient troll coins');
  END IF;

  -- Deduct coins via the Troll Bank (user_profiles.troll_coins is a restricted
  -- column, so direct updates are blocked by column privileges).
  SELECT public.troll_bank_spend_coins_secure(
    p_user_id := auth.uid(),
    p_amount := p_bid_amount,
    p_bucket := 'paid',
    p_source := 'auction_bid',
    p_ref_id := p_lot_id::text,
    p_metadata := jsonb_build_object('show_id', p_show_id, 'lot_id', p_lot_id, 'boost_amount', p_boost_amount)
  )::json INTO v_spend_result;

  IF (v_spend_result->>'success') IS DISTINCT FROM 'true' THEN
    RETURN json_build_object('accepted', false, 'reason', COALESCE(v_spend_result->>'error', 'Failed to deduct coins for bid'));
  END IF;

  -- Insert bid
  INSERT INTO auction_bids (lot_id, auction_show_id, bidder_id, bid_amount, is_anonymous, anonymous_label, is_boost_bid, boost_amount, created_at)
  VALUES (p_lot_id, p_show_id, auth.uid(), p_bid_amount, v_is_anonymous, v_anonymous_label, p_boost_amount > 0, p_boost_amount, now())
  RETURNING id INTO v_bid_id;

  -- Update lot
  UPDATE auction_lots SET
    current_highest_bid = p_bid_amount,
    current_highest_bidder_id = auth.uid(),
    updated_at = now()
  WHERE id = p_lot_id;

  -- Log transaction
  INSERT INTO coin_transactions (user_id, amount, direction, type, reference_id, description)
  VALUES (auth.uid(), p_bid_amount, 'OUT', 'boost_bid', v_bid_id, 'Boost bid on lot: ' || v_lot_record.title);

  RETURN json_build_object(
    'accepted', true,
    'bid_id', v_bid_id,
    'new_highest_bid', p_bid_amount,
    'boost_amount', p_boost_amount,
    'is_anonymous', v_is_anonymous,
    'anonymous_label', v_anonymous_label
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Prediction Functions
-- -----------------------------------------------------------------------------

-- Submit or update a prediction
CREATE OR REPLACE FUNCTION submit_prediction(
  p_show_id uuid,
  p_predicted_winner_id uuid DEFAULT NULL,
  p_predicted_price int DEFAULT NULL,
  p_prediction_type text DEFAULT 'combined'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_record record;
  v_settings record;
  v_existing_id uuid;
  v_result_id uuid;
BEGIN
  -- Check if predictions are enabled globally
  SELECT * INTO v_settings FROM auction_prediction_settings WHERE id = 1;
  IF NOT FOUND OR NOT v_settings.enabled_global THEN
    RETURN json_build_object('success', false, 'reason', 'Predictions are disabled globally');
  END IF;

  -- Get show
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'Show not found');
  END IF;

  -- Check if predictions are enabled for this show
  IF NOT v_show_record.predictions_enabled THEN
    RETURN json_build_object('success', false, 'reason', 'Predictions are not enabled for this show');
  END IF;

  -- Check if predictions are locked
  IF v_show_record.predictions_locked THEN
    RETURN json_build_object('success', false, 'reason', 'Predictions are locked for this show');
  END IF;

  -- Check if show is live or scheduled
  IF v_show_record.status NOT IN ('live', 'scheduled') THEN
    RETURN json_build_object('success', false, 'reason', 'Predictions are only available for live or scheduled shows');
  END IF;

  -- Validate prediction type
  IF p_prediction_type NOT IN ('winner', 'price', 'combined') THEN
    RETURN json_build_object('success', false, 'reason', 'Invalid prediction type');
  END IF;

  -- Validate inputs based on type
  IF p_prediction_type = 'winner' AND p_predicted_winner_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'Predicted winner ID is required for winner predictions');
  END IF;

  IF p_prediction_type = 'price' AND p_predicted_price IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'Predicted price is required for price predictions');
  END IF;

  IF p_prediction_type = 'combined' AND (p_predicted_winner_id IS NULL OR p_predicted_price IS NULL) THEN
    RETURN json_build_object('success', false, 'reason', 'Both winner and price are required for combined predictions');
  END IF;

  -- Check for existing prediction
  SELECT id INTO v_existing_id FROM auction_predictions
  WHERE user_id = auth.uid() AND auction_show_id = p_show_id;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing prediction (only if not locked)
    UPDATE auction_predictions SET
      predicted_winner_id = p_predicted_winner_id,
      predicted_price = p_predicted_price,
      prediction_type = p_prediction_type,
      updated_at = now()
    WHERE id = v_existing_id AND is_locked = false
    RETURNING id INTO v_result_id;

    IF v_result_id IS NULL THEN
      RETURN json_build_object('success', false, 'reason', 'Cannot update locked prediction');
    END IF;

    RETURN json_build_object('success', true, 'prediction_id', v_result_id, 'action', 'updated');
  ELSE
    -- Insert new prediction
    INSERT INTO auction_predictions (
      user_id, auction_show_id, predicted_winner_id, predicted_price,
      prediction_type, submitted_at, updated_at
    ) VALUES (
      auth.uid(), p_show_id, p_predicted_winner_id, p_predicted_price,
      p_prediction_type, now(), now()
    )
    RETURNING id INTO v_result_id;

    RETURN json_build_object('success', true, 'prediction_id', v_result_id, 'action', 'created');
  END IF;
END;
$$;

COMMENT ON FUNCTION submit_prediction IS 'Submit or update an auction outcome prediction';

-- Lock predictions for a show (auctioneer or admin)
CREATE OR REPLACE FUNCTION lock_predictions(p_show_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_record record;
BEGIN
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'Show not found');
  END IF;

  -- Check if user is the auctioneer or admin
  IF NOT EXISTS (
    SELECT 1 FROM auctioneer_profiles ap
    WHERE ap.id = v_show_record.auctioneer_id AND ap.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  ) THEN
    RETURN json_build_object('success', false, 'reason', 'Only the auctioneer or admin can lock predictions');
  END IF;

  -- Lock predictions
  UPDATE auction_shows SET
    predictions_locked = true,
    predictions_lock_at = now(),
    updated_at = now()
  WHERE id = p_show_id;

  -- Lock all unlocked predictions for this show
  UPDATE auction_predictions SET
    is_locked = true,
    locked_at = now()
  WHERE auction_show_id = p_show_id AND is_locked = false;

  RETURN json_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION lock_predictions IS 'Lock all predictions for an auction show';

-- Get predictions for a show (with optional user filter)
CREATE OR REPLACE FUNCTION get_predictions(p_show_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_record record;
  v_result json;
BEGIN
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'Show not found');
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', ap.id,
      'user_id', ap.user_id,
      'predicted_winner_id', ap.predicted_winner_id,
      'predicted_price', ap.predicted_price,
      'prediction_type', ap.prediction_type,
      'is_locked', ap.is_locked,
      'submitted_at', ap.submitted_at,
      'username', up.username,
      'display_name', up.display_name,
      'avatar_url', up.avatar_url
    ) ORDER BY ap.submitted_at DESC
  ) INTO v_result
  FROM auction_predictions ap
  LEFT JOIN user_profiles up ON up.id = ap.user_id
  WHERE ap.auction_show_id = p_show_id
  AND (p_user_id IS NULL OR ap.user_id = p_user_id);

  RETURN json_build_object('success', true, 'predictions', COALESCE(v_result, '[]'::json));
END;
$$;

COMMENT ON FUNCTION get_predictions IS 'Get predictions for an auction show';

-- Get prediction count for a show
CREATE OR REPLACE FUNCTION get_prediction_count(p_show_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM auction_predictions WHERE auction_show_id = p_show_id;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_prediction_count IS 'Get total prediction count for a show';

-- Settle predictions after auction ends (admin/auctioneer)
CREATE OR REPLACE FUNCTION settle_predictions(
  p_show_id uuid,
  p_winner_id uuid DEFAULT NULL,
  p_final_price int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_record record;
  v_settings record;
  v_prediction record;
  v_crowns int;
  v_xp int;
  v_event_points int;
  v_total_rewards int := 0;
BEGIN
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'Show not found');
  END IF;

  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  ) THEN
    RETURN json_build_object('success', false, 'reason', 'Only admins can settle predictions');
  END IF;

  -- Get reward settings
  SELECT * INTO v_settings FROM auction_prediction_settings WHERE id = 1;

  -- Process each prediction
  FOR v_prediction IN
    SELECT * FROM auction_predictions WHERE auction_show_id = p_show_id
  LOOP
    v_crowns := 0;
    v_xp := 0;
    v_event_points := 0;

    -- Check winner prediction
    IF v_prediction.predicted_winner_id IS NOT NULL AND v_prediction.predicted_winner_id = p_winner_id THEN
      UPDATE auction_predictions SET is_correct_winner = true WHERE id = v_prediction.id;
      v_crowns := v_crowns + COALESCE(v_settings.reward_crowns_correct_winner, 10);
      v_xp := v_xp + COALESCE(v_settings.reward_xp_correct_winner, 100);
      v_event_points := v_event_points + COALESCE(v_settings.reward_event_points_correct_winner, 5);
    END IF;

    -- Check price prediction (exact match)
    IF v_prediction.predicted_price IS NOT NULL AND v_prediction.predicted_price = p_final_price THEN
      UPDATE auction_predictions SET is_correct_price = true, price_accuracy = 100 WHERE id = v_prediction.id;
      v_crowns := v_crowns + COALESCE(v_settings.reward_crowns_correct_price, 25);
      v_xp := v_xp + COALESCE(v_settings.reward_xp_correct_price, 250);
      v_event_points := v_event_points + COALESCE(v_settings.reward_event_points_correct_price, 10);
    END IF;

    -- Combined bonus: both correct
    IF v_prediction.prediction_type = 'combined'
       AND v_prediction.is_correct_winner = true
       AND v_prediction.is_correct_price = true THEN
      -- Replace individual rewards with combined reward
      v_crowns := COALESCE(v_settings.reward_crowns_combined, 50);
      v_xp := COALESCE(v_settings.reward_xp_combined, 500);
      v_event_points := COALESCE(v_settings.reward_event_points_combined, 20);
    END IF;

    -- Grant rewards
    IF v_crowns > 0 THEN
      INSERT INTO auction_prediction_rewards (prediction_id, user_id, auction_show_id, reward_type, reward_amount, reason, granted, granted_at)
      VALUES (v_prediction.id, v_prediction.user_id, p_show_id, 'crowns', v_crowns, 'prediction_correct', true, now());
      v_total_rewards := v_total_rewards + 1;
    END IF;

    IF v_xp > 0 THEN
      INSERT INTO auction_prediction_rewards (prediction_id, user_id, auction_show_id, reward_type, reward_amount, reason, granted, granted_at)
      VALUES (v_prediction.id, v_prediction.user_id, p_show_id, 'xp', v_xp, 'prediction_correct', true, now());
      v_total_rewards := v_total_rewards + 1;

      -- Award XP
      UPDATE user_profiles SET
        xp = xp + v_xp,
        total_xp = total_xp + v_xp,
        updated_at = now()
      WHERE id = v_prediction.user_id;
    END IF;

    IF v_event_points > 0 THEN
      INSERT INTO auction_prediction_rewards (prediction_id, user_id, auction_show_id, reward_type, reward_amount, reason, granted, granted_at)
      VALUES (v_prediction.id, v_prediction.user_id, p_show_id, 'event_points', v_event_points, 'prediction_correct', true, now());
      v_total_rewards := v_total_rewards + 1;
    END IF;
  END LOOP;

  -- Record history
  INSERT INTO auction_prediction_history (
    auction_show_id, total_predictions, actual_winner_id, actual_final_price, settled_at
  ) VALUES (
    p_show_id,
    (SELECT COUNT(*) FROM auction_predictions WHERE auction_show_id = p_show_id),
    p_winner_id, p_final_price, now()
  );

  RETURN json_build_object('success', true, 'total_rewards_granted', v_total_rewards);
END;
$$;

COMMENT ON FUNCTION settle_predictions IS 'Settle all predictions for an auction show and grant rewards';

-- =============================================================================
-- REALTIME: Enable new tables
-- =============================================================================

DO $$
BEGIN
  -- Add tables to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'auction_predictions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_predictions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'auction_prediction_rewards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_prediction_rewards;
  END IF;
END;
$$;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_auction_predictions_show_id ON auction_predictions(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_predictions_user_id ON auction_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_predictions_show_user ON auction_predictions(auction_show_id, user_id);
CREATE INDEX IF NOT EXISTS idx_auction_prediction_rewards_user_id ON auction_prediction_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_prediction_rewards_prediction_id ON auction_prediction_rewards(prediction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_anonymous ON auction_bids(auction_show_id, is_anonymous) WHERE is_anonymous = true;
CREATE INDEX IF NOT EXISTS idx_auction_bids_boost ON auction_bids(auction_show_id, is_boost_bid) WHERE is_boost_bid = true;
