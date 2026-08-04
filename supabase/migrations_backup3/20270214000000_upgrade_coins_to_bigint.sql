-- Upgrade coins to NUMERIC(20, 2) to fix integer overflow and support decimals

-- 1. Drop dependent views and triggers
DROP MATERIALIZED VIEW IF EXISTS public.user_earnings_summary;
DROP VIEW IF EXISTS public.economy_summary;
DROP VIEW IF EXISTS public.earnings_view;
DROP VIEW IF EXISTS public.monthly_earnings_breakdown;
DROP VIEW IF EXISTS public.creator_earnings;

DROP TRIGGER IF EXISTS trg_sync_trollstown_coins ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_set_trollstown_coins ON public.trollstown_properties;

-- 2. Alter table columns to NUMERIC(20, 2)
-- user_profiles
ALTER TABLE public.user_profiles ALTER COLUMN troll_coins TYPE NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_earned_coins TYPE NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_spent_coins TYPE NUMERIC(20, 2);

-- Update other coin related columns if they exist (handling variations)
DO $$
BEGIN
  -- paid_coins (alias or legacy)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'paid_coins') THEN
    ALTER TABLE public.user_profiles ALTER COLUMN paid_coins TYPE NUMERIC(20, 2);
  END IF;

  -- free_coin_balance
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'free_coin_balance') THEN
    ALTER TABLE public.user_profiles ADD COLUMN free_coin_balance NUMERIC(20, 2) DEFAULT 0;
  ELSE
    ALTER TABLE public.user_profiles ALTER COLUMN free_coin_balance TYPE NUMERIC(20, 2);
  END IF;

  -- paid_coin_balance
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'paid_coin_balance') THEN
    ALTER TABLE public.user_profiles ADD COLUMN paid_coin_balance NUMERIC(20, 2) DEFAULT 0;
  ELSE
    ALTER TABLE public.user_profiles ALTER COLUMN paid_coin_balance TYPE NUMERIC(20, 2);
  END IF;

  -- earned_coin_balance
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'earned_coin_balance') THEN
    ALTER TABLE public.user_profiles ADD COLUMN earned_coin_balance NUMERIC(20, 2) DEFAULT 0;
  ELSE
    ALTER TABLE public.user_profiles ALTER COLUMN earned_coin_balance TYPE NUMERIC(20, 2);
  END IF;
END $$;

-- trollstown_properties
ALTER TABLE public.trollstown_properties ALTER COLUMN troll_coins TYPE NUMERIC(20, 2);

-- loans
ALTER TABLE public.loans ALTER COLUMN principal TYPE NUMERIC(20, 2);
ALTER TABLE public.loans ALTER COLUMN balance TYPE NUMERIC(20, 2);

-- loan_applications
ALTER TABLE public.loan_applications ALTER COLUMN requested_coins TYPE NUMERIC(20, 2);

-- bank_tiers
ALTER TABLE public.bank_tiers ALTER COLUMN max_loan_coins TYPE NUMERIC(20, 2);

-- coin_ledger
ALTER TABLE public.coin_ledger ALTER COLUMN delta TYPE NUMERIC(20, 2);

-- loan_payments
ALTER TABLE public.loan_payments ALTER COLUMN amount TYPE NUMERIC(20, 2);

-- property_loans (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_loans') THEN
    ALTER TABLE public.property_loans ALTER COLUMN total_amount TYPE NUMERIC(20, 2);
    ALTER TABLE public.property_loans ALTER COLUMN remaining_amount TYPE NUMERIC(20, 2);
    ALTER TABLE public.property_loans ALTER COLUMN monthly_payment TYPE NUMERIC(20, 2);
  END IF;
END $$;


-- 3. Update RPC functions to accept NUMERIC

DROP FUNCTION IF EXISTS public.add_troll_coins(uuid, numeric);
DROP FUNCTION IF EXISTS public.add_troll_coins(uuid, integer);
DROP FUNCTION IF EXISTS public.add_troll_coins(uuid, bigint);
-- add_troll_coins
CREATE OR REPLACE FUNCTION "public"."add_troll_coins"("user_id_input" "uuid", "coins_to_add" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_profiles
  SET 
    troll_coins = COALESCE(troll_coins, 0) + coins_to_add,
    total_earned_coins = COALESCE(total_earned_coins, 0) + coins_to_add,
    updated_at = NOW()
  WHERE id = user_id_input;
END;
$$;

-- add_earned_coins
CREATE OR REPLACE FUNCTION "public"."add_earned_coins"("user_id" "uuid", "coins" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  update user_profiles
  set earned_coin_balance = earned_coin_balance + coins,
      total_earned_coins = total_earned_coins + coins
  where id = user_id;
end;
$$;

-- add_paid_coins
DROP FUNCTION IF EXISTS public.add_paid_coins(uuid, numeric);
DROP FUNCTION IF EXISTS public.add_paid_coins(uuid, integer);
DROP FUNCTION IF EXISTS public.add_paid_coins(uuid, bigint);
CREATE OR REPLACE FUNCTION "public"."add_paid_coins"("user_id_input" "uuid", "coins_to_add" numeric) RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
  UPDATE user_profiles
  SET paid_coin_balance = COALESCE(paid_coin_balance, 0) + coins_to_add
  WHERE id = user_id_input;
$$;

-- troll_bank_credit_coins (Updated to use NUMERIC)
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins numeric, -- Changed from int to numeric
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_balance numeric(20, 2);
    v_loan_record record;
    v_repay_amount numeric(20, 2) := 0;
    v_user_gets numeric(20, 2);
    v_new_loan_balance numeric(20, 2);
    v_loan_status text;
    v_gift_repayment_enabled boolean := false;
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Lock user profile row
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
    -- Eligible buckets: 'paid' only (default)
    IF v_loan_record IS NOT NULL AND p_bucket = 'paid' THEN
        -- repay = min(loan_balance, floor(p_coins * 0.50))
        -- Using floor to keep integer-ish repayment logic if desired, or just exact amount.
        -- Let's stick to simple logic: 50% of incoming paid coins goes to loan.
        v_repay_amount := LEAST(v_loan_record.balance, (p_coins * 0.50));
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
    -- a) Repayment
    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id, p_metadata);

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
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata);
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

-- troll_bank_apply_for_loan (Updated to use NUMERIC)
DROP FUNCTION IF EXISTS public.troll_bank_apply_for_loan(integer);
DROP FUNCTION IF EXISTS public.troll_bank_apply_for_loan(numeric);
CREATE OR REPLACE FUNCTION public.troll_bank_apply_for_loan(
    p_requested_coins numeric -- Changed from int to numeric
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
    v_max_allowed numeric(20, 2);
    v_tier_name text;
    v_result json;
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'reason', 'Unauthorized: no user');
    END IF;

    -- Get user info
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'reason', 'User not found');
    END IF;

    -- Check active loan (One active loan at a time)
    SELECT EXISTS (
        SELECT 1 FROM public.loans WHERE user_id = v_user_id AND status = 'active'
    ) INTO v_active_loan_exists;

    IF v_active_loan_exists THEN
        RETURN json_build_object('success', false, 'reason', 'Active loan exists');
    END IF;

    -- Calculate account age
    v_account_age_days := EXTRACT(DAY FROM (now() - v_user.created_at));

    -- Determine Max Loan Amount based on Tiers
    SELECT max_loan_coins, tier_name INTO v_max_allowed, v_tier_name
    FROM public.bank_tiers
    WHERE min_tenure_days <= v_account_age_days
    ORDER BY min_tenure_days DESC
    LIMIT 1;
    v_max_allowed := COALESCE(v_max_allowed, 0);

    IF p_requested_coins > v_max_allowed THEN
        RETURN json_build_object(
            'success', false, 
            'reason', 'Requested amount exceeds limit based on tenure', 
            'limit', v_max_allowed,
            'current_tenure_days', v_account_age_days,
            'tier', v_tier_name
        );
    END IF;

    -- Create application (Auto-approved)
    INSERT INTO public.loan_applications (user_id, requested_coins, status, auto_approved, reason)
    VALUES (v_user_id, p_requested_coins, 'approved', true, 'Auto-approved by Troll Bank Tier System');

    -- Create active loan
    INSERT INTO public.loans (user_id, principal, balance, status)
    VALUES (v_user_id, p_requested_coins, p_requested_coins, 'active');

    -- Disburse coins
    -- Calls the credit function internally
    SELECT public.troll_bank_credit_coins(
        v_user_id,
        p_requested_coins,
        'loan',
        'loan_disbursement',
        NULL,
        jsonb_build_object('tier', v_tier_name, 'tenure', v_account_age_days)
    ) INTO v_result;

    RETURN json_build_object(
        'success', true,
        'loan_amount', p_requested_coins,
        'details', v_result
    );
END;
$$;

-- 4. Recreate Views
CREATE OR REPLACE VIEW "public"."economy_summary" WITH ("security_invoker"='true') AS
WITH 
  revenue_stats AS (
    SELECT 
      COALESCE(SUM(usd_amount), 0) as total_revenue_usd
    FROM coin_transactions 
    WHERE type = 'store_purchase' AND status = 'completed'
  ),
  circulation_stats AS (
    SELECT 
      COALESCE(SUM(coin_balance + free_coin_balance), 0) as total_coins_in_circulation
    FROM user_profiles
  ),
  gift_stats AS (
    SELECT 
      COALESCE(SUM(ABS(amount)), 0) as total_gift_coins_spent
    FROM coin_transactions 
    WHERE type = 'gift'
  ),
  payout_stats AS (
    SELECT 
      COALESCE(SUM(amount_usd) FILTER (WHERE status = 'paid'), 0) as total_payouts_processed_usd,
      COALESCE(SUM(amount_usd) FILTER (WHERE status = 'pending'), 0) as total_pending_payouts_usd
    FROM payout_requests
  ),
  creator_stats AS (
    SELECT 
      COALESCE(SUM(coins_awarded), 0) as total_creator_earned_coins
    FROM coin_transactions 
    WHERE type = 'gift'
  ),
  top_broadcaster AS (
    SELECT 
      to_user_name as top_earning_broadcaster
    FROM coin_transactions 
    WHERE type = 'gift' AND coins_awarded > 0
    GROUP BY to_user_name
    ORDER BY SUM(coins_awarded) DESC
    LIMIT 1
  )
SELECT 
  rs.total_revenue_usd,
  cs.total_coins_in_circulation,
  gs.total_gift_coins_spent,
  ps.total_payouts_processed_usd,
  ps.total_pending_payouts_usd,
  crs.total_creator_earned_coins,
  tb.top_earning_broadcaster
FROM 
  revenue_stats rs,
  circulation_stats cs,
  gift_stats gs,
  payout_stats ps,
  creator_stats crs,
  top_broadcaster tb;

-- Recreate earnings_view (Simplified if necessary, or full if dependencies exist)
-- This view is required by subsequent permissions migrations
CREATE OR REPLACE VIEW public.earnings_view AS
 WITH gift_earnings AS (
         SELECT gifts.receiver_id AS user_id,
            sum(gifts.cost) AS total_coins_earned,
            count(*) AS gift_count,
            date_trunc('month'::text, gifts.created_at) AS month
           FROM gifts
          WHERE gifts.receiver_id IS NOT NULL
          GROUP BY gifts.receiver_id, (date_trunc('month'::text, gifts.created_at))
        ), transaction_earnings AS (
         SELECT coin_transactions.user_id,
            sum(coin_transactions.amount) AS total_coins_earned,
            count(*) AS transaction_count,
            date_trunc('month'::text, coin_transactions.created_at) AS month
           FROM coin_transactions
          WHERE (coin_transactions.type = ANY (ARRAY['gift_receive'::text, 'gift'::text])) AND coin_transactions.amount > 0
          GROUP BY coin_transactions.user_id, (date_trunc('month'::text, coin_transactions.created_at))
        ), combined_earnings AS (
         SELECT COALESCE(g.user_id, t.user_id) AS user_id,
            COALESCE(g.month, t.month) AS month,
            COALESCE(g.total_coins_earned, 0::numeric) + COALESCE(t.total_coins_earned, 0::bigint)::numeric AS total_coins,
            COALESCE(g.gift_count, 0::bigint) + COALESCE(t.transaction_count, 0::bigint) AS transaction_count
           FROM gift_earnings g
             FULL JOIN transaction_earnings t ON g.user_id = t.user_id AND g.month = t.month
        ), payout_summary AS (
         SELECT payout_requests.user_id,
            date_trunc('month'::text, payout_requests.created_at) AS month,
            sum(
                CASE
                    WHEN payout_requests.status = 'paid'::text THEN COALESCE(payout_requests.cash_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS paid_out_usd,
            sum(
                CASE
                    WHEN payout_requests.status = 'pending'::text THEN COALESCE(payout_requests.cash_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS pending_usd,
            sum(
                CASE
                    WHEN payout_requests.status = 'approved'::text THEN COALESCE(payout_requests.cash_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS approved_usd,
            count(*) FILTER (WHERE payout_requests.status = 'paid'::text) AS paid_count,
            count(*) FILTER (WHERE payout_requests.status = 'pending'::text) AS pending_count
           FROM payout_requests
          GROUP BY payout_requests.user_id, (date_trunc('month'::text, payout_requests.created_at))
        ), yearly_payouts AS (
         SELECT payout_requests.user_id,
            date_part('year'::text, payout_requests.created_at) AS year,
            sum(
                CASE
                    WHEN payout_requests.status = 'paid'::text THEN COALESCE(payout_requests.cash_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS total_paid_usd
           FROM payout_requests
          GROUP BY payout_requests.user_id, (date_part('year'::text, payout_requests.created_at))
        )
 SELECT p.id AS user_id,
    p.username,
    p.avatar_url,
    p.email,
    p.troll_coins AS current_coin_balance,
    p.total_earned_coins AS lifetime_earned_coins,
    COALESCE(ce.total_coins, 0::numeric) AS monthly_earned_coins,
    COALESCE(ce.transaction_count, 0::bigint) AS monthly_gift_count,
    COALESCE(ps.paid_out_usd, 0::numeric) AS monthly_paid_out_usd,
    COALESCE(ps.pending_usd, 0::numeric) AS monthly_pending_usd,
    COALESCE(ps.approved_usd, 0::numeric) AS monthly_approved_usd,
    COALESCE(yp.total_paid_usd, 0::numeric) AS yearly_paid_out_usd,
        CASE
            WHEN COALESCE(yp.total_paid_usd, 0::numeric) >= 600::numeric THEN 'over_threshold'::text
            WHEN COALESCE(yp.total_paid_usd, 0::numeric) >= 500::numeric THEN 'nearing_threshold'::text
            ELSE 'below_threshold'::text
        END AS irs_threshold_status,
    ( SELECT max(pr.created_at) AS max
           FROM payout_requests pr
          WHERE pr.user_id = p.id AND pr.status = 'paid'::text) AS last_payout_at,
    ( SELECT count(*) AS count
           FROM payout_requests pr
          WHERE pr.user_id = p.id AND pr.status = 'pending'::text) AS pending_requests_count,
    ( SELECT sum(COALESCE(pr.cash_amount, 0::numeric)) AS sum
           FROM payout_requests pr
          WHERE pr.user_id = p.id AND pr.status = 'paid'::text) AS lifetime_paid_usd
   FROM user_profiles p
     LEFT JOIN combined_earnings ce ON ce.user_id = p.id AND ce.month = date_trunc('month'::text, now())
     LEFT JOIN payout_summary ps ON ps.user_id = p.id AND ps.month = date_trunc('month'::text, now())
     LEFT JOIN yearly_payouts yp ON yp.user_id = p.id AND yp.year = date_part('year'::text, now())::integer
  WHERE p.is_broadcaster = true OR p.total_earned_coins > 0::numeric;

-- Recreate user_earnings_summary
CREATE MATERIALIZED VIEW public.user_earnings_summary AS
 WITH user_stats AS (
         SELECT u.id AS user_id,        
            u.username,
            u.created_at AS user_created_at,
            COALESCE(u.troll_coins, 0::numeric) AS current_coin_balance,
            GREATEST(COALESCE(u.troll_coins, 0::numeric) - COALESCE(u.bonus_coin_balance, 0::numeric), 0::numeric) AS coins_eligible_for_cashout,
            COALESCE(u.bonus_coin_balance, 0::numeric) AS coins_locked,
            u.is_banned,
            u.role
           FROM user_profiles u
        ), ledger_stats AS (
         SELECT coin_ledger.user_id,    
            COALESCE(sum(
                CASE
                    WHEN coin_ledger.delta > 0::numeric THEN coin_ledger.delta  
                    ELSE 0::numeric     
                END), 0::numeric) AS total_coins_earned,
            COALESCE(sum(
                CASE
                    WHEN coin_ledger.delta < 0::numeric THEN abs(coin_ledger.delta)
                    ELSE 0::numeric     
                END), 0::numeric) AS total_coins_spent,
            COALESCE(max(
                CASE
                    WHEN coin_ledger.bucket = 'paid'::text AND coin_ledger.source = 'cashout'::text THEN coin_ledger.created_at
                    ELSE NULL::timestamp with time zone
                END), NULL::timestamp with time zone) AS last_cashout_date      
           FROM coin_ledger
          GROUP BY coin_ledger.user_id  
        ), weekly_earnings AS (
         SELECT coin_ledger.user_id,    
            COALESCE(sum(coin_ledger.delta), 0::numeric) AS weekly_earned       
           FROM coin_ledger
          WHERE coin_ledger.delta > 0::numeric AND coin_ledger.created_at > (now() - '7 days'::interval)
          GROUP BY coin_ledger.user_id  
        )
 SELECT us.user_id,
    us.username,
    COALESCE(ls.total_coins_earned, 0::numeric) AS total_coins_earned,
    COALESCE(ls.total_coins_spent, 0::numeric) AS total_coins_spent,
    us.current_coin_balance,
    us.coins_eligible_for_cashout,      
    us.coins_locked,
    ls.last_cashout_date,
    COALESCE(we.weekly_earned, 0::numeric) AS weekly_avg_earnings,
        CASE
            WHEN us.coins_eligible_for_cashout >= 12000 AND (now() - us.user_created_at) > '30 days'::interval AND (us.is_banned IS FALSE OR us.is_banned IS NULL) THEN true
            ELSE false
        END AS is_cashout_eligible,     
    now() AS last_refreshed_at
   FROM user_stats us
     LEFT JOIN ledger_stats ls ON us.user_id = ls.user_id
     LEFT JOIN weekly_earnings we ON us.user_id = we.user_id;

-- Recreate indexes for user_earnings_summary
CREATE UNIQUE INDEX idx_user_earnings_summary_user_id ON public.user_earnings_summary USING btree (user_id);
CREATE INDEX idx_user_earnings_summary_eligible ON public.user_earnings_summary USING btree (is_cashout_eligible);
