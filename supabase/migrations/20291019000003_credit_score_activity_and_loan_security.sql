ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 400,
  ADD COLUMN IF NOT EXISTS credit_limit BIGINT NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS credit_used BIGINT NOT NULL DEFAULT 0;

UPDATE public.user_profiles
SET credit_score = COALESCE(credit_score, 400),
    credit_limit = COALESCE(credit_limit, 250),
    credit_used = COALESCE(credit_used, 0)
WHERE credit_score IS NULL OR credit_limit IS NULL OR credit_used IS NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN credit_score SET DEFAULT 400,
  ALTER COLUMN credit_limit SET DEFAULT 250,
  ALTER COLUMN credit_used SET DEFAULT 0,
  ALTER COLUMN credit_score SET NOT NULL,
  ALTER COLUMN credit_limit SET NOT NULL,
  ALTER COLUMN credit_used SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_credit (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 400 CHECK (score BETWEEN 0 AND 800),
  tier TEXT NOT NULL DEFAULT 'Building',
  trend_7d SMALLINT NOT NULL DEFAULT 0,
  loan_reliability NUMERIC(5,2) NOT NULL DEFAULT 0,
  components JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ
);

ALTER TABLE public.user_credit
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'Building',
  ADD COLUMN IF NOT EXISTS trend_7d SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_reliability NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS components JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL,
  event_key TEXT,
  source_table TEXT,
  source_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credit_events
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS source_table TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS ux_credit_events_event_key
  ON public.credit_events(event_key)
  WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_events_user_created
  ON public.credit_events(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_credit_tier(p_score INTEGER)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_score < 300 THEN 'Untrusted'
    WHEN p_score < 450 THEN 'Shaky'
    WHEN p_score < 600 THEN 'Building'
    WHEN p_score < 700 THEN 'Reliable'
    WHEN p_score < 800 THEN 'Trusted'
    ELSE 'Elite'
  END;
$$;

CREATE TABLE IF NOT EXISTS public.credit_activity_monthly_totals (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  hosted_seconds BIGINT NOT NULL DEFAULT 0,
  viewed_seconds BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month_start)
);

CREATE TABLE IF NOT EXISTS public.credit_activity_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_role TEXT NOT NULL CHECK (activity_role IN ('host', 'viewer')),
  stream_id TEXT NOT NULL,
  month_start DATE NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.user_credit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_activity_monthly_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_activity_sessions ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.user_credit FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.credit_events FROM anon, authenticated;
REVOKE ALL ON public.credit_activity_monthly_totals FROM anon, authenticated;
REVOKE ALL ON public.credit_activity_sessions FROM anon, authenticated;
GRANT SELECT ON public.user_credit, public.credit_events TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_credit'
      AND policyname = 'user_credit_select_owner'
  ) THEN
    CREATE POLICY user_credit_select_owner ON public.user_credit
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'credit_events'
      AND policyname = 'credit_events_select_owner'
  ) THEN
    CREATE POLICY credit_events_select_owner ON public.credit_events
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END;
$$;

INSERT INTO public.user_credit (user_id, score, tier)
SELECT profile.id,
       GREATEST(0, LEAST(COALESCE(profile.credit_score, 400), 800)),
       public.get_credit_tier(GREATEST(0, LEAST(COALESCE(profile.credit_score, 400), 800)))
FROM public.user_profiles profile
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.credit_events_cap_monthly_positive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  IF NEW.delta <= 0 THEN
    RETURN NEW;
  END IF;

  IF current_setting('mai.credit_no_reward_user', TRUE) = NEW.user_id::TEXT THEN
    NEW.delta := 0;
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::TEXT, 0));

  SELECT COALESCE(SUM(delta), 0)::INTEGER
  INTO v_used
  FROM public.credit_events
  WHERE user_id = NEW.user_id
    AND delta > 0
    AND created_at >= date_trunc('month', NOW());

  NEW.delta := LEAST(NEW.delta, GREATEST(0, 50 - v_used));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_events_set_score_award_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_user TEXT;
  v_current_delta INTEGER;
BEGIN
  IF NEW.delta <= 0 THEN
    RETURN NEW;
  END IF;

  v_current_user := current_setting('mai.credit_event_user', TRUE);
  v_current_delta := COALESCE(NULLIF(current_setting('mai.credit_event_delta', TRUE), '')::INTEGER, 0);

  IF v_current_user = NEW.user_id::TEXT THEN
    v_current_delta := v_current_delta + NEW.delta;
  ELSE
    v_current_delta := NEW.delta;
  END IF;

  PERFORM set_config('mai.credit_event_user', NEW.user_id::TEXT, TRUE);
  PERFORM set_config('mai.credit_event_delta', v_current_delta::TEXT, TRUE);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_credit_enforce_monthly_positive_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_user TEXT;
  v_event_delta INTEGER;
  v_managed_user TEXT;
  v_managed_delta INTEGER;
  v_no_reward_user TEXT;
  v_used INTEGER;
  v_allowed INTEGER;
  v_increase INTEGER;
BEGIN
  NEW.score := GREATEST(0, LEAST(800, NEW.score));
  IF NEW.score <= OLD.score THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::TEXT, 0));
  v_increase := NEW.score - OLD.score;
  v_event_user := current_setting('mai.credit_event_user', TRUE);
  v_event_delta := COALESCE(NULLIF(current_setting('mai.credit_event_delta', TRUE), '')::INTEGER, 0);
  v_managed_user := current_setting('mai.credit_managed_user', TRUE);
  v_managed_delta := COALESCE(NULLIF(current_setting('mai.credit_managed_delta', TRUE), '')::INTEGER, 0);
  v_no_reward_user := current_setting('mai.credit_no_reward_user', TRUE);

  IF v_no_reward_user = NEW.user_id::TEXT THEN
    PERFORM set_config('mai.credit_event_user', '', TRUE);
    PERFORM set_config('mai.credit_event_delta', '', TRUE);
    PERFORM set_config('mai.credit_managed_user', '', TRUE);
    PERFORM set_config('mai.credit_managed_delta', '', TRUE);
    NEW.score := OLD.score;
    RETURN NEW;
  END IF;

  IF v_managed_user = NEW.user_id::TEXT THEN
    PERFORM set_config('mai.credit_managed_user', '', TRUE);
    PERFORM set_config('mai.credit_managed_delta', '', TRUE);
    SELECT COALESCE(SUM(delta), 0)::INTEGER
    INTO v_used
    FROM public.credit_events
    WHERE user_id = NEW.user_id
      AND delta > 0
      AND created_at >= date_trunc('month', NOW());
    v_allowed := GREATEST(0, 50 - v_used);
    NEW.score := OLD.score + LEAST(v_increase, v_managed_delta, v_allowed);
    RETURN NEW;
  END IF;

  IF v_event_user = NEW.user_id::TEXT AND v_event_delta > 0 THEN
    PERFORM set_config('mai.credit_event_user', '', TRUE);
    PERFORM set_config('mai.credit_event_delta', '', TRUE);
    NEW.score := OLD.score + LEAST(v_increase, v_event_delta);
    RETURN NEW;
  END IF;

  PERFORM set_config('mai.credit_event_user', '', TRUE);
  PERFORM set_config('mai.credit_event_delta', '', TRUE);
  SELECT COALESCE(SUM(delta), 0)::INTEGER
  INTO v_used
  FROM public.credit_events
  WHERE user_id = NEW.user_id
    AND delta > 0
    AND created_at >= date_trunc('month', NOW());

  v_allowed := GREATEST(0, 50 - v_used);
  v_increase := LEAST(v_increase, v_allowed);
  NEW.score := OLD.score + v_increase;

  IF v_increase > 0 THEN
    INSERT INTO public.credit_events (
      user_id, event_type, delta, event_key, source_table, metadata
    )
    VALUES (
      NEW.user_id,
      'score_adjustment_legacy',
      v_increase,
      'score_adjustment:' || gen_random_uuid()::TEXT,
      'user_credit',
      jsonb_build_object('source', 'legacy_score_update')
    );
    PERFORM set_config('mai.credit_event_user', '', TRUE);
    PERFORM set_config('mai.credit_event_delta', '', TRUE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_score_sync_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_profiles
  SET credit_score = NEW.score
  WHERE id = NEW.user_id
    AND credit_score IS DISTINCT FROM NEW.score;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_score_guard_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_score INTEGER;
BEGIN
  SELECT score INTO v_score
  FROM public.user_credit
  WHERE user_id = NEW.id;

  NEW.credit_score := COALESCE(
    v_score,
    CASE WHEN TG_OP = 'INSERT' THEN 400 ELSE OLD.credit_score END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_score_disable_repayment_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(NEW.credit_used, 0) < COALESCE(OLD.credit_used, 0) THEN
    PERFORM set_config('mai.credit_no_reward_user', NEW.id::TEXT, TRUE);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_score_disable_loan_repayment_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB := to_jsonb(NEW);
  v_old_balance NUMERIC;
  v_new_balance NUMERIC;
  v_user_id UUID;
BEGIN
  v_old_balance := COALESCE(
    NULLIF(v_old->>'balance', '')::NUMERIC,
    NULLIF(v_old->>'remaining_balance', '')::NUMERIC
  );
  v_new_balance := COALESCE(
    NULLIF(v_new->>'balance', '')::NUMERIC,
    NULLIF(v_new->>'remaining_balance', '')::NUMERIC
  );

  IF v_old_balance IS NOT NULL AND v_new_balance IS NOT NULL
     AND v_new_balance < v_old_balance THEN
    v_user_id := NULLIF(v_new->>'user_id', '')::UUID;
    IF v_user_id IS NOT NULL THEN
      PERFORM set_config('mai.credit_no_reward_user', v_user_id::TEXT, TRUE);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_events_cap_monthly_positive ON public.credit_events;
CREATE TRIGGER credit_events_cap_monthly_positive
BEFORE INSERT ON public.credit_events
FOR EACH ROW EXECUTE FUNCTION public.credit_events_cap_monthly_positive();

DROP TRIGGER IF EXISTS credit_events_set_score_award_context ON public.credit_events;
CREATE TRIGGER credit_events_set_score_award_context
AFTER INSERT ON public.credit_events
FOR EACH ROW EXECUTE FUNCTION public.credit_events_set_score_award_context();

DROP TRIGGER IF EXISTS user_credit_enforce_monthly_positive_cap ON public.user_credit;
CREATE TRIGGER user_credit_enforce_monthly_positive_cap
BEFORE UPDATE OF score ON public.user_credit
FOR EACH ROW EXECUTE FUNCTION public.user_credit_enforce_monthly_positive_cap();

DROP TRIGGER IF EXISTS user_credit_sync_profile ON public.user_credit;
CREATE TRIGGER user_credit_sync_profile
AFTER INSERT OR UPDATE ON public.user_credit
FOR EACH ROW EXECUTE FUNCTION public.credit_score_sync_profile();

DROP TRIGGER IF EXISTS user_profiles_credit_score_guard ON public.user_profiles;
CREATE TRIGGER user_profiles_credit_score_guard
BEFORE UPDATE OF credit_score ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.credit_score_guard_profile_update();

DROP TRIGGER IF EXISTS user_profiles_credit_score_insert_guard ON public.user_profiles;
CREATE TRIGGER user_profiles_credit_score_insert_guard
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.credit_score_guard_profile_update();

DROP TRIGGER IF EXISTS credit_score_disable_repayment_rewards ON public.user_profiles;
CREATE TRIGGER credit_score_disable_repayment_rewards
AFTER UPDATE OF credit_used ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.credit_score_disable_repayment_rewards();

DO $$
BEGIN
  IF to_regclass('public.loans') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS credit_score_disable_loan_repayment_rewards ON public.loans';
    EXECUTE 'CREATE TRIGGER credit_score_disable_loan_repayment_rewards AFTER UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.credit_score_disable_loan_repayment_rewards()';
  END IF;
  IF to_regclass('public.bank_loans') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS credit_score_disable_bank_loan_repayment_rewards ON public.bank_loans';
    EXECUTE 'CREATE TRIGGER credit_score_disable_bank_loan_repayment_rewards AFTER UPDATE ON public.bank_loans FOR EACH ROW EXECUTE FUNCTION public.credit_score_disable_loan_repayment_rewards()';
  END IF;
END;
$$;

UPDATE public.user_profiles profile
SET credit_score = credit.score
FROM public.user_credit credit
WHERE profile.id = credit.user_id
  AND profile.credit_score IS DISTINCT FROM credit.score;

CREATE OR REPLACE FUNCTION public.apply_credit_score_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_delta INTEGER,
  p_event_key TEXT,
  p_source_table TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_delta INTEGER;
  v_current_score INTEGER;
  v_used INTEGER;
  v_delta INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_delta IS NULL OR p_event_type IS NULL OR p_event_key IS NULL THEN
    RAISE EXCEPTION 'Credit score event requires user, type, delta, and idempotency key';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

  SELECT delta INTO v_existing_delta
  FROM public.credit_events
  WHERE event_key = p_event_key;
  IF FOUND THEN
    RETURN v_existing_delta;
  END IF;

  INSERT INTO public.user_credit (user_id, score, tier)
  VALUES (p_user_id, 400, public.get_credit_tier(400))
  ON CONFLICT (user_id) DO NOTHING;

  SELECT score INTO v_current_score
  FROM public.user_credit
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_delta := p_delta;
  IF v_delta > 0 THEN
    SELECT COALESCE(SUM(delta), 0)::INTEGER
    INTO v_used
    FROM public.credit_events
    WHERE user_id = p_user_id
      AND delta > 0
      AND created_at >= date_trunc('month', NOW());
    v_delta := LEAST(v_delta, GREATEST(0, 50 - v_used));
  END IF;

  IF v_delta > 0 THEN
    PERFORM set_config('mai.credit_managed_user', p_user_id::TEXT, TRUE);
    PERFORM set_config('mai.credit_managed_delta', v_delta::TEXT, TRUE);
  END IF;

  UPDATE public.user_credit
  SET score = GREATEST(0, LEAST(800, v_current_score + v_delta)),
      tier = public.get_credit_tier(GREATEST(0, LEAST(800, v_current_score + v_delta))),
      updated_at = NOW(),
      last_event_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_events (
    user_id, event_type, delta, event_key, source_table, source_id, metadata
  )
  VALUES (
    p_user_id, p_event_type, v_delta, p_event_key,
    p_source_table, p_source_id, COALESCE(p_metadata, '{}'::JSONB)
  )
  ON CONFLICT DO NOTHING;

  PERFORM set_config('mai.credit_managed_user', '', TRUE);
  PERFORM set_config('mai.credit_managed_delta', '', TRUE);
  PERFORM set_config('mai.credit_event_user', '', TRUE);
  PERFORM set_config('mai.credit_event_delta', '', TRUE);
  RETURN v_delta;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_credit_score_event(UUID, TEXT, INTEGER, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_credit_score_event(UUID, TEXT, INTEGER, TEXT, TEXT, UUID, JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_user_credit_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_credit (user_id, score, tier)
  VALUES (NEW.id, 400, public.get_credit_tier(400))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
CREATE TRIGGER on_auth_user_created_credit
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_user_credit_on_signup();

CREATE OR REPLACE FUNCTION public.credit_score_on_loan_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row JSONB := to_jsonb(NEW);
  v_user_id UUID;
  v_loan_id UUID;
  v_principal NUMERIC;
  v_penalty INTEGER;
BEGIN
  v_user_id := NULLIF(v_row->>'user_id', '')::UUID;
  v_loan_id := NULLIF(v_row->>'id', '')::UUID;
  v_principal := COALESCE(
    NULLIF(v_row->>'principal', '')::NUMERIC,
    NULLIF(v_row->>'amount', '')::NUMERIC,
    0
  );

  IF v_user_id IS NULL OR v_loan_id IS NULL OR v_principal <= 0 THEN
    RETURN NEW;
  END IF;

  v_penalty := LEAST(10, GREATEST(1, CEIL(v_principal / 100)::INTEGER));
  PERFORM public.apply_credit_score_event(
    v_user_id,
    'loan_originated',
    -v_penalty,
    'loan_originated:' || TG_TABLE_NAME || ':' || v_loan_id::TEXT,
    TG_TABLE_NAME,
    v_loan_id,
    jsonb_build_object('principal', v_principal, 'penalty_per_100_coins', 1, 'maximum_penalty', 10)
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.loans') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS credit_score_on_loan_created ON public.loans';
    EXECUTE 'CREATE TRIGGER credit_score_on_loan_created AFTER INSERT ON public.loans FOR EACH ROW EXECUTE FUNCTION public.credit_score_on_loan_created()';
  END IF;
  IF to_regclass('public.bank_loans') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS credit_score_on_bank_loan_created ON public.bank_loans';
    EXECUTE 'CREATE TRIGGER credit_score_on_bank_loan_created AFTER INSERT ON public.bank_loans FOR EACH ROW EXECUTE FUNCTION public.credit_score_on_loan_created()';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_score_on_stream_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row JSONB := to_jsonb(NEW);
  v_gift_id UUID;
  v_gift_key TEXT;
  v_sender_id UUID;
  v_receiver_id UUID;
  v_gift_value BIGINT;
  v_sender_points INTEGER;
  v_activity_seconds BIGINT;
  v_activity_factor NUMERIC;
  v_received_used INTEGER;
  v_receiver_points INTEGER;
  v_month_start TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  v_gift_key := NULLIF(v_row->>'id', '');
  IF v_gift_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_gift_id := v_gift_key::UUID;
  END IF;
  v_sender_id := NULLIF(v_row->>'sender_id', '')::UUID;
  v_receiver_id := COALESCE(
    NULLIF(v_row->>'receiver_id', '')::UUID,
    NULLIF(v_row->>'recipient_id', '')::UUID
  );
  v_gift_value := COALESCE(
    NULLIF(v_row->>'amount', '')::BIGINT,
    NULLIF(v_row->>'coins_spent', '')::BIGINT,
    NULLIF(v_row->>'coin_amount', '')::BIGINT,
    0
  );

  IF v_gift_key IS NULL OR v_sender_id IS NULL OR v_receiver_id IS NULL
     OR v_sender_id = v_receiver_id OR v_gift_value <= 0 THEN
    RETURN NEW;
  END IF;

  v_sender_points := FLOOR(v_gift_value / 1000.0)::INTEGER;
  IF v_sender_points > 0 THEN
    PERFORM public.apply_credit_score_event(
      v_sender_id,
      'gift_sent',
      v_sender_points,
      'credit_gift_sent:' || v_gift_key,
      TG_TABLE_NAME,
      v_gift_id,
      jsonb_build_object('gift_value', v_gift_value, 'coins_per_point', 1000)
    );
  END IF;

  SELECT COALESCE(hosted_seconds, 0) + COALESCE(viewed_seconds, 0)
  INTO v_activity_seconds
  FROM public.credit_activity_monthly_totals
  WHERE user_id = v_receiver_id AND month_start = v_month_start::DATE;

  v_activity_factor := LEAST(1, COALESCE(v_activity_seconds, 0)::NUMERIC / 36000);
  v_receiver_points := FLOOR(v_sender_points * 0.10 * v_activity_factor)::INTEGER;

  IF v_receiver_points > 0 THEN
    SELECT COALESCE(SUM(delta), 0)::INTEGER
    INTO v_received_used
    FROM public.credit_events
    WHERE user_id = v_receiver_id
      AND event_type = 'gift_received_activity_bonus'
      AND delta > 0
      AND created_at >= v_month_start;

    v_receiver_points := LEAST(v_receiver_points, GREATEST(0, 5 - v_received_used));
    IF v_receiver_points > 0 THEN
      PERFORM public.apply_credit_score_event(
        v_receiver_id,
        'gift_received_activity_bonus',
        v_receiver_points,
        'credit_gift_received:' || v_gift_key,
        TG_TABLE_NAME,
        v_gift_id,
        jsonb_build_object(
          'gift_value', v_gift_value,
          'sender_credit_points', v_sender_points,
          'activity_factor', v_activity_factor,
          'monthly_received_gift_cap', 5
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.stream_gifts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS credit_score_on_stream_gift ON public.stream_gifts';
    EXECUTE 'CREATE TRIGGER credit_score_on_stream_gift AFTER INSERT ON public.stream_gifts FOR EACH ROW EXECUTE FUNCTION public.credit_score_on_stream_gift()';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_activity_heartbeat(
  p_stream_id TEXT,
  p_activity_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_stream JSONB;
  v_owner_id UUID;
  v_month_start DATE := date_trunc('month', NOW())::DATE;
  v_previous public.credit_activity_sessions%ROWTYPE;
  v_totals public.credit_activity_monthly_totals%ROWTYPE;
  v_elapsed INTEGER := 0;
  v_host_points INTEGER;
  v_viewer_points INTEGER;
  v_awarded_points INTEGER := 0;
  v_point_index INTEGER;
  v_award_key TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_stream_id IS NULL OR p_stream_id = '' OR p_activity_role NOT IN ('host', 'viewer') THEN
    RAISE EXCEPTION 'Invalid credit activity session';
  END IF;

  SELECT to_jsonb(stream)
  INTO v_stream
  FROM public.streams stream
  WHERE stream.id::TEXT = p_stream_id;

  IF v_stream IS NULL
     OR NOT (
       COALESCE(v_stream->>'is_live', 'false') = 'true'
       OR LOWER(COALESCE(v_stream->>'status', '')) IN ('live', 'active')
     ) THEN
    DELETE FROM public.credit_activity_sessions
    WHERE user_id = v_user_id AND stream_id = p_stream_id;
    RETURN jsonb_build_object('credited_points', 0, 'credited_seconds', 0);
  END IF;

  BEGIN
    v_owner_id := COALESCE(
      NULLIF(v_stream->>'broadcaster_id', ''),
      NULLIF(v_stream->>'user_id', '')
    )::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_owner_id := NULL;
  END;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('credited_points', 0, 'credited_seconds', 0);
  END IF;

  IF p_activity_role = 'host' AND v_owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the broadcaster can record host activity';
  END IF;

  IF p_activity_role = 'viewer' THEN
    IF v_owner_id = v_user_id OR NOT EXISTS (
      SELECT 1
      FROM public.stream_audience_presence presence
      WHERE presence.stream_id = p_stream_id
        AND presence.user_id = v_user_id
        AND presence.is_active IS TRUE
        AND presence.left_at IS NULL
        AND presence.last_seen_at >= NOW() - INTERVAL '2 minutes'
    ) THEN
      DELETE FROM public.credit_activity_sessions
      WHERE user_id = v_user_id AND stream_id = p_stream_id;
      RETURN jsonb_build_object('credited_points', 0, 'credited_seconds', 0);
    END IF;
  END IF;

  INSERT INTO public.credit_activity_monthly_totals (user_id, month_start)
  VALUES (v_user_id, v_month_start)
  ON CONFLICT (user_id, month_start) DO NOTHING;

  SELECT * INTO v_previous
  FROM public.credit_activity_sessions
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_previous.month_start <> v_month_start
     OR v_previous.activity_role <> p_activity_role
     OR v_previous.stream_id <> p_stream_id THEN
    INSERT INTO public.credit_activity_sessions (
      user_id, activity_role, stream_id, month_start, last_heartbeat_at
    )
    VALUES (v_user_id, p_activity_role, p_stream_id, v_month_start, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET activity_role = EXCLUDED.activity_role,
        stream_id = EXCLUDED.stream_id,
        month_start = EXCLUDED.month_start,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at;
    RETURN jsonb_build_object('credited_points', 0, 'credited_seconds', 0);
  END IF;

  v_elapsed := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_previous.last_heartbeat_at)))::INTEGER;
  IF v_elapsed < 0 OR v_elapsed > 120 THEN
    v_elapsed := 0;
  END IF;

  UPDATE public.credit_activity_sessions
  SET last_heartbeat_at = NOW()
  WHERE user_id = v_user_id;

  IF v_elapsed > 0 THEN
    IF p_activity_role = 'host' THEN
      UPDATE public.credit_activity_monthly_totals
      SET hosted_seconds = hosted_seconds + v_elapsed
      WHERE user_id = v_user_id AND month_start = v_month_start;
    ELSE
      UPDATE public.credit_activity_monthly_totals
      SET viewed_seconds = viewed_seconds + v_elapsed
      WHERE user_id = v_user_id AND month_start = v_month_start;
    END IF;
  END IF;

  SELECT * INTO v_totals
  FROM public.credit_activity_monthly_totals
  WHERE user_id = v_user_id AND month_start = v_month_start;

  v_host_points := FLOOR(v_totals.hosted_seconds / 3600.0)::INTEGER;
  v_viewer_points := FLOOR(v_totals.viewed_seconds / 7200.0)::INTEGER;

  FOR v_point_index IN 1..v_host_points LOOP
    v_award_key := 'credit_host_activity:' || v_user_id::TEXT || ':' ||
      to_char(v_month_start, 'YYYY-MM') || ':' || v_point_index::TEXT;
    IF NOT EXISTS (SELECT 1 FROM public.credit_events WHERE event_key = v_award_key) THEN
      v_awarded_points := v_awarded_points + public.apply_credit_score_event(
        v_user_id, 'broadcast_activity', 1, v_award_key,
        'credit_activity_monthly_totals', NULL,
        jsonb_build_object('hosted_seconds', v_totals.hosted_seconds, 'rule', 'one_point_per_verified_host_hour')
      );
    END IF;
  END LOOP;

  FOR v_point_index IN 1..v_viewer_points LOOP
    v_award_key := 'credit_viewer_activity:' || v_user_id::TEXT || ':' ||
      to_char(v_month_start, 'YYYY-MM') || ':' || v_point_index::TEXT;
    IF NOT EXISTS (SELECT 1 FROM public.credit_events WHERE event_key = v_award_key) THEN
      v_awarded_points := v_awarded_points + public.apply_credit_score_event(
        v_user_id, 'viewing_activity', 1, v_award_key,
        'credit_activity_monthly_totals', NULL,
        jsonb_build_object('viewed_seconds', v_totals.viewed_seconds, 'rule', 'one_point_per_two_verified_viewer_hours')
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'credited_points', v_awarded_points,
    'credited_seconds', v_elapsed,
    'hosted_seconds', v_totals.hosted_seconds,
    'viewed_seconds', v_totals.viewed_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_activity_heartbeat(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_activity_heartbeat(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.try_pay_with_credit_card(
  p_user_id UUID,
  p_amount BIGINT,
  p_context TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_context TEXT := LOWER(BTRIM(COALESCE(p_context, '')));
  v_charge BIGINT;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR (
       auth.uid() IS DISTINCT FROM p_user_id
       AND COALESCE(auth.role(), '') <> 'service_role'
     ) THEN
    RETURN FALSE;
  END IF;

  IF v_context IN ('coin_pack', 'coin_pack_purchase', 'coin_purchase', 'coin_store_pack')
     OR LOWER(COALESCE(p_metadata->>'item_type', '')) IN
       ('coin_pack', 'coin_pack_purchase', 'coin_purchase', 'coin_store_pack')
     OR LOWER(COALESCE(p_metadata->>'product_type', '')) IN
       ('coin_pack', 'coin_pack_purchase', 'coin_purchase', 'coin_store_pack')
     OR LOWER(COALESCE(p_metadata->>'purchase_type', '')) IN
       ('coin_pack', 'coin_pack_purchase', 'coin_purchase', 'coin_store_pack')
     OR LOWER(COALESCE(p_metadata->>'category', '')) IN
       ('coin_pack', 'coin_pack_purchase', 'coin_purchase', 'coin_store_pack') THEN
    RETURN FALSE;
  END IF;

  IF v_context NOT IN (
    'shop_purchase',
    'vehicle_purchase',
    'insurance_payment',
    'platform_fee',
    'consumable_purchase'
  ) THEN
    RETURN FALSE;
  END IF;

  IF to_regprocedure('public.draw_credit_internal(uuid,bigint,text,text,jsonb)') IS NOT NULL THEN
    EXECUTE 'SELECT public.draw_credit_internal($1, $2, $3, $4, $5)'
      INTO v_charge
      USING p_user_id, p_amount, 'Credit Card: ' || v_context, v_context, COALESCE(p_metadata, '{}'::JSONB);
  ELSIF to_regprocedure('public.draw_credit_internal(uuid,bigint)') IS NOT NULL THEN
    EXECUTE 'SELECT public.draw_credit_internal($1, $2)'
      INTO v_charge
      USING p_user_id, p_amount;
  ELSE
    RAISE EXCEPTION 'Credit card charge function is unavailable';
  END IF;

  PERFORM public.apply_credit_score_event(
    p_user_id,
    'credit_cc_purchase',
    -5,
    'credit_cc_purchase:' || txid_current()::TEXT || ':' || p_user_id::TEXT,
    'credit_card_transactions',
    NULL,
    jsonb_build_object(
      'principal', p_amount,
      'total_charge', v_charge,
      'context', v_context,
      'metadata', COALESCE(p_metadata, '{}'::JSONB)
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.try_pay_with_credit_card(UUID, BIGINT, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_pay_with_credit_card(UUID, BIGINT, TEXT, JSONB)
  TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.draw_credit_internal(uuid,bigint,text,text,jsonb)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.draw_credit_internal(uuid,bigint,text,text,jsonb) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.draw_credit_internal(uuid,bigint,text,text,jsonb) TO service_role';
  END IF;
  IF to_regprocedure('public.draw_credit_internal(uuid,bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.draw_credit_internal(uuid,bigint) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.draw_credit_internal(uuid,bigint) TO service_role';
  END IF;
  IF to_regprocedure('public.draw_credit(bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.draw_credit(bigint) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.draw_credit(bigint) TO service_role';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_bank_loan(
  p_loan_id UUID,
  p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_loan RECORD;
  v_balance BIGINT;
  v_actual_pay BIGINT;
  v_new_balance BIGINT;
  v_current_score INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT id, user_id, principal, balance, status
  INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;

  IF NOT FOUND OR v_loan.user_id <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;
  IF v_loan.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan is not active');
  END IF;

  v_actual_pay := LEAST(p_amount::BIGINT, v_loan.balance);
  IF v_actual_pay <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT troll_coins INTO v_balance
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < v_actual_pay THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_actual_pay
  WHERE id = v_user_id;

  UPDATE public.loans
  SET balance = balance - v_actual_pay,
      status = CASE WHEN balance - v_actual_pay <= 0 THEN 'paid' ELSE 'active' END
  WHERE id = p_loan_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id)
  VALUES (
    v_user_id,
    -v_actual_pay,
    'loan_repayment',
    'bank',
    p_loan_id::TEXT
  );

  SELECT score INTO v_current_score
  FROM public.user_credit
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'paid', v_actual_pay,
    'remaining', v_new_balance,
    'credit_score', v_current_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_bank_loan(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_bank_loan(UUID, INTEGER) TO authenticated;
