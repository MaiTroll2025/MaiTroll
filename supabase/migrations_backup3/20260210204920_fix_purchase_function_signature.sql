
-- Drop conflicting signatures for purchase_from_ktauto
DROP FUNCTION IF EXISTS public.purchase_from_ktauto(p_catalog_id INTEGER, p_plate_type TEXT);
DROP FUNCTION IF EXISTS public.purchase_from_ktauto(p_catalog_id INTEGER, p_plate_type TEXT, p_use_credit BOOLEAN);
DROP FUNCTION IF EXISTS public.purchase_from_ktauto(p_catalog_id INTEGER, p_plate_type TEXT, p_use_loan BOOLEAN);

-- Recreate the function with the correct signature
CREATE OR REPLACE FUNCTION public.purchase_from_ktauto(
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
    v_property_type_id UUID;
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

    -- 3. Check Purchase Limit
    SELECT COUNT(*) INTO v_purchase_count 
    FROM public.vehicle_transactions 
    WHERE user_id = v_user_id AND type = 'purchase' AND created_at > NOW() - INTERVAL '30 days';

    IF v_purchase_count >= 25 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monthly purchase limit reached (25 cars/month)');
    END IF;

    -- 4. Calculate Costs
    v_title_fee := 50; -- Example fee
    v_reg_fee := CASE WHEN p_plate_type = 'hard' THEN 2000 ELSE 200 END;
    v_total_cost := v_car.base_price + v_title_fee + v_reg_fee;

    -- 5. Check Balance
    SELECT troll_coins INTO v_user_balance FROM public.profiles WHERE id = v_user_id;
    IF v_user_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 6. Get property_type_id for 'vehicle'
    SELECT id INTO v_property_type_id FROM public.property_types WHERE type_name = 'vehicle';
    IF v_property_type_id IS NULL THEN
        -- This is a fallback, ideally the type should always exist
        INSERT INTO public.property_types (type_name, description)
        VALUES ('vehicle', 'User-owned vehicles')
        RETURNING id INTO v_property_type_id;
    END IF;

    -- 7. Create Property Entry First
    INSERT INTO public.properties (owner_id, type_id, name, description, value)
    VALUES (v_user_id, v_property_type_id, v_car.name, v_car.name, v_car.base_price)
    RETURNING id INTO v_user_vehicle_id;

    -- 8. Create Vehicle Records
    v_plate_number := public.generate_plate_number(p_plate_type);
    v_reg_expiry := CASE WHEN p_plate_type = 'hard' THEN NOW() + INTERVAL '1 year' ELSE NOW() + INTERVAL '30 days' END;

    INSERT INTO public.user_vehicles (id, user_id, catalog_id, plate, registration_expires_at, status)
    VALUES (v_user_vehicle_id, v_user_id, p_catalog_id, v_plate_number, v_reg_expiry, 'owned');

    -- 9. Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, vehicle_id, type, amount, details)
    VALUES (v_user_id, v_user_vehicle_id, 'purchase', v_total_cost, jsonb_build_object('price', v_car.base_price, 'fees', v_title_fee + v_reg_fee));

    -- 10. Deduct Coins
    UPDATE public.profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle purchased successfully',
        'vehicle_id', v_user_vehicle_id,
        'plate', v_plate_number
    );
END;
$$;
