-- =============================================================================
-- Migration: Fix place_bid RPC to bypass coin protection & sync viewer Agora
-- Description:
--   1. Replace place_bid with secure version that uses
--      app.bypass_coin_protection = true before restricted column updates.
--   2. Preserve anonymous round support from prior migration.
--   3. Credit auctioneer coins directly (bypassing require_admin on credit co
--   4. LiveAuctionRoom viewer Agora auto-connect now starts as soon as
--      showId + user are known, not after show data loads.
-- Date: 2026-07-11
-- =============================================================================

-- =============================================================================
-- 1. Drop and recreate place_bid with coin-protection bypass
-- =============================================================================

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
  v_auctioneer_user_id uuid;
BEGIN
  -- Get show
  SELECT * INTO v_show_record FROM auction_shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('accepted', false, 'reason', 'Show not found');
  END IF;

  -- Check if anonymous round is active for this show
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

  -- Bypass trigger protection for restricted columns
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Deduct coins from bidder
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

  -- Credit auctioneer
  SELECT user_id INTO v_auctioneer_user_id
  FROM public.auctioneer_profiles
  WHERE id = v_show_record.auctioneer_id;

  IF v_auctioneer_user_id IS NOT NULL THEN
    UPDATE user_profiles SET
      troll_coins = troll_coins + p_bid_amount,
      updated_at = now()
    WHERE id = v_auctioneer_user_id;

    INSERT INTO coin_transactions (user_id, amount, direction, type, reference_id, description)
    VALUES (v_auctioneer_user_id, p_bid_amount, 'IN', 'auction_bid', v_bid_id, 'Bid on lot: ' || v_lot_record.title);
  END IF;

  -- Log transaction for bidder
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

COMMENT ON FUNCTION place_bid IS 'Place a bid on a live auction lot (supports anonymous rounds, bypasses coin protection trigger)';
