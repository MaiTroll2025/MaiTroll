-- ============================================================
-- XTROLLZ PAYMENTS
-- PayPal application fees
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.xtrollz_application_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.xtrollz_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_order_id text NOT NULL,
  paypal_capture_id text,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_timestamp timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_payments_application_id
ON public.xtrollz_application_payments(application_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_payments_user_id
ON public.xtrollz_application_payments(user_id);

ALTER TABLE public.xtrollz_application_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz payments"
ON public.xtrollz_application_payments;

CREATE POLICY "Users can view own XTrollz payments"
ON public.xtrollz_application_payments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE
ON public.xtrollz_application_payments
TO authenticated;

GRANT ALL
ON public.xtrollz_application_payments
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
