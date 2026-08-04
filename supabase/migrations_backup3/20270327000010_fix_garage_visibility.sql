-- Fix garage visibility and purchase logic
-- 1. Ensure RLS policies are correct for user_vehicles and related tables
-- 2. Ensure purchase_from_ktauto inserts into user_vehicles correctly

-- RLS for user_vehicles
DROP POLICY IF EXISTS "Users view own vehicles" ON public.user_vehicles;
CREATE POLICY "Users view own vehicles" ON public.user_vehicles FOR SELECT USING (auth.uid() = user_id);

-- RLS for vehicles_catalog
DROP POLICY IF EXISTS "Public read catalog" ON public.vehicles_catalog;
CREATE POLICY "Public read catalog" ON public.vehicles_catalog FOR SELECT USING (true);

-- Ensure purchase_from_ktauto is correct and explicitly uses user_vehicles
CREATE OR REPLACE FUNCTION purchase_from_ktauto(
    p_catalog_id INTEGER,
    p_plate_type TEXT DEFAULT 'temp' -- 'temp' or 'hard'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_car RECORD;
    v_user_balance BIGINT;
    v_title_fee INTEGER;
    v_reg_fee INTEGER;
    v_total_cost INTEGER;
    v_purchase_count INTEGER;
    v_user_vehicle_id UUID;
    v_plate_number TEXT;
    v_reg_expiry TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validate User
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 2. Get Car Details
    SELECT * INTO v_car FROM public.vehicles_catalog WHERE id = p_catalog_id;
    IF v_car IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    -- 3. Check Purchase Limit (25 per rolling 30 days)
    SELECT COUNT(*) INTO v_purchase_count 
    FROM public.vehicle_transactions 
    WHERE user_id = v_user_id 
      AND type = 'purchase' 
      AND created_at > NOW() - INTERVAL '30 days';

    IF v_purchase_count >= 25 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monthly purchase limit reached (25 cars/month)');
    END IF;

    -- 4. Calculate Costs
    SELECT amount INTO v_title_fee FROM public.tmv_fee_schedule WHERE fee_type = 'title_issue';
    
    IF p_plate_type = 'hard' THEN
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_hard';
        v_reg_expiry := NOW() + INTERVAL '60 days';
    ELSE
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_temp';
        v_reg_expiry := NOW() + INTERVAL '7 days';
    END IF;

    v_total_cost := v_car.price + COALESCE(v_title_fee, 500) + COALESCE(v_reg_fee, 200);

    -- 5. Check Balance & Deduct
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
    
    IF v_user_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds: ' || v_total_cost || ' required');
    END IF;

    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_total_cost 
    WHERE id = v_user_id;

    -- 6. Create User Vehicle
    INSERT INTO public.user_vehicles (user_id, catalog_id)
    VALUES (v_user_id, p_catalog_id)
    RETURNING id INTO v_user_vehicle_id;

    -- 7. Create Title
    INSERT INTO public.vehicle_titles (user_vehicle_id, user_id)
    VALUES (v_user_vehicle_id, v_user_id);

    -- 8. Create Registration (Plate)
    BEGIN
        v_plate_number := public.generate_license_plate();
    EXCEPTION WHEN OTHERS THEN
        v_plate_number := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 7));
    END;
    
    INSERT INTO public.vehicle_registrations (user_vehicle_id, plate_number, plate_type, expires_at)
    VALUES (v_user_vehicle_id, v_plate_number, p_plate_type, v_reg_expiry);

    -- 9. Create Insurance Policy (Unpaid)
    INSERT INTO public.vehicle_insurance_policies (user_vehicle_id, status)
    VALUES (v_user_vehicle_id, 'unpaid');

    -- 10. Log Transactions
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (
        v_user_id, 
        v_user_vehicle_id, 
        'purchase', 
        v_total_cost, 
        jsonb_build_object(
            'car_price', v_car.price,
            'title_fee', v_title_fee,
            'reg_fee', v_reg_fee,
            'plate_type', p_plate_type,
            'car_name', v_car.name
        )
    );

    -- Coin Transaction
    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        -v_total_cost, 
        'purchase', 
        'Bought ' || v_car.name || ' from KTAuto'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle purchased successfully',
        'vehicle_id', v_user_vehicle_id,
        'plate', v_plate_number,
        'cost', v_total_cost
    );
END;
$$;
