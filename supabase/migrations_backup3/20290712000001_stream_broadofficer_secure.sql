-- =====================================================================
-- A6: Broadofficer assignment & removal (stream-scoped, secure)
-- =====================================================================
-- Authorization is based on the CURRENT STREAM assignment, verified by the
-- RPC confirming the acting user owns/controls the stream. Assignments live
-- in public.broadcast_officers and are delivered to all clients via realtime.
-- =====================================================================

-- Ensure the stream-scoped table exists (idempotent; matches prior migrations)
CREATE TABLE IF NOT EXISTS public.broadcast_officers (
    broadcaster_id UUID REFERENCES auth.users(id),
    officer_id     UUID REFERENCES auth.users(id),
    stream_id      UUID REFERENCES public.streams(id),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (broadcaster_id, officer_id, stream_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_officers_stream
    ON public.broadcast_officers (stream_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_officers_officer
    ON public.broadcast_officers (officer_id, stream_id);

-- ---------------------------------------------------------------------
-- Helper: is a user an admin (reuse existing pattern loosely)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_stream_owner_or_admin(
    p_stream_id uuid,
    p_user_id   uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_owner uuid;
    v_admin boolean := false;
BEGIN
    SELECT user_id INTO v_owner FROM public.streams WHERE id = p_stream_id;
    IF v_owner IS NOT NULL AND v_owner = p_user_id THEN
        RETURN true;
    END IF;
    SELECT COALESCE(is_admin, false)
        OR role IN ('admin','superadmin','owner','ceo')
      INTO v_admin
      FROM public.user_profiles WHERE id = p_user_id;
    RETURN COALESCE(v_admin, false);
END;
$$;

-- ---------------------------------------------------------------------
-- Assign broadofficer (stream-scoped) -> returns jsonb with dedup flag
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.assign_broadofficer(uuid, uuid);

CREATE OR REPLACE FUNCTION public.assign_broadofficer(
    p_stream_id  uuid,
    p_officer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor        uuid := auth.uid();
    v_owner        uuid;
    v_already      boolean := false;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    IF p_stream_id IS NULL OR p_officer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing stream or officer');
    END IF;

    SELECT user_id INTO v_owner FROM public.streams WHERE id = p_stream_id;
    IF v_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
    END IF;

    -- Only the stream owner (or admin) may assign officers for this stream
    IF NOT public.is_stream_owner_or_admin(p_stream_id, v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not control this stream');
    END IF;

    IF p_officer_id = v_owner THEN
        RETURN jsonb_build_object('success', false, 'error', 'The broadcaster is already the host');
    END IF;

    -- Detect duplicate assignment (idempotent) to prevent duplicate messages
    SELECT EXISTS (
        SELECT 1 FROM public.broadcast_officers
        WHERE broadcaster_id = v_owner AND officer_id = p_officer_id AND stream_id = p_stream_id
    ) INTO v_already;

    IF NOT v_already THEN
        INSERT INTO public.broadcast_officers (broadcaster_id, officer_id, stream_id)
        VALUES (v_owner, p_officer_id, p_stream_id)
        ON CONFLICT (broadcaster_id, officer_id, stream_id) DO NOTHING;
    END IF;

    RETURN jsonb_build_object('success', true, 'already_assigned', v_already);
END;
$$;

-- ---------------------------------------------------------------------
-- Remove broadofficer (stream-scoped) -> returns jsonb with removed flag
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_stream_broadofficer(
    p_stream_id  uuid,
    p_officer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor   uuid := auth.uid();
    v_owner   uuid;
    v_deleted integer := 0;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT user_id INTO v_owner FROM public.streams WHERE id = p_stream_id;
    IF v_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
    END IF;

    IF NOT public.is_stream_owner_or_admin(p_stream_id, v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not control this stream');
    END IF;

    DELETE FROM public.broadcast_officers
        WHERE broadcaster_id = v_owner
          AND officer_id = p_officer_id
          AND stream_id = p_stream_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'removed', v_deleted > 0);
END;
$$;

-- ---------------------------------------------------------------------
-- Stream-scoped broadofficer check (authoritative for current stream)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_stream_broadofficer(
    p_stream_id uuid,
    p_user_id   uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.broadcast_officers bo
        WHERE bo.stream_id = p_stream_id
          AND bo.officer_id = p_user_id
    );
$$;

-- ---------------------------------------------------------------------
-- RLS: readable list so clients + realtime can observe assignments
-- ---------------------------------------------------------------------
ALTER TABLE public.broadcast_officers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcast_officers_select ON public.broadcast_officers;
CREATE POLICY broadcast_officers_select ON public.broadcast_officers
    FOR SELECT USING (true);

-- Writes only via SECURITY DEFINER RPCs above (no INSERT/DELETE policy).

-- ---------------------------------------------------------------------
-- Realtime + grants
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'broadcast_officers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_officers;
    END IF;
END $$;

GRANT SELECT ON public.broadcast_officers TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_stream_owner_or_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_broadofficer(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_stream_broadofficer(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_stream_broadofficer(uuid, uuid) TO authenticated, service_role;
