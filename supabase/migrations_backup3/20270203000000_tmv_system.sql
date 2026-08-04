-- 1. TMV System - Profile Updates
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS drivers_license_status TEXT DEFAULT 'none', -- none, active, suspended, expired
ADD COLUMN IF NOT EXISTS drivers_license_expiry TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gas_balance NUMERIC DEFAULT 100.0 CHECK (gas_balance >= 0 AND gas_balance <= 100),
ADD COLUMN IF NOT EXISTS last_gas_update TIMESTAMPTZ DEFAULT now();

-- 2. TMV System - Vehicle Updates
ALTER TABLE public.user_cars
ADD COLUMN IF NOT EXISTS insurance_expiry TIMESTAMPTZ;

-- 3. Gas Requests Table
CREATE TABLE IF NOT EXISTS public.gas_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for Gas Requests
ALTER TABLE public.gas_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gas_requests' AND policyname = 'Users can view requests involving them') THEN
        CREATE POLICY "Users can view requests involving them" ON public.gas_requests
            FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gas_requests' AND policyname = 'Users can create requests') THEN
        CREATE POLICY "Users can create requests" ON public.gas_requests
            FOR INSERT WITH CHECK (auth.uid() = requester_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gas_requests' AND policyname = 'Users can update requests sent to them') THEN
        CREATE POLICY "Users can update requests sent to them" ON public.gas_requests
            FOR UPDATE USING (auth.uid() = target_user_id);
    END IF;
END $$;


-- 4. RPC: Submit Driver Test
-- Answers are validated server-side.
CREATE OR REPLACE FUNCTION public.submit_driver_test(answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_score INTEGER := 0;
    v_passed BOOLEAN := false;
    v_correct_answers JSONB := '[
        {"q": 1, "a": "A"}, 
        {"q": 2, "a": "B"}, 
        {"q": 3, "a": "B"}, 
        {"q": 4, "a": "C"}, 
        {"q": 5, "a": "B"}, 
        {"q": 6, "a": "B"}, 
        {"q": 7, "a": "C"}, 
        {"q": 8, "a": "A"}, 
        {"q": 9, "a": "B"}, 
        {"q": 10, "a": "B"}
    ]'; -- Correct answers aligned with frontend
    v_answer RECORD;
    v_user_answer TEXT;
    v_total_questions INTEGER := 10;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Validate Answers
    FOR v_answer IN SELECT * FROM jsonb_array_elements(v_correct_answers)
    LOOP
        v_user_answer := answers->>(v_answer.value->>'q');
        IF v_user_answer = (v_answer.value->>'a') THEN
            v_score := v_score + 1;
        END IF;
    END LOOP;

    -- Pass condition: 90% (9/10)
    IF v_score >= 9 THEN
        v_passed := true;
        
        -- Update Profile
        UPDATE public.user_profiles
        SET drivers_license_status = 'active',
            drivers_license_expiry = now() + interval '30 days'
        WHERE id = v_user_id;
        
        -- Grant Badge (Assuming a badges system exists, if not, this is a placeholder)
        -- We will assume a 'badges' array or similar in user_profiles if standard, 
        -- but based on file list 'UserBadge.tsx', badges might be complex. 
        -- For now, we just set the license status which triggers the badge UI.
        
        -- Bonus: Coins towards free vehicle
        PERFORM public.troll_bank_credit_coins(
             v_user_id,
             1000, -- Amount to earn
             'reward',
             'drivers_test_passed',
             NULL, -- p_ref_id
             '{}'::jsonb
        );
    END IF;

    RETURN jsonb_build_object(
        'passed', v_passed, 
        'score', v_score, 
        'percent', (v_score::float / v_total_questions::float) * 100
    );
END;
$$;


-- 5. RPC: Refill Gas
CREATE OR REPLACE FUNCTION public.refill_gas(p_amount_percent NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_gas NUMERIC;
    v_cost INTEGER;
    v_new_gas NUMERIC;
    v_is_staff BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Check Staff Status (Staff don't pay)
    SELECT (role IN ('admin', 'secretary', 'troll_officer', 'lead_troll_officer')) INTO v_is_staff
    FROM public.user_profiles WHERE id = v_user_id;

    -- Calculate Cost: 300 coins per 5%
    -- p_amount_percent must be multiple of 5? Let's allow any, but charge accordingly.
    -- Prompt: "300 Troll Coins per 5%"
    v_cost := CEIL((p_amount_percent / 5.0) * 300.0);

    IF v_is_staff THEN
        v_cost := 0;
    END IF;

    -- Deduct Coins
    IF v_cost > 0 THEN
        PERFORM public.troll_bank_spend_coins(
            v_user_id,
            v_cost,
            'paid',
            'gas_refill',
            NULL,
            jsonb_build_object('amount', p_amount_percent)
        );
    END IF;

    -- Update Gas
    UPDATE public.user_profiles
    SET gas_balance = LEAST(gas_balance + p_amount_percent, 100.0),
        last_gas_update = now()
    WHERE id = v_user_id
    RETURNING gas_balance INTO v_new_gas;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_gas, 'cost', v_cost);
END;
$$;


-- 6. RPC: Consume Gas
CREATE OR REPLACE FUNCTION public.consume_gas(p_amount NUMERIC DEFAULT 5.0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_gas NUMERIC;
BEGIN
    v_user_id := auth.uid();
    
    UPDATE public.user_profiles
    SET gas_balance = GREATEST(gas_balance - p_amount, 0.0),
        last_gas_update = now()
    WHERE id = v_user_id
    RETURNING gas_balance INTO v_current_gas;
    
    RETURN jsonb_build_object('success', true, 'new_balance', v_current_gas);
END;
$$;


-- 7. RPC: Purchase Insurance
CREATE OR REPLACE FUNCTION public.purchase_insurance(p_car_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_cost INTEGER := 2000;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Verify ownership
    PERFORM 1 FROM public.user_cars WHERE id = p_car_id AND user_id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found or not owned'; END IF;

    -- Deduct Coins
    PERFORM public.troll_bank_spend_coins(
        v_user_id,
        v_cost,
        'paid',
        'vehicle_insurance',
        NULL,
        jsonb_build_object('car_id', p_car_id)
    );

    -- Update Vehicle
    UPDATE public.user_cars
    SET insurance_expiry = now() + interval '30 days' -- Assuming 30 days coverage
    WHERE id = p_car_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. RPC: Request Gas
CREATE OR REPLACE FUNCTION public.request_gas(p_target_user_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_requester_username TEXT;
BEGIN
    v_user_id := auth.uid();
    
    INSERT INTO public.gas_requests (requester_id, target_user_id, amount)
    VALUES (v_user_id, p_target_user_id, p_amount);
    
    -- Get requester username for notification
    SELECT username INTO v_requester_username FROM public.user_profiles WHERE id = v_user_id;

    -- Create notification for target user
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        p_target_user_id,
        'gas_request',
        'Gas Request',
        v_requester_username || ' requested ' || p_amount || '% gas from you.',
        jsonb_build_object('requester_id', v_user_id, 'amount', p_amount)
    );
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. RPC: Approve Gas Request
CREATE OR REPLACE FUNCTION public.approve_gas_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_req RECORD;
    v_sender_gas NUMERIC;
BEGIN
    v_user_id := auth.uid(); -- The approver (sender of gas)
    
    SELECT * INTO v_req FROM public.gas_requests WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    
    IF v_req.target_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Not authorized to approve this request';
    END IF;
    
    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'Request already processed';
    END IF;

    -- Check sender balance
    SELECT gas_balance INTO v_sender_gas FROM public.user_profiles WHERE id = v_user_id;
    IF v_sender_gas < v_req.amount THEN
        RAISE EXCEPTION 'Insufficient gas balance';
    END IF;

    -- Atomic Transfer
    -- Deduct from sender
    UPDATE public.user_profiles 
    SET gas_balance = gas_balance - v_req.amount 
    WHERE id = v_user_id;
    
    -- Add to requester
    UPDATE public.user_profiles 
    SET gas_balance = LEAST(gas_balance + v_req.amount, 100.0) 
    WHERE id = v_req.requester_id;
    
    -- Update Request
    UPDATE public.gas_requests 
    SET status = 'approved', updated_at = now() 
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. RPC: Admin Suspend License
CREATE OR REPLACE FUNCTION public.admin_suspend_license(p_target_user_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_admin_id := auth.uid();
    
    -- Check Admin/Secretary Role
    SELECT (role IN ('admin', 'secretary')) INTO v_is_admin
    FROM public.user_profiles WHERE id = v_admin_id;
    
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

    IF p_action = 'suspend' THEN
        UPDATE public.user_profiles
        SET drivers_license_status = 'suspended'
        WHERE id = p_target_user_id;
    ELSIF p_action = 'revoke' THEN
        UPDATE public.user_profiles
        SET drivers_license_status = 'none',
            drivers_license_expiry = NULL
        WHERE id = p_target_user_id;
    ELSIF p_action = 'reinstate' THEN
        UPDATE public.user_profiles
        SET drivers_license_status = 'active'
        WHERE id = p_target_user_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
