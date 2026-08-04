-- Migration for Rentals and Auctions Logic
-- Implements manual payments, rental system, and auction mechanics

-- ==========================================
-- 1. MANUAL PAYMENTS (Upkeep)
-- ==========================================

CREATE OR REPLACE FUNCTION public.pay_house_dues(p_user_house_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_house RECORD;
    v_catalog RECORD;
    v_cost BIGINT;
    v_paid BOOLEAN;
BEGIN
    -- Get House Info
    SELECT uh.*, hc.daily_tax_rate_bps, hc.maintenance_rate_bps, hc.base_price
    INTO v_house
    FROM public.user_houses uh
    JOIN public.houses_catalog hc ON uh.house_catalog_id = hc.id
    WHERE uh.id = p_user_house_id AND uh.user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'House not found or not owned');
    END IF;

    -- Calculate Cost (Same as daily upkeep, but maybe allow partial or specific period? For now, pay 1 day worth to clear delinquency)
    -- If delinquent, paying once should reset status? Or do we track 'balance due'?
    -- Kain says "If delinquent beyond grace period...". Simplest model: Pay 'current due' which we can approximate as 1 day of upkeep if we don't track debt balance.
    -- Better: If delinquent, pay 1 day + penalty?
    -- Let's stick to: User pays X amount to clear status.
    
    v_cost := (v_house.base_price * (v_house.daily_tax_rate_bps + v_house.maintenance_rate_bps)) / 10000;
    IF v_cost < 10 THEN v_cost := 10; END IF;

    v_paid := public.try_pay_coins(v_user_id, v_cost, 'house_manual_payment', jsonb_build_object('house_id', p_user_house_id));

    IF v_paid THEN
        UPDATE public.user_houses 
        SET last_tax_paid_at = NOW(), 
            last_maintenance_paid_at = NOW(),
            status = 'active',
            influence_active = true,
            condition = LEAST(100, condition + 5) -- Repair bonus for manual care
        WHERE id = p_user_house_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'Payment successful, house active');
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_car_dues(p_user_car_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_car RECORD;
    v_cost BIGINT;
    v_paid BOOLEAN;
BEGIN
    SELECT uc.*, cc.insurance_rate_bps, cc.base_price
    INTO v_car
    FROM public.user_cars uc
    JOIN public.cars_catalog cc ON uc.car_catalog_id = cc.id
    WHERE uc.id = p_user_car_id AND uc.user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Car not found');
    END IF;

    v_cost := (v_car.base_price * v_car.insurance_rate_bps) / 10000;
    IF v_cost < 5 THEN v_cost := 5; END IF;

    v_paid := public.try_pay_coins(v_user_id, v_cost, 'car_manual_payment', jsonb_build_object('car_id', p_user_car_id));

    IF v_paid THEN
        UPDATE public.user_cars
        SET last_fees_paid_at = NOW(),
            status = 'insured',
            insurance_expires_at = NOW() + INTERVAL '7 days' -- Manual pay gives 1 week buffer? Or just 1 day? Kain implies daily check. Let's give 24h buffer.
        WHERE id = p_user_car_id;
        
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;
END;
$$;


-- ==========================================
-- 2. RENTALS
-- ==========================================

CREATE OR REPLACE FUNCTION public.create_rental_listing(p_user_house_id UUID, p_rent_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_house RECORD;
BEGIN
    SELECT * INTO v_house FROM public.user_houses WHERE id = p_user_house_id AND user_id = v_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'House not found'); END IF;

    -- Check slots? For now assume 1 slot per house or check catalog
    -- Simplification: One active rental per house for now unless we split it.
    -- Kain says "rent_slots".
    
    -- Create "vacancy" logic?
    -- Actually, we need to list it. Or just allow people to "Apply".
    -- Let's assume this creates a "Listing" (which we might need a table for, or just use house status?)
    -- But wait, `house_rentals` links landlord and tenant.
    -- So we need a way for a tenant to find a house.
    -- Let's add `is_for_rent` and `rent_price` to `user_houses`.
    
    UPDATE public.user_houses 
    SET feature_flags = feature_flags || jsonb_build_object('is_for_rent', true, 'rent_price', p_rent_amount)
    WHERE id = p_user_house_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rent_property(p_user_house_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID := auth.uid();
    v_house RECORD;
    v_rent_price BIGINT;
    v_paid BOOLEAN;
    v_rental_id UUID;
BEGIN
    SELECT * INTO v_house FROM public.user_houses WHERE id = p_user_house_id;
    
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'House not found'); END IF;
    
    -- Check if for rent
    IF NOT (v_house.feature_flags->>'is_for_rent')::boolean THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not for rent');
    END IF;
    
    v_rent_price := (v_house.feature_flags->>'rent_price')::bigint;
    
    -- Pay first month
    v_paid := public.try_pay_coins(v_tenant_id, v_rent_price, 'rent_payment', jsonb_build_object('house_id', p_user_house_id));
    
    IF v_paid THEN
        -- Create Rental Record
        INSERT INTO public.house_rentals (landlord_user_id, tenant_user_id, user_house_id, rent_amount, status, last_paid_at, next_due_at)
        VALUES (v_house.user_id, v_tenant_id, p_user_house_id, v_rent_price, 'active', NOW(), NOW() + INTERVAL '7 days') -- Weekly rent
        RETURNING id INTO v_rental_id;
        
        -- Pay Landlord (minus fee)
        -- Fee 10%
        PERFORM public.try_pay_coins(v_house.user_id, -1 * (v_rent_price * 0.9)::bigint, 'rent_income', jsonb_build_object('rental_id', v_rental_id));
        -- Note: try_pay_coins handles deduction. To GIVE coins, we pass negative amount?
        -- `try_pay_coins` implementation: `UPDATE ... SET troll_coins = troll_coins - p_amount`.
        -- So yes, negative amount ADDS coins.
        
        -- Unlist house
        UPDATE public.user_houses 
        SET feature_flags = feature_flags || jsonb_build_object('is_for_rent', false)
        WHERE id = p_user_house_id;

        RETURN jsonb_build_object('success', true, 'rental_id', v_rental_id);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;
END;
$$;

-- ==========================================
-- 3. AUCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id UUID, p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_auction RECORD;
    v_paid BOOLEAN;
BEGIN
    SELECT * INTO v_auction FROM public.asset_auctions WHERE id = p_auction_id;
    
    IF v_auction.status != 'active' OR v_auction.ends_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction ended');
    END IF;
    
    IF p_amount <= v_auction.current_bid OR p_amount < v_auction.starting_bid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bid too low');
    END IF;
    
    -- Hold funds
    v_paid := public.try_pay_coins(v_user_id, p_amount, 'auction_bid', jsonb_build_object('auction_id', p_auction_id));
    
    IF v_paid THEN
        -- Refund previous winner
        IF v_auction.current_winner_user_id IS NOT NULL THEN
            -- Refund
            PERFORM public.try_pay_coins(v_auction.current_winner_user_id, -1 * v_auction.current_bid, 'auction_refund', jsonb_build_object('auction_id', p_auction_id));
        END IF;
        
        -- Update Auction
        UPDATE public.asset_auctions
        SET current_bid = p_amount,
            current_winner_user_id = v_user_id
        WHERE id = p_auction_id;
        
        -- Log Bid
        INSERT INTO public.auction_bids (auction_id, bidder_user_id, amount)
        VALUES (p_auction_id, v_user_id, p_amount);
        
        RETURN jsonb_build_object('success', true);
    ELSE
         RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_auctions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auction RECORD;
    v_count INT := 0;
BEGIN
    FOR v_auction IN 
        SELECT * FROM public.asset_auctions 
        WHERE status = 'active' AND ends_at <= NOW()
    LOOP
        -- Transfer Asset
        IF v_auction.current_winner_user_id IS NOT NULL THEN
            IF v_auction.asset_type = 'house' THEN
                UPDATE public.user_houses 
                SET user_id = v_auction.current_winner_user_id,
                    status = 'active',
                    condition = 100, -- Reset condition on win? Or keep it? Let's reset to be nice.
                    feature_flags = feature_flags - 'is_for_rent' -- Reset flags
                WHERE id = v_auction.asset_id;
            ELSIF v_auction.asset_type = 'car' THEN
                UPDATE public.user_cars
                SET user_id = v_auction.current_winner_user_id,
                    status = 'insured', -- Give them a break
                    condition = 100
                WHERE id = v_auction.asset_id;
            END IF;
            
            -- Payout to system (burned) or previous owner?
            -- Kain says "Auctions are the primary mechanism to force circulation from delinquency".
            -- Usually proceeds cover debt, rest to owner?
            -- Or if foreclosed, bank takes all.
            -- Kain: "asset transfers, ledger logs everything".
            -- We already took the money from the bidder in `place_bid`.
            
        ELSE
            -- No winner?
            -- Return to bank? Delete?
            -- Let's leave it 'foreclosed' or extend?
            -- For now, mark ended.
        END IF;

        UPDATE public.asset_auctions SET status = 'ended' WHERE id = v_auction.id;
        v_count := v_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object('finalized', v_count);
END;
$$;
