-- =====================================================================
-- A7: Staff moderation powers gated by active work-session (clock-in)
-- =====================================================================
-- Source of truth for "clocked in" = a public.officer_work_sessions row
-- with clock_out IS NULL. The server validates clock-in when an escalated
-- staff action is submitted (not the frontend). Realtime clock-in/out
-- changes let ViewerPage update available actions immediately.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Clock-in helper (authoritative)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_clocked_in(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.officer_work_sessions
        WHERE officer_id = p_user_id
          AND clock_out IS NULL
    );
$$;

-- ---------------------------------------------------------------------
-- 2. High-privilege bypass helper (admins never need to clock in)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_high_privilege(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
          AND (COALESCE(is_admin, false)
               OR role IN ('admin','superadmin','owner','ceo'))
    );
$$;

-- ---------------------------------------------------------------------
-- 3. Centralized clock-in guard for escalated staff moderation actions.
--    Every mod_* RPC inserts into public.broadcast_mod_actions, so a
--    BEFORE INSERT trigger enforces clock-in for escalated actions
--    regardless of which RPC (or client) performs the insert.
--
--    Allowed WITHOUT clock-in (limited broadcaster set + arrest):
--      mute, unmute, disable_chat, enable_chat, kick, arrest,
--      enable_broadcast, enable_hytrogame, enable_seat_joining
--    Require clock-in for non-host / non-admin actors (escalated):
--      warn, warning, report, platform_review, fine,
--      disable_broadcast, disable_hytrogame, disable_seat_joining
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_staff_clockin_mod_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escalated boolean;
    v_is_host   boolean := false;
BEGIN
    v_escalated := NEW.action_type IN (
        'warn','warning','report','platform_review','fine',
        'disable_broadcast','disable_hytrogame','disable_seat_joining'
    );

    IF NOT v_escalated THEN
        RETURN NEW;
    END IF;

    IF NEW.actor_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Host of the stream may always moderate their own stream
    IF NEW.stream_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.streams
            WHERE id = NEW.stream_id AND user_id = NEW.actor_id
        ) INTO v_is_host;
        IF v_is_host THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Admins / high-privilege roles bypass clock-in
    IF public.is_high_privilege(NEW.actor_id) THEN
        RETURN NEW;
    END IF;

    -- Everyone else must be clocked in
    IF NOT public.is_staff_clocked_in(NEW.actor_id) THEN
        RAISE EXCEPTION 'You must be clocked in to perform this action';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_staff_clockin ON public.broadcast_mod_actions;
CREATE TRIGGER trg_enforce_staff_clockin
    BEFORE INSERT ON public.broadcast_mod_actions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_clockin_mod_actions();

-- ---------------------------------------------------------------------
-- 4. Authoritative viewer moderation context (server-computed, no stale
--    local state). ViewerPage uses this to decide which tools to show.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_viewer_mod_context(p_stream_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user       uuid := auth.uid();
    v_profile    public.user_profiles;
    v_is_host    boolean := false;
    v_clocked_in boolean := false;
    v_is_staff   boolean := false;
    v_is_bo      boolean := false;
BEGIN
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('is_authenticated', false);
    END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user;

    IF p_stream_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.streams WHERE id = p_stream_id AND user_id = v_user
        ) INTO v_is_host;
        v_is_bo := public.is_stream_broadofficer(p_stream_id, v_user);
    END IF;

    v_clocked_in := public.is_staff_clocked_in(v_user);

    v_is_staff := COALESCE(v_profile.is_admin, false)
        OR COALESCE(v_profile.is_troll_officer, false)
        OR COALESCE(v_profile.is_lead_officer, false)
        OR COALESCE(v_profile.is_ceo, false)
        OR COALESCE(v_profile.is_secretary, false)
        OR COALESCE(v_profile.is_prosecutor, false)
        OR COALESCE(v_profile.is_attorney, false)
        OR v_profile.role IN (
            'admin','superadmin','owner','ceo','staff','moderator',
            'lead_troll_officer','troll_officer','officer','secretary',
            'executive_secretary','prosecutor','attorney','judge','president',
            'vice_president'
        );

    RETURN jsonb_build_object(
        'is_authenticated', true,
        'is_host', v_is_host,
        'is_staff', COALESCE(v_is_staff, false),
        'is_clocked_in', v_clocked_in,
        'is_broadofficer', v_is_bo,
        'staff_role', v_profile.role,
        -- Effective authority:
        --  full staff tools require staff AND clocked in (or high-priv/host)
        'has_full_staff_tools', (COALESCE(v_is_staff,false) AND v_clocked_in)
            OR public.is_high_privilege(v_user) OR v_is_host,
        --  staff who are NOT clocked in still get arrest + summon
        'can_arrest', COALESCE(v_is_staff, false) OR v_is_host OR public.is_high_privilege(v_user),
        'can_summon', COALESCE(v_is_staff, false) OR public.is_high_privilege(v_user)
    );
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Realtime for work-session changes (so ViewerPage reacts instantly)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'officer_work_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.officer_work_sessions;
    END IF;
END $$;

GRANT SELECT ON public.officer_work_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_clocked_in(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_high_privilege(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_viewer_mod_context(uuid) TO authenticated, service_role;
