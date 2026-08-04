-- Fix seat leave auto-rejoin bug: remote RPCs were outdated
-- leave_seat_atomic was deleting from stream_participants instead of updating stream_seat_sessions
-- get_stream_seats was only returning status='active' instead of all active statuses

-- =============================================================================
-- 1. Fix leave_seat_atomic to update stream_seat_sessions status to 'left'
-- =============================================================================

DROP FUNCTION IF EXISTS public.leave_seat_atomic(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.leave_seat_atomic(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.stream_seat_sessions%ROWTYPE;
BEGIN
    -- Fetch the session first to verify it exists and is active
    SELECT * INTO v_row
    FROM public.stream_seat_sessions
    WHERE id = p_session_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found or not yours');
    END IF;

    IF v_row.status != 'active' AND v_row.status != 'live' AND v_row.status != 'camera_starting' AND v_row.status != 'reserved' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found or not yours');
    END IF;

    UPDATE public.stream_seat_sessions
    SET status = 'left',
        left_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_seat_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_seat_atomic(UUID) TO anon;

-- =============================================================================
-- 2. Fix get_stream_seats to return all active statuses (not just 'active')
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_stream_seats(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_stream_seats(p_stream_id UUID)
RETURNS TABLE (
    id UUID,
    seat_index INTEGER,
    user_id UUID,
    guest_id TEXT,
    status TEXT,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    livekit_participant_identity TEXT,
    price_paid INTEGER,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    is_gold BOOLEAN,
    role TEXT,
    troll_coins BIGINT,
    rgb_username_expires_at TIMESTAMPTZ,
    glowing_username_color TEXT,
    troll_role TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id::UUID,
        s.seat_index::INTEGER,
        s.user_id::UUID,
        s.guest_id::TEXT,
        s.status::TEXT,
        s.joined_at::TIMESTAMPTZ,
        s.left_at::TIMESTAMPTZ,
        s.livekit_participant_identity::TEXT,
        s.price_paid::INTEGER,
        (CASE
            WHEN s.user_id IS NOT NULL THEN COALESCE(u.username, 'Unknown')
            ELSE COALESCE(s.guest_id, 'Guest')
        END)::TEXT as username,
        (CASE
            WHEN s.user_id IS NOT NULL THEN COALESCE(u.display_name, u.username)
            ELSE COALESCE(s.guest_id, 'Guest')
        END)::TEXT as display_name,
        (CASE
            WHEN s.user_id IS NOT NULL THEN COALESCE(u.avatar_url, 'https://ui-avatars.com/api/?name=' || COALESCE(u.username, 'User') || '&background=random')
            ELSE 'https://ui-avatars.com/api/?name=' || COALESCE(s.guest_id, 'Guest') || '&background=random'
        END)::TEXT as avatar_url,
        COALESCE(u.is_gold, false)::BOOLEAN as is_gold,
        COALESCE(u.role, 'guest')::TEXT as role,
        COALESCE(u.troll_coins, 0)::BIGINT as troll_coins,
        u.rgb_username_expires_at::TIMESTAMPTZ,
        u.glowing_username_color::TEXT,
        u.troll_role::TEXT,
        u.created_at::TIMESTAMPTZ
    FROM public.stream_seat_sessions s
    LEFT JOIN public.user_profiles u ON s.user_id = u.id
    WHERE s.stream_id = p_stream_id
    AND s.status IN ('active', 'live', 'reserved', 'camera_starting');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO anon;
