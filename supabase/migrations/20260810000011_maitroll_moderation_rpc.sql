-- ============================================================================
-- MAI TROLL CANONICAL MODERATION SYSTEM - PART 2
-- Backend RPCs for moderation engine
-- ============================================================================

BEGIN;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- normalize_for_moderation: collapse text for comparison
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_for_moderation(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(p_text, '\s+', ' ', 'g'),
            '[^a-z0-9\s]', '', 'g'
          ),
          '(.)\1{2,}', '\1', 'g'
        ),
        '^\s+|\s+$', '', 'g'
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.normalize_for_moderation(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pseudonymize_ip: one-way hash for IP storage (NOT reversible)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pseudonymize_ip(p_ip TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(digest(p_ip || 'mai-troll-ip-salt-2026', 'sha256'), 'hex');
$$;

GRANT EXECUTE ON FUNCTION public.pseudonymize_ip(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- is_user_jailed: check if user is currently in active jail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_jailed(p_user_id UUID)
RETURNS TABLE (
  is_jailed BOOLEAN,
  jail_id UUID,
  discipline_level INTEGER,
  scheduled_release_at TIMESTAMPTZ,
  bond_amount INTEGER,
  bond_allowed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.status = 'jailed' AND j.scheduled_release_at > now(),
    j.id,
    j.discipline_level,
    j.scheduled_release_at,
    j.bond_amount,
    j.bond_allowed
  FROM public.jail j
  WHERE j.user_id = p_user_id
    AND j.status = 'jailed'
    AND j.scheduled_release_at > now()
  ORDER BY j.jailed_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_jailed(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_user_discipline_level: highest level ever served (persists across bond/serve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_discipline_level(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level INTEGER := 0;
BEGIN
  SELECT COALESCE(MAX(discipline_level), 0) INTO v_level
  FROM public.jail
  WHERE user_id = p_user_id;

  RETURN v_level;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_discipline_level(uuid) TO authenticated, service_role;

-- ============================================================================
-- UNICODE VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_unicode_safety(p_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_char INTEGER;
  v_combining INTEGER := 0;
  v_base INTEGER := 0;
  v_has_bidi_control BOOLEAN := false;
  v_has_zero_width BOOLEAN := false;
  v_has_invisible_separator BOOLEAN := false;
  v_has_control_char BOOLEAN := false;
  v_max_combining_per_base INTEGER := 0;
  v_current_combining INTEGER := 0;
  v_reason TEXT := NULL;
BEGIN
  IF p_text IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  FOR v_char IN SELECT codepoint FROM regexp_split_to_table(p_text, '') AS x(codepoint) LOOP
    -- Control characters (excluding common whitespace: tab, newline, CR)
    IF v_char BETWEEN 0 AND 31 AND v_char NOT IN (9, 10, 13) THEN
      v_has_control_char := true;
    END IF;

    -- Bidi controls: LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI, etc.
    IF v_char IN (8206, 8207, 8234, 8235, 8236, 8237, 8238, 8298, 8299, 8300, 8301, 8302, 8303) THEN
      v_has_bidi_control := true;
    END IF;

    -- Zero-width characters: ZWSP, ZWNJ, ZWJ, BOM, WJ
    IF v_char IN (8203, 8204, 8205, 65279, 8288) THEN
      v_has_zero_width := true;
    END IF;

    -- Invisible separators
    IF v_char IN (57344, 65529, 65530, 65531, 65532, 65533) THEN
      v_has_invisible_separator := true;
    END IF;

    -- Combining marks
    IF (v_char BETWEEN 768 AND 879) OR (v_char BETWEEN 6832 AND 6911) OR (v_char BETWEEN 7616 AND 7679) OR (v_char BETWEEN 8400 AND 8447) OR (v_char BETWEEN 65056 AND 65071) THEN
      v_combining := v_combining + 1;
      v_current_combining := v_current_combining + 1;
    ELSE
      IF v_current_combining > v_max_combining_per_base THEN
        v_max_combining_per_base := v_current_combining;
      END IF;
      v_current_combining := 0;
      IF v_char > 31 THEN
        v_base := v_base + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_current_combining > v_max_combining_per_base THEN
    v_max_combining_per_base := v_current_combining;
  END IF;

  -- Determine rejection reason
  IF v_has_control_char THEN
    v_reason := 'Control characters detected';
  ELSIF v_has_bidi_control THEN
    v_reason := 'Bidirectional control characters detected';
  ELSIF v_has_zero_width THEN
    v_reason := 'Zero-width characters detected';
  ELSIF v_has_invisible_separator THEN
    v_reason := 'Invisible separator characters detected';
  ELSIF v_max_combining_per_base > 2 THEN
    v_reason := 'Excessive combining marks detected';
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', v_reason,
      'combining_marks', v_combining,
      'base_chars', v_base,
      'max_combining_per_base', v_max_combining_per_base
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_unicode_safety(text) TO authenticated, service_role;

-- ============================================================================
-- CONTENT MODERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.moderate_user_content(
  p_user_id UUID,
  p_content TEXT,
  p_source TEXT DEFAULT 'chat',
  p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_trimmed TEXT;
  v_prohibited_term TEXT := NULL;
  v_is_context_sensitive BOOLEAN := false;
  v_category TEXT := NULL;
  v_severity TEXT := 'moderate';
  v_unicode_result JSONB;
BEGIN
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_trimmed := trim(p_content);

  -- Unicode validation
  v_unicode_result := public.validate_unicode_safety(v_trimmed);
  IF NOT (v_unicode_result->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'UNICODE_ABUSE',
      'reason', v_unicode_result->>'reason',
      'message', 'That message contains unsupported or abusive characters. Please rewrite it using normal text.'
    );
  END IF;

  -- Prohibited language check
  v_normalized := public.normalize_for_moderation(v_trimmed);

  FOR v_prohibited_term, v_is_context_sensitive, v_category, v_severity IN
    SELECT pt.term, pt.is_context_sensitive, pt.category, pt.severity
    FROM public.moderation_prohibited_terms pt
    WHERE pt.is_active = true
      AND public.normalize_for_moderation(pt.term) = ANY (
        SELECT regexp_split_to_table(v_normalized, '\s+')
      )
  LOOP
    IF NOT v_is_context_sensitive OR v_severity IN ('high', 'severe') THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'code', 'PROHIBITED_LANGUAGE',
        'reason', 'Prohibited language detected',
        'prohibited_term', v_prohibited_term,
        'category', v_category,
        'severity', v_severity,
        'message', 'That message violates Mai Troll''s chat rules and was not sent.'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_user_content(uuid, text, text, jsonb) TO authenticated, service_role;

-- ============================================================================
-- USERNAME SAFETY CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_username_safe(
  p_username TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_forbidden RECORD;
  v_unicode_result JSONB;
BEGIN
  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN jsonb_build_object('safe', false, 'code', 'USERNAME_EMPTY', 'reason', 'Username is empty');
  END IF;

  -- Unicode validation
  v_unicode_result := public.validate_unicode_safety(p_username);
  IF NOT (v_unicode_result->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'safe', false,
      'code', 'USERNAME_NOT_ALLOWED',
      'reason', 'Unicode abuse detected in username',
      'message', 'Username contains unsupported characters.'
    );
  END IF;

  v_normalized := public.normalize_for_moderation(p_username);

  -- Check forbidden usernames
  FOR v_forbidden IN
    SELECT * FROM public.moderation_forbidden_usernames
    WHERE is_active = true
      AND normalize_for_moderation(username) = v_normalized
  LOOP
    RETURN jsonb_build_object(
      'safe', false,
      'code', 'USERNAME_NOT_ALLOWED',
      'reason', v_forbidden.reason,
      'forbidden_username', v_forbidden.username,
      'message', 'This username is not allowed.'
    );
  END LOOP;

  -- Check prohibited terms in username
  IF EXISTS (
    SELECT 1 FROM public.moderation_prohibited_terms pt
    WHERE pt.is_active = true
      AND NOT pt.is_context_sensitive
      AND public.normalize_for_moderation(pt.term) = ANY (
        SELECT regexp_split_to_table(v_normalized, '\s+')
      )
  ) THEN
    RETURN jsonb_build_object(
      'safe', false,
      'code', 'USERNAME_NOT_ALLOWED',
      'reason', 'Prohibited term in username',
      'message', 'This username contains prohibited content.'
    );
  END IF;

  RETURN jsonb_build_object('safe', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_safe(text, uuid) TO authenticated, service_role;

-- ============================================================================
-- APPLY MODERATION OFFENSE + DISCIPLINE ESCALATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_moderation_offense(
  p_user_id UUID,
  p_offense_type TEXT,
  p_category TEXT,
  p_severity TEXT DEFAULT 'moderate',
  p_rule_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'content_moderation',
  p_message_hash TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offense_id UUID;
  v_offense_count INTEGER;
  v_window_start TIMESTAMPTZ := now() - INTERVAL '24 hours';
  v_current_level INTEGER;
  v_next_level INTEGER;
  v_jail_duration INTEGER;
  v_bond_amount INTEGER;
  v_new_jail_id UUID;
  v_config RECORD;
BEGIN
  INSERT INTO public.moderation_offenses (
    user_id, offense_type, category, severity, rule_id, source, message_hash, metadata
  ) VALUES (
    p_user_id, p_offense_type, p_category, p_severity, p_rule_id, p_source, p_message_hash, p_metadata
  ) RETURNING id INTO v_offense_id;

  SELECT COUNT(*) INTO v_offense_count
  FROM public.moderation_offenses
  WHERE user_id = p_user_id
    AND created_at >= v_window_start
    AND category NOT IN ('username_attempt', 'false_positive');

  v_current_level := public.get_user_discipline_level(p_user_id);

  IF v_offense_count % 3 = 0 AND v_offense_count > 0 THEN
    v_next_level := LEAST(v_current_level + 1, 6);

    IF v_next_level >= 1 THEN
      SELECT * INTO v_config
      FROM public.moderation_discipline_config
      WHERE level = v_next_level AND is_active = true;

      IF FOUND THEN
        v_jail_duration := v_config.jail_duration_seconds;
        v_bond_amount := v_config.bond_amount;

        INSERT INTO public.jail (
          user_id, discipline_level, reason, source,
          scheduled_release_at, bond_allowed, bond_amount, status
        ) VALUES (
          p_user_id, v_next_level,
          'Repeated Chat Rule Violations',
          'moderation_engine',
          now() + (v_jail_duration || ' seconds')::INTERVAL,
          v_config.bond_allowed,
          v_bond_amount,
          'jailed'
        ) RETURNING id INTO v_new_jail_id;

        UPDATE public.user_profiles
        SET
          discipline_level = GREATEST(discipline_level, v_next_level),
          jailed_until = now() + (v_jail_duration || ' seconds')::INTERVAL,
          current_jail_id = v_new_jail_id,
          last_offense_at = now(),
          updated_at = now()
        WHERE id = p_user_id;

        INSERT INTO public.moderation_audit_log (
          action, target_user_id, reason, success, discipline_level, jail_id, bond_amount, offense_count, metadata
        ) VALUES (
          'DISCIPLINE_APPLIED', p_user_id,
          'Repeated Chat Rule Violations', true, v_next_level, v_new_jail_id, v_bond_amount, v_offense_count,
          jsonb_build_object('offense_id', v_offense_id, 'next_level', v_next_level, 'duration_seconds', v_jail_duration)
        );

        RETURN jsonb_build_object(
          'success', true,
          'code', 'DISCIPLINE_APPLIED',
          'offense_id', v_offense_id,
          'offense_count', v_offense_count,
          'discipline_level', v_next_level,
          'jail_id', v_new_jail_id,
          'jail_duration_seconds', v_jail_duration,
          'bond_amount', v_bond_amount,
          'message', 'Disciplinary escalation applied.'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'OFFENSE_RECORDED',
    'offense_id', v_offense_id,
    'offense_count', v_offense_count,
    'message', 'Offense recorded.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_moderation_offense(
  uuid, text, text, text, text, text, text, jsonb
) TO authenticated, service_role;

-- ============================================================================
-- POST JAIL BOND
-- ============================================================================

CREATE OR REPLACE FUNCTION public.post_jail_bond(
  p_jail_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := COALESCE(p_user_id, auth.uid());
  v_jail RECORD;
  v_wallet_coins INTEGER;
  v_transaction_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
  END IF;

  SELECT * INTO v_jail
  FROM public.jail
  WHERE id = p_jail_id
    AND user_id = v_actor_id
    AND status = 'jailed'
    AND bond_allowed = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_JAIL', 'message', 'Active bond-eligible jail not found.');
  END IF;

  IF v_jail.bond_paid = true THEN
    RETURN jsonb_build_object('success', false, 'code', 'BOND_ALREADY_PAID', 'message', 'Bond has already been paid for this sentence.');
  END IF;

  IF v_jail.bond_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_BOND_REQUIRED', 'message', 'No bond is required for this sentence.');
  END IF;

  SELECT troll_coins INTO v_wallet_coins
  FROM public.user_profiles
  WHERE id = v_actor_id
  FOR UPDATE;

  IF v_wallet_coins IS NULL OR v_wallet_coins < v_jail.bond_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_TROLL_COINS',
      'message', 'You don''t have enough Troll Coins to post bond.',
      'required', v_jail.bond_amount,
      'available', COALESCE(v_wallet_coins, 0)
    );
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_jail.bond_amount,
      updated_at = now()
  WHERE id = v_actor_id
    AND troll_coins >= v_jail.bond_amount;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INSUFFICIENT_TROLL_COINS', 'message', 'Insufficient balance.');
  END IF;

  INSERT INTO public.jail_bond_transactions (
    jail_id, user_id, amount, discipline_level, status, metadata
  ) VALUES (
    v_jail.id, v_actor_id, v_jail.bond_amount, v_jail.discipline_level, 'completed',
    jsonb_build_object('released_at', now())
  ) RETURNING id INTO v_transaction_id;

  UPDATE public.jail
  SET bond_paid = true,
      bond_transaction_id = v_transaction_id,
      released_at = now(),
      release_type = 'bond',
      status = 'released',
      updated_at = now()
  WHERE id = v_jail.id;

  UPDATE public.user_profiles
  SET jailed_until = NULL,
      current_jail_id = NULL,
      updated_at = now()
  WHERE id = v_actor_id;

  INSERT INTO public.moderation_audit_log (
    action, target_user_id, reason, success, discipline_level, jail_id, bond_amount, metadata
  ) VALUES (
    'BOND_PAID', v_actor_id, 'Jail bond posted', true,
    v_jail.discipline_level, v_jail.id, v_jail.bond_amount,
    jsonb_build_object('transaction_id', v_transaction_id, 'bond_amount', v_jail.bond_amount)
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'BOND_PAID',
    'message', 'Bond Posted — You Have Been Released',
    'data', jsonb_build_object(
      'jail_id', v_jail.id,
      'transaction_id', v_transaction_id,
      'bond_amount', v_jail.bond_amount,
      'discipline_level', v_jail.discipline_level,
      'redirect_to', '/'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_jail_bond(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- BAN EVASION DETECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.evaluate_ban_evasion(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_signals TEXT[] := ARRAY[]::TEXT[];
  v_source_profile RECORD;
  v_linked_profile RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_source_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('risk_score', 0, 'evasion_detected', false, 'signals', ARRAY[]::TEXT[]);
  END IF;

  -- Check existing confirmed high-confidence links
  FOR v_linked_profile IN
    SELECT up.*, mal.link_type, mal.confidence, mal.created_at
    FROM public.moderation_account_links mal
    JOIN public.user_profiles up ON up.id = mal.linked_user_id
    WHERE mal.source_user_id = p_user_id
      AND mal.review_status = 'confirmed'
      AND mal.confidence IN ('high', 'very_high')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.jail j
      WHERE j.user_id = v_linked_profile.id
        AND j.discipline_level = 6
        AND j.status = 'jailed'
        AND j.scheduled_release_at > now() + INTERVAL '30 days'
    ) THEN
      v_risk_score := v_risk_score + 100;
      v_signals := array_append(v_signals, 'linked_to_level6_user');
    END IF;
  END LOOP;

  -- Check reverse links
  FOR v_linked_profile IN
    SELECT up.*, mal.link_type, mal.confidence
    FROM public.moderation_account_links mal
    JOIN public.user_profiles up ON up.id = mal.source_user_id
    WHERE mal.linked_user_id = p_user_id
      AND mal.review_status = 'confirmed'
      AND mal.confidence IN ('high', 'very_high')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.jail j
      WHERE j.user_id = v_linked_profile.id
        AND j.discipline_level = 6
        AND j.status = 'jailed'
        AND j.scheduled_release_at > now() + INTERVAL '30 days'
    ) THEN
      v_risk_score := v_risk_score + 100;
      v_signals := array_append(v_signals, 'reverse_linked_to_level6_user');
    END IF;
  END LOOP;

  -- IP-based signal (strong but not absolute)
  IF v_source_profile.last_known_ip IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.moderation_risk_evidence mre
      WHERE mre.evidence_type = 'ip_address'
        AND mre.pseudonymized_value = public.pseudonymize_ip(v_source_profile.last_known_ip::text)
        AND mre.user_id != p_user_id
        AND mre.created_at > now() - INTERVAL '90 days'
    ) THEN
      v_risk_score := v_risk_score + 30;
      v_signals := array_append(v_signals, 'shared_ip_with_risk_user');
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'risk_score', v_risk_score,
    'evasion_detected', v_risk_score >= 100,
    'signals', v_signals,
    'user_id', p_user_id
  );

  IF v_risk_score >= 100 THEN
    INSERT INTO public.moderation_audit_log (
      action, target_user_id, reason, success, metadata
    ) VALUES (
      'EVASION_RESTRICTION', p_user_id,
      'Ban evasion detected', true,
      jsonb_build_object('risk_score', v_risk_score, 'signals', v_signals)
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_ban_evasion(uuid) TO authenticated, service_role;

-- ============================================================================
-- EVALUATE USER DISCIPLINE (canonical state)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.evaluate_user_discipline(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jail RECORD;
  v_level INTEGER;
BEGIN
  SELECT * INTO v_jail
  FROM public.jail
  WHERE user_id = p_user_id
    AND status = 'jailed'
    AND scheduled_release_at > now()
  ORDER BY jailed_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'is_jailed', true,
      'jail_id', v_jail.id,
      'discipline_level', v_jail.discipline_level,
      'scheduled_release_at', v_jail.scheduled_release_at,
      'bond_amount', v_jail.bond_amount,
      'bond_allowed', v_jail.bond_allowed,
      'reason', v_jail.reason,
      'jailed_at', v_jail.jailed_at,
      'release_type', v_jail.release_type
    );
  END IF;

  v_level := public.get_user_discipline_level(p_user_id);

  RETURN jsonb_build_object(
    'is_jailed', false,
    'discipline_level', v_level
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_user_discipline(uuid) TO authenticated, service_role;

-- ============================================================================
-- RPC: mod_jail_user (authorized staff only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mod_jail_user(
  p_target_user_id UUID,
  p_discipline_level INTEGER DEFAULT 1,
  p_reason TEXT DEFAULT 'Repeated Chat Rule Violations',
  p_duration_seconds INTEGER DEFAULT NULL,
  p_bond_amount INTEGER DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := COALESCE(p_actor_id, auth.uid());
  v_actor_profile public.user_profiles%ROWTYPE;
  v_target_profile public.user_profiles%ROWTYPE;
  v_config RECORD;
  v_jail_duration INTEGER;
  v_bond INTEGER;
  v_new_jail_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
  END IF;

  SELECT * INTO v_actor_profile
  FROM public.user_profiles
  WHERE id = v_actor_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ACTOR_NOT_FOUND', 'message', 'Actor profile not found.');
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'You do not have permission to jail users.');
  END IF;

  SELECT * INTO v_target_profile
  FROM public.user_profiles
  WHERE id = p_target_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TARGET_NOT_FOUND', 'message', 'Target user not found.');
  END IF;

  SELECT * INTO v_config
  FROM public.moderation_discipline_config
  WHERE level = p_discipline_level AND is_active = true;

  IF FOUND THEN
    v_jail_duration := COALESCE(p_duration_seconds, v_config.jail_duration_seconds);
    v_bond := COALESCE(p_bond_amount, v_config.bond_amount);
  ELSE
    v_jail_duration := COALESCE(p_duration_seconds, 1800);
    v_bond := COALESCE(p_bond_amount, 100);
  END IF;

  INSERT INTO public.jail (
    user_id, discipline_level, reason, source,
    scheduled_release_at, bond_allowed, bond_amount, status
  ) VALUES (
    p_target_user_id, p_discipline_level,
    p_reason,
    'moderator_action',
    now() + (v_jail_duration || ' seconds')::INTERVAL,
    true,
    v_bond,
    'jailed'
  ) RETURNING id INTO v_new_jail_id;

  UPDATE public.user_profiles
  SET
    discipline_level = GREATEST(discipline_level, p_discipline_level),
    jailed_until = now() + (v_jail_duration || ' seconds')::INTERVAL,
    current_jail_id = v_new_jail_id,
    updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.moderation_audit_log (
    action, actor_user_id, target_user_id, reason, success, discipline_level, jail_id, bond_amount, metadata
  ) VALUES (
    'MODERATOR_JAIL', v_actor_id, p_target_user_id, p_reason, true, p_discipline_level, v_new_jail_id, v_bond,
    jsonb_build_object('actor_role', v_actor_profile.role, 'target_username', v_target_profile.username)
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'USER_JAILED',
    'message', 'User jailed successfully.',
    'data', jsonb_build_object(
      'jail_id', v_new_jail_id,
      'discipline_level', p_discipline_level,
      'duration_seconds', v_jail_duration,
      'bond_amount', v_bond,
      'scheduled_release_at', now() + (v_jail_duration || ' seconds')::INTERVAL
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mod_jail_user(uuid, integer, text, integer, integer, uuid) TO authenticated, service_role;

-- ============================================================================
-- RPC: mod_release_jail (authorized staff only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mod_release_jail(
  p_jail_id UUID,
  p_reason TEXT DEFAULT 'Moderator release',
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := COALESCE(p_actor_id, auth.uid());
  v_actor_profile public.user_profiles%ROWTYPE;
  v_jail RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
  END IF;

  SELECT * INTO v_actor_profile
  FROM public.user_profiles
  WHERE id = v_actor_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ACTOR_NOT_FOUND', 'message', 'Actor profile not found.');
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'You do not have permission to release jail.');
  END IF;

  SELECT * INTO v_jail
  FROM public.jail
  WHERE id = p_jail_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'JAIL_NOT_FOUND', 'message', 'Jail record not found.');
  END IF;

  UPDATE public.jail
  SET status = 'released',
      released_at = now(),
      release_type = 'moderator_release',
      updated_at = now()
  WHERE id = p_jail_id;

  UPDATE public.user_profiles
  SET jailed_until = NULL,
      current_jail_id = NULL,
      updated_at = now()
  WHERE id = v_jail.user_id;

  INSERT INTO public.moderation_audit_log (
    action, actor_user_id, target_user_id, reason, success, discipline_level, jail_id, metadata
  ) VALUES (
    'MODERATOR_RELEASE', v_actor_id, v_jail.user_id, p_reason, true, v_jail.discipline_level, p_jail_id,
    jsonb_build_object('actor_role', v_actor_profile.role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'JAIL_RELEASED',
    'message', 'Jail released successfully.',
    'data', jsonb_build_object('jail_id', p_jail_id, 'released_at', now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mod_release_jail(uuid, text, uuid) TO authenticated, service_role;

-- ============================================================================
-- RPC: auto_release_expired_jails (for cron/trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_release_expired_jails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count INTEGER := 0;
  v_jail RECORD;
BEGIN
  FOR v_jail IN
    SELECT j.*, u.id AS user_id
    FROM public.jail j
    JOIN public.user_profiles u ON u.id = j.user_id
    WHERE j.status = 'jailed'
      AND j.scheduled_release_at <= now()
      AND j.bond_paid = false
  LOOP
    UPDATE public.jail
    SET status = 'released',
        released_at = now(),
        release_type = 'sentence_complete',
        updated_at = now()
    WHERE id = v_jail.id;

    UPDATE public.user_profiles
    SET jailed_until = NULL,
        current_jail_id = NULL,
        updated_at = now()
    WHERE id = v_jail.user_id;

    INSERT INTO public.moderation_audit_log (
      action, target_user_id, reason, success, discipline_level, jail_id, metadata
    ) VALUES (
      'AUTO_RELEASE', v_jail.user_id, 'Sentence completed', true, v_jail.discipline_level, v_jail.id,
      jsonb_build_object('release_type', 'sentence_complete', 'scheduled_release_at', v_jail.scheduled_release_at)
    );

    v_released_count := v_released_count + 1;
  END LOOP;

  RETURN v_released_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_release_expired_jails() TO service_role;

-- ============================================================================
-- RPC: check_user_chat_restriction (unified check)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_chat_restriction(
  p_user_id UUID,
  p_stream_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jail RECORD;
  v_block RECORD;
  v_mute RECORD;
  v_restriction RECORD;
  v_result JSONB := jsonb_build_object('restricted', false, 'reasons', ARRAY[]::TEXT[]);
BEGIN
  -- 1. Check active jail (highest priority)
  SELECT * INTO v_jail
  FROM public.jail
  WHERE user_id = p_user_id
    AND status = 'jailed'
    AND scheduled_release_at > now()
  ORDER BY jailed_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_result := jsonb_build_object(
      'restricted', true,
      'reasons', array_append(v_result->'reasons', 'jailed'),
      'jail', jsonb_build_object(
        'jail_id', v_jail.id,
        'discipline_level', v_jail.discipline_level,
        'scheduled_release_at', v_jail.scheduled_release_at,
        'bond_amount', v_jail.bond_amount,
        'bond_allowed', v_jail.bond_allowed,
        'reason', v_jail.reason
      )
    );
    RETURN v_result;
  END IF;

  -- 2. Check chat blocks
  IF p_stream_id IS NOT NULL THEN
    SELECT * INTO v_block
    FROM public.chat_blocks
    WHERE user_id = p_user_id
      AND (stream_id = p_stream_id OR stream_id IS NULL)
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY stream_id NULLS LAST, created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_result := jsonb_build_object(
        'restricted', true,
        'reasons', array_append(v_result->'reasons', 'chat_blocked'),
        'chat_block', jsonb_build_object(
          'expires_at', v_block.expires_at,
          'is_permanent', v_block.is_permanent,
          'reason', v_block.reason
        )
      );
      RETURN v_result;
    END IF;
  END IF;

  -- 3. Check stream mutes
  IF p_stream_id IS NOT NULL THEN
    SELECT * INTO v_mute
    FROM public.stream_mutes
    WHERE user_id = p_user_id
      AND stream_id = p_stream_id
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF FOUND THEN
      v_result := jsonb_build_object(
        'restricted', true,
        'reasons', array_append(v_result->'reasons', 'muted'),
        'mute', jsonb_build_object(
          'expires_at', v_mute.expires_at,
          'reason', v_mute.reason
        )
      );
      RETURN v_result;
    END IF;
  END IF;

  -- 4. Check broadcast restrictions
  IF p_stream_id IS NOT NULL THEN
    SELECT * INTO v_restriction
    FROM public.broadcast_restrictions
    WHERE user_id = p_user_id
      AND (stream_id = p_stream_id OR stream_id IS NULL)
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF FOUND THEN
      v_result := jsonb_build_object(
        'restricted', true,
        'reasons', array_append(v_result->'reasons', 'broadcast_restricted'),
        'broadcast_restriction', jsonb_build_object(
          'expires_at', v_restriction.expires_at,
          'chat_disabled', v_restriction.chat_disabled
        )
      );
      RETURN v_result;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_chat_restriction(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- TRIGGER: auto-release expired jails
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_auto_release_jails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_release_expired_jails();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_release_jails ON public.jail;
CREATE TRIGGER trg_auto_release_jails
  AFTER INSERT OR UPDATE ON public.jail
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_auto_release_jails();

COMMIT;
