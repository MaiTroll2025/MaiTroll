-- Migration: Fix car purchase to update user profile vehicle_id for neighborhood onboarding
-- Problem: After purchasing a car, neighborhood onboarding doesn't progress because user profile vehicle_id is not set
-- Solution: Update purchase_from_ktauto function to set vehicle_id in user_profiles table

-- Update the purchase_from_ktauto function to set vehicle_id in user profile
CREATE OR REPLACE FUNCTION purchase_from_ktauto(
    p_catalog_id INTEGER,
    p_plate_type TEXT DEFAULT 'temp',
    p_use_credit BOOLEAN DEFAULT FALSE
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
    v_credit_success BOOLEAN;
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

    -- 5. Payment Processing
    IF p_use_credit THEN
        v_credit_success := public.try_pay_with_credit_card(
            v_user_id,
            v_total_cost::BIGINT,
            'vehicle_purchase',
            jsonb_build_object('car_id', p_catalog_id, 'plate_type', p_plate_type)
        );

        IF NOT v_credit_success THEN
             RETURN jsonb_build_object('success', false, 'message', 'Credit card declined (Limit exceeded or restricted)');
        END IF;
    ELSE
        -- Cash Payment
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;

        IF v_user_balance < v_total_cost THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds: ' || v_total_cost || ' required');
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_total_cost
        WHERE id = v_user_id;
    END IF;

    -- 6. Create User Vehicle
    INSERT INTO public.user_vehicles (user_id, catalog_id)
    VALUES (v_user_id, p_catalog_id)
    RETURNING id INTO v_user_vehicle_id;

    -- 7. Generate Plate
    v_plate_number := public.generate_license_plate();

    -- 8. Create Title
    INSERT INTO public.vehicle_titles (user_vehicle_id, user_id, status)
    VALUES (v_user_vehicle_id, v_user_id, 'clean');

    -- 9. Create Registration
    INSERT INTO public.vehicle_registrations (user_vehicle_id, plate_number, plate_type, expires_at, status)
    VALUES (v_user_vehicle_id, v_plate_number, p_plate_type, v_reg_expiry, 'active');

    -- 10. Create Insurance (Unpaid)
    INSERT INTO public.vehicle_insurance_policies (user_vehicle_id, status)
    VALUES (v_user_vehicle_id, 'unpaid');

    -- 11. Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (
        v_user_id,
        v_user_vehicle_id,
        'purchase',
        v_total_cost,
        jsonb_build_object(
            'car_name', v_car.name,
            'plate', v_plate_number,
            'payment_method', CASE WHEN p_use_credit THEN 'credit_card' ELSE 'cash' END
        )
    );

    -- 12. Update user profile to set vehicle_id (for neighborhood onboarding progression)
    UPDATE public.user_profiles
    SET vehicle_id = v_user_vehicle_id
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Vehicle purchased successfully', 'vehicle_id', v_user_vehicle_id);
END;
$$;