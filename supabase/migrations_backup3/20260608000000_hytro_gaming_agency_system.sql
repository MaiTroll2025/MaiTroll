-- ============================================================================
-- HYTRO GAMING AGENCY SYSTEM
-- Complete agency management with applications, points, tiers, rewards
-- ============================================================================

-- ============================================================================
-- SECTION 0: ENSURE DEPENDENCY FUNCTIONS EXIST
-- (is_not_suspended, is_not_banned, is_admin, current_user_id)
-- ============================================================================

-- Drop existing functions first to avoid signature conflicts
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_not_suspended(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_not_suspended() CASCADE;
DROP FUNCTION IF EXISTS public.is_not_banned(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_not_banned() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_id() CASCADE;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_not_banned(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    RETURN NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND banned_at IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_not_suspended(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    RETURN NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND suspended_until IS NOT NULL
        AND suspended_until > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (is_admin = true OR role IN ('admin', 'superadmin', 'ceo'))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================================
-- SECTION 1: ENUM TYPES
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_application_status') THEN
        CREATE TYPE public.agency_application_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_member_role') THEN
        CREATE TYPE public.agency_member_role AS ENUM ('creator', 'leader', 'manager');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_tier') THEN
        CREATE TYPE public.agency_tier AS ENUM ('none', 'bronze', 'silver', 'gold', 'legend');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_transaction_type') THEN
        CREATE TYPE public.agency_transaction_type AS ENUM ('stream_hours', 'platform_share', 'verified_viewer', 'user_registration', 'tier_bonus', 'admin_adjustment', 'reward_redemption');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_reward_status') THEN
        CREATE TYPE public.agency_reward_status AS ENUM ('pending', 'available', 'claimed', 'expired', 'revoked');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_reward_type') THEN
        CREATE TYPE public.agency_reward_type AS ENUM ('bonus_coins', 'badge', 'exclusive_access', 'custom_role', 'merchandise', 'cash_payout', 'tier_milestone');
    END IF;
END
$$;

-- ============================================================================
-- SECTION 1.5: ENSURE COLUMNS EXIST ON PREVIOUSLY-CREATED TABLES
-- (Handles case where tables exist from partial/duplicate runs but are missing columns)
-- ============================================================================

DO $$
BEGIN
    -- agency_applications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_applications') THEN
        -- Drop NOT NULL constraints from old Talent Offices schema for hytrogaming compatibility
        DECLARE
            col_record RECORD;
        BEGIN
            FOR col_record IN
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'agency_applications'
                AND is_nullable = 'NO'
                AND column_name != 'id'
            LOOP
                EXECUTE format('ALTER TABLE public.agency_applications ALTER COLUMN %I DROP NOT NULL', col_record.column_name);
            END LOOP;
        END;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS display_name TEXT;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS primary_platform TEXT DEFAULT 'twitch';
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS channel_url TEXT;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS avg_weekly_hours NUMERIC(6,2) DEFAULT 0;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS avg_weekly_viewers INTEGER DEFAULT 0;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS content_category TEXT[] DEFAULT '{}';
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS motivation TEXT;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS experience TEXT;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS referral_code TEXT;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS status public.agency_application_status DEFAULT 'pending';
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.user_profiles(id);
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS review_notes TEXT;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.agency_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- agency_members
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_members') THEN
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.agency_applications(id) ON DELETE SET NULL;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS role public.agency_member_role DEFAULT 'creator';
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS current_tier public.agency_tier DEFAULT 'none';
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS lifetime_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS notified_tier_change BOOLEAN DEFAULT false;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.agency_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- agency_point_transactions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_point_transactions') THEN
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS transaction_type public.agency_transaction_type;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS points INTEGER;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS source_id TEXT;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS source_table TEXT;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS verification_data JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS week_start DATE;
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id);
        ALTER TABLE public.agency_point_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- agency_weekly_stats
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_weekly_stats') THEN
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS week_start DATE;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS week_end DATE;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS stream_hours_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS platform_share_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS viewer_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS registration_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS tier_bonus_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS admin_adjustment_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS hours_streamed NUMERIC(6,2) DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS verified_viewers INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS verified_registrations INTEGER DEFAULT 0;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS tier_at_end public.agency_tier DEFAULT 'none';
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ;
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.agency_weekly_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- agency_rewards
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_rewards') THEN
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS reward_type public.agency_reward_type;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS title TEXT;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS points_cost INTEGER DEFAULT 0;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS tier_requirement public.agency_tier DEFAULT 'none';
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS coin_value INTEGER DEFAULT 0;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS status public.agency_reward_status DEFAULT 'pending';
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES public.user_profiles(id);
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS fulfillment_data JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id);
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.agency_rewards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- agency_audit_log
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_audit_log') THEN
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.user_profiles(id);
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.user_profiles(id);
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS action TEXT;
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS entity_id UUID;
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS previous_data JSONB;
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS new_data JSONB;
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
        ALTER TABLE public.agency_audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- agency_settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_settings') THEN
        ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS key TEXT;
        ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id);
        ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END
$$;

-- ============================================================================
-- SECTION 2: AGENCY APPLICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    primary_platform TEXT NOT NULL DEFAULT 'twitch',
    channel_url TEXT,
    avg_weekly_hours NUMERIC(6,2) DEFAULT 0,
    avg_weekly_viewers INTEGER DEFAULT 0,
    content_category TEXT[] DEFAULT '{}',
    motivation TEXT,
    experience TEXT,
    referral_code TEXT,
    status public.agency_application_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_applications_user_id ON public.agency_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_applications_status ON public.agency_applications(status);
CREATE INDEX IF NOT EXISTS idx_agency_applications_created_at ON public.agency_applications(created_at DESC);

-- ============================================================================
-- SECTION 3: AGENCY MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.agency_applications(id) ON DELETE SET NULL,
    role public.agency_member_role NOT NULL DEFAULT 'creator',
    current_tier public.agency_tier NOT NULL DEFAULT 'none',
    total_points INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notified_tier_change BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_members_user_id ON public.agency_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_tier ON public.agency_members(current_tier);
CREATE INDEX IF NOT EXISTS idx_agency_members_total_points ON public.agency_members(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_agency_members_lifetime_points ON public.agency_members(lifetime_points DESC);
CREATE INDEX IF NOT EXISTS idx_agency_members_active ON public.agency_members(is_active);

-- ============================================================================
-- SECTION 4: AGENCY POINT TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_point_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    transaction_type public.agency_transaction_type NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    source_id TEXT,
    source_table TEXT,
    verified BOOLEAN NOT NULL DEFAULT false,
    verification_data JSONB DEFAULT '{}'::jsonb,
    week_start DATE,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apt_user_id ON public.agency_point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_apt_type ON public.agency_point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_apt_created_at ON public.agency_point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apt_week_start ON public.agency_point_transactions(week_start);
CREATE INDEX IF NOT EXISTS idx_apt_user_week ON public.agency_point_transactions(user_id, week_start);

-- ============================================================================
-- SECTION 5: AGENCY WEEKLY STATS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_weekly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    stream_hours_points INTEGER NOT NULL DEFAULT 0,
    platform_share_points INTEGER NOT NULL DEFAULT 0,
    viewer_points INTEGER NOT NULL DEFAULT 0,
    registration_points INTEGER NOT NULL DEFAULT 0,
    tier_bonus_points INTEGER NOT NULL DEFAULT 0,
    admin_adjustment_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0,
    hours_streamed NUMERIC(6,2) DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    verified_viewers INTEGER DEFAULT 0,
    verified_registrations INTEGER DEFAULT 0,
    tier_at_end public.agency_tier NOT NULL DEFAULT 'none',
    calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_aws_user_id ON public.agency_weekly_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_aws_week_start ON public.agency_weekly_stats(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_aws_user_week ON public.agency_weekly_stats(user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_aws_tier ON public.agency_weekly_stats(tier_at_end);

-- ============================================================================
-- SECTION 6: AGENCY REWARDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reward_type public.agency_reward_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    points_cost INTEGER DEFAULT 0,
    tier_requirement public.agency_tier DEFAULT 'none',
    coin_value INTEGER DEFAULT 0,
    status public.agency_reward_status NOT NULL DEFAULT 'pending',
    available_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.user_profiles(id),
    revoke_reason TEXT,
    fulfillment_data JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_user_id ON public.agency_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_ar_status ON public.agency_rewards(status);
CREATE INDEX IF NOT EXISTS idx_ar_type ON public.agency_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_ar_created_at ON public.agency_rewards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ar_tier ON public.agency_rewards(tier_requirement);

-- ============================================================================
-- SECTION 7: AGENCY AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id UUID REFERENCES public.user_profiles(id),
    target_user_id UUID REFERENCES public.user_profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    previous_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aal_actor ON public.agency_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_aal_target ON public.agency_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_aal_action ON public.agency_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_aal_entity ON public.agency_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_aal_created_at ON public.agency_audit_log(created_at DESC);

-- ============================================================================
-- SECTION 8: AGENCY SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agency_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default point values
INSERT INTO public.agency_settings (key, value, description) VALUES
    ('point_values', '{"stream_hours": 10, "platform_share": 2, "verified_viewer": 5, "user_registration": 25}'::jsonb, 'Points awarded per activity type'),
    ('tier_thresholds', '{"bronze": 250, "silver": 500, "gold": 1000, "legend": 2000}'::jsonb, 'Points required for each tier'),
    ('tier_bonus_points', '{"bronze": 50, "silver": 150, "gold": 350, "legend": 750}'::jsonb, 'Bonus points awarded on tier promotion'),
    ('weekly_evaluation_day', '"Sunday"'::jsonb, 'Day of week for weekly evaluation'),
    ('weekly_evaluation_time', '"23:59:59"'::jsonb, 'Time for weekly evaluation (UTC)'),
    ('point_expiration_days', 'null'::jsonb, 'Days until points expire (null = never)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SECTION 9: POINT CONSTANTS HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_agency_point_value(p_activity_type TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_settings JSONB;
    v_value INTEGER;
BEGIN
    SELECT value INTO v_settings FROM public.agency_settings WHERE key = 'point_values';
    IF v_settings IS NULL THEN
        RETURN CASE p_activity_type
            WHEN 'stream_hours' THEN 10
            WHEN 'platform_share' THEN 2
            WHEN 'verified_viewer' THEN 5
            WHEN 'user_registration' THEN 25
            ELSE 0
        END;
    END IF;
    v_value := (v_settings->>p_activity_type)::INTEGER;
    RETURN COALESCE(v_value, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 10: TIER CALCULATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_agency_tier(p_points INTEGER)
RETURNS public.agency_tier AS $$
DECLARE
    v_thresholds JSONB;
    v_bronze INTEGER;
    v_silver INTEGER;
    v_gold INTEGER;
    v_legend INTEGER;
BEGIN
    SELECT value INTO v_thresholds FROM public.agency_settings WHERE key = 'tier_thresholds';
    IF v_thresholds IS NULL THEN
        v_bronze := 250; v_silver := 500; v_gold := 1000; v_legend := 2000;
    ELSE
        v_bronze := COALESCE((v_thresholds->>'bronze')::INTEGER, 250);
        v_silver := COALESCE((v_thresholds->>'silver')::INTEGER, 500);
        v_gold := COALESCE((v_thresholds->>'gold')::INTEGER, 1000);
        v_legend := COALESCE((v_thresholds->>'legend')::INTEGER, 2000);
    END IF;

    IF p_points >= v_legend THEN RETURN 'legend'::public.agency_tier;
    ELSIF p_points >= v_gold THEN RETURN 'gold'::public.agency_tier;
    ELSIF p_points >= v_silver THEN RETURN 'silver'::public.agency_tier;
    ELSIF p_points >= v_bronze THEN RETURN 'bronze'::public.agency_tier;
    ELSE RETURN 'none'::public.agency_tier;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 11: TIER THRESHOLD LOOKUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_next_tier_threshold(p_points INTEGER)
RETURNS TABLE(tier public.agency_tier, threshold INTEGER) AS $$
DECLARE
    v_thresholds JSONB;
    v_bronze INTEGER;
    v_silver INTEGER;
    v_gold INTEGER;
    v_legend INTEGER;
BEGIN
    SELECT value INTO v_thresholds FROM public.agency_settings WHERE key = 'tier_thresholds';
    IF v_thresholds IS NULL THEN
        v_bronze := 250; v_silver := 500; v_gold := 1000; v_legend := 2000;
    ELSE
        v_bronze := COALESCE((v_thresholds->>'bronze')::INTEGER, 250);
        v_silver := COALESCE((v_thresholds->>'silver')::INTEGER, 500);
        v_gold := COALESCE((v_thresholds->>'gold')::INTEGER, 1000);
        v_legend := COALESCE((v_thresholds->>'legend')::INTEGER, 2000);
    END IF;

    IF p_points < v_bronze THEN
        RETURN QUERY SELECT 'bronze'::public.agency_tier, v_bronze;
    ELSIF p_points < v_silver THEN
        RETURN QUERY SELECT 'silver'::public.agency_tier, v_silver;
    ELSIF p_points < v_gold THEN
        RETURN QUERY SELECT 'gold'::public.agency_tier, v_gold;
    ELSIF p_points < v_legend THEN
        RETURN QUERY SELECT 'legend'::public.agency_tier, v_legend;
    ELSE
        RETURN QUERY SELECT 'legend'::public.agency_tier, v_legend;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 12: ADD POINTS FUNCTION (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_agency_points(
    p_user_id UUID,
    p_activity_type TEXT,
    p_quantity INTEGER DEFAULT 1,
    p_source_id TEXT DEFAULT NULL,
    p_source_table TEXT DEFAULT NULL,
    p_verified BOOLEAN DEFAULT true,
    p_verification_data JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(points_awarded INTEGER, new_total INTEGER, new_tier public.agency_tier) AS $$
DECLARE
    v_point_value INTEGER;
    v_points INTEGER;
    v_current_total INTEGER;
    v_new_total INTEGER;
    v_current_tier public.agency_tier;
    v_new_tier public.agency_tier;
    v_week_start DATE;
BEGIN
    v_point_value := public.get_agency_point_value(p_activity_type);
    v_points := v_point_value * GREATEST(p_quantity, 0);
    v_week_start := date_trunc('week', NOW())::DATE;

    INSERT INTO public.agency_point_transactions (
        user_id, transaction_type, points, source_id, source_table, verified, verification_data, week_start
    ) VALUES (
        p_user_id, p_activity_type::public.agency_transaction_type, v_points, p_source_id, p_source_table, p_verified, p_verification_data, v_week_start
    );

    SELECT COALESCE(total_points, 0), current_tier INTO v_current_total, v_current_tier
    FROM public.agency_members WHERE user_id = p_user_id;

    IF v_current_total IS NULL THEN
        v_current_total := 0;
        v_current_tier := 'none'::public.agency_tier;
    END IF;

    v_new_total := v_current_total + v_points;
    v_new_tier := public.calculate_agency_tier(v_new_total);

    INSERT INTO public.agency_members (user_id, total_points, lifetime_points, current_tier, last_active_at)
    VALUES (p_user_id, v_new_total, v_points, v_new_tier, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        total_points = v_new_total,
        lifetime_points = public.agency_members.lifetime_points + v_points,
        current_tier = v_new_tier,
        last_active_at = NOW(),
        updated_at = NOW(),
        notified_tier_change = CASE WHEN v_new_tier != public.agency_members.current_tier THEN false ELSE public.agency_members.notified_tier_change END;

    IF v_new_tier != v_current_tier THEN
        PERFORM public.log_agency_action(
            NULL, p_user_id, 'tier_promotion', 'agency_members',
            (SELECT id FROM public.agency_members WHERE user_id = p_user_id),
            jsonb_build_object('previous_tier', v_current_tier::TEXT),
            jsonb_build_object('new_tier', v_new_tier::TEXT)
        );
    END IF;

    RETURN QUERY SELECT v_points, v_new_total, v_new_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 13: ADJUST POINTS FUNCTION (ADMIN ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.adjust_agency_points(
    p_user_id UUID,
    p_points INTEGER,
    p_reason TEXT DEFAULT 'Admin adjustment'
)
RETURNS TABLE(previous_total INTEGER, new_total INTEGER, new_tier public.agency_tier) AS $$
DECLARE
    v_actor_id UUID := public.current_user_id();
    v_current_total INTEGER;
    v_new_total INTEGER;
    v_current_tier public.agency_tier;
    v_new_tier public.agency_tier;
BEGIN
    IF NOT public.is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Only admins can adjust agency points';
    END IF;

    SELECT total_points, current_tier INTO v_current_total, v_current_tier
    FROM public.agency_members WHERE user_id = p_user_id;

    IF v_current_total IS NULL THEN
        v_current_total := 0;
        v_current_tier := 'none'::public.agency_tier;
    END IF;

    v_new_total := GREATEST(v_current_total + p_points, 0);
    v_new_tier := public.calculate_agency_tier(v_new_total);

    INSERT INTO public.agency_point_transactions (
        user_id, transaction_type, points, description, verified, created_by
    ) VALUES (
        p_user_id, 'admin_adjustment', p_points, p_reason, true, v_actor_id
    );

    UPDATE public.agency_members SET
        total_points = v_new_total,
        current_tier = v_new_tier,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    PERFORM public.log_agency_action(
        v_actor_id, p_user_id, 'points_adjusted', 'agency_members',
        (SELECT id FROM public.agency_members WHERE user_id = p_user_id),
        jsonb_build_object('previous_total', v_current_total, 'tier', v_current_tier::TEXT),
        jsonb_build_object('new_total', v_new_total, 'tier', v_new_tier::TEXT, 'adjustment', p_points, 'reason', p_reason)
    );

    RETURN QUERY SELECT v_current_total, v_new_total, v_new_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 14: AUDIT LOGGING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_agency_action(
    p_actor_id UUID,
    p_target_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT DEFAULT 'agency',
    p_entity_id UUID DEFAULT NULL,
    p_previous_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.agency_audit_log (
        actor_id, target_user_id, action, entity_type, entity_id,
        previous_data, new_data
    ) VALUES (
        p_actor_id, p_target_user_id, p_action, p_entity_type, p_entity_id,
        p_previous_data, p_new_data
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 15: AUTO-CREATE MEMBER ON APPROVAL TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_application_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_log_id UUID;
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        INSERT INTO public.agency_members (
            user_id, application_id, role, current_tier, total_points, lifetime_points, joined_at
        ) VALUES (
            NEW.user_id, NEW.id, 'creator'::public.agency_member_role,
            'none'::public.agency_tier, 0, 0, NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;

        PERFORM public.log_agency_action(
            NEW.reviewed_by, NEW.user_id, 'application_approved',
            'agency_applications', NEW.id,
            jsonb_build_object('status', 'pending'),
            jsonb_build_object('status', 'approved', 'role', 'creator')
        );
    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        PERFORM public.log_agency_action(
            NEW.reviewed_by, NEW.user_id, 'application_rejected',
            'agency_applications', NEW.id,
            jsonb_build_object('status', 'pending'),
            jsonb_build_object('status', 'rejected', 'reason', COALESCE(NEW.rejection_reason, 'No reason provided'))
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS agency_application_approval_trigger ON public.agency_applications;
CREATE TRIGGER agency_application_approval_trigger
    AFTER UPDATE ON public.agency_applications
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.handle_application_approval();

-- ============================================================================
-- SECTION 16: WEEKLY EVALUATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_weekly_agency_evaluation()
RETURNS TABLE(
    user_id UUID,
    week_start DATE,
    week_end DATE,
    total_points INTEGER,
    previous_tier public.agency_tier,
    new_tier public.agency_tier,
    tier_changed BOOLEAN
) AS $$
DECLARE
    v_week_start DATE := date_trunc('week', NOW())::DATE;
    v_week_end DATE := v_week_start + INTERVAL '6 days';
    v_member RECORD;
    v_week_points INTEGER;
    v_current_total INTEGER;
    v_new_total INTEGER;
    v_previous_tier public.agency_tier;
    v_new_tier public.agency_tier;
    v_tier_changed BOOLEAN;
    v_bonus_points INTEGER;
    v_bonuses JSONB;
BEGIN
    SELECT value INTO v_bonuses FROM public.agency_settings WHERE key = 'tier_bonus_points';

    FOR v_member IN SELECT am.user_id, am.total_points, am.current_tier FROM public.agency_members am WHERE am.is_active = true
    LOOP
        SELECT COALESCE(SUM(apt.points), 0)
        INTO v_week_points
        FROM public.agency_point_transactions apt
        WHERE apt.user_id = v_member.user_id
        AND apt.week_start = v_week_start;

        v_current_total := v_member.total_points + v_week_points;
        v_previous_tier := v_member.current_tier;
        v_new_tier := public.calculate_agency_tier(v_current_total);
        v_tier_changed := (v_new_tier != v_previous_tier);

        IF v_tier_changed THEN
            v_bonus_points := 0;
            IF v_bonuses IS NOT NULL THEN
                v_bonus_points := COALESCE((v_bonuses->>v_new_tier::TEXT)::INTEGER, 0);
                IF v_bonus_points > 0 THEN
                    v_current_total := v_current_total + v_bonus_points;

                    INSERT INTO public.agency_point_transactions (
                        user_id, transaction_type, points, description, verified, week_start, created_by
                    ) VALUES (
                        v_member.user_id, 'tier_bonus', v_bonus_points,
                        'Tier promotion bonus: ' || v_previous_tier::TEXT || ' -> ' || v_new_tier::TEXT,
                        true, v_week_start, NULL
                    );
                END IF;
            END IF;

            INSERT INTO public.agency_rewards (
                user_id, reward_type, title, description, tier_requirement,
                status, available_at, created_by
            ) VALUES (
                v_member.user_id, 'tier_milestone',
                v_new_tier::TEXT || ' Tier Achieved!',
                'Congratulations! You have reached ' || v_new_tier::TEXT || ' tier.',
                v_new_tier, 'available', NOW(), NULL
            );
        END IF;

        v_new_total := v_current_total;

        INSERT INTO public.agency_weekly_stats (
            user_id, week_start, week_end,
            stream_hours_points, platform_share_points, viewer_points, registration_points,
            tier_bonus_points, admin_adjustment_points, total_points,
            tier_at_end, calculated_at
        )
        VALUES (
            v_member.user_id, v_week_start, v_week_end,
            0, 0, 0, 0,
            CASE WHEN v_tier_changed THEN v_bonus_points ELSE 0 END,
            0, v_week_points + CASE WHEN v_tier_changed THEN v_bonus_points ELSE 0 END,
            v_new_tier, NOW()
        )
        ON CONFLICT (user_id, week_start) DO UPDATE SET
            total_points = v_week_points + CASE WHEN v_tier_changed THEN v_bonus_points ELSE 0 END,
            tier_bonus_points = CASE WHEN v_tier_changed THEN v_bonus_points ELSE 0 END,
            tier_at_end = v_new_tier,
            calculated_at = NOW(),
            updated_at = NOW();

        UPDATE public.agency_members SET
            total_points = v_new_total,
            lifetime_points = lifetime_points + v_week_points + CASE WHEN v_tier_changed THEN v_bonus_points ELSE 0 END,
            current_tier = v_new_tier,
            updated_at = NOW(),
            notified_tier_change = CASE WHEN v_tier_changed THEN false ELSE notified_tier_change END
        WHERE user_id = v_member.user_id;

        IF v_tier_changed THEN
            PERFORM public.log_agency_action(
                NULL, v_member.user_id,
                CASE WHEN v_new_tier > v_previous_tier THEN 'tier_promotion' ELSE 'tier_demotion' END,
                'agency_members',
                (SELECT id FROM public.agency_members WHERE agency_members.user_id = v_member.user_id),
                jsonb_build_object('tier', v_previous_tier::TEXT),
                jsonb_build_object('tier', v_new_tier::TEXT, 'week_points', v_week_points)
            );
        END IF;

        user_id := v_member.user_id;
        week_start := v_week_start;
        week_end := v_week_end;
        total_points := v_week_points;
        previous_tier := v_previous_tier;
        new_tier := v_new_tier;
        tier_changed := v_tier_changed;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 17: GET LEADERBOARD FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_agency_leaderboard(p_week_start DATE DEFAULT NULL)
RETURNS TABLE(
    user_id UUID,
    display_name TEXT,
    current_tier public.agency_tier,
    total_points INTEGER,
    lifetime_points INTEGER,
    weekly_points INTEGER,
    rank BIGINT
) AS $$
DECLARE
    v_week DATE;
BEGIN
    v_week := COALESCE(p_week_start, date_trunc('week', NOW())::DATE);

    RETURN QUERY
    WITH weekly_data AS (
        SELECT apt.user_id, COALESCE(SUM(apt.points), 0) AS week_pts
        FROM public.agency_point_transactions apt
        WHERE apt.week_start = v_week
        AND apt.transaction_type NOT IN ('admin_adjustment')
        GROUP BY apt.user_id
    )
    SELECT
        am.user_id,
        COALESCE(up.display_name, up.username, 'Unknown') AS display_name,
        am.current_tier,
        am.total_points,
        am.lifetime_points,
        COALESCE(wd.week_pts, 0)::INTEGER AS weekly_points,
        RANK() OVER (ORDER BY am.total_points DESC) AS rank
    FROM public.agency_members am
    LEFT JOIN public.user_profiles up ON up.id = am.user_id
    LEFT JOIN weekly_data wd ON wd.user_id = am.user_id
    WHERE am.is_active = true
    ORDER BY am.total_points DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- SECTION 18: UPDATE TIMESTAMPTZ TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_agency_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agency_applications_updated_at ON public.agency_applications;
CREATE TRIGGER tr_agency_applications_updated_at
    BEFORE UPDATE ON public.agency_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_agency_updated_at();

DROP TRIGGER IF EXISTS tr_agency_members_updated_at ON public.agency_members;
CREATE TRIGGER tr_agency_members_updated_at
    BEFORE UPDATE ON public.agency_members
    FOR EACH ROW EXECUTE FUNCTION public.update_agency_updated_at();

DROP TRIGGER IF EXISTS tr_agency_weekly_stats_updated_at ON public.agency_weekly_stats;
CREATE TRIGGER tr_agency_weekly_stats_updated_at
    BEFORE UPDATE ON public.agency_weekly_stats
    FOR EACH ROW EXECUTE FUNCTION public.update_agency_updated_at();

DROP TRIGGER IF EXISTS tr_agency_rewards_updated_at ON public.agency_rewards;
CREATE TRIGGER tr_agency_rewards_updated_at
    BEFORE UPDATE ON public.agency_rewards
    FOR EACH ROW EXECUTE FUNCTION public.update_agency_updated_at();

DROP TRIGGER IF EXISTS tr_agency_settings_updated_at ON public.agency_settings;
CREATE TRIGGER tr_agency_settings_updated_at
    BEFORE UPDATE ON public.agency_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_agency_updated_at();

-- ============================================================================
-- SECTION 19: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.agency_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

-- Policies for agency_applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.agency_applications;
CREATE POLICY "Users can view own applications" ON public.agency_applications
    FOR SELECT USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "Users can insert own application" ON public.agency_applications;
CREATE POLICY "Users can insert own application" ON public.agency_applications
    FOR INSERT WITH CHECK (
        user_id = public.current_user_id()
        AND public.is_not_suspended()
        AND public.is_not_banned()
    );

DROP POLICY IF EXISTS "Users can update own pending application" ON public.agency_applications;
CREATE POLICY "Users can update own pending application" ON public.agency_applications
    FOR UPDATE USING (
        user_id = public.current_user_id()
        AND status = 'pending'
        AND public.is_not_suspended()
    );

DROP POLICY IF EXISTS "Admins can view all applications" ON public.agency_applications;
CREATE POLICY "Admins can view all applications" ON public.agency_applications
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update applications" ON public.agency_applications;
CREATE POLICY "Admins can update applications" ON public.agency_applications
    FOR UPDATE USING (public.is_admin() AND public.is_not_banned());

DROP POLICY IF EXISTS "Admins can delete applications" ON public.agency_applications;
CREATE POLICY "Admins can delete applications" ON public.agency_applications
    FOR DELETE USING (public.is_admin());

-- Policies for agency_members
DROP POLICY IF EXISTS "Members can view all members" ON public.agency_members;
CREATE POLICY "Members can view all members" ON public.agency_members
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own member record" ON public.agency_members;
CREATE POLICY "Users can update own member record" ON public.agency_members
    FOR UPDATE USING (
        user_id = public.current_user_id()
        AND public.is_not_suspended()
    );

DROP POLICY IF EXISTS "Admins can manage members" ON public.agency_members;
CREATE POLICY "Admins can manage members" ON public.agency_members
    FOR ALL USING (public.is_admin() AND public.is_not_banned());

-- Policies for agency_point_transactions (users can ONLY read their own)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.agency_point_transactions;
CREATE POLICY "Users can view own transactions" ON public.agency_point_transactions
    FOR SELECT USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.agency_point_transactions;
CREATE POLICY "Admins can view all transactions" ON public.agency_point_transactions
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert transactions" ON public.agency_point_transactions;
CREATE POLICY "Admins can insert transactions" ON public.agency_point_transactions
    FOR INSERT WITH CHECK (public.is_admin() AND public.is_not_banned());

DROP POLICY IF EXISTS "No direct user inserts" ON public.agency_point_transactions;
CREATE POLICY "No direct user inserts" ON public.agency_point_transactions
    FOR INSERT WITH CHECK (false);

-- Policies for agency_weekly_stats
DROP POLICY IF EXISTS "Users can view own weekly stats" ON public.agency_weekly_stats;
CREATE POLICY "Users can view own weekly stats" ON public.agency_weekly_stats
    FOR SELECT USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "Admins can view all weekly stats" ON public.agency_weekly_stats;
CREATE POLICY "Admins can view all weekly stats" ON public.agency_weekly_stats
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage weekly stats" ON public.agency_weekly_stats;
CREATE POLICY "Admins can manage weekly stats" ON public.agency_weekly_stats
    FOR ALL USING (public.is_admin() AND public.is_not_banned());

-- Policies for agency_rewards
DROP POLICY IF EXISTS "Users can view own rewards" ON public.agency_rewards;
CREATE POLICY "Users can view own rewards" ON public.agency_rewards
    FOR SELECT USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "Users can claim own rewards" ON public.agency_rewards;
CREATE POLICY "Users can claim own rewards" ON public.agency_rewards
    FOR UPDATE USING (
        user_id = public.current_user_id()
        AND status = 'available'
        AND public.is_not_suspended()
    );

DROP POLICY IF EXISTS "Admins can manage all rewards" ON public.agency_rewards;
CREATE POLICY "Admins can manage all rewards" ON public.agency_rewards
    FOR ALL USING (public.is_admin() AND public.is_not_banned());

-- Policies for agency_audit_log
DROP POLICY IF EXISTS "Admins can view audit log" ON public.agency_audit_log;
CREATE POLICY "Admins can view audit log" ON public.agency_audit_log
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert audit log" ON public.agency_audit_log;
CREATE POLICY "Admins can insert audit log" ON public.agency_audit_log
    FOR INSERT WITH CHECK (public.is_admin());

-- Policies for agency_settings
DROP POLICY IF EXISTS "Anyone can read settings" ON public.agency_settings;
CREATE POLICY "Anyone can read settings" ON public.agency_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON public.agency_settings;
CREATE POLICY "Admins can manage settings" ON public.agency_settings
    FOR ALL USING (public.is_admin() AND public.is_not_banned());

-- ============================================================================
-- SECTION 20: GRANT PRIVILEGES
-- ============================================================================

GRANT SELECT ON public.agency_applications TO authenticated;
GRANT INSERT ON public.agency_applications TO authenticated;
GRANT UPDATE ON public.agency_applications TO authenticated;

GRANT SELECT ON public.agency_members TO authenticated;
GRANT UPDATE ON public.agency_members TO authenticated;

GRANT SELECT ON public.agency_point_transactions TO authenticated;

GRANT SELECT ON public.agency_weekly_stats TO authenticated;

GRANT SELECT ON public.agency_rewards TO authenticated;
GRANT UPDATE ON public.agency_rewards TO authenticated;

GRANT SELECT ON public.agency_audit_log TO authenticated;

GRANT SELECT ON public.agency_settings TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_agency_point_value TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_agency_tier TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_tier_threshold TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_agency_points TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_leaderboard TO authenticated;
