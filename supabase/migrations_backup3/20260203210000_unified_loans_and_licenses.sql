-- Unified Loans & License Enforcement Migration
-- 1. Block suspended drivers from buying cars
-- 2. Implement instant loans for Credit Score > 650 across Car, Property, Landlord, and Bank

-- ==========================================
-- 1. Vehicle Loans Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vehicle_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    vehicle_id UUID NOT NULL REFERENCES public.user_vehicles(id) ON DELETE CASCADE,
    total_amount INTEGER NOT NULL,
    remaining_amount INTEGER NOT NULL,
    monthly_payment INTEGER NOT NULL,
    interest_rate NUMERIC DEFAULT 0.05,
    next_payment_due_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    missed_payments INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted', 'repo')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vehicle_loans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users view own vehicle loans" ON public.vehicle_loans;
    CREATE POLICY "Users view own vehicle loans" ON public.vehicle_loans 
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ==========================================
-- 2. Helper: Check Credit Eligibility
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_instant_loan_eligibility(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_score INTEGER;
BEGIN
    SELECT score INTO v_score FROM public.user_credit WHERE user_id = p_user_id;
    
    -- Default to 400 if no record (though seed should handle it)
    IF v_score IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN v_score > 650;
END;
$$;

-- ==========================================
-- 3. Update purchase_from_ktauto (License Check + Loans)
-- ==========================================
CREATE OR REPLACE FUNCTION purchase_from_ktauto(
    p_catalog_id INTEGER,
    p_plate_type TEXT DEFAULT 'temp', -- 'temp' or 'hard'
    p_use_loan BOOLEAN DEFAULT FALSE
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
    v_down_payment INTEGER;
    v_loan_amount INTEGER;
    v_purchase_count INTEGER;
    v_user_vehicle_id UUID;
    v_plate_number TEXT;
    v_reg_expiry TIMESTAMPTZ;
    v_license_status TEXT;
    v_credit_eligible BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validate User
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 2. Check License Status
    SELECT status INTO v_license_status FROM public.user_driver_licenses WHERE user_id = v_user_id;
    -- If no license record, assume they need one? Or default to valid? 
    -- Usually new users might not have a record. Let's assume 'valid' if null, or strict?
    -- The table defaults to 'valid'.
    IF v_license_status IS NOT NULL AND v_license_status IN ('suspended', 'revoked') THEN
        RETURN jsonb_build_object('success', false, 'message', 'License is ' || v_license_status || '. Purchase denied.');
    END IF;

    -- 3. Get Car Details
    SELECT * INTO v_car FROM public.vehicles_catalog WHERE id = p_catalog_id;
    IF v_car IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    -- 4. Check Purchase Limit
    SELECT COUNT(*) INTO v_purchase_count 
    FROM public.vehicle_transactions 
    WHERE user_id = v_user_id 
      AND type = 'purchase' 
      AND created_at > NOW() - INTERVAL '30 days';

    IF v_purchase_count >= 25 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monthly purchase limit reached');
    END IF;

    -- 5. Calculate Costs
    SELECT amount INTO v_title_fee FROM public.tmv_fee_schedule WHERE fee_type = 'title_issue';
    
    IF p_plate_type = 'hard' THEN
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_hard';
        v_reg_expiry := NOW() + INTERVAL '60 days';
    ELSE
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_temp';
        v_reg_expiry := NOW() + INTERVAL '7 days';
    END IF;

    v_total_cost := v_car.price + COALESCE(v_title_fee, 500) + COALESCE(v_reg_fee, 200);

    -- 6. Handle Loan vs Cash
    IF p_use_loan THEN
        -- Check Credit
        v_credit_eligible := public.check_instant_loan_eligibility(v_user_id);
        IF NOT v_credit_eligible THEN
            RETURN jsonb_build_object('success', false, 'message', 'Credit score must be > 650 for instant loan');
        END IF;

        -- 10% Down Payment on CAR PRICE only. Fees must be paid in full? 
        -- Usually fees are paid upfront.
        v_down_payment := FLOOR(v_car.price * 0.10);
        v_loan_amount := v_car.price - v_down_payment;
        
        -- User pays Down Payment + Fees
        v_total_cost := v_down_payment + COALESCE(v_title_fee, 500) + COALESCE(v_reg_fee, 200);
    ELSE
        v_down_payment := 0;
        v_loan_amount := 0;
        -- v_total_cost remains full price
    END IF;

    -- 7. Check Balance & Deduct
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
    
    IF v_user_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds: ' || v_total_cost || ' required');
    END IF;

    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_total_cost 
    WHERE id = v_user_id;

    -- 8. Create User Vehicle
    INSERT INTO public.user_vehicles (user_id, catalog_id)
    VALUES (v_user_id, p_catalog_id)
    RETURNING id INTO v_user_vehicle_id;

    -- 9. Create Title
    INSERT INTO public.vehicle_titles (user_vehicle_id, user_id)
    VALUES (v_user_vehicle_id, v_user_id);

    -- 10. Create Registration
    v_plate_number := generate_license_plate();
    INSERT INTO public.vehicle_registrations (user_vehicle_id, plate_number, plate_type, expires_at)
    VALUES (v_user_vehicle_id, v_plate_number, p_plate_type, v_reg_expiry);

    -- 11. Create Insurance (Unpaid)
    INSERT INTO public.vehicle_insurance_policies (user_vehicle_id, status)
    VALUES (v_user_vehicle_id, 'unpaid');

    -- 12. Create Loan Record (If applicable)
    IF p_use_loan AND v_loan_amount > 0 THEN
        INSERT INTO public.vehicle_loans (
            user_id, vehicle_id, total_amount, remaining_amount, monthly_payment, next_payment_due_at
        ) VALUES (
            v_user_id, 
            v_user_vehicle_id, 
            v_loan_amount, 
            v_loan_amount, 
            CEIL(v_loan_amount / 12.0), -- 12 month term example
            NOW() + INTERVAL '30 days'
        );
    END IF;

    -- 13. Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (
        v_user_id, 
        v_user_vehicle_id, 
        'purchase', 
        v_total_cost, 
        jsonb_build_object(
            'car_price', v_car.price,
            'loan_amount', v_loan_amount,
            'is_loan', p_use_loan,
            'plate', v_plate_number
        )
    );

    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        -v_total_cost, 
        'purchase', 
        'Bought ' || v_car.name || (CASE WHEN p_use_loan THEN ' (Loan)' ELSE '' END)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle purchased successfully',
        'vehicle_id', v_user_vehicle_id,
        'plate', v_plate_number
    );
END;
$$;

-- ==========================================
-- 4. Update buy_property_with_loan (Enforce > 650)
-- ==========================================
CREATE OR REPLACE FUNCTION public.buy_property_with_loan(p_property_id UUID, p_down_payment INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_balance INTEGER;
    v_loan_amount INTEGER;
    v_min_down_payment INTEGER;
    v_credit_eligible BOOLEAN;
BEGIN
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    -- Credit Check
    v_credit_eligible := public.check_instant_loan_eligibility(v_user_id);
    IF NOT v_credit_eligible THEN
        RETURN jsonb_build_object('success', false, 'error', 'Credit score must be > 650 for instant property loan');
    END IF;

    IF v_property.is_for_sale = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not for sale');
    END IF;
    
    IF v_property.owner_id = v_user_id THEN
         RETURN jsonb_build_object('success', false, 'error', 'You already own this property');
    END IF;

    -- Calculate Loan
    v_min_down_payment := FLOOR(v_property.price * 0.10); -- 10% min down
    
    IF p_down_payment < v_min_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Down payment must be at least 10%');
    END IF;

    IF p_down_payment > v_property.price THEN
        p_down_payment := v_property.price;
    END IF;

    v_loan_amount := v_property.price - p_down_payment;
    
    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins for down payment');
    END IF;

    -- Deduct Down Payment
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_down_payment WHERE id = v_user_id;
    
    -- Log transaction
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -p_down_payment, 'purchase', 'housing', 'Down payment for ' || v_property.name);

    -- Transfer Ownership
    IF v_property.owner_id IS NOT NULL THEN
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_property.price WHERE id = v_property.owner_id;
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
        VALUES (v_property.owner_id, v_property.price, 'sale', 'housing', 'Sold property ' || v_property.name);
    END IF;

    UPDATE public.properties 
    SET owner_id = v_user_id, 
        owner_user_id = v_user_id, 
        is_for_sale = false, 
        is_for_rent = true 
    WHERE id = p_property_id;

    -- Create Loan
    IF v_loan_amount > 0 THEN
        INSERT INTO public.property_loans (
            user_id, property_id, total_amount, remaining_amount, monthly_payment, next_payment_due_at
        ) VALUES (
            v_user_id, p_property_id, v_loan_amount, v_loan_amount, ceil(v_loan_amount / 24.0), NOW() + INTERVAL '30 days'
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==========================================
-- 5. Update purchase_landlord_license (Add Loan Option)
-- ==========================================
CREATE OR REPLACE FUNCTION public.purchase_landlord_license(p_use_loan BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INTEGER := 7000;
    v_balance INTEGER;
    v_credit_eligible BOOLEAN;
    v_pay_amount INTEGER;
BEGIN
    -- Check if already landlord
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id AND is_landlord = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already a landlord');
    END IF;

    -- Determine Payment
    IF p_use_loan THEN
        v_credit_eligible := public.check_instant_loan_eligibility(v_user_id);
        IF NOT v_credit_eligible THEN
            RETURN jsonb_build_object('success', false, 'error', 'Credit score must be > 650 for instant loan');
        END IF;
        v_pay_amount := 700; -- 10% down payment
    ELSE
        v_pay_amount := v_cost;
    END IF;

    -- Check balance (if paying upfront)
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_pay_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Deduct coins
    IF v_pay_amount > 0 THEN
        UPDATE public.user_profiles SET troll_coins = troll_coins - v_pay_amount WHERE id = v_user_id;
        
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_user_id, -v_pay_amount, 'purchase', 'landlord_license', 'Landlord License Purchase', 'out');
    END IF;

    -- Grant License
    UPDATE public.user_profiles SET is_landlord = true WHERE id = v_user_id;

    -- Create Loan if applicable
    IF p_use_loan THEN
        -- Using landlord_loans table? 
        -- landlord_loans requires a property_id.
        -- We should probably use the GENERIC loans table for this "business loan".
        
        INSERT INTO public.loans (user_id, principal, balance, status)
        VALUES (v_user_id, v_cost - v_pay_amount, v_cost - v_pay_amount, 'active');
        
        -- Log it
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_user_id, 0, 'loan', 'landlord_license', 'Landlord License Loan Taken', 'neutral');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==========================================
-- 6. Update Troll Bank Loan (Instant Approval Boost)
-- ==========================================
CREATE OR REPLACE FUNCTION public.troll_bank_apply_for_loan(
    p_user_id uuid,
    p_requested_coins int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user record;
    v_active_loan_exists boolean;
    v_account_age_days int;
    v_max_allowed bigint;
    v_tier_name text;
    v_result json;
    v_credit_eligible boolean;
BEGIN
    -- Get user info
    SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'reason', 'User not found');
    END IF;

    -- Check active loan
    SELECT EXISTS (
        SELECT 1 FROM public.loans WHERE user_id = p_user_id AND status = 'active'
    ) INTO v_active_loan_exists;

    IF v_active_loan_exists THEN
        RETURN json_build_object('success', false, 'reason', 'Active loan exists');
    END IF;

    -- Check Credit Score Eligibility
    v_credit_eligible := public.check_instant_loan_eligibility(p_user_id);

    -- Calculate account age
    v_account_age_days := EXTRACT(DAY FROM (now() - v_user.created_at));

    -- Determine Max Loan Amount
    IF v_credit_eligible THEN
        -- BOOST: If > 650, allow up to 500,000 instantly regardless of tenure
        v_max_allowed := 500000;
        v_tier_name := 'Elite Credit Boost';
    ELSE
        -- Standard Tier Logic
        SELECT max_loan_coins, tier_name INTO v_max_allowed, v_tier_name
        FROM public.bank_tiers
        WHERE min_tenure_days <= v_account_age_days
        ORDER BY min_tenure_days DESC
        LIMIT 1;
        
        v_max_allowed := COALESCE(v_max_allowed, 0);
    END IF;

    IF p_requested_coins > v_max_allowed THEN
        RETURN json_build_object(
            'success', false, 
            'reason', 'Requested amount exceeds limit', 
            'limit', v_max_allowed,
            'tier', v_tier_name
        );
    END IF;

    -- Create application (Auto-approved)
    INSERT INTO public.loan_applications (user_id, requested_coins, status, auto_approved, reason)
    VALUES (p_user_id, p_requested_coins, 'approved', true, 'Auto-approved (' || v_tier_name || ')');

    -- Create active loan
    INSERT INTO public.loans (user_id, principal, balance, status)
    VALUES (p_user_id, p_requested_coins, p_requested_coins, 'active');

    -- Disburse coins
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_requested_coins,
        'loan',
        'loan_disbursement',
        NULL,
        jsonb_build_object('tier', v_tier_name)
    ) INTO v_result;

    RETURN json_build_object(
        'success', true,
        'loan_details', v_result,
        'principal', p_requested_coins,
        'tier', v_tier_name
    );
END;
$$;
