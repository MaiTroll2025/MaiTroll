-- Update user_can_bid: reduce minimum coin requirement from 5000 to 500
-- Also update place_bid: reduce minimum coin requirement from 5000 to 500

CREATE OR REPLACE FUNCTION public.user_can_bid(p_user_id uuid, p_show_id uuid, p_lot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_balance BIGINT;
    v_min_required BIGINT := 500;
    v_blocked BOOLEAN := false;
    v_block_reason TEXT;
    v_show_status TEXT;
    v_lot_status TEXT;
    v_auctioneer_id UUID;
    v_globally_restricted BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Get user balance
    v_balance := user_coin_balance(p_user_id);
    
    -- Get show status
    SELECT status INTO v_show_status
    FROM auction_shows
    WHERE id = p_show_id;
    
    -- Get lot status
    SELECT status INTO v_lot_status
    FROM auction_lots
    WHERE id = p_lot_id;
    
    -- Get auctioneer_id from show
    SELECT auctioneer_id INTO v_auctioneer_id
    FROM auction_shows
    WHERE id = p_show_id;
    
    -- Check if user is the auctioneer (cannot bid on own auction)
    IF v_auctioneer_id IN (SELECT id FROM auctioneer_profiles WHERE user_id = p_user_id) THEN
        v_blocked := true;
        v_block_reason := 'Auctioneers cannot bid on their own shows';
    END IF;
    
    -- Check for active bid blocks (either show-specific or auctioneer-level)
    IF NOT v_blocked THEN
        SELECT abb.reason INTO v_block_reason
        FROM auction_bid_blocks abb
        WHERE abb.blocked_user_id = p_user_id
          AND abb.active = true
          AND (abb.auction_show_id = p_show_id OR abb.auction_show_id IS NULL)
          AND abb.auctioneer_user_id = (
              SELECT ap.user_id FROM auctioneer_profiles ap 
              WHERE ap.id = v_auctioneer_id
          )
        LIMIT 1;
        
        IF FOUND THEN
            v_blocked := true;
        END IF;
    END IF;
    
    -- Build result
    v_result := jsonb_build_object(
        'allowed', NOT v_blocked AND v_balance >= v_min_required AND v_show_status = 'live' AND v_lot_status = 'live',
        'reason', CASE 
            WHEN v_blocked THEN v_block_reason
            WHEN v_balance < v_min_required THEN 'Insufficient troll coins. Minimum 500 required.'
            WHEN v_show_status != 'live' THEN 'Auction show is not live'
            WHEN v_lot_status != 'live' THEN 'Lot is not currently live for bidding'
            ELSE NULL
        END,
        'balance', v_balance,
        'min_required', v_min_required,
        'blocked', v_blocked,
        'globally_restricted', v_globally_restricted,
        'show_restricted', v_show_status != 'live'
    );
    
    RETURN v_result;
END;
$function$;

-- Update place_bid to use 500 minimum instead of 5000
-- Drops and recreates the function to update the minimum coin check
DO $$
DECLARE
    v_func_source TEXT;
BEGIN
    -- Get current function source
    SELECT pg_get_functiondef(oid) INTO v_func_source
    FROM pg_proc
    WHERE proname = 'place_bid'
      AND pronamespace = 'public'::regnamespace;
    
    IF v_func_source IS NOT NULL THEN
        -- Replace 5000 with 500 in the function source
        v_func_source := REPLACE(v_func_source, '5000', '500');
        v_func_source := REPLACE(v_func_source, 'Minimum 5000', 'Minimum 500');
        EXECUTE v_func_source;
    END IF;
END $$;
