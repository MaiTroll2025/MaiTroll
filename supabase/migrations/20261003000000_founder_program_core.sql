-- ============================================================================
-- MAI TROLL — FOUNDER PROGRAM (CORE)
-- ============================================================================
-- Additive, reversible migration. Extends the EXISTING role architecture,
-- moderation system, gift RPC and cashout RPC. It does NOT replace them.
--
-- Design notes
--   * Founder is NOT stored in user_profiles.role. It lives in its own table so
--     a Founder keeps every role they already had (admin, troll_officer,
--     broadcaster, resident, ...). Nothing is overwritten.
--   * Founder status is TIME BASED. Every permission check requires
--     status = 'active' AND now() < end_at.
--   * The gift multiplier is applied by an AFTER INSERT trigger on
--     public.stream_gifts into a ledger table with a UNIQUE constraint on
--     stream_gift_id. That makes "apply exactly once" a database guarantee,
--     immune to realtime reconnects, frontend retries, payment retries and
--     gift replay.
--   * Purchased coins never touch stream_gifts, so the Founder multiplier can
--     never multiply a coin pack purchase, a refund, an administrative grant
--     or a cashout.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. SAFETY PRE-FLIGHT
--    The Founder program reuses the existing moderation / court / gift /
--    cashout infrastructure. If any of it is missing we abort rather than
--    silently create a second, disconnected system.
-- ============================================================================

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_profiles');
  END IF;
  IF to_regclass('public.stream_gifts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.stream_gifts');
  END IF;
  IF to_regclass('public.moderation_reports') IS NULL THEN
    v_missing := array_append(v_missing, 'public.moderation_reports');
  END IF;
  IF to_regclass('public.notifications') IS NULL THEN
    v_missing := array_append(v_missing, 'public.notifications');
  END IF;
  IF to_regclass('public.payout_requests') IS NULL THEN
    v_missing := array_append(v_missing, 'public.payout_requests');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Founder Program aborted — required existing tables are missing: %',
      array_to_string(v_missing, ', ');
  END IF;
END
$preflight$;

-- ============================================================================
-- 1. PROGRAM SETTINGS (singleton row, configurable capacity)
--    Initial program is 5 Founders, but the limit is data, not code.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_program_settings (
  id                          boolean PRIMARY KEY DEFAULT true,
  program_enabled             boolean NOT NULL DEFAULT true,
  capacity                    integer NOT NULL DEFAULT 5,
  default_duration_months     integer NOT NULL DEFAULT 6,
  default_gift_multiplier     numeric(6,2) NOT NULL DEFAULT 2,
  default_cashout_multiplier  numeric(6,2) NOT NULL DEFAULT 1,
  allowed_multipliers         numeric(6,2)[] NOT NULL DEFAULT ARRAY[1,2,5]::numeric(6,2)[],
  min_multiplier              numeric(6,2) NOT NULL DEFAULT 1,
  max_multiplier              numeric(6,2) NOT NULL DEFAULT 5,
  allow_manual_expiration     boolean NOT NULL DEFAULT true,
  notes                       text,
  updated_by                  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_program_settings_singleton CHECK (id = true),
  CONSTRAINT founder_program_settings_capacity_positive CHECK (capacity > 0),
  CONSTRAINT founder_program_settings_duration_positive CHECK (default_duration_months > 0)
);

INSERT INTO public.founder_program_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. FOUNDERS
--    One live row per user. Removing never deletes: the row is kept with
--    status='removed' so history stays auditable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'expired', 'removed', 'suspended')),
  start_at           timestamptz NOT NULL DEFAULT now(),
  end_at             timestamptz NOT NULL,
  gift_multiplier    numeric(6,2) NOT NULL DEFAULT 2 CHECK (gift_multiplier >= 1),
  cashout_multiplier numeric(6,2) NOT NULL DEFAULT 1 CHECK (cashout_multiplier >= 1),
  previous_role      text,
  previous_troll_role text,
  created_by         uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  removed_by         uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  removed_at         timestamptz,
  removal_reason     text,
  suspended_at       timestamptz,
  notes              text
);

-- At most one live Founder record per user (removed rows stay for history).
CREATE UNIQUE INDEX IF NOT EXISTS founders_one_live_per_user
  ON public.founders (user_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_founders_user_id        ON public.founders (user_id);
CREATE INDEX IF NOT EXISTS idx_founders_status         ON public.founders (status);
CREATE INDEX IF NOT EXISTS idx_founders_end_at         ON public.founders (end_at);
CREATE INDEX IF NOT EXISTS idx_founders_active_window
  ON public.founders (status, end_at);

-- ============================================================================
-- 3. FOUNDER SCHEDULED BROADCASTS
--     Created before founder_actions because founder_actions references it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_scheduled_broadcasts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        uuid REFERENCES public.founders(id) ON DELETE SET NULL,
  user_id           uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  scheduled_for     timestamptz NOT NULL,
  duration_minutes  integer,
  category          text,
  status            text NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'cancelled', 'completed', 'live', 'expired')),
  stream_id         uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancel_reason     text,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_scheduled_broadcasts_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT founder_scheduled_broadcasts_duration_positive
    CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);

CREATE INDEX IF NOT EXISTS idx_founder_sched_user   ON public.founder_scheduled_broadcasts (user_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_founder_sched_status ON public.founder_scheduled_broadcasts (status, scheduled_for);
CREATE UNIQUE INDEX IF NOT EXISTS founder_sched_one_active_per_slot
  ON public.founder_scheduled_broadcasts (user_id, scheduled_for)
  WHERE status = 'scheduled';

-- ============================================================================
-- 4. FOUNDER ACTION AUDIT LOG (server side, never frontend-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id            uuid REFERENCES public.founders(id) ON DELETE SET NULL,
  founder_user_id       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  founder_username      text,
  action_type           text NOT NULL CHECK (action_type IN (
                          'view_report',
                          'arrest',
                          'release',
                          'summon',
                          'schedule_broadcast',
                          'edit_broadcast',
                          'cancel_broadcast',
                          'send_founder_message',
                          'founder_created',
                          'founder_updated',
                          'founder_removed',
                          'founder_expired',
                          'founder_suspended',
                          'founder_resumed',
'gift_bonus',
                           'cashout_bonus',
                           'settings_updated'
                         )),
  target_user_id        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  target_username       text,
  report_id             uuid REFERENCES public.moderation_reports(id) ON DELETE SET NULL,
  case_id               uuid REFERENCES public.court_cases(id) ON DELETE SET NULL,
  scheduled_broadcast_id uuid REFERENCES public.founder_scheduled_broadcasts(id) ON DELETE SET NULL,
  reason                text,
  notes                 text,
  details               jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                text NOT NULL DEFAULT 'completed',
  actor_role            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founder_actions_created     ON public.founder_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_actions_founder     ON public.founder_actions (founder_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_actions_type        ON public.founder_actions (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_actions_target      ON public.founder_actions (target_user_id);
CREATE INDEX IF NOT EXISTS idx_founder_actions_report      ON public.founder_actions (report_id);

-- ============================================================================
-- 5. FOUNDER CHAT (private, realtime)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  body         text NOT NULL,
  channel      text NOT NULL DEFAULT 'founder_chat',
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz,
  deleted_at   timestamptz,
  CONSTRAINT founder_messages_body_not_blank CHECK (length(trim(body)) > 0),
  CONSTRAINT founder_messages_body_length CHECK (length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_founder_messages_created ON public.founder_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_messages_sender  ON public.founder_messages (sender_id, created_at DESC);

-- Per-recipient read state (supports "see unread messages").
CREATE TABLE IF NOT EXISTS public.founder_message_reads (
  message_id   uuid NOT NULL REFERENCES public.founder_messages(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  read_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- ============================================================================
-- 6. FOUNDER GIFT BONUS LEDGER  (exactly-once, auditable)
--    UNIQUE(stream_gift_id) is the idempotency guarantee.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_gift_bonuses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- public.stream_gifts.id is BIGINT (serial), not uuid. Must match exactly
  -- or the FK cannot be created.
  stream_gift_id        bigint NOT NULL UNIQUE
                          REFERENCES public.stream_gifts(id) ON DELETE CASCADE,
  founder_id            uuid REFERENCES public.founders(id) ON DELETE SET NULL,
  founder_user_id       uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stream_id             uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  sender_id             uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  gift_amount           integer NOT NULL,
  base_creator_reward   integer NOT NULL,
  founder_multiplier    numeric(6,2) NOT NULL,
  founder_bonus         integer NOT NULL,
  final_creator_reward  integer NOT NULL,
  credited              boolean NOT NULL DEFAULT false,
  reversed              boolean NOT NULL DEFAULT false,
  reversed_at           timestamptz,
  reversal_reason       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_gift_bonuses_base_positive  CHECK (base_creator_reward >= 0),
  CONSTRAINT founder_gift_bonuses_bonus_positive CHECK (founder_bonus >= 0),
  CONSTRAINT founder_gift_bonuses_final_consistent
    CHECK (final_creator_reward = base_creator_reward + founder_bonus)
);

CREATE INDEX IF NOT EXISTS idx_founder_gift_bonuses_founder ON public.founder_gift_bonuses (founder_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_gift_bonuses_stream  ON public.founder_gift_bonuses (stream_id);

-- ============================================================================
-- 7. FOUNDER CASHOUT BONUS LEDGER  (exactly-once, auditable)
--    UNIQUE(payout_request_id). Never bypasses an existing cashout rule: the
--    bonus is applied only to a payout that already exists, which means it
--    already passed tiers, fees, weekly limits and verification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_cashout_bonuses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id     uuid NOT NULL UNIQUE
                          REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  founder_id            uuid REFERENCES public.founders(id) ON DELETE SET NULL,
  founder_user_id       uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  cashout_multiplier    numeric(6,2) NOT NULL,
  base_cash_amount      numeric(12,2) NOT NULL,
  founder_bonus_cash    numeric(12,2) NOT NULL,
  final_cash_amount     numeric(12,2) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_cashout_bonuses_final_consistent
    CHECK (final_cash_amount = base_cash_amount + founder_bonus_cash)
);

CREATE INDEX IF NOT EXISTS idx_founder_cashout_bonuses_founder
  ON public.founder_cashout_bonuses (founder_user_id, created_at DESC);

-- ============================================================================
-- 8. TRIGGERS / updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS founders_set_updated_at ON public.founders;
CREATE TRIGGER founders_set_updated_at
  BEFORE UPDATE ON public.founders
  FOR EACH ROW EXECUTE FUNCTION public.founder_set_updated_at();

DROP TRIGGER IF EXISTS founder_sched_set_updated_at ON public.founder_scheduled_broadcasts;
CREATE TRIGGER founder_sched_set_updated_at
  BEFORE UPDATE ON public.founder_scheduled_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.founder_set_updated_at();

DROP TRIGGER IF EXISTS founder_settings_set_updated_at ON public.founder_program_settings;
CREATE TRIGGER founder_settings_set_updated_at
  BEFORE UPDATE ON public.founder_program_settings
  FOR EACH ROW EXECUTE FUNCTION public.founder_set_updated_at();

-- ============================================================================
-- 9. ADMIN GATE (self-contained; no dependency on public.is_admin() so the
--    Founder Program cannot break if that helper is re-defined.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_user_is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT true
      FROM public.user_profiles up
      WHERE up.id = p_user_id
        AND (
          COALESCE(up.is_admin, false) = true
          OR COALESCE(up.is_superadmin, false) = true
          OR LOWER(COALESCE(up.role, '')) IN ('admin', 'superadmin', 'ceo', 'owner')
          OR LOWER(COALESCE(up.troll_role, '')) IN ('admin', 'superadmin', 'ceo', 'owner')
        )
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_user_is_admin(uuid) TO authenticated, service_role;

-- ============================================================================
-- 10. FOUNDER PERMISSION FUNCTIONS
--     The single source of truth for "active Founder".
--     active  == status='active' AND removed_at IS NULL AND now() < end_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_founder(p_user_id uuid)
RETURNS public.founders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.*
  FROM public.founders f
  WHERE f.user_id = p_user_id
    AND f.removed_at IS NULL
  ORDER BY (f.status = 'active' AND f.end_at > now()) DESC, f.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_founder(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_active_founder(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT true
      FROM public.founders f
      JOIN public.founder_program_settings s ON s.id = true
      WHERE f.user_id = p_user_id
        AND f.status = 'active'
        AND f.removed_at IS NULL
        AND f.end_at > now()
        AND COALESCE(s.program_enabled, true) = true
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_founder(uuid) TO authenticated, service_role;

-- Convenience alias used by some RPCs.
CREATE OR REPLACE FUNCTION public.founder_is_active(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_founder(p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.founder_is_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_manage_founders(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.founder_user_is_admin(p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_founders(uuid) TO authenticated, service_role;

-- Admin may open the Founder Hub for administration.
CREATE OR REPLACE FUNCTION public.can_access_founder_hub(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_founder(p_user_id)
      OR public.can_manage_founders(p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_access_founder_hub(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Individual Founder capabilities. Each one re-verifies status + expiry.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_founder_view_reports(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_founder(p_user_id);
$$;
CREATE OR REPLACE FUNCTION public.can_founder_arrest(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_founder(p_user_id);
$$;
CREATE OR REPLACE FUNCTION public.can_founder_release(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_founder(p_user_id);
$$;
CREATE OR REPLACE FUNCTION public.can_founder_summon(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_founder(p_user_id);
$$;
CREATE OR REPLACE FUNCTION public.can_founder_schedule_broadcast(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_founder(p_user_id);
$$;
CREATE OR REPLACE FUNCTION public.can_founder_use_chat(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_founder(p_user_id) OR public.can_manage_founders(p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_founder_view_reports(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_founder_arrest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_founder_release(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_founder_summon(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_founder_schedule_broadcast(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_founder_use_chat(uuid) TO authenticated, service_role;

-- Effective status (handles lazy expiry without needing a cron).
CREATE OR REPLACE FUNCTION public.founder_effective_status(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
               WHEN f.removed_at IS NOT NULL OR f.status = 'removed' THEN 'removed'
               WHEN f.status = 'suspended'                      THEN 'suspended'
               WHEN f.status = 'expired'                       THEN 'expired'
               WHEN f.end_at <= now()                          THEN 'expired'
               ELSE 'active'
             END
      FROM public.founders f
      WHERE f.user_id = p_user_id
      ORDER BY f.created_at DESC
      LIMIT 1
    ),
    'none'
  );
$$;

GRANT EXECUTE ON FUNCTION public.founder_effective_status(uuid) TO authenticated, service_role;

-- ============================================================================
-- 11. EXPIRY SYNC
--     Flips status active -> expired once end_at passes. Rows are never
--     deleted, so historical Founder actions remain auditable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_sync_expirations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.founders f
       SET status = 'expired',
           updated_at = now()
     WHERE f.status = 'active'
       AND f.removed_at IS NULL
       AND f.end_at <= now()
    RETURNING f.id, f.user_id, f.end_at
  )
  INSERT INTO public.founder_actions (
    founder_id, founder_user_id, founder_username,
    action_type, details, status, actor_role, created_at
  )
  SELECT e.id,
         e.user_id,
         (SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown')
            FROM public.user_profiles up WHERE up.id = e.user_id),
         'founder_expired',
         jsonb_build_object('end_at', e.end_at, 'reason', 'term_ended'),
         'completed',
         'system',
         now()
    FROM expired e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_sync_expirations() TO authenticated, service_role;

-- ============================================================================
-- 12. NOTIFICATION + AUDIT HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, body, metadata, is_read, read, created_at)
  VALUES (p_user_id, p_type, p_title, p_message, p_message, COALESCE(p_metadata, '{}'::jsonb), false, false, now())
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let a notification failure roll back a moderation action.
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_notify(uuid, text, text, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_log_action(
  p_founder_id uuid,
  p_action_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_report_id uuid DEFAULT NULL,
  p_case_id uuid DEFAULT NULL,
  p_scheduled_broadcast_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
  v_username text;
BEGIN
  SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown')
    INTO v_username
    FROM public.user_profiles up
   WHERE up.id = v_actor;

  INSERT INTO public.founder_actions (
    founder_id, founder_user_id, founder_username, action_type,
    target_user_id, target_username, report_id, case_id,
    scheduled_broadcast_id, reason, notes, details, status, actor_role, created_at
  )
  VALUES (
    p_founder_id,
    v_actor,
    v_username,
    p_action_type,
    p_target_user_id,
    (SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown')
       FROM public.user_profiles up WHERE up.id = p_target_user_id),
    p_report_id,
    p_case_id,
    p_scheduled_broadcast_id,
    p_reason,
    p_notes,
    COALESCE(p_details, '{}'::jsonb),
    'completed',
    CASE WHEN public.founder_user_is_admin(v_actor) THEN 'admin' ELSE 'founder' END,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_log_action(
  uuid, text, uuid, text, uuid, uuid, uuid, text, jsonb
) TO authenticated, service_role;

-- ============================================================================
-- 13. GIFT MULTIPLIER — EXACTLY ONCE
--
--     Triggered by stream_gifts AFTER INSERT.
--
--     Guarantees:
--       * UNIQUE(stream_gift_id) makes a second application impossible.
--       * Only EARNED gift rewards are multiplied. Purchased coins, coin packs,
--         refunds, admin grants and cashouts never create a stream_gifts row.
--       * Reversed/cancelled gifts are skipped, and reversing a gift debits
--         the previously credited bonus.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_apply_gift_bonus(p_stream_gift_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g            public.stream_gifts%ROWTYPE;
  v_founder    public.founders%ROWTYPE;
  v_receiver   uuid;
  v_base       integer;
  v_bonus      integer;
  v_final      integer;
  v_mult       numeric(6,2);
  v_new_id     uuid;
BEGIN
  IF p_stream_gift_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT', 'message', 'A gift id is required.');
  END IF;

  SELECT * INTO g FROM public.stream_gifts WHERE id = p_stream_gift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'GIFT_NOT_FOUND', 'message', 'Gift not found.');
  END IF;

  -- Reversed / cancelled gifts never earn a bonus.
  IF COALESCE(g.is_reversed, false) = true THEN
    RETURN jsonb_build_object('success', false, 'code', 'GIFT_REVERSED', 'message', 'Gift was reversed.');
  END IF;

  v_receiver := COALESCE(g.receiver_id, g.recipient_id);
  IF v_receiver IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_RECEIVER', 'message', 'Gift has no receiver.');
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_receiver);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_A_FOUNDER', 'message', 'Receiver is not a Founder.');
  END IF;

  IF v_founder.status <> 'active'
     OR v_founder.removed_at IS NOT NULL
     OR v_founder.end_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'code', 'FOUNDER_INACTIVE', 'message', 'Founder status is not active.');
  END IF;

  v_mult := COALESCE(v_founder.gift_multiplier, 1);
  IF v_mult <= 1 THEN
    RETURN jsonb_build_object('success', true, 'applied', false, 'code', 'NO_MULTIPLIER',
                             'message', 'Founder gift multiplier is 1x.');
  END IF;

  -- Base creator reward: what the creator actually earned from this gift.
  v_base := COALESCE(
    NULLIF(g.metadata ->> 'creator_share_coins', '')::integer,
    NULLIF(g.metadata ->> 'creator_reward', '')::integer,
    NULLIF(g.coins_amount, 0),
    NULLIF(g.coins_spent, 0),
    NULLIF(g.amount, 0),
    0
  );

  IF v_base <= 0 THEN
    RETURN jsonb_build_object('success', true, 'applied', false, 'code', 'NO_BASE_REWARD',
                             'message', 'Gift has no creator reward to multiply.');
  END IF;

  v_bonus := ROUND(v_base * (v_mult - 1))::integer;
  IF v_bonus <= 0 THEN
    RETURN jsonb_build_object('success', true, 'applied', false, 'code', 'ZERO_BONUS',
                             'message', 'Founder bonus rounds to zero.');
  END IF;

  v_final := v_base + v_bonus;

  -- Idempotency gate: the UNIQUE constraint on stream_gift_id means this INSERT
  -- can only ever succeed once for a given gift, no matter how many times the
  -- trigger, a retry, a reconnect or a replay calls it.
  INSERT INTO public.founder_gift_bonuses (
    stream_gift_id, founder_id, founder_user_id, stream_id, sender_id,
    gift_amount, base_creator_reward, founder_multiplier, founder_bonus,
    final_creator_reward, credited, created_at
  )
  VALUES (
    p_stream_gift_id, v_founder.id, v_receiver, g.stream_id, g.sender_id,
    COALESCE(g.coins_amount, g.amount, 0), v_base, v_mult, v_bonus, v_final, false, now()
  )
  ON CONFLICT (stream_gift_id) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'applied', false, 'code', 'ALREADY_APPLIED',
                             'message', 'Founder bonus was already applied to this gift.');
  END IF;

  -- Credit the Founder.
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  UPDATE public.user_profiles
     SET troll_coins        = COALESCE(troll_coins, 0) + v_bonus,
         total_earned_coins = COALESCE(total_earned_coins, 0) + v_bonus,
         updated_at         = now()
   WHERE id = v_receiver;

  IF NOT FOUND THEN
    -- Recipient disappeared mid-flight; keep the ledger row for audit but do
    -- not leave it marked as credited.
    RETURN jsonb_build_object('success', false, 'code', 'RECIPIENT_NOT_FOUND',
                             'message', 'Founder profile no longer exists.',
                             'bonus_id', v_new_id);
  END IF;

  INSERT INTO public.coin_transactions (
    user_id, amount, type, description, metadata, created_at
  )
  VALUES (
    v_receiver,
    v_bonus,
    'founder_gift_bonus',
    format('Founder Program %sx gift reward bonus (+%s coins)', v_mult, v_bonus),
    jsonb_build_object(
      'founder_bonus_id', v_new_id,
      'stream_gift_id',    p_stream_gift_id,
      'stream_id',         g.stream_id,
      'gift_id',           g.gift_id,
      'gift_amount',       COALESCE(g.coins_amount, g.amount, 0),
      'base_creator_reward',   v_base,
      'founder_multiplier',    v_mult,
      'founder_bonus',         v_bonus,
      'final_creator_reward',  v_final,
      'sender_id',         g.sender_id
    ),
    now()
  );

  UPDATE public.founder_gift_bonuses
     SET credited = true
   WHERE id = v_new_id;

  INSERT INTO public.founder_actions (
    founder_id, founder_user_id, founder_username, action_type,
    target_user_id, target_username, details, status, actor_role, created_at
  )
  VALUES (
    v_founder.id, v_receiver,
    (SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown')
       FROM public.user_profiles up WHERE up.id = v_receiver),
    'gift_bonus', v_receiver, NULL,
    jsonb_build_object(
      'stream_gift_id', p_stream_gift_id,
      'stream_id',      g.stream_id,
      'gift_amount',    COALESCE(g.coins_amount, g.amount, 0),
      'base_creator_reward',  v_base,
      'founder_multiplier',   v_mult,
      'founder_bonus',        v_bonus,
      'final_creator_reward', v_final
    ),
    'completed', 'system', now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'applied', true,
    'bonus_id', v_new_id,
    'gift_amount',           COALESCE(g.coins_amount, g.amount, 0),
    'base_creator_reward',   v_base,
    'founder_multiplier',    v_mult,
    'founder_bonus',         v_bonus,
    'final_creator_reward',  v_final
  );
EXCEPTION
  WHEN OTHERS THEN
    -- A Founder bonus failure must never break gifting for everyone else.
    RETURN jsonb_build_object('success', false, 'code', 'FOUNDER_BONUS_ERROR',
                             'message', 'Founder bonus could not be applied.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_apply_gift_bonus(bigint) TO authenticated, service_role;

-- AFTER INSERT trigger: the ONLY place the bonus is applied during gifting.
CREATE OR REPLACE FUNCTION public.founder_trg_stream_gift_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.founder_apply_gift_bonus(NEW.id);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS founder_stream_gift_bonus_ins ON public.stream_gifts;
CREATE TRIGGER founder_stream_gift_bonus_ins
  AFTER INSERT ON public.stream_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.founder_trg_stream_gift_bonus();

-- Reversal: if a gift is undone, claw back the Founder bonus (once).
CREATE OR REPLACE FUNCTION public.founder_trg_stream_gift_reversal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.founder_gift_bonuses%ROWTYPE;
BEGIN
  IF COALESCE(NEW.is_reversed, false) = true
     AND COALESCE(OLD.is_reversed, false) IS DISTINCT FROM true THEN

    SELECT * INTO b
      FROM public.founder_gift_bonuses
     WHERE stream_gift_id = NEW.id
     FOR UPDATE;

    IF FOUND AND b.credited = true AND b.reversed = false AND b.founder_bonus > 0 THEN
      PERFORM set_config('app.bypass_coin_protection', 'true', true);

      UPDATE public.founder_gift_bonuses
         SET reversed = true,
             reversed_at = now(),
             reversal_reason = 'gift_reversed',
             credited = false
       WHERE id = b.id;

      UPDATE public.user_profiles
         SET troll_coins        = GREATEST(0, COALESCE(troll_coins, 0) - b.founder_bonus),
             total_earned_coins = GREATEST(0, COALESCE(total_earned_coins, 0) - b.founder_bonus),
             updated_at         = now()
       WHERE id = b.founder_user_id;

      INSERT INTO public.coin_transactions (
        user_id, amount, type, description, metadata, created_at
      )
      VALUES (
        b.founder_user_id,
        -b.founder_bonus,
        'founder_gift_bonus_reversal',
        format('Founder Program gift bonus reversed (-%s coins)', b.founder_bonus),
        jsonb_build_object(
          'founder_bonus_id', b.id,
          'stream_gift_id',   b.stream_gift_id,
          'reason',           'gift_reversed'
        ),
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS founder_stream_gift_reversal ON public.stream_gifts;
CREATE TRIGGER founder_stream_gift_reversal
  AFTER UPDATE ON public.stream_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.founder_trg_stream_gift_reversal();

-- ============================================================================
-- 14. CASHOUT MULTIPLIER
--     Applied only to a payout that ALREADY exists, which means it already
--     passed every existing rule (minimum, tier, fees, weekly limit,
--     verification, provider). It never creates, approves or processes a
--     cashout, and Founders cannot call the approve/deny RPCs.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_apply_cashout_bonus(p_payout_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout    public.payout_requests%ROWTYPE;
  v_founder   public.founders%ROWTYPE;
  v_actor     uuid := auth.uid();
  v_mult      numeric(6,2);
  v_base      numeric(12,2);
  v_bonus     numeric(12,2);
  v_final     numeric(12,2);
  v_new_id    uuid;
BEGIN
  IF p_payout_request_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT', 'message', 'A payout request id is required.');
  END IF;

  SELECT * INTO v_payout FROM public.payout_requests WHERE id = p_payout_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYOUT_NOT_FOUND', 'message', 'Cashout request not found.');
  END IF;

  -- Only the payout owner, an admin, or the service role may apply this.
  IF v_actor IS NOT NULL
     AND v_actor <> v_payout.user_id
     AND NOT public.founder_user_is_admin(v_actor)
     AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED',
                             'message', 'You cannot apply a cashout bonus to this request.');
  END IF;

  SELECT * INTO v_founder FROM public.get_founder(v_payout.user_id);
  IF NOT FOUND
     OR v_founder.status <> 'active'
     OR v_founder.removed_at IS NOT NULL
     OR v_founder.end_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'code', 'FOUNDER_INACTIVE',
                             'message', 'Founder status is not active.');
  END IF;

  v_mult := COALESCE(v_founder.cashout_multiplier, 1);
  IF v_mult <= 1 THEN
    RETURN jsonb_build_object('success', true, 'applied', false, 'code', 'NO_MULTIPLIER',
                             'message', 'Founder cashout multiplier is 1x.');
  END IF;

  v_base := COALESCE(v_payout.net_amount, v_payout.cash_amount, 0);
  IF v_base <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_BASE_AMOUNT',
                             'message', 'Cashout request has no payable amount.');
  END IF;

  v_bonus := ROUND(v_base * (v_mult - 1), 2);
  IF v_bonus <= 0 THEN
    RETURN jsonb_build_object('success', true, 'applied', false, 'code', 'ZERO_BONUS',
                             'message', 'Founder cashout bonus rounds to zero.');
  END IF;

  v_final := v_base + v_bonus;

  INSERT INTO public.founder_cashout_bonuses (
    payout_request_id, founder_id, founder_user_id,
    cashout_multiplier, base_cash_amount, founder_bonus_cash, final_cash_amount, created_at
  )
  VALUES (
    p_payout_request_id, v_founder.id, v_payout.user_id, v_mult, v_base, v_bonus, v_final, now()
  )
  ON CONFLICT (payout_request_id) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'applied', false, 'code', 'ALREADY_APPLIED',
                             'message', 'Founder cashout bonus was already applied to this request.');
  END IF;

  UPDATE public.payout_requests
     SET cash_amount = v_final,
         net_amount  = v_final,
         updated_at  = now()
   WHERE id = p_payout_request_id;

  INSERT INTO public.founder_actions (
    founder_id, founder_user_id, founder_username, action_type,
    target_user_id, details, status, actor_role, created_at
  )
  VALUES (
    v_founder.id, v_payout.user_id,
    (SELECT COALESCE(NULLIF(up.username, ''), NULLIF(up.display_name, ''), 'Unknown')
       FROM public.user_profiles up WHERE up.id = v_payout.user_id),
    'cashout_bonus', v_payout.user_id,
    jsonb_build_object(
      'payout_request_id',  p_payout_request_id,
      'cashout_multiplier', v_mult,
      'base_cash_amount',   v_base,
      'founder_bonus_cash', v_bonus,
      'final_cash_amount',  v_final
    ),
    'completed',
    CASE WHEN v_actor IS NULL OR auth.role() = 'service_role' THEN 'system'
         WHEN public.founder_user_is_admin(v_actor) THEN 'admin' ELSE 'founder' END,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'applied', true,
    'payout_request_id',   p_payout_request_id,
    'cashout_multiplier',  v_mult,
    'base_cash_amount',    v_base,
    'founder_bonus_cash',  v_bonus,
    'final_cash_amount',   v_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_apply_cashout_bonus(uuid) TO authenticated, service_role;

-- Founder-facing cashout wrapper. It runs the EXISTING request_cashout first,
-- so all existing cashout rules are enforced, and only then layers the
-- Founder multiplier on top of the request that already passed.
CREATE OR REPLACE FUNCTION public.founder_request_cashout(
  p_coins_to_redeem bigint,
  p_provider_type text,
  p_provider_username text,
  p_user_tag text DEFAULT NULL,
  p_id_verification_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb;
  v_payout_id uuid;
  v_bonus jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'request_cashout'
       AND pronamespace = 'public'::regnamespace
       AND pronargs = 6
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAVAILABLE', 'message', 'Cashout is temporarily unavailable.');
  END IF;

  v_result := public.request_cashout(
    v_actor, p_coins_to_redeem, p_provider_type, p_provider_username,
    p_user_tag, p_id_verification_url
  );

  IF COALESCE((v_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_payout_id := NULLIF(v_result ->> 'payout_id', '')::uuid;

  IF v_payout_id IS NOT NULL THEN
    v_bonus := public.founder_apply_cashout_bonus(v_payout_id);
  ELSE
    v_bonus := jsonb_build_object('success', true, 'applied', false);
  END IF;

  RETURN v_result || jsonb_build_object(
    'founder_cashout_bonus', v_bonus,
    'cashout_multiplier', COALESCE((v_bonus ->> 'cashout_multiplier')::numeric, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.founder_request_cashout(bigint, text, text, text, text)
  TO authenticated, service_role;

-- ============================================================================
-- 15. ROW LEVEL SECURITY
--     Direct writes are revoked: SECURITY DEFINER functions are the only
--     mutation path for Founder data.
-- ============================================================================

ALTER TABLE public.founder_program_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founders                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_actions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_message_reads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_scheduled_broadcasts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_gift_bonuses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_cashout_bonuses       ENABLE ROW LEVEL SECURITY;

-- Settings: readable by any authenticated user (capacity + defaults drive UI).
DROP POLICY IF EXISTS founder_settings_read ON public.founder_program_settings;
CREATE POLICY founder_settings_read
  ON public.founder_program_settings FOR SELECT
  TO authenticated
  USING (true);

-- Founders: a Founder sees their own record; Admins see everything.
-- Public discovery of *who is* a Founder goes through founder_public_directory()
-- so multipliers/notes never leak through raw table access.
DROP POLICY IF EXISTS founders_read_own_or_admin ON public.founders;
CREATE POLICY founders_read_own_or_admin
  ON public.founders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.founder_user_is_admin(auth.uid()));

-- Founder actions: a Founder sees their own history; Admins see everything.
DROP POLICY IF EXISTS founder_actions_read_own_or_admin ON public.founder_actions;
CREATE POLICY founder_actions_read_own_or_admin
  ON public.founder_actions FOR SELECT
  TO authenticated
  USING (
    founder_user_id = auth.uid()
    OR public.founder_user_is_admin(auth.uid())
  );

-- Founder chat: active Founders and Admins only.
DROP POLICY IF EXISTS founder_messages_read ON public.founder_messages;
CREATE POLICY founder_messages_read
  ON public.founder_messages FOR SELECT
  TO authenticated
  USING (public.can_founder_use_chat(auth.uid()));

DROP POLICY IF EXISTS founder_message_reads_own ON public.founder_message_reads;
CREATE POLICY founder_message_reads_own
  ON public.founder_message_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Scheduled broadcasts: upcoming ones are public (profile banner); the rest are
-- visible to the owning Founder and to Admins.
DROP POLICY IF EXISTS founder_sched_read ON public.founder_scheduled_broadcasts;
CREATE POLICY founder_sched_read
  ON public.founder_scheduled_broadcasts FOR SELECT
  TO authenticated
  USING (
    (status = 'scheduled' AND scheduled_for >= now() - interval '1 hour')
    OR user_id = auth.uid()
    OR public.founder_user_is_admin(auth.uid())
  );

-- Bonuses: visible to the Founder they belong to and to Admins.
DROP POLICY IF EXISTS founder_gift_bonuses_read ON public.founder_gift_bonuses;
CREATE POLICY founder_gift_bonuses_read
  ON public.founder_gift_bonuses FOR SELECT
  TO authenticated
  USING (founder_user_id = auth.uid() OR public.founder_user_is_admin(auth.uid()));

DROP POLICY IF EXISTS founder_cashout_bonuses_read ON public.founder_cashout_bonuses;
CREATE POLICY founder_cashout_bonuses_read
  ON public.founder_cashout_bonuses FOR SELECT
  TO authenticated
  USING (founder_user_id = auth.uid() OR public.founder_user_is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies are created on purpose.
REVOKE INSERT, UPDATE, DELETE ON public.founders                     FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.founder_actions              FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.founder_messages             FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.founder_message_reads        FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.founder_scheduled_broadcasts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.founder_gift_bonuses         FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.founder_cashout_bonuses      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.founder_program_settings     FROM authenticated;

GRANT SELECT ON public.founder_program_settings,     public.founders,                    public.founder_actions,
                public.founder_messages,             public.founder_message_reads,       public.founder_scheduled_broadcasts,
                public.founder_gift_bonuses,         public.founder_cashout_bonuses
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';