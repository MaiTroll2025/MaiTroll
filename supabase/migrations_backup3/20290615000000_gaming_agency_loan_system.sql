-- Gaming Agency Loan System
-- Adds loan_type to loans table and creates apply_for_gaming_agency_loan RPC

-- 1. Add loan_type column to loans table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loans' AND column_name = 'loan_type'
  ) THEN
    ALTER TABLE public.loans ADD COLUMN loan_type text DEFAULT 'bank';
  END IF;
END $$;

-- 2. Create gaming agency loan application RPC
CREATE OR REPLACE FUNCTION public.apply_for_gaming_agency_loan(
  p_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_active_loan boolean;
  v_existing_pending_loan boolean;
  v_loan_id uuid;
  v_current_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: not signed in');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid loan amount');
  END IF;

  IF p_amount > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'Loan amount cannot exceed 5,000 TC');
  END IF;

  -- Check for existing active loan
  SELECT EXISTS(
    SELECT 1 FROM public.loans
    WHERE user_id = v_user_id AND status = 'active' AND loan_type = 'gaming_agency'
  ) INTO v_existing_active_loan;

  IF v_existing_active_loan THEN
    RETURN json_build_object('success', false, 'error', 'You already have an active gaming loan. Pay it off first.');
  END IF;

  -- Check for pending loan application
  SELECT EXISTS(
    SELECT 1 FROM public.loan_applications
    WHERE user_id = v_user_id AND status = 'pending'
  ) INTO v_existing_pending_loan;

  IF v_existing_pending_loan THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending loan application.');
  END IF;

  -- Create the loan record
  INSERT INTO public.loans (user_id, principal, balance, status, loan_type)
  VALUES (v_user_id, p_amount, p_amount, 'active', 'gaming_agency')
  RETURNING id INTO v_loan_id;

  -- Also insert into loan_applications for tracking
  INSERT INTO public.loan_applications (user_id, requested_coins, status, auto_approved, reason)
  VALUES (v_user_id, p_amount, 'approved', true, 'Gaming Agency Loan - auto-approved');

  -- Get current balance for logging
  SELECT COALESCE(ui.troll_coins, 0) INTO v_current_balance
  FROM public.user_profiles ui WHERE ui.id = v_user_id;

  -- Note: The actual coin crediting and credit card processing
  -- is handled by the application layer (PayPal) or admin
  -- This RPC just creates the loan record

  RETURN json_build_object(
    'success', true,
    'loan_id', v_loan_id,
    'amount', p_amount,
    'message', 'Gaming agency loan created successfully. No cashouts until loan is paid off.',
    'current_balance', v_current_balance
  );
END;
$$;

-- 3. Create function to check if user has active gaming loan
CREATE OR REPLACE FUNCTION public.has_active_gaming_loan(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_loan_record record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('has_active_loan', false);
  END IF;

  SELECT id, principal, balance, created_at
  INTO v_loan_record
  FROM public.loans
  WHERE user_id = v_user_id AND status = 'active' AND loan_type = 'gaming_agency'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_loan_record.id IS NOT NULL THEN
    RETURN json_build_object(
      'has_active_loan', true,
      'loan_id', v_loan_record.id,
      'principal', v_loan_record.principal,
      'balance', v_loan_record.balance,
      'created_at', v_loan_record.created_at
    );
  END IF;

  RETURN json_build_object('has_active_loan', false);
END;
$$;

-- 4. Create loan repayment RPC
CREATE OR REPLACE FUNCTION public.pay_gaming_loan(
  p_payment_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_loan record;
  v_new_balance numeric;
  v_cashout_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid payment amount');
  END IF;

  -- Get active gaming loan
  SELECT id, balance
  INTO v_loan
  FROM public.loans
  WHERE user_id = v_user_id AND status = 'active' AND loan_type = 'gaming_agency'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_loan.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No active gaming loan found');
  END IF;

  -- Check user has enough cashout balance to pay
  SELECT COALESCE(ui.cashout_coins, 0) - COALESCE(ui.cashout_reserved_coins, 0)
  INTO v_cashout_balance
  FROM public.user_profiles ui WHERE ui.id = v_user_id;

  IF v_cashout_balance < p_payment_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient cashout balance. Available: ' || v_cashout_balance || ' TC'
    );
  END IF;

  v_new_balance := GREATEST(0, v_loan.balance - p_payment_amount);

  -- Update loan
  UPDATE public.loans
  SET
    balance = v_new_balance,
    status = CASE WHEN v_new_balance <= 0 THEN 'paid' ELSE 'active' END,
    closed_at = CASE WHEN v_new_balance <= 0 THEN NOW() ELSE closed_at END
  WHERE id = v_loan.id;

  -- Log coin deduction
  UPDATE public.user_profiles
  SET
    cashout_coins = GREATEST(0, cashout_coins - p_payment_amount),
    troll_coins = GREATEST(0, troll_coins - p_payment_amount)
  WHERE id = v_user_id;

  -- Log ledger entry
  INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
  VALUES (v_user_id, -p_payment_amount, 'loan', 'auto_repay', 'Gaming agency loan repayment');

  RETURN json_build_object(
    'success', true,
    'paid', p_payment_amount,
    'remaining_balance', v_new_balance,
    'loan_paid_off', v_new_balance <= 0,
    'message', CASE WHEN v_new_balance <= 0
      THEN 'Loan fully paid off! Cashouts are now unlocked.'
      ELSE 'Payment applied. Remaining: ' || v_new_balance || ' TC'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_for_gaming_agency_loan TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_gaming_loan TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_gaming_loan TO authenticated;
