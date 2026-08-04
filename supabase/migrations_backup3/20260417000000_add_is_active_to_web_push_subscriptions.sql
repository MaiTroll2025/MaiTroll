-- Add is_active and updated_at columns to web_push_subscriptions
-- These columns support soft-deactivation of subscriptions and audit tracking

ALTER TABLE public.web_push_subscriptions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Index for performance when filtering active subscriptions
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_active
  ON public.web_push_subscriptions(is_active);
