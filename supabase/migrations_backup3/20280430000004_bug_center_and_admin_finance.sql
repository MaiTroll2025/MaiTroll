-- Bug Center + live admin finance summary.
-- Additive compatibility migration for databases that did not receive the loose SQL files.

CREATE TABLE IF NOT EXISTS public.app_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'open',
  severity text DEFAULT 'medium',
  source text NOT NULL,
  page_url text,
  route_path text,
  user_id uuid NULL,
  user_email text NULL,
  user_role text NULL,
  stream_id uuid NULL,
  function_name text NULL,
  table_name text NULL,
  error_code text NULL,
  error_message text NOT NULL,
  error_details text NULL,
  error_hint text NULL,
  stack_trace text NULL,
  request_payload jsonb NULL,
  response_payload jsonb NULL,
  browser_info jsonb NULL,
  app_context jsonb NULL,
  fixed_note text NULL,
  fixed_by uuid NULL,
  fixed_at timestamptz NULL,
  occurrence_count integer DEFAULT 1,
  last_seen_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_bug_reports
  ADD COLUMN IF NOT EXISTS occurrence_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fixed_note text,
  ADD COLUMN IF NOT EXISTS fixed_by uuid,
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_bug_reports_status_check') THEN
    ALTER TABLE public.app_bug_reports
      ADD CONSTRAINT app_bug_reports_status_check CHECK (status IN ('open', 'in_progress', 'fixed', 'ignored'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_bug_reports_severity_check') THEN
    ALTER TABLE public.app_bug_reports
      ADD CONSTRAINT app_bug_reports_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.app_bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON public.app_bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_source ON public.app_bug_reports(source);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at_desc ON public.app_bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.app_bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_stream_id ON public.app_bug_reports(stream_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_error_code ON public.app_bug_reports(error_code);
CREATE INDEX IF NOT EXISTS idx_bug_reports_duplicate_check ON public.app_bug_reports(source, route_path, error_message, status, last_seen_at);

ALTER TABLE public.app_bug_reports ENABLE ROW LEVEL SECURITY;

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
        role IN ('admin', 'superadmin', 'ceo', 'moderator', 'lead_troll_officer', 'troll_officer', 'secretary')
        OR troll_role IN ('admin', 'superadmin', 'ceo', 'moderator', 'lead_troll_officer', 'troll_officer')
        OR COALESCE(is_admin, false) = true
        OR COALESCE(is_lead_officer, false) = true
        OR COALESCE(is_troll_officer, false) = true
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_bug_center_admin(p_user_id uuid)
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
        role IN ('admin', 'superadmin', 'ceo')
        OR troll_role IN ('admin', 'superadmin', 'ceo')
        OR COALESCE(is_admin, false) = true
      )
  );
$$;

DROP POLICY IF EXISTS "Users can insert own bug reports" ON public.app_bug_reports;
CREATE POLICY "Users can insert own bug reports"
  ON public.app_bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Bug center staff can read bug reports" ON public.app_bug_reports;
CREATE POLICY "Bug center staff can read bug reports"
  ON public.app_bug_reports FOR SELECT
  TO authenticated
  USING (public.is_bug_center_staff(auth.uid()));

DROP POLICY IF EXISTS "Bug center admins can update bug reports" ON public.app_bug_reports;
CREATE POLICY "Bug center admins can update bug reports"
  ON public.app_bug_reports FOR UPDATE
  TO authenticated
  USING (public.is_bug_center_admin(auth.uid()))
  WITH CHECK (public.is_bug_center_admin(auth.uid()));

DROP POLICY IF EXISTS "Bug center admins can delete bug reports" ON public.app_bug_reports;
CREATE POLICY "Bug center admins can delete bug reports"
  ON public.app_bug_reports FOR DELETE
  TO authenticated
  USING (public.is_bug_center_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_app_bug_report(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  v_id uuid;
  v_now timestamptz := now();
  v_source text := COALESCE(payload->>'source', 'frontend');
  v_severity text := COALESCE(payload->>'severity', 'medium');
  v_page_url text := COALESCE(payload->>'page_url', payload->>'pageUrl');
  v_route_path text := COALESCE(payload->>'route_path', payload->>'routePath');
  v_user_id uuid := nullif(COALESCE(payload->>'user_id', payload->>'userId'), '')::uuid;
  v_user_email text := COALESCE(payload->>'user_email', payload->>'userEmail');
  v_user_role text := COALESCE(payload->>'user_role', payload->>'userRole');
  v_stream_id uuid := nullif(COALESCE(payload->>'stream_id', payload->>'streamId'), '')::uuid;
  v_function_name text := COALESCE(payload->>'function_name', payload->>'functionName');
  v_table_name text := COALESCE(payload->>'table_name', payload->>'tableName');
  v_error_code text := COALESCE(payload->>'error_code', payload->>'errorCode');
  v_error_message text := COALESCE(payload->>'error_message', payload->>'errorMessage', 'Unknown application error');
  v_error_details text := COALESCE(payload->>'error_details', payload->>'errorDetails');
  v_error_hint text := COALESCE(payload->>'error_hint', payload->>'errorHint');
  v_stack_trace text := COALESCE(payload->>'stack_trace', payload->>'stackTrace');
  v_is_duplicate boolean := false;
BEGIN
  IF v_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    v_severity := 'medium';
  END IF;

  -- Try to update existing duplicate first (uses index, single row lock)
  UPDATE public.app_bug_reports
  SET occurrence_count = COALESCE(occurrence_count, 1) + 1,
      last_seen_at = v_now,
      updated_at = v_now,
      page_url = COALESCE(v_page_url, page_url),
      error_code = COALESCE(v_error_code, error_code),
      error_details = COALESCE(v_error_details, error_details),
      error_hint = COALESCE(v_error_hint, error_hint),
      stack_trace = COALESCE(v_stack_trace, stack_trace),
      request_payload = COALESCE(payload->'request_payload', payload->'requestPayload', request_payload),
      response_payload = COALESCE(payload->'response_payload', payload->'responsePayload', response_payload),
      browser_info = COALESCE(payload->'browser_info', payload->'browserInfo', browser_info),
      app_context = COALESCE(payload->'app_context', payload->'appContext', app_context)
  WHERE id = (
    SELECT id
    FROM public.app_bug_reports
    WHERE source = v_source
      AND route_path IS NOT DISTINCT FROM v_route_path
      AND error_message = v_error_message
      AND status IN ('open', 'in_progress')
      AND last_seen_at > v_now - interval '60 seconds'
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_is_duplicate := true;
  ELSE
    -- No duplicate found — insert new row
    BEGIN
      INSERT INTO public.app_bug_reports (
        source, severity, page_url, route_path, user_id, user_email, user_role, stream_id,
        function_name, table_name, error_code, error_message, error_details, error_hint,
        stack_trace, request_payload, response_payload, browser_info, app_context,
        created_at, updated_at, occurrence_count, last_seen_at
      )
      VALUES (
        v_source, v_severity, v_page_url, v_route_path, v_user_id, v_user_email, v_user_role, v_stream_id,
        v_function_name, v_table_name, v_error_code, v_error_message, v_error_details, v_error_hint,
        v_stack_trace,
        COALESCE(payload->'request_payload', payload->'requestPayload'),
        COALESCE(payload->'response_payload', payload->'responsePayload'),
        COALESCE(payload->'browser_info', payload->'browserInfo'),
        COALESCE(payload->'app_context', payload->'appContext'),
        v_now, v_now, 1, v_now
      )
      RETURNING id INTO v_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Race condition: concurrent insert — fall back to update
        UPDATE public.app_bug_reports
        SET occurrence_count = COALESCE(occurrence_count, 1) + 1,
            last_seen_at = v_now,
            updated_at = v_now
        WHERE source = v_source
          AND route_path IS NOT DISTINCT FROM v_route_path
          AND error_message = v_error_message
          AND status IN ('open', 'in_progress')
        RETURNING id INTO v_id;
        v_is_duplicate := true;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'duplicate', v_is_duplicate);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_app_bug_report failed: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
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
  v_platform_profit numeric := 0;
  v_total_payouts numeric := 0;
  v_fees_collected numeric := 0;
  v_coin_kind_column text := null;
  v_coin_status_filter text := '';
  v_payment_status_filter text := '';
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

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'status') THEN
    v_payment_status_filter := ' WHERE COALESCE(status, ''completed'') IN (''completed'', ''paid'', ''success'')';
  END IF;

  IF v_coin_kind_column IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'amount')
  THEN
    EXECUTE format('SELECT COALESCE(SUM(amount), 0) FROM public.coin_transactions WHERE %I IN (''purchase'', ''store_purchase'') AND amount > 0', v_coin_kind_column) INTO v_purchased_coins;
    EXECUTE format('SELECT COALESCE(SUM(amount), 0) FROM public.coin_transactions WHERE %I IN (''gift'', ''gift_received'', ''trollmond_gift'') AND amount > 0', v_coin_kind_column) INTO v_gift_coins;
    EXECUTE format('SELECT COALESCE(SUM(ABS(amount)), 0) FROM public.coin_transactions WHERE %I IN (''reward'', ''bonus'', ''daily_login'', ''admin_grant'') AND amount > 0', v_coin_kind_column) INTO v_free_coins;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'usd_amount') THEN
    EXECUTE 'SELECT COALESCE(SUM(usd_amount), 0) FROM public.coin_transactions' || v_coin_status_filter INTO v_coin_sales_revenue;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND column_name = 'amount_usd') THEN
    EXECUTE 'SELECT COALESCE(SUM(amount_usd), 0) FROM public.coin_transactions' || v_coin_status_filter INTO v_coin_sales_revenue;
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

GRANT EXECUTE ON FUNCTION public.is_bug_center_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_bug_center_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_app_bug_report(jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_summary_live() TO authenticated;
GRANT ALL ON public.app_bug_reports TO service_role;
