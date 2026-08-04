-- Universal Earnings System for Mai Troll Stats Page
-- Creates user_earning_events and role_earning_rules tables

BEGIN;

-- ============================================
-- USER EARNING EVENTS TABLE
-- Universal earning event tracking for all users
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_earning_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_key text NOT NULL,
    role_label text NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    amount_coins integer NOT NULL DEFAULT 0,
    percent_rate numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    paid_at timestamptz,
    payout_run_id uuid REFERENCES public.treasury_payout_runs(id) ON DELETE SET NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_earning_events_user_id ON public.user_earning_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_earning_events_role_key ON public.user_earning_events(role_key);
CREATE INDEX IF NOT EXISTS idx_user_earning_events_source_type ON public.user_earning_events(source_type);
CREATE INDEX IF NOT EXISTS idx_user_earning_events_status ON public.user_earning_events(status);
CREATE INDEX IF NOT EXISTS idx_user_earning_events_payout_run_id ON public.user_earning_events(payout_run_id);
CREATE INDEX IF NOT EXISTS idx_user_earning_events_created_at ON public.user_earning_events(created_at DESC);

-- ============================================
-- ROLE EARNING RULES TABLE
-- Powers what the Stats Page shows for all roles
-- ============================================
CREATE TABLE IF NOT EXISTS public.role_earning_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key text NOT NULL UNIQUE,
    role_label text NOT NULL,
    earning_type text NOT NULL,
    amount_coins integer NOT NULL DEFAULT 0,
    percent_rate numeric NOT NULL DEFAULT 0,
    source_type text,
    requirement_text text,
    application_route text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_earning_rules_role_key ON public.role_earning_rules(role_key);
CREATE INDEX IF NOT EXISTS idx_role_earning_rules_is_active ON public.role_earning_rules(is_active);

-- ============================================
-- USER EARNING SUMMARY VIEW
-- Aggregated summary for each user
-- ============================================
CREATE OR REPLACE VIEW public.user_earning_summary AS
SELECT
    user_id,
    -- Total earned (lifetime)
    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved', 'paid') THEN amount_coins ELSE 0 END), 0) as total_earned_coins,
    -- Pending earnings
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_coins ELSE 0 END), 0) as pending_coins,
    -- Paid earnings
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_coins ELSE 0 END), 0) as paid_coins,
    -- This week
    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved', 'paid') AND created_at >= date_trunc('week', current_date) THEN amount_coins ELSE 0 END), 0) as week_earned_coins,
    -- This month
    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved', 'paid') AND created_at >= date_trunc('month', current_date) THEN amount_coins ELSE 0 END), 0) as month_earned_coins,
    -- Last paid date
    MAX(CASE WHEN status = 'paid' THEN paid_at ELSE NULL::timestamptz END) as last_paid_at,
    -- Event counts
    COUNT(*) as total_events,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_events,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_events
FROM public.user_earning_events
GROUP BY user_id;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.user_earning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_earning_rules ENABLE ROW LEVEL SECURITY;

-- Users can view their own earning events
DROP POLICY IF EXISTS "Users can view their own earning events" ON public.user_earning_events;
CREATE POLICY "Users can view their own earning events" ON public.user_earning_events
    FOR SELECT USING (auth.uid() = user_id);

-- System/Admins can insert/update earning events
DROP POLICY IF EXISTS "System can manage earning events" ON public.user_earning_events;
CREATE POLICY "System can manage earning events" ON public.user_earning_events
    FOR ALL USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'ceo' OR troll_role = 'admin')
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'ceo' OR troll_role = 'admin')
        )
    );

-- All authenticated users can read role earning rules
DROP POLICY IF EXISTS "All can view role earning rules" ON public.role_earning_rules;
CREATE POLICY "All can view role earning rules" ON public.role_earning_rules
    FOR SELECT USING (true);

-- Only admins can manage role earning rules
DROP POLICY IF EXISTS "Admins can manage role earning rules" ON public.role_earning_rules;
CREATE POLICY "Admins can manage role earning rules" ON public.role_earning_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'ceo' OR troll_role = 'admin')
        )
    );

-- ============================================
-- INSERT DEFAULT ROLE EARNING RULES
-- ============================================
INSERT INTO public.role_earning_rules (role_key, role_label, earning_type, amount_coins, percent_rate, source_type, requirement_text, application_route, is_active)
VALUES
    ('user', 'User', 'normal_activity_rewards', 0, 0, null, 'Default role for all Mai Troll users', null, true),
    ('creator', 'Creator', 'gifts_seats_battles', 0, 0, 'gift', 'Broadcast and earn from viewers', null, true),
    ('broadcaster', 'Broadcaster', 'gifts_seats_battles', 0, 0, 'gift', 'Go live and earn from gifts/seats', null, true),
    ('agency_leader', 'Agency Leader', 'contract_split_percentage', 0, 10, 'gifts', 'Lead an approved agency', '/agencies/create', true),
    ('agency_hr_manager', 'Agency HR Manager', 'agency_fee_split', 0, 5, 'agency', 'Be promoted to HR manager in an agency', null, true),
    ('agency_hr', 'Agency HR', 'agency_fee_split', 0, 3, 'agency', 'Join an agency as HR', null, true),
    ('troll_family_leader', 'Troll Family Leader', 'agency_conversion_eligible', 25000, 0, 'family', 'Lead a family with 15+ members to convert to agency', '/family/create', true),
    ('troll_officer', 'Troll Officer', 'treasury_weekly_payout', 500, 0, 'treasury', 'Apply and be approved as Troll Officer', '/apply?t=officer', true),
    ('lead_troll_officer', 'Lead Troll Officer', 'treasury_weekly_payout', 1000, 0, 'treasury', 'Lead Troll Officer - higher treasury allocation', null, true),
    ('secretary', 'Secretary', 'treasury_weekly_payout', 750, 0, 'treasury', 'Appointed by President', null, true),
    ('president', 'President', 'treasury_weekly_payout', 5000, 0, 'treasury', 'Elected President of Mai Troll', null, true),
    ('journalist', 'Journalist', 'treasury_weekly_payout', 300, 0, 'treasury', 'Apply to become a TCNN Journalist', '/tcnn/apply', true),
    ('tcnn_news_caster', 'TCNN News Caster', 'treasury_weekly_payout', 200, 0, 'treasury', 'Appointed as TCNN News Caster', null, true),
    ('tcnn_chief_news_caster', 'TCNN Chief News Caster', 'treasury_weekly_payout', 400, 0, 'treasury', 'Lead TCNN as Chief News Caster', null, true),
    ('auctioneer', 'Auctioneer', 'auction_commission', 0, 0, 'auction', 'Apply to become Auctioneer - earn from commissions', '/apply?t=auctioneer', true),
    ('attorney', 'Attorney', 'treasury_weekly_payout', 400, 0, 'treasury', 'Apply to become Court Attorney', '/court/apply', true),
    ('prosecutor', 'Prosecutor', 'treasury_weekly_payout', 400, 0, 'treasury', 'Apply to become Court Prosecutor', '/court/apply', true),
    ('troller', 'Troller', 'treasury_weekly_payout', 100, 0, 'treasury', 'Default user activity rewards', null, true)
ON CONFLICT (role_key) DO NOTHING;

-- Grants
GRANT SELECT ON public.user_earning_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_earning_rules TO authenticated;
GRANT SELECT ON public.user_earning_summary TO authenticated;

COMMIT;