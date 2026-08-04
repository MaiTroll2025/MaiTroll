-- Update process_daily_asset_upkeep to include Hotel Tax

CREATE OR REPLACE FUNCTION public.process_daily_asset_upkeep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house RECORD;
    v_car RECORD;
    v_user RECORD;
    v_cost BIGINT;
    v_paid BOOLEAN;
    v_processed_houses INT := 0;
    v_processed_cars INT := 0;
    v_foreclosed_houses INT := 0;
    v_foreclosed_cars INT := 0;
    v_processed_hotel_tax INT := 0;
    v_hotel_tax_amount BIGINT := 50; -- Daily cost for not owning a home
BEGIN
    -- A) Process Houses (Taxes & Maintenance)
    FOR v_house IN 
        SELECT uh.*, hc.daily_tax_rate_bps, hc.maintenance_rate_bps, hc.base_price, hc.name
        FROM public.user_houses uh
        JOIN public.houses_catalog hc ON uh.houses_catalog_id = hc.id
        WHERE uh.status IN ('active', 'delinquent')
    LOOP
        -- Calculate Cost: (Base Price * (Tax + Maint) / 10000)
        -- Apply discounts from upgrades?
        -- For performance in a loop, maybe skip complex upgrade checks or use a simplified view.
        -- Let's stick to base rates for the daily job for now to ensure speed, 
        -- unless we optimize the query to include discounts.
        
        v_cost := (v_house.base_price * (v_house.daily_tax_rate_bps + v_house.maintenance_rate_bps)) / 10000;
        
        -- Minimum cost 10 coins
        IF v_cost < 10 THEN v_cost := 10; END IF;

        -- Try Pay
        v_paid := public.try_pay_coins(v_house.user_id, v_cost, 'house_upkeep', jsonb_build_object('house_id', v_house.id, 'house_name', v_house.name));
        
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

    -- B) Process Cars (Insurance)
    FOR v_car IN 
        SELECT uc.*, cc.insurance_rate_bps, cc.base_price, cc.name
        FROM public.user_cars uc
        JOIN public.cars_catalog cc ON uc.car_catalog_id = cc.id
        WHERE uc.status IN ('active', 'insured', 'uninsured') 
    LOOP
        -- Calculate Cost (Insurance mostly)
        v_cost := (v_car.base_price * v_car.insurance_rate_bps) / 10000;
        
        IF v_cost < 5 THEN v_cost := 5; END IF;

        v_paid := public.try_pay_coins(v_car.user_id, v_cost, 'car_upkeep', jsonb_build_object('car_id', v_car.id, 'car_name', v_car.name));

        IF v_paid THEN
            UPDATE public.user_cars
            SET last_fees_paid_at = NOW(),
                status = CASE WHEN status = 'uninsured' THEN 'insured' ELSE status END,
                condition = LEAST(100, condition + 1)
            WHERE id = v_car.id;
        ELSE
             UPDATE public.user_cars
            SET status = 'uninsured',
                condition = GREATEST(0, condition - 2)
            WHERE id = v_car.id;
        END IF;

        v_processed_cars := v_processed_cars + 1;
    END LOOP;
    
    -- C) Process Hotel Tax (Users with no active house)
    -- Find users who do NOT have an 'active' house
    FOR v_user IN
        SELECT p.id, p.username
        FROM public.user_profiles p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_houses uh 
            WHERE uh.user_id = p.id AND uh.status = 'active'
        )
    LOOP
        -- Charge Hotel Tax
        v_paid := public.try_pay_coins(v_user.id, v_hotel_tax_amount, 'hotel_tax', jsonb_build_object('message', 'No active residence'));
        
        -- If they can't pay hotel tax... nothing happens? Or they go into debt?
        -- try_pay_coins checks balance. If false, we just log or ignore.
        -- Ideally, debt system would track this, but for now we just try to charge.
        
        v_processed_hotel_tax := v_processed_hotel_tax + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'processed_houses', v_processed_houses,
        'processed_cars', v_processed_cars,
        'foreclosed_houses', v_foreclosed_houses,
        'hotel_tax_payers', v_processed_hotel_tax
    );
END;
$$;
