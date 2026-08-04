
-- RPC: Get Stream Seats (Security Definer)
-- Bypasses RLS to ensure all users (especially the broadcaster) can see who is on stage.

CREATE OR REPLACE FUNCTION public.get_stream_seats(p_stream_id UUID)
RETURNS TABLE (
    id UUID,
    seat_index INTEGER,
    user_id UUID,
    status TEXT,
    joined_at TIMESTAMPTZ,
    username TEXT,
    avatar_url TEXT,
    is_gold BOOLEAN,
    role TEXT,
    troll_coins INTEGER,
    rgb_username_expires_at TIMESTAMPTZ,
    glowing_username_color TEXT,
    troll_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.seat_index,
        s.user_id,
        s.status,
        s.joined_at,
        u.username,
        u.avatar_url,
        u.is_gold,
        u.role,
        u.troll_coins,
        u.rgb_username_expires_at,
        u.glowing_username_color,
        u.troll_role
    FROM public.stream_seat_sessions s
    LEFT JOIN public.user_profiles u ON s.user_id = u.id
    WHERE s.stream_id = p_stream_id
    AND s.status = 'active';
END;
$$;
