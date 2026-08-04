-- Align admin finance summary with USD coin-pack revenue (usd_amount/platform_profit)
-- and widen purchase-oriented transaction types counted as purchased coins.

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
  v_platform_profit numeric := 0;
  v_total_payouts numeric := 0;
  v_fees_collected numeric := 0;
  v_coin_kind_column text := null;
  v_coin_status_filter text := '';
  v_coin_status_expr text := 'TRUE';
  v_payment_status_filter text := '';
  v_pp_coin_sales numeric := 0;
BEGIN
  IF NOT public.is_bug_center_staff(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE role IN ('admin', 'superadmin', 'ceo') OR COALESCE(is_admin, false)),
         COUNT(*) FILTER (WHERE role IN ('troll_officer', 'lead_troll_officer') OR COALESCE(is_troll_officer, false) OR COALESCE(is_lead_officer, false)),
         COALESCE(SUM(COALESCE(troll_coins, 0)), 0),
         COALESCE(SUM(COALESCE(total_earned_coins, 0)), 0)
    INTO v_total_users, v_admin_count, v_troll_officers, v_total_coins, v_earned_coins
  FROM public.user_profiles;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'creator_applications') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.creator_applications WHERE status = ''pending''' INTO v_pending_apps;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'applications') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.applications WHERE status = ''pending''' INTO v_pending_apps;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_requests') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.payout_requests WHERE status IN (''pending'', ''requested'', ''review'')' INTO v_pending_payouts;
    EXECUTE 'SELECT COALESCE(SUM(amount), 0) FROM public.payout_requests WHERE status IN (''paid'', ''approved'', ''completed'')' INTO v_total_payouts;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'type') THEN
    v_coin_kind_column := 'type';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'transaction_type') THEN
    v_coin_kind_column := 'transaction_type';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'status') THEN
    v_coin_status_filter := ' WHERE COALESCE(status, ''completed'') IN (''completed'', ''paid'', ''success'')';
  END IF;

  IF LENGTH(TRIM(v_coin_status_filter)) > 0 THEN
    v_coin_status_expr := LTRIM(SUBSTRING(TRIM(v_coin_status_filter) FROM 7)); -- strips leading WHERE
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'status') THEN
    v_payment_status_filter := ' WHERE COALESCE(status, ''completed'') IN (''completed'', ''paid'', ''success'')';
  END IF;

  IF v_coin_kind_column IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'amount')
  THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(amount), 0) FROM public.coin_transactions WHERE %I IN (''purchase'', ''store_purchase'', ''paypal_purchase'', ''coin_purchase'') AND amount > 0',
      v_coin_kind_column
    ) INTO v_purchased_coins;
    EXECUTE format(
      'SELECT COALESCE(SUM(amount), 0) FROM public.coin_transactions WHERE %I IN (''gift'', ''gift_received'', ''trollmond_gift'') AND amount > 0',
      v_coin_kind_column
    ) INTO v_gift_coins;
    EXECUTE format(
      'SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.coin_transactions WHERE %I IN (''reward'', ''bonus'', ''daily_login'', ''admin_grant'') AND amount > 0',
      v_coin_kind_column
    ) INTO v_free_coins;
  END IF;

  IF v_coin_kind_column IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'usd_amount')
  THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(usd_amount), 0) FROM public.coin_transactions WHERE (%s) AND %I IN (''purchase'', ''store_purchase'', ''paypal_purchase'', ''coin_purchase'')',
      v_coin_status_expr,
      v_coin_kind_column
    ) INTO v_coin_sales_revenue;
  ELSIF v_coin_kind_column IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'amount_usd')
  THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(amount_usd), 0) FROM public.coin_transactions WHERE (%s) AND %I IN (''purchase'', ''store_purchase'', ''paypal_purchase'', ''coin_purchase'')',
      v_coin_status_expr,
      v_coin_kind_column
    ) INTO v_coin_sales_revenue;
  END IF;

  IF v_coin_sales_revenue = 0
    AND v_coin_kind_column IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'platform_profit')
  THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(platform_profit), 0) FROM public.coin_transactions WHERE (%s) AND %I IN (''purchase'', ''store_purchase'', ''paypal_purchase'', ''coin_purchase'')',
      v_coin_status_expr,
      v_coin_kind_column
    ) INTO v_pp_coin_sales;
    v_coin_sales_revenue := COALESCE(v_pp_coin_sales, 0);
  END IF;

  IF v_coin_sales_revenue = 0 AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'amount_paid') THEN
    EXECUTE 'SELECT COALESCE(SUM(amount_paid), 0) FROM public.payment_transactions' || v_payment_status_filter INTO v_coin_sales_revenue;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'platform_profit') THEN
    EXECUTE 'SELECT COALESCE(SUM(platform_profit), 0) FROM public.coin_transactions' INTO v_platform_profit;
  END IF;

  IF v_platform_profit = 0 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_profit') THEN
    EXECUTE 'SELECT COALESCE(SUM(total_profit), 0) FROM public.platform_profit' INTO v_platform_profit;
  END IF;

  v_fees_collected := GREATEST(v_coin_sales_revenue - v_total_payouts, 0);

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stream_reports') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.stream_reports WHERE status = ''pending''' INTO v_ai_flags;
  END IF;

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
