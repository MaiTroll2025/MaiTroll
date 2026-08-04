-- ============================================================================
-- Comprehensive Mod Actions System v2
-- ============================================================================
-- NO BAN LOGIC - Mai Troll uses arrests, warnings, mutes, suspensions
-- Adds:
--   1. broadcast_mod_actions table - unified mod action log for all staff
--   2. broadcast_mod_appeals - appeal system for mod actions
--   3. broadcast_mod_action_audit - audit trail for all changes
--   4. user_broadcast_restrictions - disable broadcast/game/seat per user
--   5. RLS policies (privacy-safe: users see own, staff sees all)
--   6. RPC functions for mod actions with risk score + strike tracking
--   7. Chat price fields on stream_settings + podcast tables
--   8. Moderator dashboard stats + repeat offender detection
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BROADCAST MOD ACTIONS TABLE
-- Unified table for all moderation actions by staff/broadofficers/broadcasters
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.broadcast_mod_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Who performed the action
    actor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor_role TEXT DEFAULT 'unknown',
    
    -- Who was targeted
    target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Action details (NO 'ban' - only arrest, warn, mute, disable, etc.)
    action_type TEXT NOT NULL CHECK (action_type IN (
        'disable_chat', 'enable_chat', 'kick', 'arrest',
        'disable_broadcast', 'enable_broadcast',
        'disable_hytrogame', 'enable_hytrogame',
        'disable_seat_joining', 'enable_seat_joining',
        'report', 'mute', 'unmute', 'warn',
        'warning', 'platform_review', 'fine'
    )),
    
    -- Context
    stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
    
    -- Action parameters
    duration_minutes INTEGER,
    reason TEXT,
    severity TEXT,
    bail_amount NUMERIC(12,2),
    
    -- Fine system
    fine_amount NUMERIC(12,2) DEFAULT 0,
    fine_paid BOOLEAN DEFAULT false,
    fine_paid_at TIMESTAMPTZ,
    fine_payment_method TEXT CHECK (fine_payment_method IN ('troll_coins', 'manual', 'waived')),
    fine_waived_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    fine_waived_at TIMESTAMPTZ,
    
    -- Evidence fields
    evidence_urls JSONB DEFAULT '[]'::jsonb,
    evidence_type TEXT CHECK (evidence_type IN ('screenshot', 'video', 'clip', 'chat_logs', 'system_log', 'other')),
    evidence_notes TEXT,
    
    -- Internal moderator notes (staff only, never shown to users)
    internal_notes TEXT,
    
    -- For arrest: whether broadcast was being recorded
    broadcast_recorded BOOLEAN DEFAULT false,
    
    -- Expiration (for timed actions)
    expires_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'completed')),
    
    -- If action was revoked
    revoked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    
    -- Audit fields
    edited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ,
    edit_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bma_target_user ON public.broadcast_mod_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_bma_actor ON public.broadcast_mod_actions(actor_id);
CREATE INDEX IF NOT EXISTS idx_bma_action_type ON public.broadcast_mod_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_bma_stream ON public.broadcast_mod_actions(stream_id);
CREATE INDEX IF NOT EXISTS idx_bma_status ON public.broadcast_mod_actions(status);
CREATE INDEX IF NOT EXISTS idx_bma_created ON public.broadcast_mod_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bma_active_target ON public.broadcast_mod_actions(target_user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bma_expires ON public.broadcast_mod_actions(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.broadcast_mod_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (PRIVACY-SAFE: no public read access)
DROP POLICY IF EXISTS "Anyone can view broadcast_mod_actions" ON public.broadcast_mod_actions;

-- Target user can view their OWN moderation actions
CREATE POLICY "Users can view own mod actions"
    ON public.broadcast_mod_actions
    FOR SELECT
    USING (target_user_id = auth.uid());

-- Actor can view actions they performed
CREATE POLICY "Actor can view own performed actions"
    ON public.broadcast_mod_actions
    FOR SELECT
    USING (actor_id = auth.uid());

-- Staff/admins can view ALL moderation actions
CREATE POLICY "Staff can view all mod actions"
    ON public.broadcast_mod_actions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

-- Staff can insert mod actions
CREATE POLICY "Staff can insert broadcast_mod_actions"
    ON public.broadcast_mod_actions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR COALESCE(is_broadcaster, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

-- Staff can update (revoke) mod actions
CREATE POLICY "Staff can update broadcast_mod_actions"
    ON public.broadcast_mod_actions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

-- ============================================================================
-- 2. BROADCAST MOD APPEALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.broadcast_mod_appeals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_id UUID NOT NULL REFERENCES public.broadcast_mod_actions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    appeal_reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'needs_review')),
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bma_appeal_action ON public.broadcast_mod_appeals(action_id);
CREATE INDEX IF NOT EXISTS idx_bma_appeal_user ON public.broadcast_mod_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_bma_appeal_status ON public.broadcast_mod_appeals(status);
CREATE INDEX IF NOT EXISTS idx_bma_appeal_pending ON public.broadcast_mod_appeals(status) WHERE status = 'pending';

ALTER TABLE public.broadcast_mod_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appeals"
    ON public.broadcast_mod_appeals
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Staff can view all appeals"
    ON public.broadcast_mod_appeals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

CREATE POLICY "Users can submit appeals for own actions"
    ON public.broadcast_mod_appeals
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.broadcast_mod_actions
            WHERE id = action_id
            AND target_user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can review appeals"
    ON public.broadcast_mod_appeals
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

-- ============================================================================
-- 3. BROADCAST MOD ACTION AUDIT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.broadcast_mod_action_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_id UUID NOT NULL REFERENCES public.broadcast_mod_actions(id) ON DELETE CASCADE,
    edited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    edit_type TEXT NOT NULL CHECK (edit_type IN ('created', 'edited', 'revoked', 'appeal_submitted', 'appeal_approved', 'appeal_denied', 'fine_paid', 'fine_waived', 'expired')),
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bma_audit_action ON public.broadcast_mod_action_audit(action_id);
CREATE INDEX IF NOT EXISTS idx_bma_audit_type ON public.broadcast_mod_action_audit(edit_type);
CREATE INDEX IF NOT EXISTS idx_bma_audit_created ON public.broadcast_mod_action_audit(created_at DESC);

ALTER TABLE public.broadcast_mod_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own action audit"
    ON public.broadcast_mod_action_audit
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.broadcast_mod_actions
            WHERE id = action_id
            AND (target_user_id = auth.uid() OR actor_id = auth.uid())
        )
    );

CREATE POLICY "Staff can view all audit"
    ON public.broadcast_mod_action_audit
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

CREATE POLICY "Staff can insert audit"
    ON public.broadcast_mod_action_audit
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

-- ============================================================================
-- 4. USER BROADCAST RESTRICTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_broadcast_restrictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    broadcast_disabled BOOLEAN DEFAULT false,
    hytrogame_disabled BOOLEAN DEFAULT false,
    seat_joining_disabled BOOLEAN DEFAULT false,
    chat_disabled BOOLEAN DEFAULT false,
    restricted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reason TEXT,
    duration_minutes INTEGER,
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_ubr_user ON public.user_broadcast_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ubr_status ON public.user_broadcast_restrictions(status);
CREATE INDEX IF NOT EXISTS idx_ubr_active_user ON public.user_broadcast_restrictions(user_id, status) WHERE status = 'active';

ALTER TABLE public.user_broadcast_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view user_broadcast_restrictions" ON public.user_broadcast_restrictions;

CREATE POLICY "Users can view own restrictions"
    ON public.user_broadcast_restrictions
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Staff can view all restrictions"
    ON public.user_broadcast_restrictions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

CREATE POLICY "Staff can manage user_broadcast_restrictions"
    ON public.user_broadcast_restrictions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer')
                OR COALESCE(is_admin, false) = true
                OR COALESCE(is_troll_officer, false) = true
                OR COALESCE(is_lead_officer, false) = true
                OR public.is_staff(auth.uid()) = true
            )
        )
    );

-- ============================================================================
-- 5. ADD RISK SCORE + STRIKE COUNT TO USER PROFILES
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'risk_score') THEN
        ALTER TABLE public.user_profiles ADD COLUMN risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'strike_count') THEN
        ALTER TABLE public.user_profiles ADD COLUMN strike_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_moderation_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_moderation_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- 6. HELPER: CHECK IF USER IS STAFF
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_staff_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (
            role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
            OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
            OR COALESCE(is_admin, false) = true
            OR COALESCE(is_troll_officer, false) = true
            OR COALESCE(is_lead_officer, false) = true
            OR COALESCE(is_broadcaster, false) = true
            OR public.is_staff(p_user_id) = true
        )
    );
END;
$$;

-- ============================================================================
-- 7. HELPER: UPDATE USER RISK SCORE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_risk_score(
    p_user_id UUID,
    p_action_type TEXT,
    p_severity TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_points INTEGER := 0;
    v_current_score INTEGER := 0;
    v_new_score INTEGER;
BEGIN
    v_points := CASE p_action_type
        WHEN 'warn' THEN 5
        WHEN 'warning' THEN 5
        WHEN 'mute' THEN 8
        WHEN 'disable_chat' THEN 8
        WHEN 'disable_seat_joining' THEN 10
        WHEN 'disable_hytrogame' THEN 10
        WHEN 'disable_broadcast' THEN 15
        WHEN 'arrest' THEN
            CASE COALESCE(p_severity, 'moderate')
                WHEN 'minor' THEN 15
                WHEN 'moderate' THEN 25
                WHEN 'serious' THEN 35
                WHEN 'severe' THEN 50
                ELSE 25
            END
        WHEN 'fine' THEN 10
        WHEN 'platform_review' THEN 40
        WHEN 'approved_appeal' THEN -10
        ELSE 0
    END;

    SELECT COALESCE(risk_score, 0) INTO v_current_score
    FROM public.user_profiles WHERE id = p_user_id;

    v_new_score := v_current_score + v_points;
    IF v_new_score > 100 THEN v_new_score := 100; END IF;
    IF v_new_score < 0 THEN v_new_score := 0; END IF;

    UPDATE public.user_profiles
    SET risk_score = v_new_score,
        last_moderation_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_new_score;
END;
$$;

-- ============================================================================
-- 8. HELPER: UPDATE USER STRIKE COUNT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_strikes(
    p_user_id UUID,
    p_action_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_strikes INTEGER := 0;
    v_new_strikes INTEGER;
BEGIN
    SELECT COALESCE(strike_count, 0) INTO v_current_strikes
    FROM public.user_profiles WHERE id = p_user_id;

    v_new_strikes := v_current_strikes + CASE p_action_type
        WHEN 'warn' THEN 1
        WHEN 'warning' THEN 1
        WHEN 'mute' THEN 1
        WHEN 'disable_chat' THEN 1
        WHEN 'disable_seat_joining' THEN 2
        WHEN 'disable_hytrogame' THEN 2
        WHEN 'disable_broadcast' THEN 2
        WHEN 'arrest' THEN 3
        WHEN 'fine' THEN 1
        WHEN 'platform_review' THEN 4
        ELSE 0
    END;

    IF v_new_strikes > 4 THEN v_new_strikes := 4; END IF;

    UPDATE public.user_profiles
    SET strike_count = v_new_strikes,
        last_moderation_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_new_strikes;
END;
$$;

-- ============================================================================
-- 9. HELPER: INSERT AUDIT RECORD
-- ============================================================================
CREATE OR REPLACE FUNCTION public.insert_mod_audit(
    p_action_id UUID,
    p_edit_type TEXT,
    p_edited_by UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO public.broadcast_mod_action_audit (
        action_id, edited_by, edit_type, old_values, new_values, reason
    ) VALUES (
        p_action_id, COALESCE(p_edited_by, auth.uid()), p_edit_type, p_old_values, p_new_values, p_reason
    ) RETURNING id INTO v_audit_id;

    UPDATE public.broadcast_mod_actions
    SET edit_count = edit_count + 1,
        edited_by = COALESCE(p_edited_by, auth.uid()),
        edited_at = NOW(),
        updated_at = NOW()
    WHERE id = p_action_id;

    RETURN v_audit_id;
END;
$$;

-- ============================================================================
-- 10. RPC: Disable Chat for User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_disable_chat(
    p_target_user_id UUID,
    p_stream_id UUID,
    p_duration_minutes INTEGER,
    p_reason TEXT DEFAULT NULL,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_expires TIMESTAMPTZ;
    v_action_id UUID;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized to perform mod actions');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;
    IF v_target_username IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Target user not found');
    END IF;

    v_expires := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.chat_blocks (stream_id, user_id, blocked_by, expires_at, reason)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_expires, COALESCE(p_reason, 'Chat disabled by ' || v_actor_role))
    ON CONFLICT DO NOTHING;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        stream_id, duration_minutes, reason, internal_notes,
        evidence_urls, evidence_type, evidence_notes,
        expires_at, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'disable_chat',
        p_stream_id, p_duration_minutes, COALESCE(p_reason, 'Chat disabled for ' || p_duration_minutes || ' minutes'),
        p_internal_notes, p_evidence_urls, p_evidence_type, p_evidence_notes,
        v_expires, 'active'
    ) RETURNING id INTO v_action_id;

    INSERT INTO public.user_broadcast_restrictions (user_id, chat_disabled, restricted_by, reason, duration_minutes, expires_at)
    VALUES (p_target_user_id, true, v_actor_id, COALESCE(p_reason, 'Chat disabled'), p_duration_minutes, v_expires)
    ON CONFLICT (user_id) DO UPDATE SET
        chat_disabled = true, restricted_by = v_actor_id, reason = COALESCE(p_reason, 'Chat disabled'),
        duration_minutes = p_duration_minutes, expires_at = v_expires, updated_at = NOW();

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'disable_chat');
    v_strikes := public.update_user_strikes(p_target_user_id, 'disable_chat');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id, NULL,
        json_build_object('action_type', 'disable_chat', 'duration_minutes', p_duration_minutes));

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', 'Chat disabled for ' || v_target_username || ' for ' || p_duration_minutes || ' minutes',
        'expires_at', v_expires, 'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 11. RPC: Enable Chat for User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_enable_chat(
    p_target_user_id UUID,
    p_stream_id UUID,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_target_username TEXT;
    v_action_id UUID;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;

    UPDATE public.chat_blocks SET expires_at = NOW()
    WHERE user_id = p_target_user_id AND stream_id = p_stream_id AND expires_at > NOW();

    INSERT INTO public.broadcast_mod_actions (actor_id, target_user_id, action_type, stream_id, status)
    VALUES (v_actor_id, p_target_user_id, 'enable_chat', p_stream_id, 'completed') RETURNING id INTO v_action_id;

    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id);

    UPDATE public.user_broadcast_restrictions SET chat_disabled = false, updated_at = NOW()
    WHERE user_id = p_target_user_id;

    RETURN json_build_object('success', true, 'message', 'Chat enabled for ' || COALESCE(v_target_username, 'user'));
END;
$$;

-- ============================================================================
-- 12. RPC: Kick User from Stream
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_kick_user(
    p_target_user_id UUID,
    p_stream_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_action_id UUID;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;

    INSERT INTO public.stream_kicks (stream_id, user_id, kicked_by, reason)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, COALESCE(p_reason, 'Kicked by ' || v_actor_role));

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        stream_id, reason, internal_notes,
        evidence_urls, evidence_type, evidence_notes, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'kick',
        p_stream_id, COALESCE(p_reason, 'Kicked from stream'),
        p_internal_notes, p_evidence_urls, p_evidence_type, p_evidence_notes, 'completed'
    ) RETURNING id INTO v_action_id;

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'kick');
    v_strikes := public.update_user_strikes(p_target_user_id, 'kick');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id);

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', COALESCE(v_target_username, 'User') || ' has been kicked from the stream',
        'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 13. RPC: Arrest User (jail-based, requires reason, severity, timeframe)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_arrest_user(
    p_target_user_id UUID,
    p_stream_id UUID,
    p_reason TEXT,
    p_severity TEXT DEFAULT 'moderate',
    p_bail_amount NUMERIC(12,2) DEFAULT 100,
    p_duration_minutes INTEGER DEFAULT 60,
    p_broadcast_recorded BOOLEAN DEFAULT false,
    p_fine_amount NUMERIC(12,2) DEFAULT 0,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_action_id UUID;
    v_expires TIMESTAMPTZ;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN json_build_object('success', false, 'message', 'Arrest reason is required');
    END IF;
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized to arrest');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;
    v_expires := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        stream_id, reason, severity, bail_amount, duration_minutes,
        broadcast_recorded, fine_amount, internal_notes,
        evidence_urls, evidence_type, evidence_notes,
        expires_at, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'arrest',
        p_stream_id, p_reason, p_severity, p_bail_amount, p_duration_minutes,
        p_broadcast_recorded, p_fine_amount, p_internal_notes,
        p_evidence_urls, p_evidence_type, p_evidence_notes,
        v_expires, 'active'
    ) RETURNING id INTO v_action_id;

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'arrest', p_severity);
    v_strikes := public.update_user_strikes(p_target_user_id, 'arrest');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id, NULL,
        json_build_object('action_type', 'arrest', 'severity', p_severity, 'fine_amount', p_fine_amount));

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', COALESCE(v_target_username, 'User') || ' has been arrested. Reason: ' || p_reason,
        'expires_at', v_expires, 'bail_amount', p_bail_amount,
        'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 14. RPC: Disable Broadcast for User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_disable_broadcast(
    p_target_user_id UUID,
    p_duration_minutes INTEGER,
    p_reason TEXT DEFAULT NULL,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_expires TIMESTAMPTZ;
    v_action_id UUID;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;
    v_expires := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.broadcast_restrictions (user_id, restricted_by, reason, duration_minutes, expires_at)
    VALUES (p_target_user_id, v_actor_id, COALESCE(p_reason, 'Broadcast disabled'), p_duration_minutes, v_expires)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        duration_minutes, reason, internal_notes,
        evidence_urls, evidence_type, evidence_notes, expires_at, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'disable_broadcast',
        p_duration_minutes, COALESCE(p_reason, 'Broadcast disabled for ' || p_duration_minutes || ' minutes'),
        p_internal_notes, p_evidence_urls, p_evidence_type, p_evidence_notes, v_expires, 'active'
    ) RETURNING id INTO v_action_id;

    INSERT INTO public.user_broadcast_restrictions (user_id, broadcast_disabled, restricted_by, reason, duration_minutes, expires_at)
    VALUES (p_target_user_id, true, v_actor_id, COALESCE(p_reason, 'Broadcast disabled'), p_duration_minutes, v_expires)
    ON CONFLICT (user_id) DO UPDATE SET
        broadcast_disabled = true, restricted_by = v_actor_id, reason = COALESCE(p_reason, 'Broadcast disabled'),
        duration_minutes = p_duration_minutes, expires_at = v_expires, updated_at = NOW();

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'disable_broadcast');
    v_strikes := public.update_user_strikes(p_target_user_id, 'disable_broadcast');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id);

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', 'Broadcast disabled for ' || COALESCE(v_target_username, 'user') || ' for ' || p_duration_minutes || ' minutes',
        'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 15. RPC: Disable HytroGame for User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_disable_hytrogame(
    p_target_user_id UUID,
    p_duration_minutes INTEGER,
    p_reason TEXT DEFAULT NULL,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_expires TIMESTAMPTZ;
    v_action_id UUID;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;
    v_expires := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        duration_minutes, reason, internal_notes,
        evidence_urls, evidence_type, evidence_notes, expires_at, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'disable_hytrogame',
        p_duration_minutes, COALESCE(p_reason, 'HytroGame disabled for ' || p_duration_minutes || ' minutes'),
        p_internal_notes, p_evidence_urls, p_evidence_type, p_evidence_notes, v_expires, 'active'
    ) RETURNING id INTO v_action_id;

    INSERT INTO public.user_broadcast_restrictions (user_id, hytrogame_disabled, restricted_by, reason, duration_minutes, expires_at)
    VALUES (p_target_user_id, true, v_actor_id, COALESCE(p_reason, 'HytroGame disabled'), p_duration_minutes, v_expires)
    ON CONFLICT (user_id) DO UPDATE SET
        hytrogame_disabled = true, restricted_by = v_actor_id, reason = COALESCE(p_reason, 'HytroGame disabled'),
        duration_minutes = p_duration_minutes, expires_at = v_expires, updated_at = NOW();

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'disable_hytrogame');
    v_strikes := public.update_user_strikes(p_target_user_id, 'disable_hytrogame');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id);

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', 'HytroGame disabled for ' || COALESCE(v_target_username, 'user') || ' for ' || p_duration_minutes || ' minutes',
        'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 16. RPC: Disable Seat Joining for User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_disable_seat_joining(
    p_target_user_id UUID,
    p_duration_minutes INTEGER,
    p_reason TEXT DEFAULT NULL,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_expires TIMESTAMPTZ;
    v_action_id UUID;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;
    v_expires := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        duration_minutes, reason, internal_notes,
        evidence_urls, evidence_type, evidence_notes, expires_at, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'disable_seat_joining',
        p_duration_minutes, COALESCE(p_reason, 'Seat joining disabled for ' || p_duration_minutes || ' minutes'),
        p_internal_notes, p_evidence_urls, p_evidence_type, p_evidence_notes, v_expires, 'active'
    ) RETURNING id INTO v_action_id;

    INSERT INTO public.user_broadcast_restrictions (user_id, seat_joining_disabled, restricted_by, reason, duration_minutes, expires_at)
    VALUES (p_target_user_id, true, v_actor_id, COALESCE(p_reason, 'Seat joining disabled'), p_duration_minutes, v_expires)
    ON CONFLICT (user_id) DO UPDATE SET
        seat_joining_disabled = true, restricted_by = v_actor_id, reason = COALESCE(p_reason, 'Seat joining disabled'),
        duration_minutes = p_duration_minutes, expires_at = v_expires, updated_at = NOW();

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'disable_seat_joining');
    v_strikes := public.update_user_strikes(p_target_user_id, 'disable_seat_joining');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id);

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', 'Seat joining disabled for ' || COALESCE(v_target_username, 'user') || ' for ' || p_duration_minutes || ' minutes',
        'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 17. RPC: Report User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_report_user(
    p_target_user_id UUID,
    p_stream_id UUID,
    p_reason TEXT,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_action_id UUID;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN json_build_object('success', false, 'message', 'Report reason is required');
    END IF;
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        stream_id, reason, internal_notes,
        evidence_urls, evidence_type, evidence_notes, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'report',
        p_stream_id, p_reason, p_internal_notes,
        p_evidence_urls, p_evidence_type, p_evidence_notes, 'active'
    ) RETURNING id INTO v_action_id;

    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id);

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', 'Report submitted for ' || COALESCE(v_target_username, 'user')
    );
END;
$$;

-- ============================================================================
-- 18. RPC: Issue Warning to User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_warn_user(
    p_target_user_id UUID,
    p_stream_id UUID,
    p_reason TEXT,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_action_id UUID;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN json_build_object('success', false, 'message', 'Warning reason is required');
    END IF;
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        stream_id, reason, internal_notes,
        evidence_urls, evidence_type, evidence_notes, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'warning',
        p_stream_id, p_reason, p_internal_notes,
        p_evidence_urls, p_evidence_type, p_evidence_notes, 'completed'
    ) RETURNING id INTO v_action_id;

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'warning');
    v_strikes := public.update_user_strikes(p_target_user_id, 'warning');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id);

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', 'Warning issued to ' || COALESCE(v_target_username, 'user'),
        'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 19. RPC: Issue Fine to User
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_issue_fine(
    p_target_user_id UUID,
    p_stream_id UUID,
    p_fine_amount NUMERIC(12,2),
    p_reason TEXT,
    p_internal_notes TEXT DEFAULT NULL,
    p_evidence_urls JSONB DEFAULT '[]'::jsonb,
    p_evidence_type TEXT DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_target_username TEXT;
    v_action_id UUID;
    v_risk_score INTEGER;
    v_strikes INTEGER;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF p_fine_amount IS NULL OR p_fine_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Fine amount must be greater than 0');
    END IF;
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN json_build_object('success', false, 'message', 'Fine reason is required');
    END IF;
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT COALESCE(role, troll_role, 'unknown') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    SELECT username INTO v_target_username FROM public.user_profiles WHERE id = p_target_user_id;

    INSERT INTO public.broadcast_mod_actions (
        actor_id, actor_role, target_user_id, action_type,
        stream_id, reason, fine_amount, internal_notes,
        evidence_urls, evidence_type, evidence_notes, status
    ) VALUES (
        v_actor_id, v_actor_role, p_target_user_id, 'fine',
        p_stream_id, p_reason, p_fine_amount, p_internal_notes,
        p_evidence_urls, p_evidence_type, p_evidence_notes, 'active'
    ) RETURNING id INTO v_action_id;

    v_risk_score := public.update_user_risk_score(p_target_user_id, 'fine');
    v_strikes := public.update_user_strikes(p_target_user_id, 'fine');
    PERFORM public.insert_mod_audit(v_action_id, 'created', v_actor_id, NULL,
        json_build_object('action_type', 'fine', 'fine_amount', p_fine_amount));

    RETURN json_build_object(
        'success', true, 'action_id', v_action_id,
        'message', 'Fine of ' || p_fine_amount || ' TC issued to ' || COALESCE(v_target_username, 'user'),
        'risk_score', v_risk_score, 'strike_count', v_strikes
    );
END;
$$;

-- ============================================================================
-- 20. RPC: Pay Mod Fine
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pay_mod_fine(p_action_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action RECORD;
    v_user_coins BIGINT;
BEGIN
    SELECT * INTO v_action
    FROM public.broadcast_mod_actions
    WHERE id = p_action_id AND action_type = 'fine' AND status = 'active' AND fine_paid = false;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Fine not found or already paid');
    END IF;

    IF v_action.target_user_id != auth.uid() THEN
        RETURN json_build_object('success', false, 'message', 'You can only pay your own fines');
    END IF;

    SELECT troll_coins INTO v_user_coins FROM public.user_profiles WHERE id = auth.uid();

    IF v_user_coins < v_action.fine_amount THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Insufficient Troll Coins. You need ' || v_action.fine_amount || ' TC but have ' || v_user_coins || ' TC'
        );
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_action.fine_amount::BIGINT, updated_at = NOW()
    WHERE id = auth.uid();

    UPDATE public.broadcast_mod_actions
    SET fine_paid = true, fine_paid_at = NOW(), fine_payment_method = 'troll_coins',
        status = 'completed', updated_at = NOW()
    WHERE id = p_action_id;

    PERFORM public.insert_mod_audit(p_action_id, 'fine_paid', auth.uid(), NULL,
        json_build_object('fine_paid', true, 'amount', v_action.fine_amount));

    RETURN json_build_object(
        'success', true,
        'message', 'Fine of ' || v_action.fine_amount || ' TC has been paid',
        'remaining_balance', v_user_coins - v_action.fine_amount::BIGINT
    );
END;
$$;

-- ============================================================================
-- 21. RPC: Submit Mod Appeal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_mod_appeal(
    p_action_id UUID,
    p_appeal_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action RECORD;
    v_appeal_id UUID;
    v_existing_appeal_count INTEGER;
BEGIN
    IF p_appeal_reason IS NULL OR TRIM(p_appeal_reason) = '' THEN
        RETURN json_build_object('success', false, 'message', 'Appeal reason is required');
    END IF;

    SELECT * INTO v_action FROM public.broadcast_mod_actions WHERE id = p_action_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Mod action not found');
    END IF;

    IF v_action.target_user_id != auth.uid() THEN
        RETURN json_build_object('success', false, 'message', 'You can only appeal your own moderation actions');
    END IF;

    SELECT COUNT(*) INTO v_existing_appeal_count
    FROM public.broadcast_mod_appeals
    WHERE action_id = p_action_id AND user_id = auth.uid() AND status = 'pending';

    IF v_existing_appeal_count > 0 THEN
        RETURN json_build_object('success', false, 'message', 'You already have a pending appeal for this action');
    END IF;

    INSERT INTO public.broadcast_mod_appeals (action_id, user_id, appeal_reason, status)
    VALUES (p_action_id, auth.uid(), p_appeal_reason, 'pending') RETURNING id INTO v_appeal_id;

    PERFORM public.insert_mod_audit(p_action_id, 'appeal_submitted', auth.uid(), NULL,
        json_build_object('appeal_id', v_appeal_id));

    RETURN json_build_object('success', true, 'appeal_id', v_appeal_id, 'message', 'Appeal submitted successfully');
END;
$$;

-- ============================================================================
-- 22. RPC: Review Mod Appeal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.review_mod_appeal(
    p_appeal_id UUID,
    p_status TEXT,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appeal RECORD;
    v_action_id UUID;
    v_old_status TEXT;
BEGIN
    IF NOT public.is_staff_user(auth.uid()) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized to review appeals');
    END IF;

    IF p_status NOT IN ('approved', 'denied', 'needs_review') THEN
        RETURN json_build_object('success', false, 'message', 'Status must be approved, denied, or needs_review');
    END IF;

    SELECT * INTO v_appeal FROM public.broadcast_mod_appeals WHERE id = p_appeal_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Appeal not found');
    END IF;

    IF v_appeal.status != 'pending' AND v_appeal.status != 'needs_review' THEN
        RETURN json_build_object('success', false, 'message', 'Appeal has already been reviewed');
    END IF;

    v_action_id := v_appeal.action_id;
    v_old_status := v_appeal.status;

    UPDATE public.broadcast_mod_appeals
    SET status = p_status, reviewed_by = auth.uid(), reviewed_at = NOW(),
        review_notes = p_review_notes, updated_at = NOW()
    WHERE id = p_appeal_id;

    IF p_status = 'approved' THEN
        UPDATE public.broadcast_mod_actions
        SET status = 'revoked', revoked_by = auth.uid(), revoked_at = NOW(),
            revoke_reason = 'Appeal approved: ' || COALESCE(p_review_notes, 'No notes'), updated_at = NOW()
        WHERE id = v_action_id AND status = 'active';

        PERFORM public.update_user_risk_score(v_appeal.user_id, 'approved_appeal');

        PERFORM public.insert_mod_audit(v_action_id, 'appeal_approved', auth.uid(),
            json_build_object('status', v_old_status), json_build_object('status', 'approved'));
    ELSE
        PERFORM public.insert_mod_audit(v_action_id,
            CASE WHEN p_status = 'denied' THEN 'appeal_denied' ELSE 'appeal_reviewed' END,
            auth.uid(), json_build_object('status', v_old_status), json_build_object('status', p_status));
    END IF;

    RETURN json_build_object('success', true, 'message', 'Appeal ' || p_status || ' successfully');
END;
$$;

-- ============================================================================
-- 23. RPC: Revoke Mod Action
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mod_revoke_action(
    p_action_id UUID,
    p_revoke_reason TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_old_status TEXT;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF NOT public.is_staff_user(v_actor_id) THEN
        RETURN json_build_object('success', false, 'message', 'Not authorized');
    END IF;

    SELECT status INTO v_old_status FROM public.broadcast_mod_actions WHERE id = p_action_id;

    UPDATE public.broadcast_mod_actions
    SET status = 'revoked', revoked_by = v_actor_id, revoked_at = NOW(),
        revoke_reason = p_revoke_reason, updated_at = NOW()
    WHERE id = p_action_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Action not found or already revoked');
    END IF;

    PERFORM public.insert_mod_audit(p_action_id, 'revoked', v_actor_id,
        json_build_object('status', v_old_status), json_build_object('status', 'revoked', 'reason', p_revoke_reason));

    RETURN json_build_object('success', true, 'message', 'Mod action revoked');
END;
$$;

-- ============================================================================
-- 24. RPC: Get All Active Modifications (for RTC Monitor page)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_active_modifications(
    p_include_internal BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    target_user_id UUID,
    target_username TEXT,
    target_avatar TEXT,
    action_type TEXT,
    reason TEXT,
    severity TEXT,
    bail_amount NUMERIC,
    fine_amount NUMERIC,
    fine_paid BOOLEAN,
    duration_minutes INTEGER,
    expires_at TIMESTAMPTZ,
    broadcast_recorded BOOLEAN,
    evidence_type TEXT,
    internal_notes TEXT,
    actor_id UUID,
    actor_username TEXT,
    actor_role TEXT,
    stream_id UUID,
    created_at TIMESTAMPTZ,
    risk_score INTEGER,
    strike_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bma.id, bma.target_user_id, tp.username, tp.avatar_url,
        bma.action_type, bma.reason, bma.severity, bma.bail_amount,
        bma.fine_amount, bma.fine_paid, bma.duration_minutes,
        bma.expires_at, bma.broadcast_recorded, bma.evidence_type,
        CASE WHEN p_include_internal THEN bma.internal_notes ELSE NULL END,
        bma.actor_id, ap.username, bma.actor_role, bma.stream_id,
        bma.created_at, tp.risk_score, tp.strike_count
    FROM public.broadcast_mod_actions bma
    LEFT JOIN public.user_profiles tp ON tp.id = bma.target_user_id
    LEFT JOIN public.user_profiles ap ON ap.id = bma.actor_id
    WHERE bma.status = 'active' AND (bma.expires_at IS NULL OR bma.expires_at > NOW())
    ORDER BY bma.created_at DESC;
END;
$$;

-- ============================================================================
-- 25. RPC: Get Moderator Dashboard Stats
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_moderator_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'todays_actions', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE created_at >= CURRENT_DATE),
        'warnings_today', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type IN ('warning', 'warn') AND created_at >= CURRENT_DATE),
        'arrests_today', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type = 'arrest' AND created_at >= CURRENT_DATE),
        'broadcast_disabled_today', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type = 'disable_broadcast' AND created_at >= CURRENT_DATE),
        'chat_disabled_today', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type = 'disable_chat' AND created_at >= CURRENT_DATE),
        'seat_disabled_today', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type = 'disable_seat_joining' AND created_at >= CURRENT_DATE),
        'hytrogame_disabled_today', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type = 'disable_hytrogame' AND created_at >= CURRENT_DATE),
        'appeals_pending', (SELECT COUNT(*) FROM public.broadcast_mod_appeals WHERE status = 'pending'),
        'reports_pending', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type = 'report' AND status = 'active'),
        'repeat_offenders', (SELECT COUNT(*) FROM public.user_profiles WHERE risk_score >= 50),
        'active_restrictions', (SELECT COUNT(*) FROM public.user_broadcast_restrictions WHERE status = 'active'),
        'platform_reviews_pending', (SELECT COUNT(*) FROM public.broadcast_mod_actions WHERE action_type = 'platform_review' AND status = 'active')
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 26. RPC: Get Repeat Offenders
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_repeat_offenders()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    risk_score INTEGER,
    strike_count INTEGER,
    total_actions BIGINT,
    last_moderation_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.id, up.username, up.avatar_url, up.risk_score, up.strike_count,
        COUNT(bma.id) AS total_actions, up.last_moderation_at
    FROM public.user_profiles up
    LEFT JOIN public.broadcast_mod_actions bma ON bma.target_user_id = up.id
    WHERE up.risk_score > 0 OR up.strike_count > 0
    GROUP BY up.id, up.username, up.avatar_url, up.risk_score, up.strike_count, up.last_moderation_at
    ORDER BY up.risk_score DESC, up.strike_count DESC
    LIMIT 50;
END;
$$;

-- ============================================================================
-- 27. Add chat price fields to stream_settings if not exists
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_settings' AND column_name = 'chat_price_per_message') THEN
        ALTER TABLE public.stream_settings ADD COLUMN chat_price_per_message NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_settings' AND column_name = 'chat_price_per_user') THEN
        ALTER TABLE public.stream_settings ADD COLUMN chat_price_per_user NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_settings' AND column_name = 'chat_revenue_split_percent') THEN
        ALTER TABLE public.stream_settings ADD COLUMN chat_revenue_split_percent INTEGER DEFAULT 50;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_settings' AND column_name = 'paid_chat_enabled') THEN
        ALTER TABLE public.stream_settings ADD COLUMN paid_chat_enabled BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_settings' AND column_name = 'paid_chat_type') THEN
        ALTER TABLE public.stream_settings ADD COLUMN paid_chat_type TEXT DEFAULT 'per_chat' CHECK (paid_chat_type IN ('per_chat', 'per_user', 'unlimited'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_settings' AND column_name = 'paid_chat_price') THEN
        ALTER TABLE public.stream_settings ADD COLUMN paid_chat_price NUMERIC(12,2) DEFAULT 100;
    END IF;
END $$;

-- ============================================================================
-- 28. Add paid chat revenue split tracking to admin_pool_ledger
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_pool_ledger' AND column_name = 'source_type') THEN
        ALTER TABLE public.admin_pool_ledger ADD COLUMN source_type TEXT DEFAULT 'chat_revenue';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_pool_ledger' AND column_name = 'streamer_id') THEN
        ALTER TABLE public.admin_pool_ledger ADD COLUMN streamer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 29. RPC: Record Paid Chat Revenue Split (50/50 to streamer and admin pool)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_paid_chat_revenue(
    p_stream_id UUID,
    p_streamer_id UUID,
    p_total_amount NUMERIC(12,2)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_streamer_share NUMERIC(12,2);
    v_admin_share NUMERIC(12,2);
    v_split_percent INTEGER;
BEGIN
    SELECT COALESCE(chat_revenue_split_percent, 50) INTO v_split_percent
    FROM public.stream_settings WHERE stream_id = p_stream_id;

    v_streamer_share = ROUND(p_total_amount * (v_split_percent::NUMERIC / 100), 2);
    v_admin_share = p_total_amount - v_streamer_share;

    IF v_streamer_share > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_streamer_share::BIGINT, updated_at = NOW()
        WHERE id = p_streamer_id;
    END IF;

    IF v_admin_share > 0 THEN
        INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, streamer_id, source_type, usd_value)
        VALUES (v_admin_share, 'Paid chat revenue split from stream ' || p_stream_id::TEXT, p_streamer_id, p_streamer_id, 'chat_revenue', 0);

        UPDATE public.admin_pool
        SET trollcoins_balance = trollcoins_balance + v_admin_share, updated_at = NOW()
        WHERE role = 'admin';
    END IF;

    RETURN json_build_object(
        'success', true, 'streamer_share', v_streamer_share,
        'admin_share', v_admin_share, 'split_percent', v_split_percent
    );
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.broadcast_mod_actions TO authenticated;
GRANT SELECT ON public.broadcast_mod_appeals TO authenticated;
GRANT SELECT ON public.broadcast_mod_action_audit TO authenticated;
GRANT SELECT ON public.user_broadcast_restrictions TO authenticated;
GRANT INSERT, UPDATE ON public.broadcast_mod_actions TO authenticated;
GRANT INSERT, UPDATE ON public.broadcast_mod_appeals TO authenticated;
GRANT INSERT ON public.broadcast_mod_action_audit TO authenticated;
GRANT INSERT, UPDATE ON public.user_broadcast_restrictions TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_disable_chat TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_enable_chat TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_kick_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_arrest_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_disable_broadcast TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_disable_hytrogame TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_disable_seat_joining TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_report_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_warn_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_issue_fine TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_mod_fine TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_mod_appeal TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_mod_appeal TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_modifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_revoke_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_paid_chat_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moderator_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_repeat_offenders TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_risk_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_strikes TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_mod_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user TO authenticated;

COMMIT;
