
-- Create admin_pool_transactions table
CREATE TABLE IF NOT EXISTS public.admin_pool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cashout_amount NUMERIC(12,2) NOT NULL,
  admin_fee NUMERIC(12,2) NOT NULL,
  admin_profit NUMERIC(12,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('cashout', 'other_fee')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source_details JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.admin_pool_transactions ENABLE ROW LEVEL SECURITY;

-- Allow admins to view
DROP POLICY IF EXISTS "Admins can view admin pool transactions" ON public.admin_pool_transactions;
CREATE POLICY "Admins can view admin pool transactions"
  ON public.admin_pool_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Create function to handle new payout requests
CREATE OR REPLACE FUNCTION public.handle_new_payout_request()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_profit NUMERIC(12,2);
  v_admin_fee NUMERIC(12,2) := 3.00; -- Fixed fee as per user request
BEGIN
  -- Determine profit based on cashout amount tiers
  -- Tiers: $25 -> $27.99, $50 -> $73, $150 -> $86.99, $325 -> $131.99
  IF NEW.cash_amount = 25 THEN
    v_admin_profit := 27.99;
  ELSIF NEW.cash_amount = 50 THEN
    v_admin_profit := 73.00;
  ELSIF NEW.cash_amount = 150 THEN
    v_admin_profit := 86.99;
  ELSIF NEW.cash_amount = 325 THEN
    v_admin_profit := 131.99;
  ELSE
    -- Default or fallback logic if amount doesn't match exactly?
    -- We assume these are the only tiers, but if not, we can log 0 or a calculated amount.
    -- For now, we only log the specific tiers requested.
    v_admin_profit := 0;
  END IF;

  -- Only insert if there's a profit defined (i.e. it's one of the tracked tiers)
  IF v_admin_profit > 0 THEN
    INSERT INTO public.admin_pool_transactions (
      transaction_id,
      user_id,
      cashout_amount,
      admin_fee,
      admin_profit,
      transaction_type,
      source_details
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.cash_amount,
      v_admin_fee,
      v_admin_profit,
      'cashout',
      jsonb_build_object('tier_cash_amount', NEW.cash_amount)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_payout_request_insert ON public.payout_requests;
CREATE TRIGGER on_payout_request_insert
  AFTER INSERT ON public.payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_payout_request();
