-- ============================================================================
-- TROLL COURT COMPLETE WORKFLOW — IDEMPOTENT ADDITIONS
-- ============================================================================
-- This migration adds ONLY missing tables/columns/RPCs.
-- It does NOT recreate or alter existing tables beyond adding columns.
-- Safe to run multiple times.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. COURT DOCKETS (plural) — scheduling calendar for court dates
--    This is DISTINCT from the existing "court_docket" (singular) table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.court_dockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_date DATE NOT NULL UNIQUE,
    max_cases INTEGER DEFAULT 20,
    cases_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed', 'completed')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_dockets_date ON public.court_dockets(court_date);
CREATE INDEX IF NOT EXISTS idx_court_dockets_status ON public.court_dockets(status);

ALTER TABLE public.court_dockets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view court_dockets" ON public.court_dockets;
CREATE POLICY "Public view court_dockets" ON public.court_dockets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage court_dockets" ON public.court_dockets;
CREATE POLICY "Staff manage court_dockets" ON public.court_dockets FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge', 'secretary')
            OR is_admin = true
            OR is_troll_officer = true
            OR is_lead_officer = true
        )
    )
);

-- ============================================================================
-- 2. COURT PARTICIPANTS — tracks who is in which session and their role
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.court_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_session_id UUID REFERENCES public.court_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'audience' CHECK (role IN ('judge', 'prosecutor', 'attorney', 'defendant', 'witness', 'audience', 'bailiff', 'clerk')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(court_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_court_participants_session ON public.court_participants(court_session_id);
CREATE INDEX IF NOT EXISTS idx_court_participants_user ON public.court_participants(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_court_participants_session_user ON public.court_participants(court_session_id, user_id);

ALTER TABLE public.court_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view court_participants" ON public.court_participants;
CREATE POLICY "Public view court_participants" ON public.court_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own participation" ON public.court_participants;
CREATE POLICY "Users manage own participation" ON public.court_participants FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge', 'secretary')
            OR is_admin = true
            OR is_troll_officer = true
            OR is_lead_officer = true
        )
    )
);

-- ============================================================================
-- 3. COURT WARRANTS — issued when defendant fails to appear
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.court_warrants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.court_cases(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    bond_amount INTEGER NOT NULL DEFAULT 500,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cleared', 'expired')),
    issued_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    paid_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    paid_amount INTEGER,
    cleared_at TIMESTAMPTZ,
    cleared_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    prior_offense_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_warrants_user ON public.court_warrants(user_id);
CREATE INDEX IF NOT EXISTS idx_court_warrants_case ON public.court_warrants(case_id);
CREATE INDEX IF NOT EXISTS idx_court_warrants_status ON public.court_warrants(status);

ALTER TABLE public.court_warrants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view warrants" ON public.court_warrants;
CREATE POLICY "Public view warrants" ON public.court_warrants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage warrants" ON public.court_warrants;
CREATE POLICY "Staff manage warrants" ON public.court_warrants FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge', 'secretary')
            OR is_admin = true
            OR is_troll_officer = true
            OR is_lead_officer = true
        )
    )
);

-- ============================================================================
-- 4. COURT SENTENCES — issued after hearing
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.court_sentences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.court_cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    sentence_type TEXT NOT NULL,
    duration_minutes INTEGER,
    duration_text TEXT,
    start_at TIMESTAMPTZ DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    issued_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'revoked', 'expired')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_sentences_user ON public.court_sentences(user_id);
CREATE INDEX IF NOT EXISTS idx_court_sentences_case ON public.court_sentences(case_id);
CREATE INDEX IF NOT EXISTS idx_court_sentences_status ON public.court_sentences(status);

ALTER TABLE public.court_sentences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view sentences" ON public.court_sentences;
CREATE POLICY "Public view sentences" ON public.court_sentences FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage sentences" ON public.court_sentences;
CREATE POLICY "Staff manage sentences" ON public.court_sentences FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge', 'secretary')
            OR is_admin = true
            OR is_troll_officer = true
            OR is_lead_officer = true
        )
    )
);

-- ============================================================================
-- 5. COURT AUDIT LOG — every important court action
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.court_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    case_id UUID REFERENCES public.court_cases(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.court_sessions(id) ON DELETE SET NULL,
    warrant_id UUID REFERENCES public.court_warrants(id) ON DELETE SET NULL,
    sentence_id UUID REFERENCES public.court_sentences(id) ON DELETE SET NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_audit_log_case ON public.court_audit_log(case_id);
CREATE INDEX IF NOT EXISTS idx_court_audit_log_user ON public.court_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_court_audit_log_action ON public.court_audit_log(action);

ALTER TABLE public.court_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view court audit log" ON public.court_audit_log;
CREATE POLICY "Public view court audit log" ON public.court_audit_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff insert audit log" ON public.court_audit_log;
CREATE POLICY "Staff insert audit log" ON public.court_audit_log FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge', 'secretary')
            OR is_admin = true
            OR is_troll_officer = true
            OR is_lead_officer = true
        )
    )
);

-- ============================================================================
-- 6. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- court_cases: link to docket, reason, warrant status, judgment, timestamps
ALTER TABLE public.court_cases
  ADD COLUMN IF NOT EXISTS docket_id UUID REFERENCES public.court_dockets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS warrant_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS judgment TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- court_sessions: display names and live state
ALTER TABLE public.court_sessions
  ADD COLUMN IF NOT EXISTS judge_username TEXT,
  ADD COLUMN IF NOT EXISTS defendant_username TEXT,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;

-- court_summons: bridge columns to link to cases
ALTER TABLE public.court_summons
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS served_to UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS served_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- user_profiles: quick warrant flag for UI and enforcement
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS has_active_warrant BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active_warrant_id UUID REFERENCES public.court_warrants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cashout_restricted_until TIMESTAMPTZ;

-- ============================================================================
-- 7. UPDATED_AT TRIGGERS FOR NEW TABLES
-- ============================================================================

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'trigger_set_timestamp'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.trigger_set_timestamp() TO authenticated, service_role;
  END IF;
END $guard$;

DROP TRIGGER IF EXISTS set_timestamp_court_dockets ON public.court_dockets;
CREATE TRIGGER set_timestamp_court_dockets
    BEFORE UPDATE ON public.court_dockets
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_court_participants ON public.court_participants;
CREATE TRIGGER set_timestamp_court_participants
    BEFORE UPDATE ON public.court_participants
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_court_warrants ON public.court_warrants;
CREATE TRIGGER set_timestamp_court_warrants
    BEFORE UPDATE ON public.court_warrants
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_court_sentences ON public.court_sentences;
CREATE TRIGGER set_timestamp_court_sentences
    BEFORE UPDATE ON public.court_sentences
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- ============================================================================
-- 8. HELPER: keep user_profiles.warrant flag synced
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_warrant_flag(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    has_active_warrant = EXISTS (
      SELECT 1 FROM public.court_warrants
      WHERE user_id = p_user_id AND status = 'active'
    ),
    active_warrant_id = (
      SELECT id FROM public.court_warrants
      WHERE user_id = p_user_id AND status = 'active'
      ORDER BY issued_at DESC LIMIT 1
    ),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_warrant_flag(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_user_warrant_flag_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_user_warrant_flag(NEW.user_id);
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_warrant_flag_trigger() TO authenticated, service_role;

-- ============================================================================
-- 9. RPC: JOIN COURT SESSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_court_session(
  p_court_session_id UUID,
  p_role TEXT DEFAULT 'audience'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.court_sessions%ROWTYPE;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_session FROM public.court_sessions WHERE id = p_court_session_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Court session not found');
  END IF;

  INSERT INTO public.court_participants (court_session_id, user_id, role)
  VALUES (p_court_session_id, v_user_id, p_role)
  ON CONFLICT (court_session_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Joined court session');
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_court_session(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 10. RPC: SET ACTIVE CASE — the case currently being heard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_active_case(
  p_case_id UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.court_cases%ROWTYPE;
  v_session_id UUID := COALESCE(p_session_id, auth.uid());
  v_actor UUID := auth.uid();
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Case not found');
  END IF;

  UPDATE public.court_cases
  SET status = 'in_session', called_at = NOW(), updated_at = NOW()
  WHERE id = p_case_id;

  IF v_session_id IS NOT NULL THEN
    UPDATE public.court_sessions
    SET case_id = p_case_id,
        defendant_id = v_case.defendant_id,
        status = 'active',
        is_live = TRUE,
        updated_at = NOW()
    WHERE id = v_session_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'case_id', p_case_id,
      'session_id', v_session_id,
      'defendant_id', v_case.defendant_id,
      'status', 'in_session'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_case(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- 11. RPC: RECORD DEFENDANT ATTENDANCE ("I'm here")
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_defendant_attendance(
  p_case_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.court_cases%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Case not found');
  END IF;

  IF v_case.defendant_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are not the defendant on this case');
  END IF;

  IF v_case.called_at IS NOT NULL AND v_now > v_case.called_at + INTERVAL '30 seconds' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance window expired. Failure to appear has been recorded.', 'expired', true);
  END IF;

  UPDATE public.court_cases
  SET status = 'defendant_present',
      updated_at = v_now
  WHERE id = p_case_id;

  INSERT INTO public.court_participants (court_session_id, user_id, role)
  SELECT id, v_user_id, 'defendant'
  FROM public.court_sessions
  WHERE case_id = p_case_id AND status = 'active'
  LIMIT 1
  ON CONFLICT (court_session_id, user_id) DO UPDATE SET role = 'defendant', updated_at = v_now;

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, reason)
  VALUES ('defendant_present', v_user_id, v_user_id, p_case_id, 'Defendant confirmed attendance');

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('attended_at', v_now, 'status', 'defendant_present')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_defendant_attendance(uuid) TO authenticated, service_role;

-- ============================================================================
-- 12. RPC: MARK FAILURE TO APPEAR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_failure_to_appear(
  p_case_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.court_cases%ROWTYPE;
  v_actor UUID := auth.uid();
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Case not found');
  END IF;

  IF v_case.status NOT IN ('in_session', 'called') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Case is not in a state where failure to appear can be recorded');
  END IF;

  UPDATE public.court_cases
  SET status = 'failure_to_appear', updated_at = NOW()
  WHERE id = p_case_id;

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, reason)
  VALUES ('failure_to_appear', v_actor, v_case.defendant_id, p_case_id, 'Defendant failed to appear within 30 seconds');

  RETURN jsonb_build_object('success', true, 'message', 'Failure to appear recorded');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_failure_to_appear(uuid) TO authenticated, service_role;

-- ============================================================================
-- 12. RPC: ISSUE COURT WARRANT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.issue_court_warrant(
  p_case_id UUID,
  p_reason TEXT,
  p_bond_amount INTEGER DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.court_cases%ROWTYPE;
  v_warrant_id UUID;
  v_actor UUID := auth.uid();
  v_prior_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Case not found');
  END IF;

  SELECT COUNT(*) INTO v_prior_count
  FROM public.court_warrants
  WHERE user_id = v_case.defendant_id AND status IN ('active', 'paid', 'cleared');

  INSERT INTO public.court_warrants (
    user_id, case_id, reason, bond_amount, status, issued_by, prior_offense_count
  ) VALUES (
    v_case.defendant_id, p_case_id, p_reason, GREATEST(0, p_bond_amount), 'active', v_actor, v_prior_count
  ) RETURNING id INTO v_warrant_id;

  UPDATE public.court_cases
  SET status = 'warrant_issued', warrant_active = TRUE, updated_at = NOW()
  WHERE id = p_case_id;

  UPDATE public.user_profiles
  SET has_active_warrant = TRUE, active_warrant_id = v_warrant_id, updated_at = NOW()
  WHERE id = v_case.defendant_id;

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, warrant_id, reason, metadata)
  VALUES ('warrant_issued', v_actor, v_case.defendant_id, p_case_id, v_warrant_id, p_reason,
    jsonb_build_object('bond_amount', GREATEST(0, p_bond_amount), 'prior_offenses', v_prior_count));

  RETURN jsonb_build_object('success', true, 'warrant_id', v_warrant_id, 'bond_amount', GREATEST(0, p_bond_amount));
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_court_warrant(uuid, text, integer) TO authenticated, service_role;

-- ============================================================================
-- 13. RPC: PAY COURT WARRANT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pay_court_warrant(
  p_warrant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warrant public.court_warrants%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_warrant FROM public.court_warrants WHERE id = p_warrant_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Warrant not found');
  END IF;

  IF v_warrant.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot pay this warrant');
  END IF;

  IF v_warrant.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Warrant is not active');
  END IF;

  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_warrant.bond_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_TROLL_COINS',
      'message', 'Insufficient Troll Coins.',
      'required', v_warrant.bond_amount,
      'available', COALESCE(v_balance, 0)
    );
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_warrant.bond_amount,
      has_active_warrant = FALSE,
      active_warrant_id = NULL,
      updated_at = NOW()
  WHERE id = v_user_id AND troll_coins >= v_warrant.bond_amount;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INSUFFICIENT_TROLL_COINS', 'message', 'Insufficient balance.');
  END IF;

  UPDATE public.court_warrants
  SET status = 'paid',
      paid_at = NOW(),
      paid_by = v_user_id,
      paid_amount = bond_amount,
      updated_at = NOW()
  WHERE id = p_warrant_id;

  UPDATE public.court_cases
  SET warrant_active = FALSE, updated_at = NOW()
  WHERE id = v_warrant.case_id;

  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, source_type, streamer_id, created_at)
  VALUES (v_warrant.bond_amount, 'Court warrant bond payment', v_user_id, 'court_warrant', NULL, NOW());

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, warrant_id, reason, metadata)
  VALUES ('warrant_paid', v_user_id, v_user_id, v_warrant.case_id, p_warrant_id,
    'Warrant bond paid', jsonb_build_object('amount', v_warrant.bond_amount));

  RETURN jsonb_build_object('success', true, 'message', 'Warrant paid', 'amount', v_warrant.bond_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_court_warrant(uuid) TO authenticated, service_role;

-- ============================================================================
-- 14. RPC: ISSUE COURT SENTENCE (multiple punishments atomically)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.issue_court_sentence(
  p_case_id UUID,
  p_sentences JSONB,
  p_fine_amount INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.court_cases%ROWTYPE;
  v_user_id UUID;
  v_actor UUID := auth.uid();
  v_sentence JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Case not found');
  END IF;

  v_user_id := v_case.defendant_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'This case has no defendant assigned and cannot be sentenced.');
  END IF;

  FOR v_sentence IN SELECT * FROM jsonb_array_elements(p_sentences) LOOP
    INSERT INTO public.court_sentences (
      case_id, user_id, sentence_type, duration_minutes, duration_text,
      start_at, end_at, issued_by, status, metadata
    ) VALUES (
      p_case_id,
      v_user_id,
      v_sentence->>'type',
      (v_sentence->>'duration_minutes')::INTEGER,
      v_sentence->>'duration_text',
      CASE WHEN (v_sentence->>'start_immediately')::BOOLEAN THEN v_now ELSE (v_sentence->>'start_at')::TIMESTAMPTZ END,
      CASE WHEN (v_sentence->>'duration_minutes')::INTEGER IS NOT NULL AND (v_sentence->>'duration_minutes')::INTEGER > 0
           THEN v_now + make_interval(mins => (v_sentence->>'duration_minutes')::INTEGER)
           ELSE NULL END,
      v_actor,
      'active',
      v_sentence
    );

    IF (v_sentence->>'type') = 'broadcast_restriction' AND (v_sentence->>'duration_minutes')::INTEGER > 0 THEN
      INSERT INTO public.broadcast_restrictions (
        user_id, restricted_by, reason, duration_minutes, starts_at, expires_at, status
      ) VALUES (
        v_user_id, v_actor, 'Court-ordered broadcast restriction',
        (v_sentence->>'duration_minutes')::INTEGER, v_now, v_now + make_interval(mins => (v_sentence->>'duration_minutes')::INTEGER), 'active'
      );
    END IF;

    IF (v_sentence->>'type') = 'chat_restriction' AND (v_sentence->>'duration_minutes')::INTEGER > 0 THEN
      UPDATE public.user_profiles
      SET muted_until = v_now + make_interval(mins => (v_sentence->>'duration_minutes')::INTEGER), updated_at = v_now
      WHERE id = v_user_id;
    END IF;

    IF (v_sentence->>'type') = 'cashout_restriction' AND (v_sentence->>'duration_minutes')::INTEGER > 0 THEN
      UPDATE public.user_profiles
      SET cashout_restricted_until = v_now + make_interval(mins => (v_sentence->>'duration_minutes')::INTEGER), updated_at = v_now
      WHERE id = v_user_id;
    END IF;
  END LOOP;

  IF p_fine_amount > 0 THEN
    IF (SELECT troll_coins FROM public.user_profiles WHERE id = v_user_id FOR UPDATE) < p_fine_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INSUFFICIENT_TROLL_COINS',
        'message', 'Defendant has insufficient Troll Coins for fine.',
        'required', p_fine_amount
      );
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_fine_amount, updated_at = v_now
    WHERE id = v_user_id AND troll_coins >= p_fine_amount;

    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, source_type, streamer_id, created_at)
    VALUES (p_fine_amount, 'Court fine', v_user_id, 'court_fine', NULL, v_now);

    INSERT INTO public.court_sentences (
      case_id, user_id, sentence_type, duration_text, start_at, issued_by, status, metadata
    ) VALUES (
      p_case_id, v_user_id, 'troll_coin_fine', p_fine_amount || ' coins',
      v_now, v_actor, 'active',
      jsonb_build_object('amount', p_fine_amount, 'destination', 'admin_pool')
    );
  END IF;

  UPDATE public.court_cases SET status = 'sentenced', updated_at = v_now WHERE id = p_case_id;

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, reason, metadata)
  VALUES ('sentence_issued', v_actor, v_user_id, p_case_id, 'Court sentence issued',
    jsonb_build_object('fine_amount', p_fine_amount, 'sentences', p_sentences));

  RETURN jsonb_build_object('success', true, 'message', 'Sentence issued', 'case_id', p_case_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_court_sentence(uuid, jsonb, integer) TO authenticated, service_role;

-- ============================================================================
-- 15. RPC: START COURT SESSION (admin/judge)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_court_session(
  p_case_id UUID DEFAULT NULL,
  p_room_name TEXT DEFAULT NULL,
  p_max_boxes INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_session_id UUID := gen_random_uuid();
  v_channel TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  v_channel := 'troll-court-' || v_session_id;

  INSERT INTO public.court_sessions (
    id, room_name, started_by, status, started_at, max_boxes, case_id, is_live, session_id
  ) VALUES (
    v_session_id,
    COALESCE(p_room_name, 'Troll Court'),
    v_actor,
    'active',
    NOW(),
    GREATEST(2, LEAST(6, p_max_boxes)),
    p_case_id,
    TRUE,
    v_session_id
  );

  INSERT INTO public.streams (user_id, broadcaster_id, title, category, status, is_live, started_at, agora_channel, box_count, layout_mode)
  VALUES (v_actor, v_actor, 'Troll Court Session', 'court', 'live', TRUE, NOW(), v_channel, GREATEST(2, LEAST(6, p_max_boxes)), 'grid')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.court_audit_log (action, actor_id, session_id, case_id, reason, metadata)
  VALUES ('court_session_started', v_actor, v_session_id, p_case_id, 'Court session started',
    jsonb_build_object('channel', v_channel));

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'channel', v_channel
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_court_session(uuid, text, integer) TO authenticated, service_role;

-- ============================================================================
-- 16. RPC: END COURT SESSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.end_court_session(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  UPDATE public.court_sessions
  SET status = 'ended', ended_at = NOW(), is_live = FALSE, updated_at = NOW()
  WHERE id = p_session_id;

  UPDATE public.streams
  SET status = 'ended', is_live = FALSE
  WHERE agora_channel = 'troll-court-' || p_session_id;

  INSERT INTO public.court_audit_log (action, actor_id, session_id, reason)
  VALUES ('court_session_ended', v_actor, p_session_id, 'Court session ended');

  RETURN jsonb_build_object('success', true, 'message', 'Court session ended');
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_court_session(uuid) TO authenticated, service_role;

-- ============================================================================
-- 17. RPC: GET ACTIVE CASE (currently being heard)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_court_case(p_session_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.court_cases%ROWTYPE;
  v_result JSONB;
BEGIN
  IF p_session_id IS NOT NULL THEN
    SELECT c.* INTO v_case
    FROM public.court_cases c
    JOIN public.court_sessions s ON s.case_id = c.id
    WHERE s.id = p_session_id AND c.status = 'in_session'
    LIMIT 1;
  ELSE
    SELECT c.* INTO v_case
    FROM public.court_cases c
    JOIN public.court_sessions s ON s.case_id = c.id
    WHERE s.is_live = TRUE AND c.status = 'in_session'
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'active_case', NULL);
  END IF;

  SELECT jsonb_build_object(
    'id', v_case.id,
    'docket_id', v_case.docket_id,
    'plaintiff_id', v_case.plaintiff_id,
    'defendant_id', v_case.defendant_id,
    'reason', v_case.reason,
    'status', v_case.status,
    'warrant_active', v_case.warrant_active,
    'judgment', v_case.judgment,
    'created_at', v_case.created_at,
    'updated_at', v_case.updated_at
  ) INTO v_result;

  RETURN jsonb_build_object('success', true, 'active_case', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_court_case(uuid) TO authenticated, service_role;

-- ============================================================================
-- 18. RPC: GET USER ACTIVE WARRANT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_active_warrant(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warrant public.court_warrants%ROWTYPE;
BEGIN
  SELECT * INTO v_warrant
  FROM public.court_warrants
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY issued_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'has_active_warrant', FALSE, 'warrant', NULL);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'has_active_warrant', TRUE,
    'warrant', jsonb_build_object(
      'id', v_warrant.id,
      'user_id', v_warrant.user_id,
      'case_id', v_warrant.case_id,
      'reason', v_warrant.reason,
      'bond_amount', v_warrant.bond_amount,
      'status', v_warrant.status,
      'issued_at', v_warrant.issued_at,
      'prior_offense_count', v_warrant.prior_offense_count
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_active_warrant(uuid) TO authenticated, service_role;

-- ============================================================================
-- 19. RPC: GET COURT CALENDAR (upcoming dockets with cases)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_court_calendar(p_from_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  docket_id UUID,
  court_date DATE,
  docket_status TEXT,
  case_id UUID,
  case_status TEXT,
  defendant_id UUID,
  defendant_username TEXT,
  defendant_avatar_url TEXT,
  reason TEXT,
  warrant_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS docket_id,
    d.court_date,
    d.status AS docket_status,
    c.id AS case_id,
    c.status AS case_status,
    c.defendant_id,
    up.username AS defendant_username,
    up.avatar_url AS defendant_avatar_url,
    c.reason,
    c.warrant_active,
    c.created_at
  FROM public.court_dockets d
  LEFT JOIN public.court_cases c ON c.docket_id = d.id
  LEFT JOIN public.user_profiles up ON up.id = c.defendant_id
  WHERE d.court_date >= p_from_date
  ORDER BY d.court_date ASC, c.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_court_calendar(date) TO authenticated, service_role;

-- ============================================================================
-- 20. RPC: UPDATE DOCKET STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_court_docket_status(
  p_docket_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  UPDATE public.court_dockets
  SET status = p_status, updated_at = NOW()
  WHERE id = p_docket_id;

  RETURN jsonb_build_object('success', true, 'message', 'Docket status updated');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_court_docket_status(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 21. RPC: CLEAR WARRANT (admin/pardon)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_court_warrant(
  p_warrant_id UUID,
  p_reason TEXT DEFAULT 'Pardoned'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warrant public.court_warrants%ROWTYPE;
  v_actor UUID := auth.uid();
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
  IF NOT public.is_modo_role(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
  END IF;
  END IF;

  SELECT * INTO v_warrant FROM public.court_warrants WHERE id = p_warrant_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Warrant not found');
  END IF;

  UPDATE public.court_warrants
  SET status = 'cleared', cleared_at = NOW(), cleared_by = v_actor, updated_at = NOW()
  WHERE id = p_warrant_id;

  UPDATE public.court_cases
  SET warrant_active = FALSE, status = 'dismissed', updated_at = NOW()
  WHERE id = v_warrant.case_id;

  UPDATE public.user_profiles
  SET has_active_warrant = FALSE, active_warrant_id = NULL, updated_at = NOW()
  WHERE id = v_warrant.user_id;

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, warrant_id, reason)
  VALUES ('warrant_cleared', v_actor, v_warrant.user_id, v_warrant.case_id, p_warrant_id, p_reason);

  RETURN jsonb_build_object('success', true, 'message', 'Warrant cleared');
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_court_warrant(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 22. RPC: CLEAR EXPIRED WARRANTS (cron / on-demand)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_expired_court_warrants()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.court_warrants
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.court_sentences
      WHERE court_sentences.user_id = court_warrants.user_id
        AND court_sentences.status = 'expired'
        AND court_sentences.end_at IS NOT NULL
        AND court_sentences.end_at <= NOW()
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.user_profiles
  SET has_active_warrant = FALSE, active_warrant_id = NULL, updated_at = NOW()
  WHERE has_active_warrant = TRUE
    AND NOT EXISTS (SELECT 1 FROM public.court_warrants WHERE user_id = user_profiles.id AND status = 'active');

  RETURN jsonb_build_object('success', true, 'cleared_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_expired_court_warrants() TO authenticated, service_role;

-- ============================================================================
-- 23. AUTO-SYNC WARRANT FLAG TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS sync_warrant_flag_after_warrant_change ON public.court_warrants;
CREATE TRIGGER sync_warrant_flag_after_warrant_change
  AFTER INSERT OR UPDATE OF status, user_id ON public.court_warrants
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_warrant_flag_trigger();

-- ============================================================================
-- 24. RPC: MANAGE COURT CASE SAFE — create case + serve summons
-- ============================================================================

CREATE OR REPLACE FUNCTION public.manage_court_case_safe(
  p_defendant_id UUID,
  p_reason TEXT,
  p_court_date DATE DEFAULT NULL,
  p_case_type TEXT DEFAULT 'criminal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_docket_id UUID;
  v_case_id UUID;
  v_summons_id UUID;
  v_target_date DATE := COALESCE(p_court_date, CURRENT_DATE);
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  IF p_defendant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Defendant is required');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Reason is required');
  END IF;

  IF p_case_type IS NULL OR p_case_type NOT IN ('non_payment','eviction','lease_violation','criminal','civil') THEN
    p_case_type := 'criminal';
  END IF;

  SELECT id INTO v_docket_id FROM public.court_dockets WHERE court_date = v_target_date LIMIT 1;

  IF v_docket_id IS NULL THEN
    INSERT INTO public.court_dockets (court_date, max_cases, cases_count, status, created_by)
    VALUES (v_target_date, 20, 0, 'open', v_actor)
    RETURNING id INTO v_docket_id;
  END IF;

  INSERT INTO public.court_cases (docket_id, defendant_id, plaintiff_id, reason, status, case_type, warrant_active)
  VALUES (v_docket_id, p_defendant_id, v_actor, p_reason, 'pending', p_case_type, FALSE)
  RETURNING id INTO v_case_id;

  INSERT INTO public.court_summons (case_id, served_to, served_by, served_at, status)
  VALUES (v_case_id, p_defendant_id, v_actor, NOW(), 'pending')
  RETURNING id INTO v_summons_id;

  UPDATE public.court_dockets
  SET cases_count = COALESCE(cases_count, 0) + 1, updated_at = NOW()
  WHERE id = v_docket_id;

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, reason)
  VALUES ('case_created', v_actor, p_defendant_id, v_case_id, p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'case_id', v_case_id,
    'docket_id', v_docket_id,
    'summons_id', v_summons_id,
    'court_date', v_target_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_court_case_safe(uuid, text, date, text) TO authenticated, service_role;

-- ============================================================================
-- 25. RPC: JUDGE PARDON USER (wrapper for clear_court_warrant)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.judge_pardon_user(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warrant_id UUID;
BEGIN
  SELECT id INTO v_warrant_id
  FROM public.court_warrants
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  IF v_warrant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active warrant found for this user');
  END IF;

  RETURN public.clear_court_warrant(v_warrant_id, 'Pardoned by judge');
END;
$$;

GRANT EXECUTE ON FUNCTION public.judge_pardon_user(uuid) TO authenticated, service_role;

-- ============================================================================
-- 26. RPC: EXTEND COURT DATE (move case to new docket)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.extend_court_date(
  p_case_id UUID,
  p_new_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.court_cases%ROWTYPE;
  v_new_docket_id UUID;
  v_actor UUID := auth.uid();
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Case not found');
  END IF;

  SELECT id INTO v_new_docket_id FROM public.court_dockets WHERE court_date = p_new_date LIMIT 1;

  IF v_new_docket_id IS NULL THEN
    INSERT INTO public.court_dockets (court_date, max_cases, cases_count, status, created_by)
    VALUES (p_new_date, 20, 0, 'open', v_actor)
    RETURNING id INTO v_new_docket_id;
  END IF;

  UPDATE public.court_cases
  SET docket_id = v_new_docket_id, status = 'scheduled', updated_at = NOW()
  WHERE id = p_case_id;

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, reason, metadata)
  VALUES ('court_date_extended', v_actor, v_case.defendant_id, p_case_id,
    'Court date extended to ' || p_new_date,
    jsonb_build_object('new_date', p_new_date, 'new_docket_id', v_new_docket_id));

  RETURN jsonb_build_object('success', true, 'message', 'Court date extended', 'new_docket_id', v_new_docket_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_court_date(uuid, date) TO authenticated, service_role;

-- ============================================================================
-- 27. RPC: ISSUE WARRANT (legacy frontend compatibility)
-- Creates a court case + warrant for the target user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.issue_warrant(
  p_target_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_docket_id UUID;
  v_case_id UUID;
  v_warrant_id UUID;
  v_target_date DATE;
  v_court_date DATE;
  v_bail INTEGER := 500;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;
  END IF;

  IF p_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target is required');
  END IF;

  SELECT CASE
    WHEN EXTRACT(ISODOW FROM now())::int IN (1,2) THEN date_trunc('day', now())::date + (2 - EXTRACT(ISODOW FROM now())::int)
    WHEN EXTRACT(ISODOW FROM now())::int IN (3)   THEN date_trunc('day', now())::date + 1
    WHEN EXTRACT(ISODOW FROM now())::int IN (4)   THEN date_trunc('day', now())::date
    WHEN EXTRACT(ISODOW FROM now())::int IN (5)   THEN date_trunc('day', now())::date + 4
    WHEN EXTRACT(ISODOW FROM now())::int IN (6)   THEN date_trunc('day', now())::date + 3
    ELSE date_trunc('day', now())::date + 2
  END INTO v_court_date;

  v_target_date := v_court_date;

  LOOP
    SELECT id INTO v_docket_id
    FROM public.court_dockets
    WHERE court_date = v_target_date
    FOR UPDATE;

    IF v_docket_id IS NULL THEN
      INSERT INTO public.court_dockets (court_date, max_cases, cases_count, status, created_by)
      VALUES (v_target_date, 20, 0, 'open', v_actor)
      RETURNING id INTO v_docket_id;
    END IF;

    IF (SELECT COALESCE(cases_count, 0) FROM public.court_dockets WHERE id = v_docket_id) < 20 THEN
      EXIT;
    END IF;

    v_target_date := v_target_date + CASE WHEN EXTRACT(ISODOW FROM v_target_date)::int = 2 THEN 2 ELSE 5 END;
  END LOOP;

  INSERT INTO public.court_cases (docket_id, defendant_id, plaintiff_id, reason, status, case_type, warrant_active)
  VALUES (v_docket_id, p_target_id, v_actor, p_reason, 'warrant_issued', 'criminal', TRUE)
  RETURNING id INTO v_case_id;

  INSERT INTO public.court_warrants (user_id, case_id, reason, bond_amount, status, issued_by, prior_offense_count)
  VALUES (p_target_id, v_case_id, p_reason, v_bail, 'active', v_actor, 0)
  RETURNING id INTO v_warrant_id;

  UPDATE public.court_cases SET warrant_active = TRUE, updated_at = NOW() WHERE id = v_case_id;

  PERFORM public.sync_user_warrant_flag(p_target_id);

  INSERT INTO public.court_audit_log (action, actor_id, target_user_id, case_id, warrant_id, reason, metadata)
  VALUES ('warrant_issued', v_actor, p_target_id, v_case_id, v_warrant_id, p_reason,
    jsonb_build_object('source', 'legacy_issue_warrant', 'notes', p_notes, 'bond_amount', v_bail));

  RETURN jsonb_build_object('success', true, 'warrant_id', v_warrant_id, 'case_id', v_case_id, 'bond_amount', v_bail);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_warrant(uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 28. WARRANT ENFORCEMENT — override can_start_broadcast and can_cashout
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_license public.user_driver_licenses%ROWTYPE;
  v_license_status text;
  v_now timestamptz := now();
  v_has_warrant boolean;
BEGIN
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.court_warrants
    WHERE user_id = p_user_id AND status = 'active'
  ) INTO v_has_warrant;

  IF v_has_warrant THEN
    RETURN jsonb_build_object('success', false, 'code', 'WARRANT_ACTIVE', 'message', 'You have an active warrant. Broadcast is restricted until the warrant is resolved.');
  END IF;

  SELECT * INTO v_license FROM public.user_driver_licenses WHERE user_id = p_user_id LIMIT 1;
  v_license_status := COALESCE(v_license.status, 'none');

  IF v_license_status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_SUSPENDED', 'message', 'Your Mai Troll license is suspended. You cannot start a broadcast.');
  END IF;

  IF v_license_status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_REVOKED', 'message', 'Your Mai Troll license has been revoked. You cannot start a broadcast.');
  END IF;

  IF v_license_status = 'expired' OR (v_license.expires_at IS NOT NULL AND v_license.expires_at < v_now) THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_EXPIRED', 'message', 'Your Mai Troll license has expired. Renew it to broadcast.');
  END IF;

  IF v_license_status = 'none' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_LICENSE', 'message', 'You need a Mai Troll license to start a broadcast.');
  END IF;

  RETURN jsonb_build_object('success', true, 'code', 'LICENSE_ACTIVE', 'message', 'License valid', 'data', jsonb_build_object('status', v_license_status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_start_broadcast(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_cashout(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.user_driver_licenses%ROWTYPE;
  v_license_status text;
  v_now timestamptz := now();
  v_has_warrant boolean;
  v_cashout_restricted_until timestamptz;
BEGIN
  SELECT cashout_restricted_until INTO v_cashout_restricted_until
  FROM public.user_profiles WHERE id = p_user_id LIMIT 1;

  IF v_cashout_restricted_until IS NOT NULL AND v_cashout_restricted_until > v_now THEN
    RETURN jsonb_build_object('success', false, 'code', 'CASHOUT_RESTRICTED', 'message', 'Your cash-out is restricted until ' || to_char(v_cashout_restricted_until, 'MM/DD HH24:MI'));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.court_warrants
    WHERE user_id = p_user_id AND status = 'active'
  ) INTO v_has_warrant;

  IF v_has_warrant THEN
    RETURN jsonb_build_object('success', false, 'code', 'WARRANT_ACTIVE', 'message', 'You have an active warrant. Cash-out is restricted until the warrant is resolved.');
  END IF;

   SELECT * INTO v_license FROM public.user_driver_licenses WHERE user_id = p_user_id LIMIT 1;
  v_license_status := COALESCE(v_license.status, 'none');

  IF v_license_status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_SUSPENDED', 'message', 'Your Mai Troll license is suspended. You cannot cash out.');
  END IF;

  IF v_license_status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_REVOKED', 'message', 'Your Mai Troll license has been revoked. You cannot cash out.');
  END IF;

  IF v_license_status = 'expired' OR (v_license.expires_at IS NOT NULL AND v_license.expires_at < v_now) THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_EXPIRED', 'message', 'Your Mai Troll license has expired. Renew it to cash out.');
  END IF;

  IF v_license_status = 'none' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_LICENSE', 'message', 'You need a Mai Troll license to cash out.');
  END IF;

  RETURN jsonb_build_object('success', true, 'code', 'LICENSE_ACTIVE', 'message', 'License valid for cashout', 'data', jsonb_build_object('status', v_license_status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_cashout(uuid) TO authenticated;

COMMIT;
