-- ==========================================
-- Platform Fee Update: 3% across targeted transactions
-- Date: 2028-05-10 (post-20280508 migrations)
--
-- Changes:
--   1. court_levy_fine: Increase defendant deduction by 3% (fine + fee)
--   2. confirm_delivery_and_release_escrow: Credit seller 97% of order total
--   3. finalize_auctions: Credit previous asset owner 97% of winning bid
--
-- All fees are retained by the platform (administrative revenue).
-- ==========================================

-- 1. Update court_levy_fine to add 3% platform fee on top of fine amount
CREATE OR REPLACE FUNCTION court_levy_fine(
    p_defendant_id uuid,
    p_amount integer,
    p_reason text,
    p_court_id uuid,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_judge_id uuid;
  v_is_authorized boolean := false;
  v_balance int;
  v_fee bigint;
  v_total_amount bigint;
BEGIN
  -- Check if caller is the Judge of the specified court session
  SELECT judge_id INTO v_judge_id
  FROM court_sessions
  WHERE id = p_court_id;
  
  IF v_judge_id = auth.uid() THEN
     v_is_authorized := true;
  ELSE
     -- Fallback: Check if caller is admin
     SELECT (role IN ('admin', 'lead_troll_officer') OR is_admin = true OR is_lead_officer = true)
     INTO v_is_authorized
     FROM user_profiles
     WHERE id = auth.uid();
  END IF;

  IF NOT v_is_authorized THEN
     RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: You are not the judge of this session.');
  END IF;
  
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Check balance
  SELECT troll_coins INTO v_balance FROM user_profiles WHERE id = p_defendant_id;
  
  IF v_balance IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Defendant not found');
  END IF;

  -- Platform fee: 3% of the fine amount (rounded up to nearest integer)
  v_fee := CEIL(p_amount::numeric * 0.03)::bigint;
  v_total_amount := p_amount + v_fee;

  IF v_balance < v_total_amount THEN
     RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- Deduct total amount (fine + fee) from defendant
  UPDATE user_profiles 
  SET troll_coins = troll_coins - v_total_amount 
  WHERE id = p_defendant_id;

  -- Log transaction with fee breakdown
  INSERT INTO coin_ledger (user_id, amount, event_type, description, metadata)
  VALUES (
    p_defendant_id, 
    -v_total_amount, 
    'court_fine', 
    p_reason, 
    p_metadata || jsonb_build_object('base_fine', p_amount, 'platform_fee', v_fee, 'total_deducted', v_total_amount)
  );
    
  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - v_total_amount);
END;
$$;

-- 2. Update confirm_delivery_and_release_escrow to apply 3% platform fee (seller receives 97%)
CREATE OR REPLACE FUNCTION confirm_delivery_and_release_escrow(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_seller_id UUID;
    v_seller_net bigint;
BEGIN
    SELECT * INTO v_order FROM public.shop_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Only release if there's escrow and no active appeal
    IF v_order.escrow_status != 'held' THEN
        RETURN jsonb_build_object('success', true, 'message', 'No escrow to release');
    END IF;
    
    -- Check for active appeal
    IF EXISTS (SELECT 1 FROM public.transaction_appeals WHERE order_id = p_order_id AND status IN ('pending', 'under_review')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot release escrow while appeal is active');
    END IF;
    
    v_seller_id := v_order.seller_id;
    
    -- Calculate seller net after 3% platform fee
    v_seller_net := floor(v_order.total_coins * 0.97)::bigint;
    
    -- Release escrow status
    UPDATE public.shop_orders
    SET escrow_status = 'released',
        escrow_released_at = NOW(),
        delivery_status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Credit seller (net amount)
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_seller_net
    WHERE id = v_seller_id;
    
    -- Optional: Log platform fee retention (could go to admin pool)
    -- Fee amount = v_order.total_coins - v_seller_net
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Escrow released to seller (net after fee)',
        'gross_amount', v_order.total_coins,
        'net_amount', v_seller_net,
        'platform_fee', v_order.total_coins - v_seller_net
    );
END;
$$;

-- 3. Update finalize_auctions to credit previous owner (seller) with 97% of winning bid
CREATE OR REPLACE FUNCTION public.finalize_auctions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auction RECORD;
    v_count INT := 0;
    v_seller_id uuid;
    v_seller_net bigint;
BEGIN
    FOR v_auction IN 
        SELECT * FROM public.asset_auctions 
        WHERE status = 'active' AND ends_at <= NOW()
    LOOP
        -- Determine seller (previous owner) before asset transfer
        v_seller_id := NULL;
        IF v_auction.asset_type = 'house' THEN
            SELECT user_id INTO v_seller_id FROM public.user_houses WHERE id = v_auction.asset_id;
        ELSIF v_auction.asset_type = 'car' THEN
            SELECT user_id INTO v_seller_id FROM public.user_cars WHERE id = v_auction.asset_id;
        END IF;

        -- Transfer Asset to winner
        IF v_auction.current_winner_user_id IS NOT NULL THEN
            IF v_auction.asset_type = 'house' THEN
                UPDATE public.user_houses 
                SET user_id = v_auction.current_winner_user_id,
                    status = 'active',
                    condition = 100,
                    feature_flags = feature_flags - 'is_for_rent'
                WHERE id = v_auction.asset_id;
            ELSIF v_auction.asset_type = 'car' THEN
                UPDATE public.user_cars
                SET user_id = v_auction.current_winner_user_id,
                    status = 'insured',
                    condition = 100
                WHERE id = v_auction.asset_id;
            END IF;

            -- Credit seller (previous owner) with 97% of winning bid (platform keeps 3%)
            IF v_seller_id IS NOT NULL AND v_auction.current_bid > 0 THEN
                v_seller_net := floor(v_auction.current_bid * 0.97)::bigint;

                INSERT INTO public.coin_ledger (
                    user_id, delta, bucket, source, ref_id, metadata, direction
                ) VALUES (
                    v_seller_id,
                    v_seller_net,
                    'auction_earnings',
                    'auction_payout',
                    v_auction.id,
                    jsonb_build_object(
                      'auction_id', v_auction.id,
                      'winning_bid', v_auction.current_bid,
                      'platform_fee', v_auction.current_bid - v_seller_net
                    ),
                    'in'
                );

                UPDATE public.user_profiles
                SET troll_coins = COALESCE(troll_coins, 0) + v_seller_net,
                    earned_balance = COALESCE(earned_balance, 0) + v_seller_net,
                    total_earned_coins = COALESCE(total_earned_coins, 0) + v_seller_net,
                    updated_at = now()
                WHERE id = v_seller_id;
            END IF;
        ELSE
            -- No winner: no payout; asset remains with platform? (no action)
        END IF;

        UPDATE public.asset_auctions SET status = 'ended' WHERE id = v_auction.id;
        v_count := v_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object('finalized', v_count);
END;
$$;

-- Ensure functions have correct permissions (idempotent)
GRANT EXECUTE ON FUNCTION court_levy_fine(uuid, integer, text, uuid, jsonb) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION confirm_delivery_and_release_escrow(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION finalize_auctions() TO service_role, authenticated;
