-- Officer Salary Model (startup/low burn)

-- 1) Officer payroll logs (used by officer lounge + audits)
CREATE TABLE IF NOT EXISTS public.officer_payroll_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id uuid NOT NULL REFERENCES auth.users(id),
    role text NOT NULL,
    pay_period_start date NOT NULL,
    pay_period_end date NOT NULL,
    base_pay bigint NOT NULL DEFAULT 0,
    bonus_pay bigint NOT NULL DEFAULT 0,
    total_paid bigint NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('paid', 'prorated', 'skipped', 'frozen')),
    reason text,
    pool_balance_before bigint,
    pool_balance_after bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_officer_payroll_logs_officer_id ON public.officer_payroll_logs(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_payroll_logs_period ON public.officer_payroll_logs(pay_period_start, pay_period_end);

ALTER TABLE public.officer_payroll_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Prevent concurrent policy creation deadlocks
  PERFORM pg_advisory_xact_lock(703002000);
  LOCK TABLE public.officer_payroll_logs IN SHARE ROW EXCLUSIVE MODE;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'officer_payroll_logs' AND policyname = 'Officers read own logs'
  ) THEN
    CREATE POLICY "Officers read own logs" ON public.officer_payroll_logs
      FOR SELECT
      USING (auth.uid() = officer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'officer_payroll_logs' AND policyname = 'Admins read payroll logs'
  ) THEN
    CREATE POLICY "Admins read payroll logs" ON public.officer_payroll_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND (role IN ('admin', 'secretary') OR is_admin = true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'officer_payroll_logs' AND policyname = 'Admins insert payroll logs'
  ) THEN
    CREATE POLICY "Admins insert payroll logs" ON public.officer_payroll_logs
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND (role IN ('admin', 'secretary') OR is_admin = true)
        )
      );
  END IF;
END $$;

-- 2) Salary model distribution
CREATE OR REPLACE FUNCTION public.distribute_officer_payroll(p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_pool_balance bigint;
  v_pool_before bigint;
  v_total_due bigint := 0;
  v_total_paid bigint := 0;
  v_officer_count int := 0;
  v_paid_count int := 0;
  v_prorate_ratio numeric := 1.0;
  v_pay_period_start date := date_trunc('week', now())::date;
  v_pay_period_end date := (date_trunc('week', now()) + interval '6 days')::date;
  v_dist_record record;
  v_base_pay bigint;
  v_bonus_pay bigint;
  v_total_due_for_officer bigint;
  v_payout_amount bigint;
  v_is_corrupt boolean;
  v_status text;
  v_reason text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_admin_user_id AND (role IN ('admin', 'secretary') OR is_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(SUM(coin_amount), 0)
  INTO v_pool_balance
  FROM public.officer_pay_ledger;

  v_pool_before := v_pool_balance;

  IF v_pool_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No funds in officer pool');
  END IF;

  FOR v_dist_record IN
    SELECT up.id, up.role, up.is_troll_officer, up.is_lead_officer, up.is_officer_active
    FROM public.user_profiles up
    WHERE (
      up.role IN ('troll_officer', 'lead_troll_officer', 'lead_officer', 'secretary')
      OR up.is_troll_officer = true
      OR up.is_lead_officer = true
    )
    AND COALESCE(up.is_officer_active, true) = true
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.officer_corruption_flags cf
      WHERE cf.officer_id = v_dist_record.id AND cf.resolved = false
    ) INTO v_is_corrupt;

    IF v_is_corrupt THEN
      CONTINUE;
    END IF;

    v_base_pay := CASE
      WHEN v_dist_record.role IN ('lead_troll_officer', 'lead_officer') OR v_dist_record.is_lead_officer = true THEN 1800
      WHEN v_dist_record.role = 'secretary' THEN 2700
      ELSE 900
    END;

    v_bonus_pay := floor(v_base_pay * 0.10)::bigint;
    v_total_due := v_total_due + v_base_pay + v_bonus_pay;
  END LOOP;

  IF v_total_due <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No eligible officers to pay');
  END IF;

  IF v_pool_balance < v_total_due THEN
    v_prorate_ratio := v_pool_balance::numeric / v_total_due::numeric;
  END IF;

  FOR v_dist_record IN
    SELECT up.id, up.role, up.username, up.is_troll_officer, up.is_lead_officer, up.is_officer_active
    FROM public.user_profiles up
    WHERE (
      up.role IN ('troll_officer', 'lead_troll_officer', 'lead_officer', 'secretary')
      OR up.is_troll_officer = true
      OR up.is_lead_officer = true
    )
    AND COALESCE(up.is_officer_active, true) = true
  LOOP
    v_officer_count := v_officer_count + 1;

    SELECT EXISTS (
      SELECT 1 FROM public.officer_corruption_flags cf
      WHERE cf.officer_id = v_dist_record.id AND cf.resolved = false
    ) INTO v_is_corrupt;

    v_base_pay := CASE
      WHEN v_dist_record.role IN ('lead_troll_officer', 'lead_officer') OR v_dist_record.is_lead_officer = true THEN 1800
      WHEN v_dist_record.role = 'secretary' THEN 2700
      ELSE 900
    END;

    v_bonus_pay := floor(v_base_pay * 0.10)::bigint;
    v_total_due_for_officer := v_base_pay + v_bonus_pay;
    v_payout_amount := floor(v_total_due_for_officer * v_prorate_ratio)::bigint;
    v_status := 'paid';
    v_reason := NULL;

    IF v_is_corrupt THEN
      v_status := 'frozen';
      v_reason := 'corruption_flag';
      v_payout_amount := 0;
    ELSIF v_total_due_for_officer <= 0 THEN
      v_status := 'skipped';
      v_reason := 'no_due';
      v_payout_amount := 0;
    ELSIF v_payout_amount <= 0 THEN
      v_status := 'skipped';
      v_reason := 'insufficient_pool';
      v_payout_amount := 0;
    ELSIF v_prorate_ratio < 1 THEN
      v_status := 'prorated';
      v_reason := 'pool_prorated';
    END IF;

    IF v_payout_amount > 0 THEN
      UPDATE public.user_profiles
      SET troll_coins = troll_coins + v_payout_amount
      WHERE id = v_dist_record.id;

      INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
      VALUES (
        v_dist_record.id,
        v_payout_amount,
        'payroll',
        'officer_salary',
        'Weekly Officer Salary',
        jsonb_build_object(
          'base_pay', v_base_pay,
          'bonus_pay', v_bonus_pay,
          'prorate_ratio', v_prorate_ratio,
          'pay_period_start', v_pay_period_start,
          'pay_period_end', v_pay_period_end
        )
      );

      INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
      VALUES (
        'officer_payout',
        v_dist_record.id::text,
        -v_payout_amount,
        jsonb_build_object(
          'base_pay', v_base_pay,
          'bonus_pay', v_bonus_pay,
          'prorate_ratio', v_prorate_ratio,
          'pay_period_start', v_pay_period_start,
          'pay_period_end', v_pay_period_end
        )
      );

      v_total_paid := v_total_paid + v_payout_amount;
      v_paid_count := v_paid_count + 1;
    END IF;

    INSERT INTO public.officer_payroll_logs (
      officer_id,
      role,
      pay_period_start,
      pay_period_end,
      base_pay,
      bonus_pay,
      total_paid,
      status,
      reason,
      pool_balance_before,
      pool_balance_after,
      metadata
    ) VALUES (
      v_dist_record.id,
      CASE
        WHEN v_dist_record.role IS NOT NULL THEN v_dist_record.role
        WHEN v_dist_record.is_lead_officer = true THEN 'lead_officer'
        ELSE 'troll_officer'
      END,
      v_pay_period_start,
      v_pay_period_end,
      v_base_pay,
      v_bonus_pay,
      v_payout_amount,
      v_status,
      v_reason,
      v_pool_before,
      v_pool_before - v_total_paid,
      jsonb_build_object(
        'total_due', v_total_due_for_officer,
        'prorate_ratio', v_prorate_ratio
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_paid', v_total_paid,
    'officers_paid', v_paid_count,
    'officers_considered', v_officer_count,
    'remaining_pool', v_pool_before - v_total_paid,
    'prorate_ratio', v_prorate_ratio
  );
END;
$$;
