BEGIN;

CREATE TABLE IF NOT EXISTS public.troll_city_treasury (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_name text NOT NULL DEFAULT 'Mai Troll Treasury',
  balance_coins bigint NOT NULL DEFAULT 0,
  total_earned_coins bigint NOT NULL DEFAULT 0,
  total_distributed_coins bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id uuid NOT NULL REFERENCES public.troll_city_treasury(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (
    transaction_type IN ('revenue_credit', 'manual_credit', 'role_distribution', 'correction')
  ),
  source_type text,
  source_id uuid,
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_coins bigint NOT NULL CHECK (amount_coins > 0),
  balance_before bigint NOT NULL DEFAULT 0,
  balance_after bigint NOT NULL DEFAULT 0,
  created_by uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treasury_role_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
  role_label text NOT NULL,
  weekly_amount_coins bigint NOT NULL DEFAULT 0 CHECK (weekly_amount_coins >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treasury_payout_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_week_start date NOT NULL,
  run_week_end date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  total_amount_coins bigint NOT NULL DEFAULT 0,
  created_by uuid,
  approved_by uuid,
  processed_by uuid,
  approved_at timestamptz,
  processed_at timestamptz,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treasury_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id uuid NOT NULL REFERENCES public.treasury_payout_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  amount_coins bigint NOT NULL CHECK (amount_coins > 0),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'skipped', 'failed')) DEFAULT 'pending',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_treasury_transactions_treasury_id_created_at ON public.treasury_transactions (treasury_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_payout_runs_week ON public.treasury_payout_runs (run_week_start, status);
CREATE INDEX IF NOT EXISTS idx_treasury_payout_items_run_id ON public.treasury_payout_items (payout_run_id, status);

ALTER TABLE public.troll_city_treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_role_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_payout_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_payout_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'troll_city_treasury'
      AND policyname = 'treasury_read_authenticated'
  ) THEN
    CREATE POLICY treasury_read_authenticated ON public.troll_city_treasury
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'treasury_transactions'
      AND policyname = 'treasury_transactions_read_authenticated'
  ) THEN
    CREATE POLICY treasury_transactions_read_authenticated ON public.treasury_transactions
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'treasury_role_allocations'
      AND policyname = 'treasury_role_allocations_read_authenticated'
  ) THEN
    CREATE POLICY treasury_role_allocations_read_authenticated ON public.treasury_role_allocations
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'treasury_payout_runs'
      AND policyname = 'treasury_payout_runs_read_authenticated'
  ) THEN
    CREATE POLICY treasury_payout_runs_read_authenticated ON public.treasury_payout_runs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'treasury_payout_items'
      AND policyname = 'treasury_payout_items_read_authenticated'
  ) THEN
    CREATE POLICY treasury_payout_items_read_authenticated ON public.treasury_payout_items
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

INSERT INTO public.troll_city_treasury (treasury_name, balance_coins, total_earned_coins, total_distributed_coins, status)
SELECT 'Mai Troll Treasury', 0, 0, 0, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.troll_city_treasury);

CREATE OR REPLACE FUNCTION public.credit_treasury_revenue(
  p_source_type text,
  p_amount_coins bigint,
  p_created_by uuid,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_source_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_treasury_id uuid;
  v_balance_before bigint;
  v_balance_after bigint;
  v_total_earned bigint;
  v_allowed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount_coins IS NULL OR p_amount_coins <= 0 THEN
    RAISE EXCEPTION 'amount_coins must be greater than zero';
  END IF;

  IF p_created_by IS NULL OR p_created_by <> v_uid THEN
    RAISE EXCEPTION 'created_by must match the authenticated user';
  END IF;

  IF p_source_type IS NULL OR btrim(p_source_type) = '' THEN
    RAISE EXCEPTION 'source_type is required';
  END IF;

  IF p_source_type NOT IN ('auction_fee', 'agency_fee', 'marketplace_fee', 'profile_view_fee', 'message_fee', 'house_fee', 'city_tax', 'permit_fee', 'manual_admin_deposit', 'other') THEN
    RAISE EXCEPTION 'Unsupported source_type: %', p_source_type;
  END IF;

  IF p_source_type = 'manual_admin_deposit' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = v_uid
        AND (
          role IN ('admin', 'owner')
          OR is_admin = true
          OR role = 'ceo'
          OR troll_role IN ('admin', 'owner', 'ceo')
        )
    ) INTO v_allowed;

    IF NOT v_allowed THEN
      RAISE EXCEPTION 'Only admin or CEO can add a manual treasury deposit';
    END IF;
  END IF;

  SELECT id, balance_coins, total_earned_coins
    INTO v_treasury_id, v_balance_before, v_total_earned
  FROM public.troll_city_treasury
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.troll_city_treasury (treasury_name, balance_coins, total_earned_coins, total_distributed_coins, status)
    VALUES ('Mai Troll Treasury', 0, 0, 0, 'active')
    RETURNING id, balance_coins, total_earned_coins INTO v_treasury_id, v_balance_before, v_total_earned;
  END IF;

  v_balance_after := v_balance_before + p_amount_coins;

  UPDATE public.troll_city_treasury
  SET balance_coins = v_balance_after,
      total_earned_coins = v_total_earned + p_amount_coins,
      updated_at = now()
  WHERE id = v_treasury_id;

  INSERT INTO public.treasury_transactions (
    treasury_id,
    user_id,
    transaction_type,
    source_type,
    source_id,
    direction,
    amount_coins,
    balance_before,
    balance_after,
    created_by,
    details
  )
  VALUES (
    v_treasury_id,
    NULL,
    CASE WHEN p_source_type = 'manual_admin_deposit' THEN 'manual_credit' ELSE 'revenue_credit' END,
    p_source_type,
    p_source_id,
    'credit',
    p_amount_coins,
    v_balance_before,
    v_balance_after,
    v_uid,
    COALESCE(p_details, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'treasury_id', v_treasury_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'amount_coins', p_amount_coins,
    'source_type', p_source_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_treasury_role_allocation(
  p_role_key text,
  p_role_label text,
  p_weekly_amount_coins bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_user_allowed boolean := false;
  v_treasury_id uuid;
  v_balance_before bigint;
  v_balance_after bigint;
  v_allocation_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_role_key IS NULL OR btrim(p_role_key) = '' THEN
    RAISE EXCEPTION 'role_key is required';
  END IF;

  IF p_role_label IS NULL OR btrim(p_role_label) = '' THEN
    RAISE EXCEPTION 'role_label is required';
  END IF;

  IF p_weekly_amount_coins IS NULL OR p_weekly_amount_coins < 0 THEN
    RAISE EXCEPTION 'weekly_amount_coins must be zero or greater';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = v_uid
      AND (
        role IN ('admin', 'president', 'owner')
        OR is_admin = true
        OR role = 'ceo'
        OR troll_role IN ('admin', 'president', 'owner', 'ceo')
      )
  ) INTO v_user_allowed;

  IF NOT v_user_allowed THEN
    RAISE EXCEPTION 'Only admins, CEOs, or the president can update treasury role allocations';
  END IF;

  INSERT INTO public.treasury_role_allocations (
    role_key,
    role_label,
    weekly_amount_coins,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    lower(btrim(p_role_key)),
    btrim(p_role_label),
    p_weekly_amount_coins,
    p_weekly_amount_coins > 0,
    v_uid,
    v_uid
  )
  ON CONFLICT (role_key)
  DO UPDATE SET
    role_label = EXCLUDED.role_label,
    weekly_amount_coins = EXCLUDED.weekly_amount_coins,
    is_active = EXCLUDED.is_active,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING id INTO v_allocation_id;

  SELECT id, balance_coins
    INTO v_treasury_id, v_balance_before
  FROM public.troll_city_treasury
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.troll_city_treasury (treasury_name, balance_coins, total_earned_coins, total_distributed_coins, status)
    VALUES ('Mai Troll Treasury', 0, 0, 0, 'active')
    RETURNING id, balance_coins INTO v_treasury_id, v_balance_before;
  END IF;

  v_balance_after := v_balance_before;

  INSERT INTO public.treasury_transactions (
    treasury_id,
    transaction_type,
    source_type,
    direction,
    amount_coins,
    balance_before,
    balance_after,
    created_by,
    details
  )
  VALUES (
    v_treasury_id,
    'correction',
    'role_allocation_update',
    'credit',
    0,
    v_balance_before,
    v_balance_after,
    v_uid,
    jsonb_build_object(
      'action', 'role_allocation_updated',
      'role_key', lower(btrim(p_role_key)),
      'role_label', btrim(p_role_label),
      'weekly_amount_coins', p_weekly_amount_coins,
      'is_active', p_weekly_amount_coins > 0
    )
  );

  RETURN jsonb_build_object(
    'allocation_id', v_allocation_id,
    'role_key', lower(btrim(p_role_key)),
    'role_label', btrim(p_role_label),
    'weekly_amount_coins', p_weekly_amount_coins,
    'is_active', p_weekly_amount_coins > 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_weekly_treasury_payout_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_allowed boolean := false;
  v_week_start date;
  v_week_end date;
  v_existing_run_id uuid;
  v_new_run_id uuid;
  v_item_count bigint := 0;
  v_total_amount bigint := 0;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = v_uid
      AND (
        role IN ('admin', 'president', 'owner')
        OR is_admin = true
        OR role = 'ceo'
        OR troll_role IN ('admin', 'president', 'owner', 'ceo')
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Only admins, CEOs, or the president can create weekly treasury payout runs';
  END IF;

  v_week_start := date_trunc('week', current_date)::date;
  v_week_end := v_week_start + interval '6 days';

  SELECT id
    INTO v_existing_run_id
  FROM public.treasury_payout_runs
  WHERE run_week_start = v_week_start
    AND status <> 'cancelled'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'A weekly treasury payout run already exists for %', v_week_start;
  END IF;

  INSERT INTO public.treasury_payout_runs (
    run_week_start,
    run_week_end,
    status,
    total_amount_coins,
    created_by,
    notes
  )
  VALUES (
    v_week_start,
    v_week_end,
    'draft',
    0,
    v_uid,
    jsonb_build_object('created_from', 'weekly_treasury_run')
  )
  RETURNING id INTO v_new_run_id;

  WITH eligible_users AS (
    SELECT
      up.id AS user_id,
      CASE
        WHEN lower(COALESCE(up.role, '')) IN ('troll_officer', 'lead_troll_officer', 'officer') OR lower(COALESCE(up.troll_role, '')) IN ('troll_officer', 'lead_troll_officer', 'officer') OR up.is_troll_officer = true OR up.is_lead_officer = true THEN 'officer'
        WHEN lower(COALESCE(up.role, '')) IN ('secretary', 'executive_secretary', 'troll_city_secretary') OR lower(COALESCE(up.troll_role, '')) IN ('secretary', 'executive_secretary', 'troll_city_secretary') THEN 'secretary'
        WHEN lower(COALESCE(up.role, '')) = 'president' OR lower(COALESCE(up.troll_role, '')) = 'president' THEN 'president'
        WHEN lower(COALESCE(up.role, '')) IN ('agency_hr_manager', 'hr_admin') OR lower(COALESCE(up.troll_role, '')) IN ('agency_hr_manager', 'hr_admin') THEN 'department_hr_manager'
        WHEN lower(COALESCE(up.role, '')) = 'assistant' OR lower(COALESCE(up.troll_role, '')) = 'assistant' THEN 'assistant'
        WHEN lower(COALESCE(up.role, '')) = 'city_operations_runner' OR lower(COALESCE(up.troll_role, '')) = 'city_operations_runner' THEN 'city_operations_runner'
        WHEN lower(COALESCE(up.role, '')) = 'creator_support_representative' OR lower(COALESCE(up.troll_role, '')) = 'creator_support_representative' THEN 'creator_support_representative'
        WHEN lower(COALESCE(up.role, '')) = 'auctioneer' OR lower(COALESCE(up.troll_role, '')) = 'auctioneer' THEN 'auctioneer'
        ELSE lower(COALESCE(up.role, up.troll_role, ''))
      END AS effective_role_key
    FROM public.user_profiles up
  )
  INSERT INTO public.treasury_payout_items (payout_run_id, user_id, role_key, amount_coins, status, details)
  SELECT
    v_new_run_id,
    eu.user_id,
    eu.effective_role_key,
    tr.weekly_amount_coins,
    'pending',
    jsonb_build_object('role_label', tr.role_label)
  FROM eligible_users eu
  JOIN public.treasury_role_allocations tr
    ON tr.role_key = eu.effective_role_key
   AND tr.is_active = true
   AND tr.weekly_amount_coins > 0;

  SELECT COUNT(*), COALESCE(SUM(amount_coins), 0)
    INTO v_item_count, v_total_amount
  FROM public.treasury_payout_items
  WHERE payout_run_id = v_new_run_id;

  UPDATE public.treasury_payout_runs
  SET total_amount_coins = v_total_amount,
      updated_at = now()
  WHERE id = v_new_run_id;

  RETURN jsonb_build_object(
    'run_id', v_new_run_id,
    'run_week_start', v_week_start,
    'run_week_end', v_week_end,
    'item_count', v_item_count,
    'total_amount_coins', v_total_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_treasury_payout_run(p_payout_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_allowed boolean := false;
  v_treasury_id uuid;
  v_balance bigint;
  v_total_amount bigint;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = v_uid
      AND (
        role IN ('admin', 'president', 'owner')
        OR is_admin = true
        OR role = 'ceo'
        OR troll_role IN ('admin', 'president', 'owner', 'ceo')
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Only admins, CEOs, or the president can approve weekly treasury payout runs';
  END IF;

  UPDATE public.treasury_payout_runs
  SET status = 'approved',
      approved_by = v_uid,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_payout_run_id
    AND status = 'draft'
  RETURNING id INTO p_payout_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only draft treasury payout runs can be approved';
  END IF;

  SELECT id, balance_coins
    INTO v_treasury_id, v_balance
  FROM public.troll_city_treasury
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.troll_city_treasury (treasury_name, balance_coins, total_earned_coins, total_distributed_coins, status)
    VALUES ('Mai Troll Treasury', 0, 0, 0, 'active')
    RETURNING id, balance_coins INTO v_treasury_id, v_balance;
  END IF;

  SELECT COALESCE(SUM(amount_coins), 0)
    INTO v_total_amount
  FROM public.treasury_payout_items
  WHERE payout_run_id = p_payout_run_id
    AND status = 'pending';

  IF v_total_amount > v_balance THEN
    RAISE EXCEPTION 'Insufficient treasury balance to approve this payout run';
  END IF;

  INSERT INTO public.treasury_transactions (
    treasury_id,
    transaction_type,
    source_type,
    source_id,
    direction,
    amount_coins,
    balance_before,
    balance_after,
    created_by,
    details
  )
  VALUES (
    v_treasury_id,
    'correction',
    'payout_run_approval',
    p_payout_run_id,
    'credit',
    0,
    v_balance,
    v_balance,
    v_uid,
    jsonb_build_object('action', 'approved', 'payout_run_id', p_payout_run_id)
  );

  RETURN jsonb_build_object(
    'payout_run_id', p_payout_run_id,
    'status', 'approved'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_treasury_payout_run(p_payout_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_allowed boolean := false;
  v_treasury_id uuid;
  v_balance_before bigint;
  v_balance_after bigint;
  v_total_amount bigint := 0;
  v_item record;
  v_before_balance bigint;
  v_after_balance bigint;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = v_uid
      AND (
        role IN ('admin', 'president', 'owner')
        OR is_admin = true
        OR role = 'ceo'
        OR troll_role IN ('admin', 'president', 'owner', 'ceo')
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Only admins, CEOs, or the president can process treasury payout runs';
  END IF;

  SELECT id, balance_coins
    INTO v_treasury_id, v_balance_before
  FROM public.troll_city_treasury
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.troll_city_treasury (treasury_name, balance_coins, total_earned_coins, total_distributed_coins, status)
    VALUES ('Mai Troll Treasury', 0, 0, 0, 'active')
    RETURNING id, balance_coins INTO v_treasury_id, v_balance_before;
  END IF;

  SELECT COALESCE(SUM(amount_coins), 0)
    INTO v_total_amount
  FROM public.treasury_payout_items
  WHERE payout_run_id = p_payout_run_id
    AND status = 'pending';

  IF v_total_amount <= 0 THEN
    RAISE EXCEPTION 'There are no pending treasury payout items to process';
  END IF;

  IF v_total_amount > v_balance_before THEN
    RAISE EXCEPTION 'Insufficient treasury balance to process this payout run';
  END IF;

  UPDATE public.treasury_payout_runs
  SET status = 'paid',
      processed_by = v_uid,
      processed_at = now(),
      updated_at = now()
  WHERE id = p_payout_run_id
    AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only approved treasury payout runs can be processed';
  END IF;

  FOR v_item IN
    SELECT id, user_id, amount_coins, role_key
    FROM public.treasury_payout_items
    WHERE payout_run_id = p_payout_run_id
      AND status = 'pending'
    FOR UPDATE
  LOOP
    SELECT COALESCE(troll_coins, 0), COALESCE(total_earned_coins, 0)
      INTO v_before_balance, v_after_balance
    FROM public.user_profiles
    WHERE id = v_item.user_id
    FOR UPDATE;

    UPDATE public.user_profiles
    SET troll_coins = v_before_balance + v_item.amount_coins,
        total_earned_coins = v_after_balance + v_item.amount_coins,
        updated_at = now()
    WHERE id = v_item.user_id;

    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      description,
      metadata
    )
    VALUES (
      v_item.user_id,
      v_item.amount_coins,
      'treasury_role_payout',
      'President-approved treasury allocation',
      jsonb_build_object(
        'payout_run_id', p_payout_run_id,
        'role_key', v_item.role_key,
        'processed_by', v_uid
      )
    );

    UPDATE public.treasury_payout_items
    SET status = 'paid',
        paid_at = now()
    WHERE id = v_item.id;
  END LOOP;

  v_balance_after := v_balance_before - v_total_amount;

  UPDATE public.troll_city_treasury
  SET balance_coins = v_balance_after,
      total_distributed_coins = total_distributed_coins + v_total_amount,
      updated_at = now()
  WHERE id = v_treasury_id;

  INSERT INTO public.treasury_transactions (
    treasury_id,
    user_id,
    transaction_type,
    source_type,
    source_id,
    direction,
    amount_coins,
    balance_before,
    balance_after,
    created_by,
    details
  )
  VALUES (
    v_treasury_id,
    NULL,
    'role_distribution',
    'weekly_role_payout',
    p_payout_run_id,
    'debit',
    v_total_amount,
    v_balance_before,
    v_balance_after,
    v_uid,
    jsonb_build_object('payout_run_id', p_payout_run_id, 'processed_by', v_uid)
  );

  RETURN jsonb_build_object(
    'payout_run_id', p_payout_run_id,
    'status', 'paid',
    'total_distributed_coins', v_total_amount,
    'balance_after', v_balance_after
  );
END;
$$;

GRANT SELECT ON public.troll_city_treasury TO authenticated;
GRANT SELECT ON public.treasury_transactions TO authenticated;
GRANT SELECT ON public.treasury_role_allocations TO authenticated;
GRANT SELECT ON public.treasury_payout_runs TO authenticated;
GRANT SELECT ON public.treasury_payout_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_treasury_revenue(text, bigint, uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_treasury_role_allocation(text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_weekly_treasury_payout_run() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_treasury_payout_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_treasury_payout_run(uuid) TO authenticated;

COMMIT;
