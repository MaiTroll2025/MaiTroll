-- Migration for Asset Purchase Logic
-- Implements purchase_house and purchase_car RPCs

CREATE OR REPLACE FUNCTION public.purchase_house(p_house_catalog_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_house_catalog RECORD;
    v_paid BOOLEAN;
    v_new_house_id UUID;
BEGIN
    -- Get Catalog Info
    SELECT * INTO v_house_catalog FROM public.houses_catalog WHERE id = p_house_catalog_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'House type not found');
    END IF;

    -- Check if user already owns a primary house? 
    -- Kain doesn't strictly forbid multiple houses, but usually games limit 1 per type or just 1 primary.
    -- Let's allow multiple, but only one is primary (handled by app logic later). 
    -- For now, just buy it.

    -- Attempt Payment
    v_paid := public.try_pay_coins(v_user_id, v_house_catalog.base_price, 'house_purchase', jsonb_build_object('catalog_id', p_house_catalog_id, 'name', v_house_catalog.name));

    IF v_paid THEN
        -- Insert User House
        INSERT INTO public.user_houses (
            user_id, 
            house_catalog_id, 
            purchase_price, 
            condition, 
            status, 
            influence_active,
            last_tax_paid_at,
            last_maintenance_paid_at
        )
        VALUES (
            v_user_id, 
            p_house_catalog_id, 
            v_house_catalog.base_price, 
            100, 
            'active', 
            true,
            NOW(), -- Paid up front for today? Or starts accruing? Let's say grace period starts now.
            NOW()
        )
        RETURNING id INTO v_new_house_id;

        RETURN jsonb_build_object('success', true, 'house_id', v_new_house_id);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.purchase_car(p_car_catalog_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_car_catalog RECORD;
    v_paid BOOLEAN;
    v_new_car_id UUID;
    v_reg_fee BIGINT;
BEGIN
    -- Get Catalog Info
    SELECT * INTO v_car_catalog FROM public.cars_catalog WHERE id = p_car_catalog_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Car not found');
    END IF;

    v_reg_fee := COALESCE(v_car_catalog.registration_fee, 0);
    
    -- Total Cost = Base Price + Registration Fee (Initial)
    -- Or just Base Price? Kain says "Registration required (recurring)".
    -- Usually buying a car includes first registration.
    
    v_paid := public.try_pay_coins(v_user_id, v_car_catalog.base_price + v_reg_fee, 'car_purchase', jsonb_build_object('catalog_id', p_car_catalog_id, 'name', v_car_catalog.name));

    IF v_paid THEN
        -- Insert User Car
        INSERT INTO public.user_cars (
            user_id, 
            car_catalog_id, 
            purchase_price, 
            condition, 
            status, 
            insurance_expires_at,
            registration_expires_at,
            plate_status,
            last_fees_paid_at,
            car_id -- Legacy field, use name or slug
        )
        VALUES (
            v_user_id, 
            p_car_catalog_id, 
            v_car_catalog.base_price, 
            100, 
            'insured', 
            NOW() + INTERVAL '7 days', -- 1 week insurance included?
            NOW() + INTERVAL '30 days', -- 1 month registration included
            'valid',
            NOW(),
            v_car_catalog.legacy_slug -- Backfill legacy field
        )
        RETURNING id INTO v_new_car_id;

        RETURN jsonb_build_object('success', true, 'car_id', v_new_car_id);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;
END;
$$;
