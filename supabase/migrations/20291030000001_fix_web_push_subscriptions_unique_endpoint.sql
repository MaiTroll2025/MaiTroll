-- Fix web_push_subscriptions table: add missing columns and UNIQUE constraint on endpoint
-- The frontend upserts with onConflict: 'endpoint' but the table lacks both the endpoint
-- column as a top-level column and a UNIQUE constraint on it, causing 42P10 errors.

ALTER TABLE public.web_push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS p256dh_key text,
  ADD COLUMN IF NOT EXISTS auth_key text,
  ADD COLUMN IF NOT EXISTS expiration_time timestamptz,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS web_push_subscriptions_endpoint_key
  ON public.web_push_subscriptions (endpoint)
  WHERE endpoint IS NOT NULL;
