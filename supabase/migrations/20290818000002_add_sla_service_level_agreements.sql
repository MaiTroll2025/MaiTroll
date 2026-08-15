-- =============================================================================
-- Add SLA (Service Level Agreement) columns and support tables
-- - Adds SLA columns to streams, subscription_tiers, user_subscriptions
-- - Creates sla_metrics and sla_violations tables
-- - Adds triggers and RPC functions for SLA monitoring
-- - Seeds initial SLA guarantees per subscription tier
-- All ALTER TABLE use ADD COLUMN IF NOT EXISTS for idempotency.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: SLA columns on streams table (stream-level service guarantees)
-- =============================================================================

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS sla_tier TEXT DEFAULT 'none'
    CHECK (sla_tier IN ('none', 'bronze', 'silver', 'gold', 'platinum')),
  ADD COLUMN IF NOT EXISTS sla_target_uptime_pct NUMERIC(5,2) DEFAULT 99.0,
  ADD COLUMN IF NOT EXISTS sla_actual_uptime_pct NUMERIC(5,2) DEFAULT 100.0,
  ADD COLUMN IF NOT EXISTS sla_quality_guarantee TEXT DEFAULT '720p'
    CHECK (sla_quality_guarantee IN ('none', '480p', '720p', '1080p', '4K', '8K')),
  ADD COLUMN IF NOT EXISTS sla_min_bitrate_kbps INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_max_latency_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_uptime_seconds BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_downtime_seconds BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_last_quality_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_quality_issues_count INTEGER DEFAULT 0;

-- Indexes for SLA columns on streams
CREATE INDEX IF NOT EXISTS idx_streams_sla_tier ON public.streams(sla_tier);
CREATE INDEX IF NOT EXISTS idx_streams_sla_started_at ON public.streams(sla_started_at);
CREATE INDEX IF NOT EXISTS idx_streams_sla_actual_uptime ON public.streams(sla_actual_uptime_pct);

-- =============================================================================
-- PART 2: SLA columns on subscription_tiers table (tier-level guarantees)
-- =============================================================================

ALTER TABLE public.subscription_tiers
  ADD COLUMN IF NOT EXISTS sla_uptime_guarantee_pct NUMERIC(5,2) DEFAULT 99.0,
  ADD COLUMN IF NOT EXISTS sla_quality_guarantee TEXT DEFAULT '720p'
    CHECK (sla_quality_guarantee IN ('none', '480p', '720p', '1080p', '4K', '8K')),
  ADD COLUMN IF NOT EXISTS sla_chat_priority TEXT DEFAULT 'standard'
    CHECK (sla_chat_priority IN ('standard', 'priority', 'vip_only')),
  ADD COLUMN IF NOT EXISTS sla_support_response_secs INTEGER DEFAULT 3600,
  ADD COLUMN IF NOT EXISTS sla_features JSONB DEFAULT '[]'::jsonb;

-- =============================================================================
-- PART 3: SLA columns on user_subscriptions table (subscription-level tracking)
-- =============================================================================

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'inactive'
    CHECK (sla_status IN ('active', 'inactive', 'expired', 'violated')),
  ADD COLUMN IF NOT EXISTS sla_uptime_pct NUMERIC(5,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS sla_compensation_coins BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_violation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_last_violation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_sla_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_sla_end_time TIMESTAMPTZ;

-- Indexes for SLA columns on user_subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subs_sla_status ON public.user_subscriptions(sla_status);
CREATE INDEX IF NOT EXISTS idx_user_subs_sla_start ON public.user_subscriptions(sla_sla_start_time);

-- =============================================================================
-- PART 4: SLA columns on user_profiles (per-broadcaster SLA display)
-- =============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS can_message BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sla_tier TEXT DEFAULT 'none'
    CHECK (sla_tier IN ('none', 'bronze', 'silver', 'gold', 'platinum')),
  ADD COLUMN IF NOT EXISTS sla_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_active_subscriptions INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_profiles_sla_tier ON public.user_profiles(sla_tier);

-- =============================================================================
-- PART 5: SLA metrics table (historical tracking per stream)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sla_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    stream_started_at TIMESTAMPTZ,
    stream_ended_at TIMESTAMPTZ,
    uptime_seconds BIGINT DEFAULT 0,
    downtime_seconds BIGINT DEFAULT 0,
    uptime_pct NUMERIC(5,2) DEFAULT 100.0,
    peak_viewers INTEGER DEFAULT 0,
    quality_issues JSONB DEFAULT '[]'::jsonb,
    quality_issues_count INTEGER DEFAULT 0,
    latency_samples JSONB DEFAULT '[]'::jsonb,
    bitrate_samples JSONB DEFAULT '[]'::jsonb,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_metrics_stream_id ON public.sla_metrics(stream_id);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_created_at ON public.sla_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_resolved ON public.sla_metrics(resolved);

ALTER TABLE public.sla_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_sla_metrics" ON public.sla_metrics;
CREATE POLICY "public_read_sla_metrics" ON public.sla_metrics FOR SELECT USING (true);

DROP POLICY IF EXISTS "stream_owner_write_sla_metrics" ON public.sla_metrics;
CREATE POLICY "stream_owner_read_sla_metrics" ON public.sla_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.streams s
      WHERE s.id = sla_metrics.stream_id
    )
  );

DROP POLICY IF EXISTS "admin_manage_sla_metrics" ON public.sla_metrics;
CREATE POLICY "admin_manage_sla_metrics" ON public.sla_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =============================================================================
-- PART 6: SLA violations table (tracks breaches and compensation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sla_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
    broadcaster_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
    violation_type TEXT NOT NULL CHECK (violation_type IN (
      'uptime_breach',
      'quality_degradation',
      'latency_spike',
      'subscriber_feature_missing',
      'support_response_timeout'
    )),
    tier_at_time TEXT,
    actual_value JSONB,
    expected_value JSONB,
    compensation_coins BIGINT DEFAULT 0,
    compensation_issued BOOLEAN DEFAULT false,
    compensation_issued_at TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_violations_stream ON public.sla_violations(stream_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_broadcaster ON public.sla_violations(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_created_at ON public.sla_violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sla_violations_resolved ON public.sla_violations(resolved);

ALTER TABLE public.sla_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcaster_read_sla_violations" ON public.sla_violations;
CREATE POLICY "broadcaster_read_sla_violations" ON public.sla_violations
  FOR SELECT USING (auth.uid() = broadcaster_id);

DROP POLICY IF EXISTS "broadcaster_own_sla_violations" ON public.sla_violations;
-- No INSERT policy for broadcasters — violations are written only by SECURITY DEFINER
-- functions (edge function / triggers using service_role).
-- This prevents broadcasters from fabricating violations to claim compensation.

DROP POLICY IF EXISTS "admin_manage_sla_violations" ON public.sla_violations;
CREATE POLICY "admin_manage_sla_violations" ON public.sla_violations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =============================================================================
-- PART 7: Grant columns to user_profiles for subscription tracking
-- =============================================================================

-- Add subscriber-level SLA display columns
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS sla_display_name TEXT,
  ADD COLUMN IF NOT EXISTS sla_priority_chat BOOLEAN DEFAULT false;

-- =============================================================================
-- PART 8: Seed SLA guarantees for subscription tiers
-- =============================================================================

-- Fan tier: basic SLA (99% uptime, 720p, standard chat)
UPDATE public.subscription_tiers
  SET sla_uptime_guarantee_pct = 99.0,
      sla_quality_guarantee = '720p',
      sla_chat_priority = 'standard',
      sla_support_response_secs = 14400,
      sla_features = '["subscriber_badge", "subscriber_chat_indicator"]'::jsonb
  WHERE name = 'Fan';

-- VIP tier: enhanced SLA (99.5% uptime, 720p+, priority chat)
UPDATE public.subscription_tiers
  SET sla_uptime_guarantee_pct = 99.5,
      sla_quality_guarantee = '720p',
      sla_chat_priority = 'priority',
      sla_support_response_secs = 3600,
      sla_features = '["subscriber_badge", "subscriber_chat_indicator", "priority_chat_highlight", "custom_emotes"]'::jsonb
  WHERE name = 'VIP';

-- Elite tier: premium SLA (99.9% uptime, 1080p+, priority chat)
UPDATE public.subscription_tiers
  SET sla_uptime_guarantee_pct = 99.9,
      sla_quality_guarantee = '1080p',
      sla_chat_priority = 'priority',
      sla_support_response_secs = 1800,
      sla_features = '["subscriber_badge", "subscriber_chat_indicator", "priority_chat_highlight", "custom_emotes", "monthly_gift", "elite_badge"]'::jsonb
  WHERE name = 'Elite';

-- Mythic tier: enterprise SLA (99.95% uptime, 4K+, vip_only chat)
UPDATE public.subscription_tiers
  SET sla_uptime_guarantee_pct = 99.95,
      sla_quality_guarantee = '4K',
      sla_chat_priority = 'vip_only',
      sla_support_response_secs = 600,
      sla_features = '["subscriber_badge", "subscriber_chat_indicator", "priority_chat_highlight", "custom_emotes", "monthly_gift", "elite_badge", "1_to_1_shoutout", "direct_dm_access", "4k_stream_access"]'::jsonb
  WHERE name = 'Mythic';

-- Fan Supporter tier (free sub): basic SLA
UPDATE public.subscription_tiers
  SET sla_uptime_guarantee_pct = 99.0,
      sla_quality_guarantee = '720p',
      sla_chat_priority = 'standard',
      sla_support_response_secs = 14400,
      sla_features = '["subscriber_badge"]'::jsonb
  WHERE name = 'Fan Supporter';

-- =============================================================================
-- PART 9: SLA config table (tunable SLA parameters)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sla_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type TEXT NOT NULL DEFAULT 'text' CHECK (config_type IN ('text', 'integer', 'boolean', 'jsonb')),
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.sla_config (config_key, config_value, config_type, description) VALUES
    ('default_sla_tier', 'none', 'text', 'Default SLA tier for new streams'),
    ('gold_uptime_threshold_pct', '99.9', 'text', 'Minimum uptime for gold SLA tier'),
    ('platinum_uptime_threshold_pct', '99.95', 'text', 'Minimum uptime for platinum SLA tier'),
    ('sla_uptime_grace_period_secs', '120', 'integer', 'Grace period in seconds before uptime is counted against SLA'),
    ('sla_quality_check_interval_secs', '30', 'integer', 'How often to check stream quality for SLA compliance'),
    ('sla_violation_compensation_rate', '0.1', 'text', 'Compensation rate (10% of tier price) for SLA violations'),
    ('sla_max_compensation_coins', '5000', 'integer', 'Maximum compensation coins per violation'),
    ('sla_subscriber_uptime_bonus_pct', '50', 'integer', 'Subscriber uptime bonus percentage applied on top of tier guarantee'),
    ('sla_subscriber_compensation_multiplier', '2', 'integer', 'Compensation multiplier for subscribers vs non-subscribers')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_sla_config" ON public.sla_config;
CREATE POLICY "public_read_sla_config" ON public.sla_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_update_sla_config" ON public.sla_config;
CREATE POLICY "admin_update_sla_config" ON public.sla_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- =============================================================================
-- PART 10: SLA trigger functions (track stream lifecycle SLA data)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_stream_sla_on_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Set SLA start time when stream goes live
    IF NEW.status = 'live' OR NEW.is_live = true THEN
        IF NEW.sla_started_at IS NULL THEN
            NEW.sla_started_at := NOW();
            NEW.sla_uptime_seconds := 0;
            NEW.sla_downtime_seconds := 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_stream_sla_on_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_elapsed BIGINT;
    v_uptime_secs BIGINT;
    v_uptime_pct NUMERIC(5,2);
BEGIN
    -- When stream ends, calculate final SLA metrics.
    -- Handles both is_live boolean and status='live' column conventions.
    -- Uses BEFORE UPDATE so NEW values persist back to the row.
    IF (OLD.is_live IS DISTINCT FROM NEW.is_live OR OLD.status IS DISTINCT FROM NEW.status)
       AND NOT (NEW.is_live = true OR NEW.status = 'live') THEN
        IF NEW.sla_started_at IS NOT NULL THEN
            v_elapsed := EXTRACT(EPOCH FROM (NOW() - NEW.sla_started_at))::BIGINT;

            -- uptime = elapsed - downtime
            v_uptime_secs := v_elapsed - COALESCE(NEW.sla_downtime_seconds, 0);
            IF v_uptime_secs < 0 THEN
                v_uptime_secs := 0;
            END IF;

            -- Calculate uptime percentage
            IF v_elapsed > 0 THEN
                v_uptime_pct := ROUND(
                    ((v_uptime_secs::NUMERIC / v_elapsed::NUMERIC) * 100), 2
                );
                IF v_uptime_pct > 100 THEN
                    v_uptime_pct := 100.00;
                END IF;
            ELSE
                v_uptime_pct := 100.00;
            END IF;

            -- Sync sla_uptime_seconds to the computed value for consistency
            NEW.sla_uptime_seconds := v_uptime_secs;
            NEW.sla_actual_uptime_pct := v_uptime_pct;
            NEW.sla_last_quality_check_at := NOW();

            -- Record SLA metrics row (inserted via security-definer, so RLS is bypassed)
            INSERT INTO public.sla_metrics (
                stream_id, stream_started_at, stream_ended_at,
                uptime_seconds, downtime_seconds, uptime_pct,
                peak_viewers, quality_issues, latency_samples, bitrate_samples,
                resolved, resolved_at, created_at, updated_at
            ) VALUES (
                NEW.id, NEW.sla_started_at, NOW(),
                v_uptime_secs,
                COALESCE(NEW.sla_downtime_seconds, 0),
                v_uptime_pct,
                GREATEST(COALESCE(NEW.current_viewers, 0), COALESCE(NEW.viewer_count, 0)),
                '[]'::jsonb,
                '[]'::jsonb,
                '[]'::jsonb,
                true, NOW(), NOW(), NOW()
            );

            -- Check for SLA violations (writes via SECURITY DEFINER, bypassing RLS)
            IF v_uptime_pct < COALESCE(NEW.sla_target_uptime_pct, 99.0) THEN
                INSERT INTO public.sla_violations (
                    stream_id, broadcaster_id, violation_type,
                    tier_at_time, actual_value, expected_value,
                    compensation_coins, notes
                ) VALUES (
                    NEW.id, NEW.broadcaster_id, 'uptime_breach',
                    NEW.sla_tier,
                    jsonb_build_object('actual_uptime_pct', v_uptime_pct, 'duration_seconds', v_elapsed),
                    jsonb_build_object('target_uptime_pct', COALESCE(NEW.sla_target_uptime_pct, 99.0)),
                    0,
                    'Stream uptime ' || v_uptime_pct || '% below SLA target ' || COALESCE(NEW.sla_target_uptime_pct, 99.0) || '%'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop and recreate triggers on streams
DROP TRIGGER IF EXISTS trg_update_stream_sla_on_start ON public.streams;
CREATE TRIGGER trg_update_stream_sla_on_start
    BEFORE UPDATE ON public.streams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_stream_sla_on_start();

DROP TRIGGER IF EXISTS trg_finalize_stream_sla_on_end ON public.streams;
CREATE TRIGGER trg_finalize_stream_sla_on_end
    BEFORE UPDATE ON public.streams
    FOR EACH ROW
    EXECUTE FUNCTION public.finalize_stream_sla_on_end();

-- =============================================================================
-- PART 11: SLA trigger function for subscription lifecycle
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_subscription_sla_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_guarantee NUMERIC(5,2);
    v_quality_guarantee TEXT;
BEGIN
    -- When a new subscription is created, set up SLA tracking
    IF TG_OP = 'INSERT' THEN
        SELECT sla_uptime_guarantee_pct, sla_quality_guarantee
        INTO v_tier_guarantee, v_quality_guarantee
        FROM public.subscription_tiers
        WHERE id = NEW.tier_id;

        NEW.sla_status := 'active';
        NEW.sla_uptime_pct := v_tier_guarantee;
        NEW.sla_compensation_coins := 0;
        NEW.sla_violation_count := 0;
        NEW.sla_sla_start_time := NOW();
        NEW.sla_sla_end_time := NEW.expires_at;
        NEW.sla_display_name := (
            SELECT name FROM public.subscription_tiers WHERE id = NEW.tier_id
        );
        NEW.sla_priority_chat := (
            SELECT sla_chat_priority IN ('priority', 'vip_only')
            FROM public.subscription_tiers
            WHERE id = NEW.tier_id
        );

        -- Update broadcaster's active subscription SLA count
        IF NEW.is_active THEN
            UPDATE public.user_profiles
            SET sla_active_subscriptions = COALESCE(sla_active_subscriptions, 0) + 1
            WHERE id = NEW.broadcaster_id;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- When subscription is cancelled or expires, deactivate SLA
        IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
            NEW.sla_status := 'expired';
            UPDATE public.user_profiles
            SET sla_active_subscriptions = GREATEST(COALESCE(sla_active_subscriptions, 0) - 1, 0)
            WHERE id = NEW.broadcaster_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_sla_lifecycle ON public.user_subscriptions;
CREATE TRIGGER trg_subscription_sla_lifecycle
    BEFORE INSERT OR UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_subscription_sla_on_create();

-- =============================================================================
-- PART 12: SLA RPC functions
-- =============================================================================

-- Get SLA status for a stream
CREATE OR REPLACE FUNCTION public.get_stream_sla_status(p_stream_id UUID)
RETURNS TABLE (
    stream_id UUID,
    sla_tier TEXT,
    sla_target_uptime_pct NUMERIC(5,2),
    sla_actual_uptime_pct NUMERIC(5,2),
    sla_quality_guarantee TEXT,
    sla_min_bitrate_kbps INTEGER,
    sla_max_latency_ms INTEGER,
    sla_started_at TIMESTAMPTZ,
    sla_uptime_seconds BIGINT,
    sla_downtime_seconds BIGINT,
    sla_quality_issues_count INTEGER,
    is_live BOOLEAN,
    viewer_count INTEGER,
    stream_started_at TIMESTAMPTZ,
    stream_ended_at TIMESTAMPTZ,
    violation_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_authorized BOOLEAN;
BEGIN
    -- Caller must be authenticated as the broadcaster, a subscriber of the broadcaster,
    -- an admin, or using the service_role (edge function).
    v_is_authorized :=
        EXISTS (
            SELECT 1 FROM public.streams s
            WHERE s.id = p_stream_id
              AND (s.broadcaster_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.user_subscriptions us
                              WHERE us.broadcaster_id = s.broadcaster_id
                                AND us.subscriber_id = auth.uid()
                                AND us.is_active = true))
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.is_admin = true
        )
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: cannot view SLA status for this stream';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.sla_tier,
        COALESCE(s.sla_target_uptime_pct, 99.0),
        COALESCE(s.sla_actual_uptime_pct, 100.0),
        s.sla_quality_guarantee,
        COALESCE(s.sla_min_bitrate_kbps, 0),
        COALESCE(s.sla_max_latency_ms, 0),
        s.sla_started_at,
        COALESCE(s.sla_uptime_seconds, 0),
        COALESCE(s.sla_downtime_seconds, 0),
        COALESCE(s.sla_quality_issues_count, 0),
        s.is_live,
        COALESCE(s.current_viewers, s.viewer_count, 0),
        s.started_at,
        s.ended_at,
        (SELECT COUNT(*) FROM public.sla_violations WHERE stream_id = p_stream_id AND resolved = false)
    FROM public.streams s
    WHERE s.id = p_stream_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_sla_status(UUID) TO authenticated, service_role;

-- Get SLA status for a user's subscriptions (overall)
CREATE OR REPLACE FUNCTION public.get_user_subscription_sla_summary(p_user_id UUID)
RETURNS TABLE (
    active_subscriptions INTEGER,
    total_subscriptions INTEGER,
    highest_tier_name TEXT,
    highest_tier_sla_uptime_pct NUMERIC(5,2),
    highest_tier_sla_quality_guarantee TEXT,
    total_sla_violations INTEGER,
    total_compensation_coins BIGINT,
    next_expiration TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only the user themselves or an admin can view this summary.
    -- Prevents one user from querying another user's subscription SLA status.
    IF auth.uid() != p_user_id AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.is_admin = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized: can only view your own subscription SLA summary';
    END IF;

    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS active_subscriptions,
        (COUNT(*) + COUNT(*) FILTER (WHERE us.is_active = false))::INTEGER AS total_subscriptions,
        st.name AS highest_tier_name,
        COALESCE(st.sla_uptime_guarantee_pct, 99.0) AS highest_tier_sla_uptime_pct,
        COALESCE(st.sla_quality_guarantee, '720p') AS highest_tier_sla_quality_guarantee,
        COALESCE((SELECT COUNT(*) FROM public.sla_violations WHERE broadcaster_id = p_user_id AND resolved = false), 0) AS total_sla_violations,
        COALESCE((SELECT SUM(compensation_coins) FROM public.sla_violations WHERE broadcaster_id = p_user_id AND compensation_issued = false), 0) AS total_compensation_coins,
        (SELECT MAX(expires_at) FROM public.user_subscriptions WHERE broadcaster_id = p_user_id AND is_active = true) AS next_expiration
    FROM public.user_subscriptions us
    LEFT JOIN public.subscription_tiers st ON st.id = us.tier_id
    WHERE us.subscriber_id = p_user_id AND us.is_active = true
    ORDER BY st.sort_order DESC
    LIMIT 1;

    -- If no active subscriptions, return empty
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            0::INTEGER,
            0::INTEGER,
            NULL::TEXT,
            0.00::NUMERIC(5,2),
            'none'::TEXT,
            0::INTEGER,
            0::BIGINT,
            NULL::TIMESTAMP WITH TIME ZONE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_subscription_sla_summary(UUID) TO authenticated, service_role;

-- Get SLA status for a specific subscription
CREATE OR REPLACE FUNCTION public.get_subscription_sla_status(p_subscription_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    tier_name TEXT,
    tier_color_hex TEXT,
    tier_icon_name TEXT,
    sla_uptime_guarantee_pct NUMERIC(5,2),
    sla_quality_guarantee TEXT,
    sla_chat_priority TEXT,
    sla_support_response_secs INTEGER,
    sla_features JSONB,
    sla_status TEXT,
    sla_uptime_pct NUMERIC(5,2),
    sla_compensation_coins BIGINT,
    sla_violation_count INTEGER,
    sla_start_time TIMESTAMPTZ,
    sla_end_time TIMESTAMPTZ,
    priority_chat BOOLEAN,
    display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscriber_id UUID;
    v_broadcaster_id UUID;
BEGIN
    -- Resolve the subscription to check ownership
    SELECT us.subscriber_id, us.broadcaster_id
    INTO v_subscriber_id, v_broadcaster_id
    FROM public.user_subscriptions us
    WHERE us.id = p_subscription_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    -- Only the subscriber, the broadcaster, an admin, or the edge function (service_role)
    -- can view this subscription's SLA status.
    IF (auth.uid() != v_subscriber_id
        AND auth.uid() != v_broadcaster_id
        AND NOT EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.is_admin = true
        )
        AND current_setting('request.jwt.claims', true)::json->>'role' != 'service_role'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: can only view your own subscription SLA status';
    END IF;

    RETURN QUERY
    SELECT
        us.id,
        st.name,
        COALESCE(st.color_hex, '#6B7280'),
        COALESCE(st.icon_name, 'Heart'),
        COALESCE(st.sla_uptime_guarantee_pct, 99.0),
        COALESCE(st.sla_quality_guarantee, '720p'),
        COALESCE(st.sla_chat_priority, 'standard'),
        COALESCE(st.sla_support_response_secs, 3600),
        COALESCE(st.sla_features, '[]'::jsonb),
        COALESCE(us.sla_status, 'inactive'),
        COALESCE(us.sla_uptime_pct, 0.0),
        COALESCE(us.sla_compensation_coins, 0),
        COALESCE(us.sla_violation_count, 0),
        us.sla_sla_start_time,
        COALESCE(us.sla_sla_end_time, us.expires_at),
        COALESCE(us.sla_priority_chat, false),
        COALESCE(us.sla_display_name, st.name)
    FROM public.user_subscriptions us
    LEFT JOIN public.subscription_tiers st ON st.id = us.tier_id
    WHERE us.id = p_subscription_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_sla_status(UUID) TO authenticated, service_role;

-- Record an SLA quality check sample (called by the edge function or stream health monitor)
CREATE OR REPLACE FUNCTION public.record_sla_metric_sample(
    p_stream_id UUID,
    p_sample_type TEXT,
    p_value NUMERIC,
    p_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stream_sla_metrics SLA_metrics%ROWTYPE;
    v_is_broadcaster BOOLEAN;
BEGIN
    -- Check permissions: only the broadcaster, an admin, or the edge function (service_role)
    SELECT EXISTS (
        SELECT 1 FROM public.streams s
        WHERE s.id = p_stream_id AND s.broadcaster_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.is_admin = true
    ) OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    INTO v_is_broadcaster;

    IF NOT v_is_broadcaster THEN
        RETURN QUERY SELECT FALSE, 'Unauthorized: only broadcaster or admin can record SLA metrics'::TEXT;
        RETURN;
    END IF;

    -- Find or create the SLA metrics row for this stream
    SELECT * INTO v_stream_sla_metrics
    FROM public.sla_metrics
    WHERE stream_id = p_stream_id AND resolved = false
    LIMIT 1;

    IF NOT FOUND THEN
        INSERT INTO public.sla_metrics (stream_id, stream_started_at)
        VALUES (p_stream_id, NOW())
        RETURNING * INTO v_stream_sla_metrics;
    END IF;

    -- Update based on sample type
    IF p_sample_type = 'quality_issue' THEN
        v_stream_sla_metrics.quality_issues :=
            COALESCE(v_stream_sla_metrics.quality_issues, '[]'::jsonb) ||
            jsonb_build_array(jsonb_build_object('timestamp', NOW(), 'value', p_value, 'detail', p_detail));
        v_stream_sla_metrics.quality_issues_count := COALESCE(v_stream_sla_metrics.quality_issues_count, 0) + 1;
    ELSIF p_sample_type = 'latency' THEN
        v_stream_sla_metrics.latency_samples :=
            COALESCE(v_stream_sla_metrics.latency_samples, '[]'::jsonb) ||
            jsonb_build_array(jsonb_build_object('timestamp', NOW(), 'value', p_value, 'detail', p_detail));
    ELSIF p_sample_type = 'bitrate' THEN
        v_stream_sla_metrics.bitrate_samples :=
            COALESCE(v_stream_sla_metrics.bitrate_samples, '[]'::jsonb) ||
            jsonb_build_array(jsonb_build_object('timestamp', NOW(), 'value', p_value, 'detail', p_detail));
    ELSIF p_sample_type = 'uptime' THEN
        IF p_detail->>'direction' = 'up' THEN
            v_stream_sla_metrics.uptime_seconds := COALESCE(v_stream_sla_metrics.uptime_seconds, 0) + p_value::BIGINT;
        ELSIF p_detail->>'direction' = 'down' THEN
            v_stream_sla_metrics.downtime_seconds := COALESCE(v_stream_sla_metrics.downtime_seconds, 0) + p_value::BIGINT;
        END IF;
    END IF;

    v_stream_sla_metrics.updated_at := NOW();

    -- Update the row
    UPDATE public.sla_metrics
    SET
        quality_issues = v_stream_sla_metrics.quality_issues,
        quality_issues_count = v_stream_sla_metrics.quality_issues_count,
        latency_samples = v_stream_sla_metrics.latency_samples,
        bitrate_samples = v_stream_sla_metrics.bitrate_samples,
        uptime_seconds = v_stream_sla_metrics.uptime_seconds,
        downtime_seconds = v_stream_sla_metrics.downtime_seconds,
        updated_at = NOW()
    WHERE stream_id = p_stream_id AND resolved = false;

    RETURN QUERY SELECT TRUE, 'SLA metric recorded'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sla_metric_sample(UUID, TEXT, NUMERIC, JSONB) TO authenticated, service_role;

-- Get broadcaster SLA summary (all streams, all subscribers)
CREATE OR REPLACE FUNCTION public.get_broadcaster_sla_summary(p_broadcaster_id UUID)
RETURNS TABLE (
    broadcaster_id UUID,
    total_streams INTEGER,
    sla_compliant_streams INTEGER,
    avg_uptime_pct NUMERIC(5,2),
    total_violations INTEGER,
    active_subscribers INTEGER,
    total_subscriber_revenue BIGINT,
    current_sla_tier TEXT,
    next_tier_uptime_threshold NUMERIC(5,2),
    coins_to_next_tier BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stream_count INTEGER;
    v_compliant_count INTEGER;
    v_avg_uptime NUMERIC(5,2);
    v_violation_count INTEGER;
    v_active_subs INTEGER;
    v_total_revenue BIGINT;
    v_sla_tier TEXT := 'none';
    v_next_threshold NUMERIC(5,2) := 0;
    v_coins_to_next BIGINT := 0;
BEGIN
    -- Only the broadcaster themselves, an admin, or the edge function (service_role)
    -- can view this broadcaster's SLA summary.
    IF auth.uid() != p_broadcaster_id AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.is_admin = true
    ) AND current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: can only view your own broadcaster SLA summary';
    END IF;

    SELECT COUNT(*) INTO v_stream_count FROM public.streams WHERE broadcaster_id = p_broadcaster_id;
    SELECT COUNT(*) INTO v_compliant_count FROM public.sla_metrics sm
        JOIN public.streams s ON s.id = sm.stream_id
        WHERE s.broadcaster_id = p_broadcaster_id AND sm.resolved = true AND sm.uptime_pct >= 99.0;
    SELECT COALESCE(AVG(uptime_pct), 100.0) INTO v_avg_uptime FROM public.sla_metrics sm
        JOIN public.streams s ON s.id = sm.stream_id
        WHERE s.broadcaster_id = p_broadcaster_id AND sm.resolved = true;
    SELECT COUNT(*) INTO v_violation_count FROM public.sla_violations
        WHERE broadcaster_id = p_broadcaster_id AND resolved = false;
    SELECT COUNT(*) INTO v_active_subs FROM public.user_subscriptions
        WHERE broadcaster_id = p_broadcaster_id AND is_active = true;
    SELECT COALESCE(SUM(total_paid_coins), 0) INTO v_total_revenue FROM public.user_subscriptions
        WHERE broadcaster_id = p_broadcaster_id AND is_active = true;

    -- Determine SLA tier based on average uptime
    IF v_avg_uptime >= 99.95 THEN
        v_sla_tier := 'platinum';
        v_next_threshold := 0;
    ELSIF v_avg_uptime >= 99.9 THEN
        v_sla_tier := 'gold';
        v_next_threshold := (SELECT config_value::NUMERIC FROM public.sla_config WHERE config_key = 'platinum_uptime_threshold_pct');
    ELSIF v_avg_uptime >= 99.0 THEN
        v_sla_tier := 'silver';
        v_next_threshold := (SELECT config_value::NUMERIC FROM public.sla_config WHERE config_key = 'gold_uptime_threshold_pct');
    ELSE
        v_sla_tier := 'bronze';
        v_next_threshold := 99.0;
    END IF;

    v_coins_to_next := 0;

    RETURN QUERY SELECT
        p_broadcaster_id,
        v_stream_count,
        v_compliant_count,
        ROUND(v_avg_uptime, 2),
        v_violation_count,
        v_active_subs,
        v_total_revenue,
        v_sla_tier,
        v_next_threshold,
        v_coins_to_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcaster_sla_summary(UUID) TO authenticated, service_role;

-- Get all active SLA violations for a broadcaster (for compensation)
CREATE OR REPLACE FUNCTION public.get_broadcaster_sla_violations(p_broadcaster_id UUID)
RETURNS TABLE (
    violation_id UUID,
    stream_id UUID,
    violation_type TEXT,
    tier_at_time TEXT,
    actual_value JSONB,
    expected_value JSONB,
    compensation_coins BIGINT,
    compensation_issued BOOLEAN,
    resolved BOOLEAN,
    notes TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only the broadcaster themselves, an admin, or the edge function (service_role)
    -- can view their own SLA violations.
    IF auth.uid() != p_broadcaster_id AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.is_admin = true
    ) AND current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: can only view your own SLA violations';
    END IF;

    RETURN QUERY
    SELECT
        sv.id,
        sv.stream_id,
        sv.violation_type,
        sv.tier_at_time,
        sv.actual_value,
        sv.expected_value,
        sv.compensation_coins,
        sv.compensation_issued,
        sv.resolved,
        sv.notes,
        sv.created_at
    FROM public.sla_violations sv
    WHERE sv.broadcaster_id = p_broadcaster_id
    ORDER BY sv.created_at DESC
    LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcaster_sla_violations(UUID) TO authenticated, service_role;

-- Claim SLA compensation (for a specific violation)
CREATE OR REPLACE FUNCTION public.claim_sla_compensation(p_violation_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT, coins_credited BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_violation sla_violations%ROWTYPE;
    v_broadcaster_id UUID;
    v_coins BIGINT;
BEGIN
    SELECT * INTO v_violation FROM public.sla_violations WHERE id = p_violation_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Violation not found'::TEXT, 0::BIGINT;
        RETURN;
    END IF;

    v_broadcaster_id := v_violation.broadcaster_id;

    -- Only the broadcaster, an admin, or the edge function (service_role) can claim
    IF auth.uid() != v_broadcaster_id AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = TRUE
    ) AND current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
        RETURN QUERY SELECT FALSE, 'Unauthorized'::TEXT, 0::BIGINT;
        RETURN;
    END IF;

    -- Already compensated?
    IF v_violation.compensation_issued THEN
        RETURN QUERY SELECT FALSE, 'Compensation already issued'::TEXT, 0::BIGINT;
        RETURN;
    END IF;

    v_coins := v_violation.compensation_coins;

    -- Issue compensation
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_coins,
        sla_last_checked_at = NOW()
    WHERE id = v_broadcaster_id;

    UPDATE public.sla_violations
    SET compensation_issued = true,
        compensation_issued_at = NOW(),
        resolved = true,
        resolved_at = NOW()
    WHERE id = p_violation_id;

    -- Log to admin pool ledger
    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, source_type, streamer_id, created_at)
    VALUES (v_coins, 'SLA compensation claim', v_broadcaster_id, 'sla_compensation', v_broadcaster_id, NOW());

    RETURN QUERY SELECT TRUE, 'Compensation issued: ' || v_coins || ' coins'::TEXT, v_coins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_sla_compensation(UUID) TO authenticated, service_role;

-- =============================================================================
-- PART 13: Update create_subscription to set SLA fields on new subscriptions
-- =============================================================================

-- Modify the create_subscription function to include SLA fields
DO $$
BEGIN
    -- Add SLA column checks to the existing create_subscription function
    -- by updating the user_subscriptions INSERT to include SLA fields
    -- This is already handled by the BEFORE INSERT trigger trg_subscription_sla_lifecycle

    RAISE NOTICE 'SLA trigger on user_subscriptions will automatically set SLA fields on insert/update';
END $$;

-- =============================================================================
-- PART 14: Update existing subscription_tiers with default SLA values
-- =============================================================================

-- Ensure all tiers have SLA defaults set even if they were created before this migration
UPDATE public.subscription_tiers
  SET sla_uptime_guarantee_pct = COALESCE(sla_uptime_guarantee_pct, 99.0),
      sla_quality_guarantee = COALESCE(sla_quality_guarantee, '720p'),
      sla_chat_priority = COALESCE(sla_chat_priority, 'standard'),
      sla_support_response_secs = COALESCE(sla_support_response_secs, 3600),
      sla_features = COALESCE(sla_features, '[]'::jsonb)
  WHERE sla_uptime_guarantee_pct IS NULL
     OR sla_quality_guarantee IS NULL
     OR sla_chat_priority IS NULL
     OR sla_support_response_secs IS NULL
     OR sla_features IS NULL;

-- =============================================================================
-- PART 15: Grants for the new tables
-- =============================================================================

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.sla_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sla_violations TO authenticated;
GRANT SELECT, UPDATE ON public.sla_config TO authenticated;

GRANT ALL ON public.sla_metrics TO service_role;
GRANT ALL ON public.sla_violations TO service_role;
GRANT ALL ON public.sla_config TO service_role;

COMMIT;
