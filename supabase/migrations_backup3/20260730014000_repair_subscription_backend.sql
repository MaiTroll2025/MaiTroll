-- ============================================================================
-- Migration: repair_subscription_backend
-- Creates subscription tiers and user subscriptions tables if missing
-- Applied: 2026-07-30
-- ============================================================================

-- subscription_tiers already exists in schema_part02
-- user_subscriptions already exists in schema_part02

-- Ensure subscription_tiers has all required columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.subscription_tiers ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'billing_interval'
  ) THEN
    ALTER TABLE public.subscription_tiers ADD COLUMN billing_interval text DEFAULT 'monthly'
      CHECK (billing_interval IN ('monthly', 'yearly'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'features'
  ) THEN
    ALTER TABLE public.subscription_tiers ADD COLUMN features text[] DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.subscription_tiers ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.subscription_tiers ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_active ON public.subscription_tiers(is_active, sort_order);

-- Ensure user_subscriptions has all required columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'tier_id'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN tier_id uuid REFERENCES public.subscription_tiers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'subscriber_id'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN subscriber_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'broadcaster_id'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN broadcaster_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'provider'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN provider text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'provider_subscription_id'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN provider_subscription_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN status text DEFAULT 'active'
      CHECK (status IN ('active', 'paused', 'cancelled', 'expired'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN started_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'renewal_date'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN renewal_date timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_subscriptions' AND constraint_name = 'user_subscriptions_unique'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_unique
      UNIQUE (subscriber_id, broadcaster_id);
  END IF;
END $$;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = subscriber_id OR auth.uid() = broadcaster_id);

CREATE POLICY "Broadcaster can insert subscriptions"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = broadcaster_id);

CREATE POLICY "Broadcaster can update own subscriptions"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = broadcaster_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscriber ON public.user_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_broadcaster ON public.user_subscriptions(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);