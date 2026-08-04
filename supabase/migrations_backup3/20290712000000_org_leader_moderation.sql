-- =====================================================================
-- A1: Moderation actions for family and agency leaders
-- =====================================================================
-- Family leaders may moderate members of their OWN family only.
-- Agency leaders (agency owner/manager) may moderate members of their
-- OWN agency only. Neither receives global moderator permissions.
--
-- All authority is enforced inside SECURITY DEFINER RPCs that confirm the
-- acting leader controls the relevant org before performing the action.
-- Every action writes an audit record to public.org_moderation_actions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit / action table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_moderation_actions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid NOT NULL,                 -- acting leader (auth.uid())
    target_user_id  uuid NOT NULL,                 -- member being moderated
    org_type        text NOT NULL CHECK (org_type IN ('family','agency')),
    org_id          uuid NOT NULL,                 -- family_id or agency_id
    action          text NOT NULL CHECK (action IN (
                        'warn','mute','remove_from_chat','remove_from_org',
                        'restrict','report'
                    )),
    reason          text,
    duration_minutes integer,                       -- NULL = permanent / n/a
    status          text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','expired','revoked')),
    created_at      timestamptz NOT NULL DEFAULT now(),  -- created date
    expires_at      timestamptz,                    -- expiration date
    revoked_at      timestamptz,                    -- revoked date
    revoked_by      uuid,                           -- revoked by
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_org_mod_actions_org
    ON public.org_moderation_actions (org_type, org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_mod_actions_target
    ON public.org_moderation_actions (target_user_id, org_type, org_id);
CREATE INDEX IF NOT EXISTS idx_org_mod_actions_active
    ON public.org_moderation_actions (org_type, org_id, target_user_id, action)
    WHERE status = 'active';

ALTER TABLE public.org_moderation_actions ENABLE ROW LEVEL SECURITY;

-- Reads are limited to leaders (via RPC below); direct reads only for the
-- target user (to see their own record) and staff. All writes go through RPCs.
DROP POLICY IF EXISTS org_mod_actions_select_own ON public.org_moderation_actions;
CREATE POLICY org_mod_actions_select_own ON public.org_moderation_actions
    FOR SELECT USING (
        target_user_id = auth.uid()
        OR actor_id = auth.uid()
    );

-- ---------------------------------------------------------------------
-- 2. Authority helper: does p_user control this org?
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_can_moderate(
    p_org_type text,
    p_org_id   uuid,
    p_user_id  uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_ok boolean := false;
BEGIN
    IF p_user_id IS NULL OR p_org_id IS NULL THEN
        RETURN false;
    END IF;

    IF p_org_type = 'family' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.troll_families tf
            WHERE tf.id = p_org_id AND tf.leader_id = p_user_id
        ) OR EXISTS (
            SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = p_org_id
              AND fm.user_id = p_user_id
              AND fm.role IN ('leader','co_leader')
        ) INTO v_ok;
    ELSIF p_org_type = 'agency' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = p_org_id AND a.owner_id = p_user_id
        ) OR EXISTS (
            SELECT 1 FROM public.agency_members am
            WHERE am.agency_id = p_org_id
              AND am.user_id = p_user_id
              AND am.status = 'active'
              AND am.role IN ('owner','manager')
        ) INTO v_ok;
    END IF;

    RETURN COALESCE(v_ok, false);
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Membership helper: is p_target a member of this org?
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_is_member(
    p_org_type text,
    p_org_id   uuid,
    p_user_id  uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_ok boolean := false;
BEGIN
    IF p_org_type = 'family' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = p_org_id AND fm.user_id = p_user_id
        ) INTO v_ok;
    ELSIF p_org_type = 'agency' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.agency_members am
            WHERE am.agency_id = p_org_id AND am.user_id = p_user_id
              AND am.status = 'active'
        ) INTO v_ok;
    END IF;
    RETURN COALESCE(v_ok, false);
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Active-restriction helper (source of truth for mute / chat / restrict)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_has_active_restriction(
    p_org_type text,
    p_org_id   uuid,
    p_user_id  uuid,
    p_action   text
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.org_moderation_actions
        WHERE org_type = p_org_type
          AND org_id = p_org_id
          AND target_user_id = p_user_id
          AND action = p_action
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
    );
$$;

-- ---------------------------------------------------------------------
-- 5. Core moderation RPC
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_moderate_member(
    p_org_type         text,
    p_org_id           uuid,
    p_target_user_id   uuid,
    p_action           text,
    p_reason           text DEFAULT NULL,
    p_duration_minutes integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor       uuid := auth.uid();
    v_expires_at  timestamptz;
    v_action_id   uuid;
    v_target_name text;
    v_org_name    text;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF p_org_type NOT IN ('family','agency') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid organization type');
    END IF;

    IF p_action NOT IN ('warn','mute','remove_from_chat','remove_from_org','restrict','report') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
    END IF;

    -- Authority check: actor must control this org (scoped, never global)
    IF NOT public.org_can_moderate(p_org_type, p_org_id, v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not lead this organization');
    END IF;

    -- Target must belong to the same org
    IF NOT public.org_is_member(p_org_type, p_org_id, p_target_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target is not a member of this organization');
    END IF;

    -- Cannot moderate yourself
    IF p_target_user_id = v_actor THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot moderate yourself');
    END IF;

    -- Leaders cannot moderate the org leader/owner
    IF p_org_type = 'family' AND EXISTS (
        SELECT 1 FROM public.troll_families WHERE id = p_org_id AND leader_id = p_target_user_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot moderate the family leader');
    END IF;
    IF p_org_type = 'agency' AND EXISTS (
        SELECT 1 FROM public.agencies WHERE id = p_org_id AND owner_id = p_target_user_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot moderate the agency owner');
    END IF;

    -- Compute expiration for time-boxed actions
    IF p_duration_minutes IS NOT NULL AND p_duration_minutes > 0
       AND p_action IN ('mute','remove_from_chat','restrict') THEN
        v_expires_at := now() + (p_duration_minutes || ' minutes')::interval;
    END IF;

    -- Resolve names for notifications
    SELECT COALESCE(username, display_name, 'Unknown') INTO v_target_name
        FROM public.user_profiles WHERE id = p_target_user_id;
    IF p_org_type = 'family' THEN
        SELECT COALESCE(family_name, name, 'your family') INTO v_org_name
            FROM public.troll_families WHERE id = p_org_id;
    ELSE
        SELECT COALESCE(name, 'your agency') INTO v_org_name
            FROM public.agencies WHERE id = p_org_id;
    END IF;

    -- Perform the action side-effects
    IF p_action = 'remove_from_chat' THEN
        IF p_org_type = 'agency' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Agency chat is not available');
        END IF;
        -- Supersede any earlier active chat restriction for this member
        UPDATE public.org_moderation_actions
            SET status = 'revoked', revoked_at = now(), revoked_by = v_actor
            WHERE org_type = p_org_type AND org_id = p_org_id
              AND target_user_id = p_target_user_id
              AND action = 'remove_from_chat' AND status = 'active';

    ELSIF p_action = 'mute' THEN
        UPDATE public.org_moderation_actions
            SET status = 'revoked', revoked_at = now(), revoked_by = v_actor
            WHERE org_type = p_org_type AND org_id = p_org_id
              AND target_user_id = p_target_user_id
              AND action = 'mute' AND status = 'active';

    ELSIF p_action = 'restrict' THEN
        UPDATE public.org_moderation_actions
            SET status = 'revoked', revoked_at = now(), revoked_by = v_actor
            WHERE org_type = p_org_type AND org_id = p_org_id
              AND target_user_id = p_target_user_id
              AND action = 'restrict' AND status = 'active';

    ELSIF p_action = 'remove_from_org' THEN
        IF p_org_type = 'family' THEN
            DELETE FROM public.family_members
                WHERE family_id = p_org_id AND user_id = p_target_user_id;
        ELSE
            UPDATE public.agency_members
                SET status = 'removed', removed_at = now(), updated_at = now()
                WHERE agency_id = p_org_id AND user_id = p_target_user_id;
        END IF;

    ELSIF p_action = 'report' THEN
        -- Report to staff (best-effort; do not fail the audit if schema differs)
        BEGIN
            INSERT INTO public.user_safety_warnings
                (target_user_id, actor_user_id, source, severity, category, note, status)
            VALUES
                (p_target_user_id, v_actor,
                 CASE WHEN p_org_type = 'family' THEN 'family' ELSE 'agency' END,
                 'medium', 'organization',
                 COALESCE(p_reason, 'Reported by ' || p_org_type || ' leader'),
                 'open');
        EXCEPTION WHEN OTHERS THEN
            NULL; -- audit record below is the durable trail
        END;
    END IF;

    -- Write audit record
    INSERT INTO public.org_moderation_actions
        (actor_id, target_user_id, org_type, org_id, action, reason,
         duration_minutes, expires_at, status)
    VALUES
        (v_actor, p_target_user_id, p_org_type, p_org_id, p_action, p_reason,
         p_duration_minutes, v_expires_at, 'active')
    RETURNING id INTO v_action_id;

    -- Notify the target member (best-effort)
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, message, metadata)
        VALUES (
            p_target_user_id,
            'org_moderation',
            CASE p_action
                WHEN 'warn' THEN 'Warning from ' || v_org_name
                WHEN 'mute' THEN 'You were muted in ' || v_org_name
                WHEN 'remove_from_chat' THEN 'Removed from chat in ' || v_org_name
                WHEN 'remove_from_org' THEN 'Removed from ' || v_org_name
                WHEN 'restrict' THEN 'Restricted in ' || v_org_name
                WHEN 'report' THEN 'You were reported to staff'
                ELSE 'Moderation action'
            END,
            COALESCE(p_reason, 'A moderation action was taken by your ' || p_org_type || ' leader.'),
            jsonb_build_object(
                'org_type', p_org_type, 'org_id', p_org_id,
                'action', p_action, 'action_id', v_action_id,
                'expires_at', v_expires_at
            )
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'action_id', v_action_id,
        'action', p_action,
        'expires_at', v_expires_at
    );
END;
$$;

-- ---------------------------------------------------------------------
-- 6. History RPC (leader-only, org-scoped)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_get_moderation_history(
    p_org_type text,
    p_org_id   uuid,
    p_limit    integer DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid := auth.uid();
    v_rows  jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    IF NOT public.org_can_moderate(p_org_type, p_org_id, v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not lead this organization');
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT
            oma.id, oma.actor_id, oma.target_user_id, oma.action, oma.reason,
            oma.duration_minutes, oma.status, oma.created_at, oma.expires_at,
            oma.revoked_at, oma.revoked_by,
            actor.username  AS actor_username,
            target.username AS target_username
        FROM public.org_moderation_actions oma
        LEFT JOIN public.user_profiles actor  ON actor.id  = oma.actor_id
        LEFT JOIN public.user_profiles target ON target.id = oma.target_user_id
        WHERE oma.org_type = p_org_type AND oma.org_id = p_org_id
        ORDER BY oma.created_at DESC
        LIMIT COALESCE(p_limit, 100)
    ) t;

    RETURN jsonb_build_object('success', true, 'history', v_rows);
END;
$$;

-- ---------------------------------------------------------------------
-- 7. Revoke RPC (leader-only, org-scoped)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_revoke_moderation(
    p_action_id uuid,
    p_reason    text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor  uuid := auth.uid();
    v_action public.org_moderation_actions;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT * INTO v_action FROM public.org_moderation_actions WHERE id = p_action_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Action not found');
    END IF;

    IF NOT public.org_can_moderate(v_action.org_type, v_action.org_id, v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not lead this organization');
    END IF;

    UPDATE public.org_moderation_actions
        SET status = 'revoked',
            revoked_at = now(),
            revoked_by = v_actor,
            metadata = metadata || jsonb_build_object('revoke_reason', p_reason)
        WHERE id = p_action_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------
-- 8. Enforce family-chat mute / chat-removal at the database (server-side)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_family_chat_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- System messages bypass restrictions
    IF NEW.message_type = 'system' THEN
        RETURN NEW;
    END IF;

    IF public.org_has_active_restriction('family', NEW.family_id, NEW.user_id, 'remove_from_chat') THEN
        RAISE EXCEPTION 'You have been removed from this family chat';
    END IF;

    IF public.org_has_active_restriction('family', NEW.family_id, NEW.user_id, 'mute') THEN
        RAISE EXCEPTION 'You are muted in this family chat';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_family_chat_restrictions ON public.family_chat_messages;
CREATE TRIGGER trg_enforce_family_chat_restrictions
    BEFORE INSERT ON public.family_chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.enforce_family_chat_restrictions();

-- ---------------------------------------------------------------------
-- 9. Realtime + grants
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'org_moderation_actions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.org_moderation_actions;
    END IF;
END $$;

GRANT SELECT ON public.org_moderation_actions TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_can_moderate(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_is_member(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_has_active_restriction(text, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_moderate_member(text, uuid, uuid, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_get_moderation_history(text, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_revoke_moderation(uuid, text) TO authenticated, service_role;
