-- ============================================================================
-- MAI TROLL — TICKET SYSTEM
-- ============================================================================
-- Additive migration. Creates a ticket/fine system where authorized staff
-- can issue coin tickets to users. Tickets must be signed by the target user,
-- and upon signing coins are deducted (balance may go negative). When paid,
-- the amount is credited to the admin pool.
--
-- Roles that can issue tickets: troll officer and all besides broadcasters
-- and broadofficers.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TICKETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issuing_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','paid','voided')),
  notes TEXT,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_target ON public.tickets(target_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_issuing ON public.tickets(issuing_admin_id);

-- ============================================================================
-- 2. TICKET TRANSACTIONS (credits to admin pool when paid)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  admin_pool_credit NUMERIC(12, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_transactions_ticket ON public.ticket_transactions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transactions_user ON public.ticket_transactions(user_id);

-- ============================================================================
-- 3. HELPER: check if a profile can issue tickets
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_issue_tickets(p_profile jsonb)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_profile ? 'role' THEN
    IF p_profile->>'role' IN ('broadcaster','broadofficer') THEN
      RETURN FALSE;
    END IF;
  END IF;
  IF p_profile ? 'is_broadcaster' AND (p_profile->>'is_broadcaster')::boolean THEN
    RETURN FALSE;
  END IF;
  IF p_profile ? 'is_broadofficer' AND (p_profile->>'is_broadofficer')::boolean THEN
    RETURN FALSE;
  END IF;

  RETURN (
    (p_profile->>'is_admin')::boolean OR
    p_profile->>'role' = 'admin' OR
    (p_profile->>'is_troll_officer')::boolean OR
    p_profile->>'role' = 'troll_officer' OR
    p_profile->>'role' = 'lead_troll_officer' OR
    (p_profile->>'is_lead_officer')::boolean OR
    p_profile->>'role' = 'secretary' OR
    (p_profile->>'is_secretary')::boolean OR
    p_profile->>'role' = 'moderator' OR
    (p_profile->>'is_moderator')::boolean OR
    p_profile->>'role' = 'temp_city_admin' OR
    p_profile->>'role' = 'superadmin' OR
    p_profile->>'role' = 'ceo' OR
    (p_profile->>'is_ceo')::boolean OR
    p_profile->>'role' = 'owner' OR
    (p_profile->>'is_president')::boolean OR
    p_profile->>'role' = 'president' OR
    p_profile->>'role' = 'vice_president' OR
    p_profile->>'role' = 'temp_admin'
  );
END;
$$;

-- ============================================================================
-- 4. RPC: issue_ticket
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_ticket(
  p_target_user_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_profile JSONB;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT to_jsonb(up) INTO v_profile
  FROM public.user_profiles up
  WHERE up.id = v_admin_id;

  IF NOT public.can_issue_tickets(v_profile) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Insufficient permissions to issue tickets');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  INSERT INTO public.tickets (target_user_id, issuing_admin_id, amount, notes, status)
  VALUES (p_target_user_id, v_admin_id, p_amount, p_notes, 'pending')
  RETURNING id INTO v_admin_id;

  RETURN jsonb_build_object('success', true, 'ticket_id', v_admin_id);
END;
$$;

-- ============================================================================
-- 5. RPC: sign_ticket
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sign_ticket(
  p_ticket_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_user_id UUID;
  v_new_balance NUMERIC(20,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.target_user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the target user can sign this ticket');
  END IF;

  IF v_ticket.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket is not pending');
  END IF;

  UPDATE public.tickets
  SET status = 'signed',
      signature_data = 'signed_by_user',
      signed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', true, 'status', 'signed');
END;
$$;

-- ============================================================================
-- 6. RPC: pay_ticket_coins
--    Deducts coins from user balance, allowing negative balances.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pay_ticket_coins(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC(20,2);
  v_new_balance NUMERIC(20,2);
  v_ledger_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT troll_coins INTO v_current_balance
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_new_balance := COALESCE(v_current_balance, 0) - p_amount;

  UPDATE public.user_profiles
  SET troll_coins = v_new_balance
  WHERE id = p_user_id;

  INSERT INTO public.coin_ledger (
    user_id, delta, bucket, source, reason, metadata, direction
  ) VALUES (
    p_user_id,
    -p_amount,
    'paid',
    'ticket',
    'Ticket payment',
    jsonb_build_object('type', 'ticket'),
    'out'
  ) RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
END;
$$;

-- ============================================================================
-- 7. RPC: pay_ticket
--    Processes a signed ticket: deducts coins (allowing negative) and credits
--    admin pool.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pay_ticket(
  p_ticket_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_pay_result JSONB;
  v_admin_user_id UUID;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.status != 'signed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket must be signed before payment');
  END IF;

  IF v_ticket.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket already paid');
  END IF;

  -- Deduct coins (allows negative)
  v_pay_result := public.pay_ticket_coins(v_ticket.target_user_id, v_ticket.amount);
  IF NOT (v_pay_result->>'success')::boolean THEN
    RETURN v_pay_result;
  END IF;

  -- Credit admin pool
  SELECT user_id INTO v_admin_user_id
  FROM public.admin_pool
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    INSERT INTO public.admin_pool (user_id, trollcoins_balance)
    VALUES (v_ticket.issuing_admin_id, v_ticket.amount)
    RETURNING user_id INTO v_admin_user_id;
  ELSE
    UPDATE public.admin_pool
    SET trollcoins_balance = trollcoins_balance + v_ticket.amount,
        updated_at = NOW()
    WHERE user_id = v_admin_user_id;
  END IF;

  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at, source_type)
  VALUES (
    v_ticket.amount,
    'Ticket payment from ' || v_ticket.target_user_id,
    v_ticket.target_user_id,
    NOW(),
    'ticket'
  );

  INSERT INTO public.ticket_transactions (ticket_id, user_id, amount, admin_pool_credit, description)
  VALUES (
    p_ticket_id,
    v_ticket.target_user_id,
    v_ticket.amount,
    v_ticket.amount,
    'Ticket payment processed'
  );

  UPDATE public.tickets
  SET status = 'paid',
      paid_at = NOW(),
      updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_pay_result->>'new_balance',
    'admin_pool_credited', v_ticket.amount
  );
END;
$$;

-- ============================================================================
-- 8. RPC: get_user_tickets
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_tickets(
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
BEGIN
  v_caller := auth.uid();

  IF p_user_id IS NULL AND v_caller IS NOT NULL THEN
    p_user_id := v_caller;
  END IF;

  IF p_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT *
    FROM public.tickets
    WHERE target_user_id = p_user_id
    ORDER BY created_at DESC;
  ELSIF auth.role() = 'service_role' THEN
    RETURN QUERY
    SELECT *
    FROM public.tickets
    ORDER BY created_at DESC;
  END IF;

  RETURN;
END;
$$;

-- ============================================================================
-- 9. RPC: get_pending_tickets
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_tickets()
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile JSONB;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN QUERY
    SELECT *
    FROM public.tickets
    WHERE status IN ('pending','signed')
    ORDER BY created_at DESC;
    RETURN;
  END IF;

  SELECT to_jsonb(up) INTO v_profile
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  IF v_profile IS NULL OR NOT public.can_issue_tickets(v_profile) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.tickets
  WHERE status IN ('pending','signed')
  ORDER BY created_at DESC;
END;
$$;

-- ============================================================================
-- 10. GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_transactions TO authenticated;

GRANT EXECUTE ON FUNCTION public.issue_ticket(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_ticket_coins(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tickets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_issue_tickets(JSONB) TO authenticated;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = target_user_id);

CREATE POLICY "Staff manage tickets" ON public.tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND public.can_issue_tickets(to_jsonb(user_profiles))
    )
  );

CREATE POLICY "Users read own ticket transactions" ON public.ticket_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff read all ticket transactions" ON public.ticket_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND public.can_issue_tickets(to_jsonb(user_profiles))
    )
  );

COMMIT;
