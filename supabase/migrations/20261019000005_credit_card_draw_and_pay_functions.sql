-- Credit Card: draw_credit_internal and pay_credit_card functions
-- These are required for credit card purchases to work in Mai Bank.
-- draw_credit_internal: Charges the user's credit card (increases credit_used)
-- pay_credit_card: Pays off credit card debt (decreases credit_used, +5 credit score)

BEGIN;

-- Ensure credit card columns exist on user_profiles (defensive, from credit score migration)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 400,
  ADD COLUMN IF NOT EXISTS credit_limit BIGINT NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS credit_used BIGINT NOT NULL DEFAULT 0;

-- Credit card transactions log table
CREATE TABLE IF NOT EXISTS public.credit_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'purchase',
  description TEXT,
  context TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  billing_cycle_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cct_user_id ON public.credit_card_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cct_context ON public.credit_card_transactions(context);

ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cct_select_owner" ON public.credit_card_transactions;
CREATE POLICY cct_select_owner ON public.credit_card_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT ON public.credit_card_transactions TO authenticated;

-- draw_credit_internal: Charge credit card, increase credit_used
-- Returns the amount charged (BIGINT)
CREATE OR REPLACE FUNCTION public.draw_credit_internal(
  p_user_id UUID,
  p_amount BIGINT,
  p_description TEXT DEFAULT 'Credit Card Purchase',
  p_context TEXT DEFAULT 'shop_purchase',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile RECORD;
  v_charge BIGINT := p_amount;
BEGIN
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate credit limit
  IF (COALESCE(v_profile.credit_limit, 0) - COALESCE(v_profile.credit_used, 0)) < p_amount THEN
    RAISE EXCEPTION 'Credit limit exceeded';
  END IF;

  -- Update credit_used
  UPDATE public.user_profiles
  SET credit_used = COALESCE(credit_used, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO public.credit_card_transactions (
    user_id, amount, transaction_type, description, context, metadata, billing_cycle_date, created_at
  )
  VALUES (
    p_user_id, p_amount, 'purchase', p_description, p_context,
    COALESCE(p_metadata, '{}'::jsonb), CURRENT_DATE, NOW()
  );

  RETURN v_charge;
END;
$$;

REVOKE ALL ON FUNCTION public.draw_credit_internal(UUID, BIGINT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.draw_credit_internal(UUID, BIGINT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- pay_credit_card: Pay off credit card debt, decrease credit_used, +5 credit score
CREATE OR REPLACE FUNCTION public.pay_credit_card(
  p_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_actual_pay BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_actual_pay := LEAST(p_amount, COALESCE(v_profile.credit_used, 0));
  IF v_actual_pay <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit card balance to pay');
  END IF;

  -- Decrease credit_used
  UPDATE public.user_profiles
  SET credit_used = COALESCE(credit_used, 0) - v_actual_pay,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Log payment transaction
  INSERT INTO public.credit_card_transactions (
    user_id, amount, transaction_type, description, context, metadata, billing_cycle_date, created_at
  )
  VALUES (
    v_user_id, v_actual_pay, 'payment', 'Credit Card Payment', 'credit_card_payment',
    jsonb_build_object('amount_paid', v_actual_pay), CURRENT_DATE, NOW()
  );

  -- Apply +5 credit score for paying off debt
  PERFORM public.apply_credit_score_event(
    v_user_id,
    'credit_cc_payment',
    5,
    'credit_cc_payment:' || txid_current()::TEXT || ':' || v_user_id::TEXT,
    'credit_card_transactions',
    NULL,
    jsonb_build_object('amount_paid', v_actual_pay, 'reason', 'credit_card_debt_payment')
  );

  RETURN jsonb_build_object(
    'success', true,
    'paid', v_actual_pay,
    'credit_score_increase', 5,
    'message', 'Credit card payment successful'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_credit_card(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO authenticated;

COMMIT;
