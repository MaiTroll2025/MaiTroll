-- Restrict global ticker publishing to administrators and authorized TCNN roles.
CREATE OR REPLACE FUNCTION public.create_global_event(
    p_title TEXT,
    p_type TEXT DEFAULT 'system',
    p_icon TEXT DEFAULT NULL,
    p_priority INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'::JSONB,
    p_dedupe_key TEXT DEFAULT NULL,
    p_source_event_id TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'published',
    p_route TEXT DEFAULT NULL,
    p_source TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_event_id UUID;
    v_allowed BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
    END IF;

    SELECT
        COALESCE(up.is_admin, false)
        OR lower(COALESCE(up.role, '')) IN (
            'admin', 'ceo', 'superadmin',
            'tcnn_news_caster', 'tcnn_chief_news_caster'
        )
        OR lower(COALESCE(up.troll_role, '')) IN (
            'tcnn_news_caster', 'tcnn_chief_news_caster'
        )
    INTO v_allowed
    FROM public.user_profiles up
    WHERE up.id = v_user_id;

    IF NOT COALESCE(v_allowed, false) THEN
        RAISE EXCEPTION 'Ticker publishing permission required' USING ERRCODE = '42501';
    END IF;

    p_metadata := COALESCE(p_metadata, '{}'::JSONB)
        || jsonb_build_object('actor_id', v_user_id);

    INSERT INTO public.global_events
        (type, title, icon, priority, metadata, dedupe_key, source_event_id,
         status, route, source, actor_id, expires_at)
    VALUES
        (p_type, p_title, p_icon, p_priority, p_metadata, p_dedupe_key,
         p_source_event_id, p_status, p_route, p_source, v_user_id, p_expires_at)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id
        FROM public.global_events
        WHERE dedupe_key = p_dedupe_key
        LIMIT 1;
    END IF;

    RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_global_event(
    TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_global_event(
    TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

NOTIFY pgrst, 'reload schema';
