-- Migration to fix Living System Loans and Add Occupancy Limits

-- 1. Add max_tenants to properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS max_tenants INTEGER DEFAULT 1;

-- 2. Fix pay_bank_loan RPC to work with bank_loans table
CREATE OR REPLACE FUNCTION public.pay_bank_loan(
    p_loan_id UUID,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_loan RECORD;
    v_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- 1. Verify Loan in bank_loans
    SELECT * INTO v_loan FROM public.bank_loans WHERE id = p_loan_id;

    IF NOT FOUND OR v_loan.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    IF v_loan.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan is not active');
    END IF;

    -- Cap amount to remaining balance
    IF p_amount > v_loan.remaining_balance THEN
        p_amount := v_loan.remaining_balance;
    END IF;

    IF p_amount <= 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- 2. Check User Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- 3. Process Payment
    -- Deduct from user
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - p_amount 
    WHERE id = v_user_id;

    -- Update loan
    UPDATE public.bank_loans
    SET remaining_balance = remaining_balance - p_amount,
        status = CASE WHEN remaining_balance - p_amount <= 0 THEN 'paid' ELSE 'active' END
    WHERE id = p_loan_id;

    -- Log transaction
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction, metadata)
    VALUES (
        v_user_id, 
        -p_amount, 
        'repayment', 
        'bank_loan_repayment', 
        'Loan Repayment', 
        'out',
        jsonb_build_object('loan_id', p_loan_id)
    );

    RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;

-- 3. Helper to check occupancy
CREATE OR REPLACE FUNCTION public.get_property_occupancy(p_property_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT count(*)::INTEGER 
    FROM public.leases 
    WHERE property_id = p_property_id 
    AND status = 'active';
$$;

-- 4. Update sign_lease to handle multi-tenancy
CREATE OR REPLACE FUNCTION public.sign_lease(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_total_cost INTEGER;
    v_rent INTEGER;
    v_utilities INTEGER;
    v_balance INTEGER;
    v_owner_id UUID;
    v_lease_id UUID;
    v_occupancy INTEGER;
    v_max_tenants INTEGER;
BEGIN
    -- Get Property
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    IF v_property.is_for_rent = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not for rent');
    END IF;
    
    -- Check Occupancy
    SELECT count(*)::INTEGER INTO v_occupancy FROM public.leases WHERE property_id = p_property_id AND status = 'active';
    v_max_tenants := COALESCE(v_property.max_tenants, 1);
    
    IF v_occupancy >= v_max_tenants THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property is fully occupied');
    END IF;

    -- Check if user already renting this property
    IF EXISTS (SELECT 1 FROM public.leases WHERE property_id = p_property_id AND tenant_id = v_user_id AND status = 'active') THEN
         RETURN jsonb_build_object('success', false, 'error', 'You are already renting this property');
    END IF;

    -- Calculate Cost (1st Month Rent + Utilities)
    v_rent := v_property.rent_amount;
    v_utilities := COALESCE(v_property.utility_cost, 0);
    v_total_cost := v_rent + v_utilities;
    v_owner_id := v_property.owner_id;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for first month rent + utilities');
    END IF;

    -- Deduct from Tenant
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;
    
    -- Distribute Initial Payment (Rent + Utilities)
    -- 1. Utilities -> Admin Pool (Ledger only)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -v_utilities, 'utility_payment', 'housing', 'Utility Payment (Initial)', 'out');

    -- 2. Rent -> Owner or System
    IF v_owner_id IS NULL THEN
        -- System owned
         INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
         VALUES (v_user_id, -v_rent, 'rent_payment', 'housing', 'Rent Payment (System)', 'out');
    ELSE
         -- User owned: 10% Tax
         DECLARE
            v_tax_amount INTEGER := floor(v_rent * 0.10);
            v_owner_payout INTEGER := v_rent - v_tax_amount;
         BEGIN
             UPDATE public.user_profiles SET troll_coins = troll_coins + v_owner_payout WHERE id = v_owner_id;
             INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
             VALUES (v_owner_id, v_owner_payout, 'rent_income', 'housing', 'Rent Received', 'in');
         END;
    END IF;

    -- Create Lease
    INSERT INTO public.leases (property_id, tenant_id, start_date, rent_due_day, last_rent_paid_at, last_utility_paid_at, status)
    VALUES (p_property_id, v_user_id, NOW(), EXTRACT(DAY FROM NOW()), NOW(), NOW(), 'active')
    RETURNING id INTO v_lease_id;

    -- Create Invoice Record
    INSERT INTO public.invoices (lease_id, tenant_id, type, amount, status, paid_at)
    VALUES (v_lease_id, v_user_id, 'rent', v_rent, 'paid', NOW()),
           (v_lease_id, v_user_id, 'electric', v_utilities, 'paid', NOW());

    -- Update Property Status ONLY if full
    IF v_occupancy + 1 >= v_max_tenants THEN
        UPDATE public.properties SET is_for_rent = false WHERE id = p_property_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'lease_id', v_lease_id);
END;
$$;
