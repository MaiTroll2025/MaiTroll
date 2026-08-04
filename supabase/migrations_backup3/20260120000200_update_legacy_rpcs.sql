-- Update legacy RPCs to use Troll Bank pipeline

-- 1. Update add_troll_coins (Used by Square, PayPal, admin tools)
DROP FUNCTION IF EXISTS public.add_troll_coins(uuid, integer);
CREATE OR REPLACE FUNCTION public.add_troll_coins(
    user_id_input uuid,
    coins_to_add integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    -- Call centralized bank function
    -- Defaulting bucket to 'paid' as this is usually for purchases
    -- Source 'legacy_rpc' to track origin
    SELECT public.troll_bank_credit_coins(
        user_id_input,
        coins_to_add,
        'paid',
        'legacy_add_troll_coins'
    ) INTO v_result;
END;
$$;

-- 2. Update add_free_coins (Used by TrollSurprise, TrollWalking, etc.)
DROP FUNCTION IF EXISTS public.add_free_coins(uuid, integer);
CREATE OR REPLACE FUNCTION public.add_free_coins(
    p_user_id uuid,
    p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    -- Call centralized bank function
    -- Bucket 'promo' or 'gifted' - using 'promo' for gameplay rewards
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'promo',
        'gameplay_reward'
    ) INTO v_result;
END;
$$;

-- 3. Update process_referral_rewards (Trigger function)
CREATE OR REPLACE FUNCTION public.process_referral_rewards()
RETURNS TRIGGER AS $$
DECLARE
    referral_record RECORD;
    current_troll_coins BIGINT;
    v_bank_result json;
BEGIN
    -- Only process if troll_coins increased
    IF NEW.troll_coins > OLD.troll_coins THEN
        -- Check if this user was referred
        SELECT * INTO referral_record
        FROM referrals
        WHERE referred_user_id = NEW.user_id
        AND reward_status = 'pending'
        AND deadline > NOW();

        IF FOUND THEN
            -- Get current total troll_coins
            -- We can use the NEW.troll_coins directly or query if needed, 
            -- but let's stick to the original logic of checking balance
            IF NEW.troll_coins >= 40000 THEN
                -- Mark referral as completed
                UPDATE referrals
                SET reward_status = 'completed', updated_at = NOW()
                WHERE id = referral_record.id;

                -- Insert reward record
                INSERT INTO empire_partner_rewards (referrer_id, referred_user_id, coins_awarded)
                VALUES (referral_record.referrer_id, NEW.user_id, 10000);

                -- Add coins to referrer's wallet using Troll Bank
                SELECT public.troll_bank_credit_coins(
                    referral_record.referrer_id,
                    10000,
                    'promo', -- Referral rewards are promo/earned
                    'referral_reward',
                    referral_record.id::text
                ) INTO v_bank_result;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add Secretary RLS Policies
-- Grant read access to secretary role for all bank tables

-- coin_ledger
CREATE POLICY "Secretary can view all ledgers" ON public.coin_ledger
FOR SELECT
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'secretary'
);

-- loans
CREATE POLICY "Secretary can view all loans" ON public.loans
FOR SELECT
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'secretary'
);

-- loan_applications
CREATE POLICY "Secretary can view all applications" ON public.loan_applications
FOR SELECT
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'secretary'
);

-- bank_audit_log
ALTER TABLE public.bank_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Secretary can view audit logs" ON public.bank_audit_log
FOR SELECT
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'secretary'
);
CREATE POLICY "Admins can view audit logs" ON public.bank_audit_log
FOR SELECT
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' OR
  (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) = true
);

-- bank_tiers (Everyone can view, so no change needed, but ensuring secretary can edit if needed?)
-- Usually secretary is read-only for config, admin edits. Leaving as select-only for now.
