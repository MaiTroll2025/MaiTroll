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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'web_push_subscriptions_endpoint_key'
      AND i.indpred IS NOT NULL
  ) THEN
    DROP INDEX public.web_push_subscriptions_endpoint_key;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS web_push_subscriptions_endpoint_key
  ON public.web_push_subscriptions (endpoint);
