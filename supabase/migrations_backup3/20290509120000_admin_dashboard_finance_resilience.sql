-- Restore reliable admin dashboard user/economy rollups after finance-SQL errors or role mismatch.
-- 1. Widen bug-center staff matcher to match prod role spellings used elsewhere (super_admin, flags).
-- 2. get_admin_finance_summary_live: count admins consistently; swallow aggregate-SQL failures.

ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS is_superadmin boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_bug_center_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        role IN (
          'admin', 'superadmin', 'ceo', 'super_admin', 'platform_admin', 'moderator',
          'lead_troll_officer', 'troll_officer', 'secretary',
          'executive_secretary', 'troll_city_secretary', 'temp_city_admin'
        )
        OR troll_role IN (
          'admin', 'superadmin', 'ceo', 'super_admin', 'platform_admin', 'moderator',
          'lead_troll_officer', 'troll_officer', 'secretary',
          'executive_secretary', 'troll_city_secretary'
        )
        OR COALESCE(is_admin, false) = true
        OR COALESCE(is_superadmin, false) = true
        OR COALESCE(is_lead_officer, false) = true
        OR COALESCE(is_troll_officer, false) = true
        OR COALESCE(is_secretary, false) = true
      )
  );
$$;


CREATE OR REPLACE FUNCTION public.get_admin_finance_summary_live()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users integer := 0;
  v_admin_count integer := 0;
  v_troll_officers integer := 0;
  v_pending_apps integer := 0;
  v_pending_payouts integer := 0;
  v_ai_flags integer := 0;
  v_total_coins numeric := 0;
  v_purchased_coins numeric := 0;
  v_earned_coins numeric := 0;
  v_free_coins numeric := 0;
  v_gift_coins numeric := 0;
  v_coin_sales_revenue numeric := 0;
  v_coin_sales_ct numeric := 0;
  v_coin_sales_pp numeric := 0;
  v_coin_sales_ledger numeric := 0;
  v_platform_profit numeric := 0;
  v_total_payouts numeric := 0;
  v_fees_collected numeric := 0;
  v_coin_kind_column text := NULL;
  v_payment_status_filter text := '';
  v_pp_coin_fallback numeric := 0;
  v_coins_pp numeric := 0;
  v_money_sql text := 'usd_amount';
BEGIN
  IF NOT public.is_bug_center_staff(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (
           WHERE COALESCE(role, '') IN ('admin', 'superadmin', 'ceo', 'super_admin', 'platform_admin', 'moderator')
             OR COALESCE(is_admin, false)
             OR COALESCE(is_superadmin, false)
         ),
         COUNT(*) FILTER (
           WHERE COALESCE(role, '') IN ('troll_officer', 'lead_troll_officer')
             OR COALESCE(is_troll_officer, false)
             OR COALESCE(is_lead_officer, false)
         ),
         COALESCE(SUM(COALESCE(troll_coins, 0)), 0),
         COALESCE(SUM(COALESCE(total_earned_coins, 0)), 0)
    INTO v_total_users, v_admin_count, v_troll_officers, v_total_coins, v_earned_coins
  FROM public.user_profiles;

BEGIN
     -- Count pending applications from both creator_applications and applications tables
     -- creator_applications: broadcaster/empire partner applications
     -- applications: seller, troll_officer, lead_officer, attorney, prosecutor, auctioneer, job applications
     IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'creator_applications'
     ) THEN
       EXECUTE 'SELECT COUNT(*) FROM public.creator_applications WHERE status = ''pending''' INTO v_pending_apps;
     END IF;
     IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'applications'
     ) THEN
       EXECUTE 'SELECT COUNT(*) FROM public.applications WHERE status = ''pending''' INTO v_pending_apps;
     END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_requests'
    ) THEN
      EXECUTE
        'SELECT COUNT(*) FROM public.payout_requests WHERE status IN (''pending'', ''requested'', ''review'')'
        INTO v_pending_payouts;
      EXECUTE
        'SELECT COALESCE(SUM(amount), 0) FROM public.payout_requests WHERE status IN (''paid'', ''approved'', ''completed'')'
        INTO v_total_payouts;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'type'
    ) THEN
      v_coin_kind_column := 'type';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'transaction_type'
    ) THEN
      v_coin_kind_column := 'transaction_type';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'status'
    ) THEN
      v_payment_status_filter := ' WHERE COALESCE(status, ''completed'') IN (''completed'', ''paid'', ''success'')';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'amount_usd'
    ) THEN
      v_money_sql := 'amount_usd';
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'usd_amount'
    ) THEN
      v_money_sql := '';
    END IF;

    IF v_coin_kind_column IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'amount'
       )
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'metadata'
       )
       AND v_money_sql <> ''
    THEN
      EXECUTE format($q$
        SELECT COALESCE(SUM(ct.amount), 0)
        FROM public.coin_transactions ct
        WHERE ct.amount > 0 AND (
          ct.%I IN (
            'purchase', 'store_purchase', 'paypal_purchase', 'coin_purchase',
            'cashapp_purchase', 'stripe_purchase', 'square_purchase'
          )
          OR ct.%I::text LIKE '%%paypal%%'
          OR (
            EXISTS (
              SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'coin_transactions' AND c.column_name = 'paypal_order_id'
            )
            AND ct.paypal_order_id IS NOT NULL AND trim(ct.paypal_order_id) <> ''
          )
          OR (
            EXISTS (
              SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'coin_transactions' AND c.column_name = 'paypal_capture_id'
            )
            AND ct.paypal_capture_id IS NOT NULL AND trim(ct.paypal_capture_id) <> ''
          )
          OR COALESCE(trim(ct.metadata->>'paypal_order_id'), '') <> ''
          OR COALESCE(trim(ct.metadata->>'paypal_capture_id'), '') <> ''
          OR (
            EXISTS (
              SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'coin_transactions' AND c.column_name = 'source'
            )
            AND COALESCE(ct.source, '') IN ('purchase', 'paypal', 'coin_store', 'stripe', 'cashapp')
            AND ct.%I NOT IN ('gift', 'gift_received', 'admin_grant', 'reward', 'bonus', 'daily_login')
          )
        )
      $q$, v_coin_kind_column, v_coin_kind_column, v_coin_kind_column) INTO v_purchased_coins;

      EXECUTE format($q$
        SELECT COALESCE(SUM(
          CASE
            WHEN COALESCE(ct.%I, 0)::numeric <> 0 THEN ct.%I::numeric
            WHEN EXISTS (
              SELECT 1 FROM information_schema.columns x
              WHERE x.table_schema = 'public' AND x.table_name = 'coin_transactions' AND x.column_name = 'platform_profit'
            )
             AND COALESCE(ct.platform_profit, 0) <> 0 THEN ct.platform_profit::numeric
            ELSE GREATEST(
              COALESCE(NULLIF(trim(ct.metadata->>'amount_paid'), '')::numeric, 0),
              COALESCE(NULLIF(trim(ct.metadata->>'amount_usd'), '')::numeric, 0),
              COALESCE(NULLIF(trim(ct.metadata->>'amount'), '')::numeric, 0),
              CASE
                WHEN (
                  EXISTS (
                    SELECT 1 FROM information_schema.columns x
                    WHERE x.table_schema = 'public' AND x.table_name = 'coin_transactions'
                      AND x.column_name = 'paypal_order_id'
                  )
                  AND ct.paypal_order_id IS NOT NULL
                ) OR COALESCE(trim(ct.metadata->>'paypal_order_id'), '') <> ''
                THEN GREATEST(0::numeric, ct.amount::numeric / NULLIF(100::numeric, 0))
                ELSE 0::numeric
              END
            )
          END
        ), 0)
        FROM public.coin_transactions ct
        WHERE ct.amount > 0 AND (
          ct.%I IN (
            'purchase', 'store_purchase', 'paypal_purchase', 'coin_purchase',
            'cashapp_purchase', 'stripe_purchase', 'square_purchase'
          )
          OR ct.%I::text LIKE '%%paypal%%'
          OR (
            EXISTS (
              SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'coin_transactions'
                AND c.column_name = 'paypal_order_id'
            )
            AND ct.paypal_order_id IS NOT NULL AND trim(ct.paypal_order_id) <> ''
          )
          OR COALESCE(trim(ct.metadata->>'paypal_order_id'), '') <> ''
          OR COALESCE(trim(ct.metadata->>'paypal_capture_id'), '') <> ''
          OR (
            EXISTS (
              SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = 'coin_transactions'
                AND c.column_name = 'source'
            )
            AND COALESCE(ct.source, '') IN ('purchase', 'paypal', 'coin_store', 'stripe', 'cashapp')
            AND ct.%I NOT IN ('gift', 'gift_received', 'admin_grant', 'reward', 'bonus', 'daily_login')
          )
        )
      $q$, v_money_sql, v_money_sql, v_coin_kind_column, v_coin_kind_column, v_coin_kind_column) INTO v_coin_sales_ct;

      EXECUTE format(
        'SELECT COALESCE(SUM(amount), 0) FROM public.coin_transactions WHERE %I IN (%L,%L,%L) AND amount > 0',
        v_coin_kind_column, 'gift', 'gift_received', 'trollmond_gift'
      ) INTO v_gift_coins;
      EXECUTE format(
        'SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.coin_transactions WHERE %I IN (%L,%L,%L,%L) AND amount > 0',
        v_coin_kind_column, 'reward', 'bonus', 'daily_login', 'admin_grant'
      ) INTO v_free_coins;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'paypal_transactions'
    )
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'paypal_transactions' AND column_name = 'amount'
       )
    THEN
      EXECUTE $sql$
        SELECT COALESCE(SUM(amount), 0)
        FROM public.paypal_transactions
        WHERE COALESCE(lower(status), '') IN ('completed', 'credited', '')
      $sql$ INTO v_coin_sales_pp;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'paypal_transactions' AND column_name = 'coins'
      ) THEN
        EXECUTE $sql$
          SELECT COALESCE(SUM(coins), 0)
          FROM public.paypal_transactions
          WHERE COALESCE(lower(status), '') IN ('completed', 'credited', '')
            AND coins IS NOT NULL AND coins > 0
        $sql$ INTO v_coins_pp;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_ledger'
    )
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'purchase_ledger' AND column_name = 'usd_amount'
       )
       AND EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchasable_items'
       )
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'purchasable_items' AND column_name = 'is_coin_pack'
       )
    THEN
      EXECUTE $sql$
        SELECT COALESCE(SUM(pl.usd_amount), 0)
        FROM public.purchase_ledger pl
        JOIN public.purchasable_items pi ON pi.id = pl.item_id
        WHERE pi.is_coin_pack IS TRUE AND pl.usd_amount IS NOT NULL
      $sql$ INTO v_coin_sales_ledger;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_ledger'
    )
           AND EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'purchase_ledger' AND column_name = 'usd_amount'
           )
    THEN
      EXECUTE $sql$
        SELECT COALESCE(SUM(usd_amount), 0)
        FROM public.purchase_ledger
        WHERE usd_amount IS NOT NULL
      $sql$ INTO v_coin_sales_ledger;
    END IF;

    v_coin_sales_revenue :=
      GREATEST(COALESCE(v_coin_sales_ct, 0), COALESCE(v_coin_sales_pp, 0), COALESCE(v_coin_sales_ledger, 0));

    IF COALESCE(v_purchased_coins, 0) = 0 AND COALESCE(v_coins_pp, 0) > 0 THEN
      v_purchased_coins := v_coins_pp;
    END IF;

    IF COALESCE(v_coin_sales_revenue, 0) = 0
       AND v_coin_kind_column IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'platform_profit'
       )
    THEN
      EXECUTE format($q$
        SELECT COALESCE(SUM(ct.platform_profit), 0)
        FROM public.coin_transactions ct
        WHERE COALESCE(ct.platform_profit, 0) <> 0
          AND (
            ct.%I IN ('purchase', 'store_purchase', 'paypal_purchase', 'coin_purchase')
            OR (
              EXISTS (
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                  AND c.table_name = 'coin_transactions'
                  AND c.column_name = 'paypal_order_id'
              )
              AND ct.paypal_order_id IS NOT NULL
            )
            OR COALESCE(trim(ct.metadata->>'paypal_order_id'), '') <> ''
          )
      $q$, v_coin_kind_column) INTO v_pp_coin_fallback;
      IF COALESCE(v_pp_coin_fallback, 0) > 0 THEN
        v_coin_sales_revenue := v_pp_coin_fallback;
      END IF;
    END IF;

    IF COALESCE(v_coin_sales_revenue, 0) = 0 AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'amount_paid'
    ) THEN
      EXECUTE
        'SELECT COALESCE(SUM(amount_paid), 0) FROM public.payment_transactions'
        || v_payment_status_filter
        INTO v_coin_sales_revenue;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'platform_profit'
    ) THEN
      EXECUTE 'SELECT COALESCE(SUM(platform_profit), 0) FROM public.coin_transactions'
        INTO v_platform_profit;
    END IF;

    IF COALESCE(v_platform_profit, 0) = 0 AND EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_profit'
    ) THEN
      EXECUTE 'SELECT COALESCE(SUM(total_profit), 0) FROM public.platform_profit' INTO v_platform_profit;
    END IF;

v_fees_collected := GREATEST(v_coin_sales_revenue - v_total_payouts, 0);
    -- Count stream reports for AI/flags count (reports needing moderation review)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'stream_reports'
    ) THEN
      EXECUTE 'SELECT COUNT(*) FROM public.stream_reports WHERE status = ''pending''' INTO v_ai_flags;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'get_admin_finance_summary_live aggregates skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'total_users', v_total_users,
    'admin_count', v_admin_count,
    'pending_applications', v_pending_apps,
    'pending_payouts', v_pending_payouts,
    'troll_officer_count', v_troll_officers,
    'ai_flag_count', v_ai_flags,
    'coin_sales_revenue', v_coin_sales_revenue,
    'total_payouts', v_total_payouts,
    'fees_collected', v_fees_collected,
    'platform_profit', v_platform_profit,
    'purchased_coins', v_purchased_coins,
    'earned_coins', v_earned_coins,
    'free_coins', v_free_coins,
    'total_troll_coins', v_total_coins,
    'gift_coins', v_gift_coins,
    'app_sponsored_gifts', 0,
    'total_liability_coins', v_total_coins,
    'kick_ban_revenue', 0,
    'last_updated', now()
  );
END;
$$;
