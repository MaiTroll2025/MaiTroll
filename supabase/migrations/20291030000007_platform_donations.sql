CREATE TABLE IF NOT EXISTS public.platform_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_usd numeric(10, 2) NOT NULL CHECK (amount_usd >= 1 AND amount_usd <= 10000),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  paypal_order_id text NOT NULL UNIQUE,
  paypal_capture_id text UNIQUE,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'canceled', 'refunded')),
  donor_name text,
  donor_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT platform_donations_completed_capture_required
    CHECK (payment_status != 'completed' OR paypal_capture_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS platform_donations_status_created_idx
  ON public.platform_donations (payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.paypal_donation_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_donation_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_donations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.paypal_donation_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_donations TO service_role;
GRANT ALL ON public.paypal_donation_webhook_events TO service_role;
