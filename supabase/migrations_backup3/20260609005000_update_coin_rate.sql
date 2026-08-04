-- Update coin rate to 0.5 per minute and fix types

-- 0. Drop triggers and views that depend on the columns
DROP MATERIALIZED VIEW IF EXISTS public.user_earnings_summary;
DROP VIEW IF EXISTS public.earnings_view;
DROP VIEW IF EXISTS public.creator_earnings;
DROP VIEW IF EXISTS public.monthly_earnings_breakdown;
DROP VIEW IF EXISTS public.economy_summary CASCADE;
-- Drop triggers on user_profiles that reference troll_coins/earnings columns
DROP TRIGGER IF EXISTS trg_sync_trollstown_coins ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_prevent_admin_troll_coins_decrease ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_check_referral_qualification ON public.user_profiles;
-- 1. Change column types using USING expression (avoids blocking on view dependencies)
ALTER TABLE public.user_profiles ALTER COLUMN troll_coins TYPE NUMERIC(20, 2) USING troll_coins::NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_earned_coins TYPE NUMERIC(20, 2) USING total_earned_coins::NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_spent_coins TYPE NUMERIC(20, 2) USING total_spent_coins::NUMERIC(20, 2);

-- 2. Update process_stream_billing to charge 0.5 coins
CREATE OR REPLACE FUNCTION public.process_stream_billing(
  p_stream_id UUID,
  p_user_id UUID,
  p_is_host BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_profile RECORD;
  v_cost NUMERIC(20, 2);
  v_guest RECORD;
BEGIN
  -- Check if stream exists and is active
  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF NOT FOUND OR v_stream.is_live = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found or not active');
  END IF;

  -- Get user profile
  SELECT * INTO v_user_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- A. Broadcaster Billing (0.5 coins/min)
  IF p_is_host THEN
    -- Check for exempt roles (Admin/Officers don't pay)
    IF v_user_profile.role IN ('admin', 'troll_officer', 'lead_troll_officer', 'secretary') THEN
      v_cost := 0;
    ELSE
      v_cost := 0.5; -- CHANGED FROM 2 TO 0.5
    END IF;

    IF v_cost > 0 THEN
        -- Check balance
        IF v_user_profile.troll_coins < v_cost THEN
           -- End stream if insufficient funds
           UPDATE public.streams
           SET is_live = false, ended_at = NOW()
           WHERE id = p_stream_id;
           
           RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'end_stream');
        END IF;

        -- Deduct coins
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_cost,
            total_spent_coins = total_spent_coins + v_cost
        WHERE id = p_user_id;

        -- Record transaction
        INSERT INTO public.coin_transactions (
          user_id,
          amount,
          type,
          description,
          stream_id
        ) VALUES (
          p_user_id,
          -v_cost,
          'stream_cost',
          'Broadcasting fee (1 min)',
          p_stream_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  -- B. Guest Billing (0.5 coins/min)
  -- Check if user is a guest in this stream
  SELECT * INTO v_guest
  FROM public.stream_guests
  WHERE stream_id = p_stream_id AND user_id = p_user_id AND status = 'active';

  IF FOUND THEN
      -- Check for exempt roles
      IF v_user_profile.role IN ('admin', 'troll_officer', 'lead_troll_officer', 'secretary') THEN
        v_cost := 0;
      ELSE
        v_cost := 0.5; -- CHANGED FROM 2 TO 0.5
      END IF;

      IF v_cost > 0 THEN
          IF v_user_profile.troll_coins < v_cost THEN
            -- Remove guest
            UPDATE public.stream_guests
            SET status = 'removed', left_at = NOW()
            WHERE stream_id = p_stream_id AND user_id = p_user_id;
            
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'remove_guest');
          END IF;

          -- Deduct coins
          UPDATE public.user_profiles
          SET troll_coins = troll_coins - v_cost,
              total_spent_coins = total_spent_coins + v_cost
          WHERE id = p_user_id;

          -- Record transaction
          INSERT INTO public.coin_transactions (
            user_id,
            amount,
            type,
            description,
            stream_id
          ) VALUES (
            p_user_id,
            -v_cost,
            'stream_cost',
            'Guest participation fee (1 min)',
            p_stream_id
          );
      END IF;

      RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'User not associated with stream billing');
END;
$$;

-- 3. Recreate triggers

-- Recreate admin safeguard: prevent admins/officers from having troll_coins decreased
CREATE OR REPLACE FUNCTION public.prevent_admin_troll_coins_decrease()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when troll_coins column is being decreased
  IF NEW.troll_coins < OLD.troll_coins THEN
    -- Check if user has a protected admin/officer role
    IF OLD.role IN ('admin', 'superadmin', 'secretary', 'lead_troll_officer', 'troll_officer')
       OR OLD.is_admin = true
       OR OLD.is_troll_officer = true
       OR OLD.is_lead_officer = true
       OR OLD.is_staff = true
       OR OLD.is_superadmin = true THEN
      RAISE EXCEPTION 'Cannot decrease troll coins for admin/officer users';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_admin_troll_coins_decrease
  BEFORE UPDATE OF troll_coins ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.troll_coins > NEW.troll_coins)
  EXECUTE FUNCTION public.prevent_admin_troll_coins_decrease();

-- Recreate referral qualification trigger (depends on troll_coins, onboarding_complete)
CREATE OR REPLACE FUNCTION public.check_referral_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id uuid;
  v_is_self_referral boolean;
  v_existing_qualified integer;
  v_founding_count integer;
BEGIN
  -- Only proceed if user has a referrer
  IF NEW.referred_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_referrer_id := NEW.referred_by_user_id;

  -- Check self-referral
  v_is_self_referral := (v_referrer_id = NEW.id);
  IF v_is_self_referral THEN
    RETURN NEW;
  END IF;

  -- Check if already qualified
  IF NEW.is_qualified_referral THEN
    RETURN NEW;
  END IF;

  -- Check qualification: onboarding complete AND >= 5000 coins
  IF COALESCE(NEW.onboarding_complete, false) = true AND COALESCE(NEW.troll_coins, 0) >= 5000 THEN
    -- Mark as qualified
    NEW.is_qualified_referral := true;
    NEW.qualified_referral_at := NOW();
    NEW.referred_user_bonus_active := true;

    -- Activate referrer as empire partner
    UPDATE public.user_profiles
    SET is_empire_partner = true,
        empire_partner = true,
        partner_status = 'active'
    WHERE id = v_referrer_id
      AND (is_empire_partner = false OR is_empire_partner IS NULL);

    -- Check if referrer qualifies for founding partner (first 15 with at least 1 qualified referral)
    SELECT COUNT(*) INTO v_existing_qualified
    FROM public.user_profiles
    WHERE referred_by_user_id = v_referrer_id
      AND is_qualified_referral = true
      AND id != NEW.id;

    -- If this is their first qualified referral, check founding eligibility
    IF v_existing_qualified = 0 THEN
      SELECT COUNT(*) INTO v_founding_count
      FROM public.user_profiles
      WHERE founding_partner = true;

      IF v_founding_count < 15 THEN
        UPDATE public.user_profiles
        SET founding_partner = true,
            founding_partner_rank = v_founding_count + 1
        WHERE id = v_referrer_id
          AND (founding_partner = false OR founding_partner IS NULL);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_referral_qualification
  BEFORE UPDATE OF troll_coins, onboarding_complete ON public.user_profiles
  FOR EACH ROW
  WHEN (NEW.referred_by_user_id IS NOT NULL AND NEW.is_qualified_referral = false)
  EXECUTE FUNCTION public.check_referral_qualification();

-- Note: trg_sync_trollstown_coins intentionally NOT recreated because trollstown_properties table is unused

-- 4. Recreate views
CREATE OR REPLACE VIEW "public"."creator_earnings" WITH ("security_invoker"='true') AS
 SELECT "u"."id" AS "user_id",
    "u"."username",
    "u"."total_earned_coins",
    "count"("ct"."id") AS "gift_count",
    "sum"("ct"."coins_awarded") AS "gift_coin_total",
    COALESCE(SUM(pr.cash_amount), 0::numeric) AS "total_earnings_usd"
   FROM ("public"."user_profiles" "u"
     LEFT JOIN "public"."coin_transactions" "ct" ON ((("u"."id" = "ct"."user_id") AND ("ct"."source" = 'gift'::"text"))))
     LEFT JOIN "public"."payout_requests" "pr" ON ("u"."id" = "pr"."user_id" AND "pr"."status" = 'paid'::"text")
  GROUP BY "u"."id", "u"."username", "u"."total_earned_coins";

CREATE OR REPLACE VIEW "public"."monthly_earnings_breakdown" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "user_id",
    "p"."username",
    "date_trunc"('month'::"text", "g"."created_at") AS "month",
    "sum"("g"."coins_spent") AS "coins_earned_from_gifts",
    "count"(DISTINCT "g"."gift_id") AS "gift_count",
    "count"(DISTINCT "g"."sender_id") AS "unique_gifters",
    "sum"(
        CASE
            WHEN ("g"."gift_type" = 'paid'::"text") THEN "g"."coins_spent"
            ELSE (0)::bigint
        END) AS "paid_coins_earned",
    "sum"(
        CASE
            WHEN ("g"."gift_type" = 'free'::"text") THEN "g"."coins_spent"
            ELSE (0)::bigint
        END) AS "free_coins_earned"
   FROM ("public"."user_profiles" "p"
     JOIN "public"."gifts" "g" ON (("g"."receiver_id" = "p"."id")))
  WHERE (("p"."is_broadcaster" = true) OR ("p"."total_earned_coins" > 0))
  GROUP BY "p"."id", "p"."username", ("date_trunc"('month'::"text", "g"."created_at"))
  ORDER BY ("date_trunc"('month'::"text", "g"."created_at")) DESC, ("sum"("g"."coins_spent")) DESC;

-- Recreate earnings_view
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
            COALESCE(g.total_coins_earned::numeric, 0::numeric) + COALESCE(t.total_coins_earned, 0::bigint)::numeric AS total_coins,
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
            date_part('year'::text, payout_requests.created_at)::integer AS year,
            sum(COALESCE(payout_requests.cash_amount, 0::numeric)) AS total_paid_usd,
            count(*) AS payout_count    
           FROM payout_requests
          WHERE payout_requests.status = 'paid'::text
          GROUP BY payout_requests.user_id, (date_part('year'::text, payout_requests.created_at))
        )
 SELECT p.id,
    p.username,
    p.total_earned_coins,
    p.troll_coins,
    COALESCE(ce.total_coins, 0::numeric) AS current_month_earnings,
    COALESCE(ce.transaction_count, 0::bigint) AS current_month_transactions,    
    COALESCE(ps.paid_out_usd, 0::numeric) AS current_month_paid_out,
    COALESCE(ps.pending_usd, 0::numeric) AS current_month_pending,
    COALESCE(ps.approved_usd, 0::numeric) AS current_month_approved,
    COALESCE(ps.paid_count, 0::bigint) AS current_month_paid_count,
    COALESCE(ps.pending_count, 0::bigint) AS current_month_pending_count,       
    COALESCE(yp.total_paid_usd, 0::numeric) AS yearly_paid_usd,
    COALESCE(yp.payout_count, 0::bigint) AS yearly_payout_count,
    COALESCE(yp.year, date_part('year'::text, now())::integer) AS tax_year,     
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
