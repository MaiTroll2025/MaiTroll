-- Create Cashout Requests Table
CREATE TABLE IF NOT EXISTS public.trollmond_cashouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    amount INTEGER NOT NULL,
    usd_value NUMERIC NOT NULL,
    paypal_email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Helper RPC to get balance and hold status
CREATE OR REPLACE FUNCTION public.get_trollmond_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
    v_holds INTEGER;
BEGIN
    SELECT trollmonds INTO v_balance FROM public.user_profiles WHERE id = p_user_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_holds FROM public.trollmond_holds WHERE user_id = p_user_id AND unlock_at > now();
    
    RETURN jsonb_build_object(
        'balance', COALESCE(v_balance, 0),
        'holds', v_holds,
        'available', GREATEST(0, COALESCE(v_balance, 0) - v_holds)
    );
END;
$$;

-- RPC: Request Cashout
CREATE OR REPLACE FUNCTION public.request_cashout(
    p_amount INTEGER,
    p_paypal_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_balance INTEGER;
    v_holds INTEGER;
    v_available INTEGER;
    v_min_withdraw INTEGER := 1000;
    v_usd_rate NUMERIC := 100.0; -- 100 TM = $1
    v_usd_value NUMERIC;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF p_amount < v_min_withdraw THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is ' || v_min_withdraw || ' TM');
    END IF;

    -- Check Balance and Holds
    SELECT trollmonds INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_holds FROM public.trollmond_holds WHERE user_id = v_user_id AND unlock_at > now();
    
    v_available := COALESCE(v_balance, 0) - v_holds;

    IF v_available < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient available balance (Funds may be on hold)');
    END IF;

    -- Calculate USD Value
    v_usd_value := ROUND((p_amount / v_usd_rate), 2);

    -- Deduct Balance
    UPDATE public.user_profiles
    SET trollmonds = trollmonds - p_amount
    WHERE id = v_user_id;

    -- Create Cashout Record
    INSERT INTO public.trollmond_cashouts (user_id, amount, usd_value, paypal_email)
    VALUES (v_user_id, p_amount, v_usd_value, p_paypal_email);

    -- Log Transaction
    INSERT INTO public.trollmond_transactions (
        user_id, amount, type, source_type, source_id, description
    ) VALUES (
        v_user_id, -p_amount, 'cashout', 'cashout_request', NULL, 'Cashout request for $' || v_usd_value
    );

    RETURN jsonb_build_object('success', true, 'message', 'Cashout request submitted');
END;
$$;
