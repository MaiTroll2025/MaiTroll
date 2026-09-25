-- Troll Time: server-authoritative 30-second battle-point multiplier
-- Migration: 20260922000000_troll_time
-- CRITICAL: Troll Time multiplies BATTLE POINTS ONLY.
-- It must NEVER multiply actual coins, wallet deductions, gift coin
-- value, creator earnings, broadcaster earnings, cashout balances,
-- coin purchases, refunds, cashback, or financial transactions.

-- 1. troll_time_events
CREATE TABLE IF NOT EXISTS public.troll_time_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type = 'troll_time'),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'expired', 'cancelled')),
  multiplier INTEGER NOT NULL CHECK (multiplier IN (2, 4, 6)),
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  next_troll_time_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(battle_id, status)
);

CREATE INDEX IF NOT EXISTS idx_troll_time_events_battle_id ON public.troll_time_events(battle_id);
CREATE INDEX IF NOT EXISTS idx_troll_time_events_status ON public.troll_time_events(status);
CREATE INDEX IF NOT EXISTS idx_troll_time_events_starts_at ON public.troll_time_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_troll_time_events_ends_at ON public.troll_time_events(ends_at);

-- 2. RLS
ALTER TABLE public.troll_time_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "troll_time_events_select_authenticated" ON public.troll_time_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "troll_time_events_insert_service_role" ON public.troll_time_events FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "troll_time_events_update_service_role" ON public.troll_time_events FOR UPDATE TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON public.troll_time_events TO service_role;
GRANT SELECT ON public.troll_time_events TO authenticated;

-- 3. battles columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='battles' AND column_name='troll_time_active') THEN
    ALTER TABLE public.battles ADD COLUMN troll_time_active BOOLEAN DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='battles' AND column_name='troll_time_multiplier') THEN
    ALTER TABLE public.battles ADD COLUMN troll_time_multiplier INTEGER DEFAULT 1 CHECK (troll_time_multiplier IN (1,2,4,6));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='battles' AND column_name='troll_time_started_at') THEN
    ALTER TABLE public.battles ADD COLUMN troll_time_started_at TIMESTAMPTZ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='battles' AND column_name='troll_time_ends_at') THEN
    ALTER TABLE public.battles ADD COLUMN troll_time_ends_at TIMESTAMPTZ;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='battles' AND column_name='troll_time_next_at') THEN
    ALTER TABLE public.battles ADD COLUMN troll_time_next_at TIMESTAMPTZ;
  END IF;
END $$;

-- 4. battle_gifts audit columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='battle_gifts' AND column_name='battle_multiplier') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN battle_multiplier INTEGER DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='battle_gifts' AND column_name='troll_time_event_id') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN troll_time_event_id UUID REFERENCES public.troll_time_events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. stream_gifts audit columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stream_gifts' AND column_name='battle_multiplier') THEN
    ALTER TABLE public.stream_gifts ADD COLUMN battle_multiplier INTEGER DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stream_gifts' AND column_name='troll_time_event_id') THEN
    ALTER TABLE public.stream_gifts ADD COLUMN troll_time_event_id UUID REFERENCES public.troll_time_events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. coin_transactions audit columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coin_transactions' AND column_name='battle_multiplier') THEN
    ALTER TABLE public.coin_transactions ADD COLUMN battle_multiplier INTEGER DEFAULT 1;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coin_transactions' AND column_name='troll_time_event_id') THEN
    ALTER TABLE public.coin_transactions ADD COLUMN troll_time_event_id UUID REFERENCES public.troll_time_events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. roll_troll_time_event — authoritative server-side roll.
--    Selects ONE multiplier (2x/4x/6x) server-side, creates the
--    authoritative event row, and updates the battles row.
--    Client is NEVER allowed to determine the multiplier.
CREATE OR REPLACE FUNCTION public.roll_troll_time_event(
  p_battle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%ROWTYPE;
  v_multiplier INTEGER;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_duration INTEGER := 10;
  v_next TIMESTAMPTZ;
  v_event public.troll_time_events%ROWTYPE;
BEGIN
  SELECT * INTO v_battle
  FROM public.battles
  WHERE id = p_battle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle is not active');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.troll_time_events
    WHERE battle_id = p_battle_id
      AND status IN ('scheduled', 'active')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Troll Time already scheduled or active');
  END IF;

  v_multiplier := (ARRAY[2, 4, 6])[1 + (floor(random() * 3)::INTEGER)];

  v_starts_at := now();
  v_ends_at := v_starts_at + (v_duration || ' seconds')::INTERVAL;
  v_next := v_ends_at + (30 || ' seconds')::INTERVAL;

  INSERT INTO public.troll_time_events (
    battle_id, event_type, status, multiplier,
    started_at, ends_at, duration_seconds, next_troll_time_at
  ) VALUES (
    p_battle_id, 'troll_time', 'active', v_multiplier,
    v_starts_at, v_ends_at, v_duration, v_next
  )
  RETURNING * INTO v_event;

  UPDATE public.battles
  SET
    troll_time_active = true,
    troll_time_multiplier = v_multiplier,
    troll_time_started_at = v_starts_at,
    troll_time_ends_at = v_ends_at,
    troll_time_next_at = v_next
  WHERE id = p_battle_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event.id,
    'battle_id', p_battle_id,
    'multiplier', v_multiplier,
    'started_at', v_starts_at,
    'ends_at', v_ends_at,
    'next_troll_time_at', v_next
  );
END;
$$;
-- 8. expire_troll_time_event
CREATE OR REPLACE FUNCTION public.expire_troll_time_event(
  p_battle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.troll_time_events%ROWTYPE;
  v_next TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_event
  FROM public.troll_time_events
  WHERE battle_id = p_battle_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active Troll Time event');
  END IF;

  UPDATE public.troll_time_events
  SET status = 'expired'
  WHERE id = v_event.id;

  v_next := now() + (30 || ' seconds')::INTERVAL;

  UPDATE public.troll_time_events
  SET next_troll_time_at = v_next
  WHERE id = v_event.id;

  UPDATE public.battles
  SET
    troll_time_active = false,
    troll_time_multiplier = 1,
    troll_time_started_at = NULL,
    troll_time_ends_at = NULL,
    troll_time_next_at = v_next
  WHERE id = p_battle_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event.id,
    'battle_id', p_battle_id,
    'multiplier', v_event.multiplier,
    'expired_at', now(),
    'next_troll_time_at', v_next
  );
END;
$$;
-- 9. get_authoritative_troll_time
CREATE OR REPLACE FUNCTION public.get_authoritative_troll_time(
  p_battle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%ROWTYPE;
  v_active public.troll_time_events%ROWTYPE;
BEGIN
  SELECT * INTO v_battle
  FROM public.battles
  WHERE id = p_battle_id;

  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  SELECT * INTO v_active
  FROM public.troll_time_events
  WHERE battle_id = p_battle_id AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'battle_id', p_battle_id,
    'battle_status', v_battle.status,
    'troll_time_active', COALESCE(v_battle.troll_time_active, false),
    'troll_time_multiplier', COALESCE(v_battle.troll_time_multiplier, 1),
    'troll_time_started_at', v_battle.troll_time_started_at,
    'troll_time_ends_at', v_battle.troll_time_ends_at,
    'troll_time_next_at', v_battle.troll_time_next_at,
    'event_id', v_active.id,
    'event_multiplier', v_active.multiplier,
    'event_started_at', v_active.started_at,
    'event_ends_at', v_active.ends_at,
    'server_time', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.roll_troll_time_event(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_troll_time_event(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_authoritative_troll_time(UUID) TO authenticated, service_role;
-- ============================================================
-- RTC Admin Monitor permission grant table for Career roles.
-- Reuses the existing role/permission architecture. Admin roles
-- always have access; Career roles require an explicit grant.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_rtc_admin_monitor_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

ALTER TABLE public.user_rtc_admin_monitor_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rtc_admin_monitor_grants_select_admin"
  ON public.user_rtc_admin_monitor_grants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
    )
  );

CREATE POLICY "rtc_admin_monitor_grants_self_select"
  ON public.user_rtc_admin_monitor_grants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "rtc_admin_monitor_grants_insert_admin"
  ON public.user_rtc_admin_monitor_grants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
    )
  );

CREATE POLICY "rtc_admin_monitor_grants_update_admin"
  ON public.user_rtc_admin_monitor_grants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
    )
  ) WITH CHECK (true);

CREATE POLICY "rtc_admin_monitor_grants_delete_admin"
  ON public.user_rtc_admin_monitor_grants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
    )
  );

GRANT ALL ON public.user_rtc_admin_monitor_grants TO service_role;
GRANT SELECT ON public.user_rtc_admin_monitor_grants TO authenticated;

-- Authoritative permission check: admin roles always pass; everyone else
-- needs an explicit, non-expired grant.
CREATE OR REPLACE FUNCTION public.can_access_rtc_admin_monitor(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_grant_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Admin / platform owner roles always have access.
  IF v_profile.is_admin = true
     OR v_profile.is_superadmin = true
     OR v_profile.role IN ('admin','superadmin','ceo','owner')
     OR v_profile.troll_role IN ('admin','superadmin','ceo','owner')
  THEN
    RETURN true;
  END IF;

  -- Web route roles (mirrors App.tsx /rtcadminmonitor RequireRole list).
  IF v_profile.role IN ('hr_admin','agency_hr_manager','lead_troll_officer','troll_officer','secretary','ceo','officer','pastor')
     OR v_profile.troll_role IN ('hr_admin','agency_hr_manager','lead_troll_officer','troll_officer','secretary','ceo','officer','pastor')
  THEN
    RETURN true;
  END IF;

  -- Career roles require an explicit, non-expired grant.
  SELECT COUNT(*) INTO v_grant_count
  FROM public.user_rtc_admin_monitor_grants
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now());

  RETURN v_grant_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_rtc_admin_monitor(UUID) TO authenticated, service_role;
