-- Business Logic for Active Asset Economy

-- 1. Helper: Pay Coin Cost
CREATE OR REPLACE FUNCTION public.try_pay_coins(p_user_id UUID, p_amount BIGINT, p_reason TEXT, p_metadata JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id;
    
    IF v_balance >= p_amount THEN
        -- Deduct
        UPDATE public.user_profiles SET troll_coins = troll_coins - p_amount WHERE id = p_user_id;
        
        -- Ledger
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, metadata)
        VALUES (p_user_id, -p_amount, 'spend', p_reason, p_metadata);
        
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- 2. Daily Upkeep Function (To be called via pg_cron or admin endpoint)
CREATE OR REPLACE FUNCTION public.process_daily_asset_upkeep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house RECORD;
    v_car RECORD;
    v_catalog RECORD;
    v_cost BIGINT;
    v_paid BOOLEAN;
    v_processed_houses INT := 0;
    v_processed_cars INT := 0;
    v_foreclosed_houses INT := 0;
    v_foreclosed_cars INT := 0;
BEGIN
    -- A) Process Houses
    FOR v_house IN 
        SELECT uh.*, hc.daily_tax_rate_bps, hc.maintenance_rate_bps, hc.base_price
        FROM public.user_houses uh
        JOIN public.houses_catalog hc ON uh.house_catalog_id = hc.id
        WHERE uh.status IN ('active', 'delinquent')
    LOOP
        -- Calculate Cost: (Base Price * (Tax + Maint) / 10000)
        v_cost := (v_house.base_price * (v_house.daily_tax_rate_bps + v_house.maintenance_rate_bps)) / 10000;
        
        -- Minimum cost 10 coins
        IF v_cost < 10 THEN v_cost := 10; END IF;

        -- Try Pay
        v_paid := public.try_pay_coins(v_house.user_id, v_cost, 'house_upkeep', jsonb_build_object('house_id', v_house.id));
        
        IF v_paid THEN
            UPDATE public.user_houses 
            SET last_tax_paid_at = NOW(), 
                last_maintenance_paid_at = NOW(),
                status = 'active', -- Recover if was delinquent
                condition = LEAST(100, condition + 1) -- Slight repair if paid
            WHERE id = v_house.id;
        ELSE
            -- Failed to pay
            UPDATE public.user_houses
            SET status = 'delinquent',
                condition = GREATEST(0, condition - 5), -- Decay
                influence_active = false
            WHERE id = v_house.id;
            
            -- Foreclosure Check (Condition 0)
            IF (v_house.condition - 5) <= 0 THEN
                UPDATE public.user_houses SET status = 'foreclosed' WHERE id = v_house.id;
                
                -- Create Auction
                INSERT INTO public.asset_auctions (asset_type, asset_id, reason, starting_bid, ends_at)
                VALUES ('house', v_house.id, 'foreclosure', v_house.base_price / 2, NOW() + INTERVAL '2 days');
                
                v_foreclosed_houses := v_foreclosed_houses + 1;
            END IF;
        END IF;
        
        v_processed_houses := v_processed_houses + 1;
    END LOOP;

    -- B) Process Cars
    FOR v_car IN 
        SELECT uc.*, cc.insurance_rate_bps, cc.base_price
        FROM public.user_cars uc
        JOIN public.cars_catalog cc ON uc.car_catalog_id = cc.id
        WHERE uc.status IN ('active', 'insured', 'uninsured') 
          AND uc.is_active = true -- Only tax active cars? Or all? Spec implies all owned. Let's do all active/insured.
    LOOP
        -- Calculate Cost (Insurance mostly)
        v_cost := (v_car.base_price * v_car.insurance_rate_bps) / 10000;
        
        -- If daily cost is negligible, maybe skip or accumulate? For now, process.
         IF v_cost < 5 THEN v_cost := 5; END IF;

        v_paid := public.try_pay_coins(v_car.user_id, v_cost, 'car_upkeep', jsonb_build_object('car_id', v_car.id));

        IF v_paid THEN
            UPDATE public.user_cars
            SET last_fees_paid_at = NOW(),
                status = CASE WHEN status = 'uninsured' THEN 'insured' ELSE status END,
                condition = LEAST(100, condition + 1)
            WHERE id = v_car.id;
        ELSE
             UPDATE public.user_cars
            SET status = 'uninsured', -- specific status for cars
                condition = GREATEST(0, condition - 2)
            WHERE id = v_car.id;
             -- Cars maybe don't foreclose immediately, but risk impound. 
             -- If condition 0, maybe scrap?
        END IF;

        v_processed_cars := v_processed_cars + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'processed_houses', v_processed_houses,
        'processed_cars', v_processed_cars,
        'foreclosed_houses', v_foreclosed_houses
    );
END;
$$;

-- 3. Get User Asset Flags (Power Bands)
CREATE OR REPLACE FUNCTION public.get_user_asset_flags(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_flags JSONB := '{}'::jsonb;
    v_house_flags JSONB;
    v_car_flags JSONB;
BEGIN
    -- Aggregate House Flags (only active/paid houses)
    SELECT jsonb_object_agg(key, value) INTO v_house_flags
    FROM (
        SELECT DISTINCT key, value
        FROM public.user_houses uh
        JOIN public.houses_catalog hc ON uh.house_catalog_id = hc.id
        CROSS JOIN jsonb_each(hc.feature_flags)
        WHERE uh.user_id = p_user_id 
          AND uh.status = 'active'
          AND uh.influence_active = true
    ) t;

    -- Aggregate Car Flags (active cars)
    SELECT jsonb_object_agg(key, value) INTO v_car_flags
    FROM (
        SELECT DISTINCT key, value
        FROM public.user_cars uc
        JOIN public.cars_catalog cc ON uc.car_catalog_id = cc.id
        CROSS JOIN jsonb_each(cc.feature_flags)
        WHERE uc.user_id = p_user_id 
          AND uc.status IN ('active', 'insured')
    ) t;

    -- Merge
    v_flags := COALESCE(v_house_flags, '{}'::jsonb) || COALESCE(v_car_flags, '{}'::jsonb);
    
    RETURN v_flags;
END;
$$;
