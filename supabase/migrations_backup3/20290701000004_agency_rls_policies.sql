-- =============================================================================
-- AGENCY RLS POLICIES
-- =============================================================================
-- Adds RLS policies for agency tables that are missing them.
-- The Hytro migration covered: agency_applications, agency_members,
--   agency_point_transactions, agency_weekly_stats, agency_rewards,
--   agency_audit_log, agency_settings
-- This migration covers: agencies, agency_goals, agency_goal_progress,
--   agency_contracts, agency_invites, agency_earnings, agency_enforcement_actions
-- =============================================================================

BEGIN;

-- =============================================================================
-- AGENCIES TABLE
-- =============================================================================
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved agencies viewable by everyone" ON public.agencies;
CREATE POLICY "Approved agencies viewable by everyone" ON public.agencies
    FOR SELECT USING (status = 'approved' OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Agency owners can manage their own agencies" ON public.agencies;
CREATE POLICY "Agency owners can manage their own agencies" ON public.agencies
    FOR ALL USING (owner_id = auth.uid());

-- =============================================================================
-- AGENCY_GOALS TABLE
-- =============================================================================
ALTER TABLE public.agency_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can view goals" ON public.agency_goals;
CREATE POLICY "Agency members can view goals" ON public.agency_goals
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND status = 'active')
    );

DROP POLICY IF EXISTS "Agency owners can manage goals" ON public.agency_goals;
CREATE POLICY "Agency owners can manage goals" ON public.agency_goals
    FOR ALL USING (
        agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
        OR agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
        )
    );

-- =============================================================================
-- AGENCY_GOAL_PROGRESS TABLE
-- =============================================================================
ALTER TABLE public.agency_goal_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can view goal progress" ON public.agency_goal_progress;
CREATE POLICY "Agency members can view goal progress" ON public.agency_goal_progress
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND status = 'active')
    );

DROP POLICY IF EXISTS "Agency members can insert own progress" ON public.agency_goal_progress;
CREATE POLICY "Agency members can insert own progress" ON public.agency_goal_progress
    FOR INSERT WITH CHECK (
        creator_id = auth.uid()
        AND agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND status = 'active')
    );

DROP POLICY IF EXISTS "Agency owners can manage goal progress" ON public.agency_goal_progress;
CREATE POLICY "Agency owners can manage goal progress" ON public.agency_goal_progress
    FOR ALL USING (
        agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
        OR agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
        )
    );

-- =============================================================================
-- AGENCY_CONTRACTS TABLE
-- =============================================================================
ALTER TABLE public.agency_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can view contracts" ON public.agency_contracts;
CREATE POLICY "Agency members can view contracts" ON public.agency_contracts
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND status = 'active')
        OR creator_id = auth.uid()
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Agency owners can manage contracts" ON public.agency_contracts;
CREATE POLICY "Agency owners can manage contracts" ON public.agency_contracts
    FOR ALL USING (
        agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
        OR agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
        )
    );

-- =============================================================================
-- AGENCY_INVITES TABLE
-- =============================================================================
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can view invites" ON public.agency_invites;
CREATE POLICY "Agency members can view invites" ON public.agency_invites
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND status = 'active')
        OR invited_user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Agency owners can manage invites" ON public.agency_invites;
CREATE POLICY "Agency owners can manage invites" ON public.agency_invites
    FOR ALL USING (
        agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
        OR agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
        )
    );

-- =============================================================================
-- AGENCY_EARNINGS TABLE
-- =============================================================================
ALTER TABLE public.agency_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can view own earnings" ON public.agency_earnings;
CREATE POLICY "Agency members can view own earnings" ON public.agency_earnings
    FOR SELECT USING (
        creator_id = auth.uid()
        OR agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
        OR agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "Agency owners can manage earnings" ON public.agency_earnings;
CREATE POLICY "Agency owners can manage earnings" ON public.agency_earnings
    FOR ALL USING (
        agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
        OR agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
        )
    );

-- =============================================================================
-- AGENCY_ENFORCEMENT_ACTIONS TABLE
-- =============================================================================
ALTER TABLE public.agency_enforcement_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can view enforcement actions" ON public.agency_enforcement_actions;
CREATE POLICY "Agency members can view enforcement actions" ON public.agency_enforcement_actions
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND status = 'active')
    );

DROP POLICY IF EXISTS "Agency owners can manage enforcement actions" ON public.agency_enforcement_actions;
CREATE POLICY "Agency owners can manage enforcement actions" ON public.agency_enforcement_actions
    FOR ALL USING (
        agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
        OR agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
        )
    );

-- =============================================================================
-- GRANTS
-- =============================================================================
GRANT SELECT ON public.agency_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agency_goal_progress TO authenticated;
GRANT SELECT ON public.agency_contracts TO authenticated;
GRANT SELECT ON public.agency_invites TO authenticated;
GRANT SELECT ON public.agency_earnings TO authenticated;
GRANT SELECT ON public.agency_enforcement_actions TO authenticated;

COMMIT;
