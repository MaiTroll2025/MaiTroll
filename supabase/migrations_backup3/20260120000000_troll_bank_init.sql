-- Troll Bank System Migration

-- 1. Coin Ledger (Source of Truth for coin movements)
CREATE TABLE IF NOT EXISTS public.coin_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    delta bigint NOT NULL, -- can be positive or negative
    bucket text NOT NULL, -- 'paid', 'gifted', 'promo', 'loan', 'repayment'
    source text NOT NULL, -- 'coin_purchase', 'gift', 'admin_grant', 'loan_disbursement', 'auto_repay'
    ref_id text, -- external reference ID (e.g. stripe payment id)
    created_at timestamptz DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_coin_ledger_user ON public.coin_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_created_at ON public.coin_ledger(created_at);

-- 2. Loans
CREATE TABLE IF NOT EXISTS public.loans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    principal bigint NOT NULL,
    balance bigint NOT NULL,
    status text NOT NULL DEFAULT 'active', -- 'active', 'paid', 'defaulted'
    created_at timestamptz DEFAULT now(),
    closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_loans_user_active ON public.loans(user_id) WHERE status = 'active';

-- 3. Loan Applications
CREATE TABLE IF NOT EXISTS public.loan_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    requested_coins bigint NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- 'approved', 'denied', 'pending'
    auto_approved boolean DEFAULT false,
    reason text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_applications_user ON public.loan_applications(user_id);

-- 4. Bank Tiers (Configuration)
CREATE TABLE IF NOT EXISTS public.bank_tiers (
    id serial PRIMARY KEY,
    tier_name text NOT NULL,
    min_tenure_days int NOT NULL DEFAULT 0,
    max_loan_coins bigint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Seed initial tiers
INSERT INTO public.bank_tiers (tier_name, min_tenure_days, max_loan_coins) VALUES
('New', 7, 100),
('Established', 30, 500),
('Veteran', 90, 2000)
ON CONFLICT DO NOTHING;

-- 5. Audit Log
CREATE TABLE IF NOT EXISTS public.bank_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text NOT NULL,
    performed_by uuid REFERENCES public.user_profiles(id), -- NULL for system
    target_user_id uuid REFERENCES public.user_profiles(id),
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS Policies

-- coin_ledger
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ledger" ON public.coin_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access ledger" ON public.coin_ledger USING (true) WITH CHECK (true); -- Simplify for service role

-- loans
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own loans" ON public.loans FOR SELECT USING (auth.uid() = user_id);

-- loan_applications
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own applications" ON public.loan_applications FOR SELECT USING (auth.uid() = user_id);

-- bank_tiers
ALTER TABLE public.bank_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view tiers" ON public.bank_tiers FOR SELECT USING (true);

-- RPC 1: troll_bank_credit_coins
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins int,
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as owner (postgres/admin) to bypass RLS for updates
AS $$
DECLARE
    v_user_balance bigint;
    v_loan_record record;
    v_repay_amount bigint := 0;
    v_user_gets bigint;
    v_new_loan_balance bigint;
    v_loan_status text;
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Lock user profile row to prevent race conditions on balance
    -- We assume troll_coins is the balance column
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Lock active loan row if exists
    SELECT * INTO v_loan_record
    FROM public.loans
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    -- Determine repayment eligibility
    -- Eligible buckets: 'paid' only (default per prompt)
    -- NOT 'promo', 'loan', or 'gifted' (unless feature flagged, default OFF)
    IF v_loan_record IS NOT NULL AND p_bucket = 'paid' THEN
        -- repay = min(loan_balance, floor(p_coins * 0.50))
        v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50)::bigint);
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
    -- a) Repayment
    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id);

        -- Update loan
        UPDATE public.loans
        SET balance = balance - v_repay_amount,
            status = CASE WHEN balance - v_repay_amount <= 0 THEN 'paid' ELSE status END,
            closed_at = CASE WHEN balance - v_repay_amount <= 0 THEN now() ELSE closed_at END
        WHERE id = v_loan_record.id
        RETURNING balance, status INTO v_new_loan_balance, v_loan_status;
    ELSE
        v_new_loan_balance := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.balance ELSE 0 END;
        v_loan_status := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.status ELSE 'none' END;
    END IF;

    -- b) Credit
    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id);
    END IF;

    -- Update user balance (troll_coins)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_user_gets
    WHERE id = p_user_id;

    RETURN json_build_object(
        'repay', v_repay_amount,
        'user_gets', v_user_gets,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status
    );
END;
$$;

-- RPC 2: troll_bank_apply_for_loan
CREATE OR REPLACE FUNCTION public.troll_bank_apply_for_loan(
    p_user_id uuid,
    p_requested_coins int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user record;
    v_active_loan_exists boolean;
    v_received_gift boolean;
    v_account_age_days int;
    v_max_allowed bigint;
    v_result json;
BEGIN
    -- Get user info
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

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

    -- Check spent coins (assuming total_spent_coins column exists based on context, or we check coin_transactions)
    -- If total_spent_coins doesn't exist, we might need to query coin_transactions.
    -- Assuming total_spent_coins exists on user_profiles from previous context scans.
    -- Re-checking: "total_spent_coins" was seen in useCoins.ts hook.
    IF COALESCE(v_user.total_spent_coins, 0) < 100 THEN
        RETURN json_build_object('success', false, 'reason', 'Must have spent 100 starter coins');
    END IF;

    -- Check account age
    v_account_age_days := EXTRACT(DAY FROM (now() - v_user.created_at));
    IF v_account_age_days < 7 THEN
        RETURN json_build_object('success', false, 'reason', 'Account too new (must be > 7 days)');
    END IF;

    -- Check if user received at least one gifted coin
    -- We can check coin_transactions for type='gift' and user_id=p_user_id
    SELECT EXISTS (
        SELECT 1 FROM public.coin_transactions 
        WHERE user_id = p_user_id AND type IN ('gift', 'gift_received') AND amount > 0
    ) INTO v_received_gift;
    
    IF NOT v_received_gift THEN
        RETURN json_build_object('success', false, 'reason', 'Must have received a gift');
    END IF;

    -- Check max allowed based on tenure
    SELECT max_loan_coins INTO v_max_allowed
    FROM public.bank_tiers
    WHERE min_tenure_days <= v_account_age_days
    ORDER BY min_tenure_days DESC
    LIMIT 1;
    
    v_max_allowed := COALESCE(v_max_allowed, 0);

    IF p_requested_coins > v_max_allowed THEN
        RETURN json_build_object('success', false, 'reason', 'Requested amount exceeds limit based on tenure', 'limit', v_max_allowed);
    END IF;

    -- Eligible!
    
    -- Create application
    INSERT INTO public.loan_applications (user_id, requested_coins, status, auto_approved, reason)
    VALUES (p_user_id, p_requested_coins, 'approved', true, 'Auto-approved by Troll Bank');

    -- Create active loan
    INSERT INTO public.loans (user_id, principal, balance, status)
    VALUES (p_user_id, p_requested_coins, p_requested_coins, 'active');

    -- Disburse coins
    -- Calls the credit function internally
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_requested_coins,
        'loan',
        'loan_disbursement'
    ) INTO v_result;

    RETURN json_build_object(
        'success', true,
        'loan_details', v_result,
        'principal', p_requested_coins
    );
END;
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON public.coin_ledger TO postgres, service_role;
GRANT SELECT ON public.coin_ledger TO authenticated;

GRANT ALL ON public.loans TO postgres, service_role;
GRANT SELECT ON public.loans TO authenticated;

GRANT ALL ON public.loan_applications TO postgres, service_role;
GRANT SELECT ON public.loan_applications TO authenticated;

GRANT ALL ON public.bank_tiers TO postgres, service_role;
GRANT SELECT ON public.bank_tiers TO authenticated;

GRANT ALL ON public.bank_audit_log TO postgres, service_role;

GRANT EXECUTE ON FUNCTION public.troll_bank_credit_coins TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.troll_bank_apply_for_loan TO postgres, service_role, authenticated;

