-- Migration: Fix Sell House to Bank Admin Pool Logic & Backfill
-- Description: Ensures Admin Pool row exists, updates balance logic, and backfills missing fees from ledger.

-- 1. Ensure Admin Pool has a row (Seed if missing)
DO $$
DECLARE
    v_admin_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_pool) THEN
        -- Try to find an admin
        SELECT id INTO v_admin_id 
        FROM public.user_profiles 
        WHERE role = 'admin' OR is_admin = true 
        ORDER BY created_at ASC 
        LIMIT 1;
        
        -- If no admin found, check for ANY user to own the pool temporarily (fallback)
        IF v_admin_id IS NULL THEN
            SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
        END IF;

        IF v_admin_id IS NOT NULL THEN
            INSERT INTO public.admin_pool (user_id, trollcoins_balance)
            VALUES (v_admin_id, 0);
        END IF;
    END IF;
END $$;

-- 2. Backfill Admin Pool Balance from Ledger (Recovery)
-- This sums up all Property Sale fees recorded in the ledger but missed in the balance due to missing row.
DO $$
DECLARE
    v_admin_pool_id UUID;
    v_missed_fees NUMERIC;
BEGIN
    SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;
    
    IF v_admin_pool_id IS NOT NULL THEN
        -- Calculate total property sale fees from ledger
        SELECT COALESCE(SUM(amount), 0) INTO v_missed_fees
        FROM public.admin_pool_ledger
        WHERE reason LIKE 'Property Sale Profit%';
        
        -- If the current balance is 0 (just created) or significantly less than ledger sum,
        -- we assume it missed the updates.
        -- We'll just ADD the difference if balance is 0?
        -- Safest approach: If balance is 0, set it to the sum.
        -- If balance > 0, we assume it's working partially? 
        -- But since the bug was "row missing", balance was likely 0 (or row didn't exist).
        
        UPDATE public.admin_pool
        SET trollcoins_balance = v_missed_fees
        WHERE id = v_admin_pool_id AND trollcoins_balance = 0;
    END IF;
END $$;

-- 3. Update sell_house_to_bank RPC
CREATE OR REPLACE FUNCTION public.sell_house_to_bank(
    house_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house RECORD;
    v_seller_id UUID;
    v_admin_id UUID;
    v_price BIGINT;
    v_third BIGINT;
    v_seller_share BIGINT;
    v_admin_pool_share_1 BIGINT;
    v_admin_pool_share_2 BIGINT;
    v_admin_pool_total BIGINT;
    v_admin_pool_id UUID;
BEGIN
    -- Get House Details
    SELECT * INTO v_house FROM public.properties WHERE id = house_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    v_seller_id := v_house.owner_user_id;
    
    IF v_seller_id <> auth.uid() THEN
        RAISE EXCEPTION 'You do not own this property';
    END IF;

    -- Get Admin ID (Bank Admin)
    SELECT id INTO v_admin_id 
    FROM public.user_profiles 
    WHERE role = 'admin' OR is_admin = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Bank admin not found';
    END IF;

    -- Calculate Values
    -- Using base_value from properties table
    v_price := COALESCE(v_house.base_value, 0);
    
    -- If base_value is null/zero, try ask_price or fallback
    IF v_price <= 0 THEN
       v_price := COALESCE(v_house.ask_price, 0);
    END IF;
    
    IF v_price <= 0 THEN
        IF v_house.is_starter THEN
             v_price := 1500;
        ELSE
             RAISE EXCEPTION 'Property has no value';
        END IF;
    END IF;

    v_third := FLOOR(v_price / 3);
    v_seller_share := v_third;
    v_admin_pool_share_1 := v_third;
    v_admin_pool_share_2 := v_price - v_seller_share - v_admin_pool_share_1;
    v_admin_pool_total := v_admin_pool_share_1 + v_admin_pool_share_2;

    -- Pay Seller (1/3)
    PERFORM public.troll_bank_credit_coins(
        v_seller_id,
        v_seller_share::INT,
        'paid', 
        'property_sale_seller',
        house_id::TEXT
    );

    -- Ensure Admin Pool Exists
    SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;

    IF v_admin_pool_id IS NULL THEN
        INSERT INTO public.admin_pool (user_id, trollcoins_balance)
        VALUES (v_admin_id, 0)
        RETURNING id INTO v_admin_pool_id;
    END IF;

    -- Update Admin Pool (2/3)
    UPDATE public.admin_pool
    SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_admin_pool_total,
        updated_at = NOW()
    WHERE id = v_admin_pool_id;

    -- Log to Ledger
    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
    VALUES (
        v_admin_pool_total,
        'Property Sale Profit (2x33.3% to Admin Pool) - House ' || house_id,
        v_seller_id,
        NOW()
    );

    -- Transfer Property
    UPDATE public.properties
    SET owner_user_id = v_admin_id,
        is_listed = false,
        is_active_home = false,
        updated_at = NOW()
    WHERE id = house_id;

    RETURN jsonb_build_object(
        'success', true,
        'seller_share', v_seller_share,
        'admin_pool_share_1', v_admin_pool_share_1,
        'admin_pool_share_2', v_admin_pool_share_2
    );
END;
$$;
