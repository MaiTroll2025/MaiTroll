-- ============================================================================
-- JAIL ATTORNEY & ADMIN FLOWS
-- Adds attorney quote/payment RPCs and admin bond quote RPCs
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD QUOTE COLUMNS TO JAIL_REQUESTS
-- ============================================================================

ALTER TABLE public.jail_requests
  ADD COLUMN IF NOT EXISTS quote_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_message TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS inmate_response TEXT DEFAULT '' CHECK (inmate_response = ANY (ARRAY['','accepted','denied'])),
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- ============================================================================
-- 2. RPC - ATTORNEY ACCEPTS REQUEST
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_attorney_request(
  p_request_id UUID,
  p_attorney_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF p_attorney_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_request FROM public.jail_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.request_type != 'attorney' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid request type');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request is no longer pending');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_attorney_id AND (is_attorney = true OR role = 'attorney')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only attorneys can accept requests');
  END IF;

  UPDATE public.jail_requests
  SET assigned_to = p_attorney_id,
      status = 'reviewing',
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Attorney assigned to case');
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_attorney_request(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- 3. RPC - ATTORNEY DECLINES REQUEST
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decline_attorney_request(
  p_request_id UUID,
  p_attorney_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_attorney_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  UPDATE public.jail_requests
  SET status = 'rejected',
      updated_at = now()
  WHERE id = p_request_id
    AND assigned_to = p_attorney_id
    AND status = 'reviewing';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot decline this request');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Request declined');
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_attorney_request(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- 4. RPC - ATTORNEY SENDS QUOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_attorney_quote(
  p_request_id UUID,
  p_amount INTEGER,
  p_message TEXT,
  p_attorney_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF p_attorney_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quote amount must be non-negative');
  END IF;

  SELECT * INTO v_request FROM public.jail_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.request_type != 'attorney' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid request type');
  END IF;

  IF v_request.assigned_to != p_attorney_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are not assigned to this case');
  END IF;

  IF v_request.status NOT IN ('reviewing', 'approved') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request must be in reviewing status to send quote');
  END IF;

  UPDATE public.jail_requests
  SET quote_amount = p_amount,
      quote_message = p_message,
      status = 'approved',
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Quote sent successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_attorney_quote(uuid, integer, text, uuid) TO authenticated, service_role;

-- ============================================================================
-- 5. RPC - INMATE ACCEPTS ATTORNEY QUOTE (COIN TRANSFER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_attorney_quote(
  p_request_id UUID,
  p_payer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_wallet_coins INTEGER;
BEGIN
  IF p_payer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_request FROM public.jail_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.request_type != 'attorney' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid request type');
  END IF;

  IF v_request.status != 'approved' OR v_request.quote_amount <= 0 OR v_request.assigned_to IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No attorney quote available');
  END IF;

  IF v_request.user_id != p_payer_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT troll_coins INTO v_wallet_coins FROM public.user_profiles WHERE id = p_payer_id FOR UPDATE;
  IF v_wallet_coins IS NULL OR v_wallet_coins < v_request.quote_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_TROLL_COINS',
      'message', 'You don''t have enough Troll Coins.',
      'required', v_request.quote_amount,
      'available', COALESCE(v_wallet_coins, 0)
    );
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_request.quote_amount,
      updated_at = now()
  WHERE id = p_payer_id
    AND troll_coins >= v_request.quote_amount;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INSUFFICIENT_TROLL_COINS', 'message', 'Insufficient balance.');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_request.quote_amount,
      updated_at = now()
  WHERE id = v_request.assigned_to;

  INSERT INTO public.jail_transactions (
    jail_id, user_id, transaction_type, amount, recipient_id, recipient_type, notes
  ) VALUES (
    v_request.jail_id, p_payer_id, 'attorney_fee', v_request.quote_amount,
    v_request.assigned_to, 'attorney', 'Attorney fee payment per case'
  );

  UPDATE public.jail_requests
  SET status = 'fulfilled',
      inmate_response = 'accepted',
      responded_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Attorney quote accepted. You may now message your attorney.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_attorney_quote(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- 6. RPC - INMATE DENIES ATTORNEY QUOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deny_attorney_quote(
  p_request_id UUID,
  p_payer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF p_payer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_request FROM public.jail_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.user_id != p_payer_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  UPDATE public.jail_requests
  SET status = 'rejected',
      inmate_response = 'denied',
      responded_at = now()
  WHERE id = p_request_id AND status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot deny this quote');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Attorney quote denied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.deny_attorney_quote(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- 7. RPC - ADMIN SENDS BOND QUOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_admin_bond_quote(
  p_request_id UUID,
  p_amount INTEGER,
  p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request FROM public.jail_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.request_type != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid request type');
  END IF;

  IF p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bond amount must be non-negative');
  END IF;

  UPDATE public.jail_requests
  SET quote_amount = p_amount,
      quote_message = p_message,
      status = 'approved',
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Bond quote sent');
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_admin_bond_quote(uuid, integer, text) TO authenticated, service_role;

-- ============================================================================
-- 8. RPC - INMATE ACCEPTS ADMIN BOND QUOTE (RELEASES FROM JAIL)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_admin_bond_quote(
  p_request_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_jail RECORD;
  v_wallet_coins INTEGER;
  v_transaction_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_request FROM public.jail_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.request_type != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid request type');
  END IF;

  IF v_request.status != 'approved' OR v_request.quote_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No bond quote available');
  END IF;

  IF v_request.user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT * INTO v_jail FROM public.jail
  WHERE id = v_request.jail_id AND user_id = p_user_id AND status = 'jailed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Active jail record not found');
  END IF;

  IF v_jail.bond_paid = true THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bond has already been paid');
  END IF;

  SELECT troll_coins INTO v_wallet_coins FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF v_wallet_coins IS NULL OR v_wallet_coins < v_request.quote_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_TROLL_COINS',
      'message', 'You don''t have enough Troll Coins.',
      'required', v_request.quote_amount,
      'available', COALESCE(v_wallet_coins, 0)
    );
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_request.quote_amount,
      updated_at = now()
  WHERE id = p_user_id
    AND troll_coins >= v_request.quote_amount;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INSUFFICIENT_TROLL_COINS', 'message', 'Insufficient balance.');
  END IF;

  INSERT INTO public.jail_bond_transactions (
    jail_id, user_id, amount, discipline_level, status, metadata
  ) VALUES (
    v_jail.id, p_user_id, v_request.quote_amount, v_jail.discipline_level, 'completed',
    jsonb_build_object('released_at', now(), 'source', 'admin_quote')
  ) RETURNING id INTO v_transaction_id;

  UPDATE public.jail
  SET bond_paid = true,
      bond_transaction_id = v_transaction_id,
      released_at = now(),
      release_type = 'bond',
      status = 'released',
      updated_at = now()
  WHERE id = v_jail.id;

  UPDATE public.user_profiles
  SET jailed_until = NULL,
      current_jail_id = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.jail_transactions (
    jail_id, user_id, transaction_type, amount, recipient_type, notes
  ) VALUES (
    v_jail.id, p_user_id, 'bond', v_request.quote_amount, 'admin',
    'Bond payment via admin quote'
  );

  UPDATE public.jail_requests
  SET status = 'fulfilled',
      inmate_response = 'accepted',
      responded_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Bond accepted. You have been released from jail.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_admin_bond_quote(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- 9. RPC - INMATE DENIES ADMIN BOND QUOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deny_admin_bond_quote(
  p_request_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_request FROM public.jail_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  UPDATE public.jail_requests
  SET status = 'rejected',
      inmate_response = 'denied',
      responded_at = now()
  WHERE id = p_request_id AND status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot deny this quote');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Bond quote denied');
END;
$$;

GRANT EXECUTE ON FUNCTION public.deny_admin_bond_quote(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- 10. RPC - GET AVAILABLE ATTORNEY REQUESTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_available_attorney_requests(p_attorney_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  jail_id UUID,
  user_id UUID,
  request_type TEXT,
  message TEXT,
  status TEXT,
  assigned_to UUID,
  quote_amount INTEGER,
  quote_message TEXT,
  inmate_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  inmate_username TEXT,
  inmate_display_name TEXT,
  jail_reason TEXT,
  jail_severity TEXT,
  jail_bond_amount INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id, r.jail_id, r.user_id, r.request_type, r.message, r.status,
    r.assigned_to, r.quote_amount, r.quote_message, r.inmate_response,
    r.responded_at, r.created_at, r.updated_at,
    up.username as inmate_username,
    up.display_name as inmate_display_name,
    j.reason as jail_reason,
    j.severity as jail_severity,
    j.bond_amount as jail_bond_amount
  FROM public.jail_requests r
  LEFT JOIN public.user_profiles up ON up.id = r.user_id
  LEFT JOIN public.jail j ON j.id = r.jail_id
  WHERE r.request_type = 'attorney'
    AND r.status IN ('pending', 'reviewing', 'approved')
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_attorney_requests(uuid) TO authenticated, service_role;

-- ============================================================================
-- 11. RPC - GET ADMIN REQUESTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_requests()
RETURNS TABLE (
  id UUID,
  jail_id UUID,
  user_id UUID,
  request_type TEXT,
  message TEXT,
  status TEXT,
  assigned_to UUID,
  quote_amount INTEGER,
  quote_message TEXT,
  inmate_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  inmate_username TEXT,
  inmate_display_name TEXT,
  jail_reason TEXT,
  jail_severity TEXT,
  jail_bond_amount INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id, r.jail_id, r.user_id, r.request_type, r.message, r.status,
    r.assigned_to, r.quote_amount, r.quote_message, r.inmate_response,
    r.responded_at, r.created_at, r.updated_at,
    up.username as inmate_username,
    up.display_name as inmate_display_name,
    j.reason as jail_reason,
    j.severity as jail_severity,
    j.bond_amount as jail_bond_amount
  FROM public.jail_requests r
  LEFT JOIN public.user_profiles up ON up.id = r.user_id
  LEFT JOIN public.jail j ON j.id = r.jail_id
  WHERE r.request_type = 'admin'
    AND r.status IN ('pending', 'approved')
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_requests() TO authenticated, service_role;

COMMIT;
