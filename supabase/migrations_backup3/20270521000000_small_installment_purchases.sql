-- Migration: Small Credit Card Installments (standalone credit building track)
-- Date:  2026-05-21
-- Purpose: Any credit-card purchase under 100 troll coins is tracked as a
--          micro-installment.  Paying it back over time earns credit-score
--          points at 25 % / 50 % / 75 % / 100 % repayment milestones.

-- ==========================================
-- 1. small_installment_purchases table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.small_installment_purchases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Purchase details
    original_price      BIGINT NOT NULL,          -- ⚠  must be < 100 troll coins
    purchase_context    TEXT NOT NULL,             -- 'shop_purchase' | 'insurance_purchase' | …
    item_type           TEXT,                      -- coinTransactions type
    item_id             TEXT,
    item_name           TEXT,
    -- Payment progress
    total_paid          BIGINT NOT NULL DEFAULT 0,
    remaining_balance   BIGINT GENERATED ALWAYS AS (GREATEST(0, original_price - total_paid)) STORED,
    milestone_level     SMALLINT NOT NULL DEFAULT 0,   -- 0=0%,1=25%,2=50%,3=75%,4=100%
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    fully_paid_at       TIMESTAMPTZ,
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ               -- 30-day inactivity grace period
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sip_user_id  ON public.small_installment_purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sip_active   ON public.small_installment_purchases(is_active) WHERE is_active = TRUE;

-- ==========================================
-- 2. installment_milestone_events (idempotency + audit)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.installment_milestone_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id       UUID NOT NULL REFERENCES public.small_installment_purchases(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    milestone_level   SMALLINT NOT NULL,
    credit_points_awarded INTEGER NOT NULL,
    payment_amount    BIGINT NOT NULL,
    event_key         TEXT UNIQUE,          -- idempotency: duplicate event_key = skip
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_installment_milestone_purchase_level UNIQUE (purchase_id, milestone_level)
);

CREATE INDEX IF NOT EXISTS idx_ime_user_id ON public.installment_milestone_events(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ime_event_key ON public.installment_milestone_events(event_key) WHERE event_key IS NOT NULL;

-- ==========================================
-- 3. RLS policies
-- ==========================================

ALTER TABLE public.small_installment_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_milestone_events    ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'small_installment_purchases' AND policyname = 'sip_select_owner') THEN
    CREATE POLICY sip_select_owner ON public.small_installment_purchases FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'small_installment_purchases' AND policyname = 'sip_service_role_all') THEN
    CREATE POLICY sip_service_role_all ON public.small_installment_purchases FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_milestone_events' AND policyname = 'ime_select_owner') THEN
    CREATE POLICY ime_select_owner ON public.installment_milestone_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_milestone_events' AND policyname = 'ime_service_role_all') THEN
    CREATE POLICY ime_service_role_all ON public.installment_milestone_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.small_installment_purchases TO authenticated;
GRANT SELECT, INSERT              ON public.installment_milestone_events TO authenticated;

-- ==========================================
-- 4. Schedule daily small-purchase milestone cron via pg_cron
-- ==========================================

-- Runs every day at 03:00 UTC and calls the credit-small-purchase-milestone edge function.
-- Replace the hard-coded Supabase URL with your project URL via
--   UPDATE public.site_settings SET setting_value = 'https://YOUR-PROJECT.supabase.co' WHERE setting_key = 'supabase_url';
-- before deploying, or inject it in CI/CD.
DO $$
DECLARE
  v_proj_url  TEXT := COALESCE(
                       (SELECT setting_value FROM public.site_settings WHERE setting_key = 'supabase_url'),
                       'https://yjxpwfalenorzrqxwmtr.supabase.co'
                     );
  v_service_key TEXT := current_setting('app.supabase_service_role_key', TRUE);
BEGIN
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE NOTICE 'Skipping cron schedule: supabase_service_role_key not configured in site_settings / app settings';
  ELSE
    PERFORM cron.unschedule('credit-small-purchase-milestone');
    INSERT INTO cron.job (schedule, command, nodename, nodeport, database, jobname, active)
    VALUES (
      '0 3 * * *',
      format($fn$
        SELECT net.http_post(
          url        := %1$L || '/functions/v1/credit-small-purchase-milestone',
          headers    := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %2$L),
          body       := '{}'::jsonb,
          timeout_milliseconds := 30000
        );
      $fn$, v_proj_url, v_service_key),
      current_setting('server_version'), 5432, current_database(),
      'credit-small-purchase-milestone', TRUE
    ) ON CONFLICT (jobname) DO UPDATE
      SET command  = EXCLUDED.command,
          active   = EXCLUDED.active,
          schedule = EXCLUDED.schedule;
  END IF;
END $$;
