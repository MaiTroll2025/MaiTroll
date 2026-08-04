
-- Migration: Fix Seat Visibility and Viewer Count RPCs
-- Description: 
-- 1. Updates get_stream_seats to handle missing user profiles (Guest/Admin issues) and ensure visibility.
-- 2. Updates update_stream_viewer_count to ensure hosts can update their viewer count.

-- 1. FIX: get_stream_seats
-- Problem: If a user (like Admin acting as Guest) has no profile or a partial profile, LEFT JOIN might return NULLs.
-- If the UI expects non-null username, the seat appears empty.
-- Solution: Use COALESCE to provide fallbacks.

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
        COALESCE(u.username, 'Guest') as username,
        COALESCE(u.avatar_url, 'https://ui-avatars.com/api/?name=Guest&background=random') as avatar_url,
        COALESCE(u.is_gold, false) as is_gold,
        COALESCE(u.role, 'user') as role,
        COALESCE(u.troll_coins, 0) as troll_coins,
        u.rgb_username_expires_at,
        u.glowing_username_color,
        u.troll_role
    FROM public.stream_seat_sessions s
    LEFT JOIN public.user_profiles u ON s.user_id = u.id
    WHERE s.stream_id = p_stream_id
    AND s.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO anon;


-- 2. FIX: update_stream_viewer_count
-- Problem: Strict role checks might fail if the host's session is slightly out of sync or if roles changed.
-- Solution: Simplify the check to "Is Host OR Is Admin/Officer".

CREATE OR REPLACE FUNCTION public.update_stream_viewer_count(p_stream_id UUID, p_count INTEGER)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  -- Check if user is the Broadcaster (Host)
  -- OR if user is Admin/Officer (via simple role check)
  IF EXISTS (
      SELECT 1 FROM public.streams 
      WHERE id = p_stream_id 
      AND (user_id = v_uid OR broadcaster_id = v_uid)
  ) OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = v_uid 
      AND (
          role IN ('admin', 'troll_officer', 'lead_troll_officer')
          OR is_troll_officer = true
          OR is_admin = true
      )
  ) THEN
    UPDATE public.streams 
    SET current_viewers = p_count 
    WHERE id = p_stream_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_stream_viewer_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stream_viewer_count(UUID, INTEGER) TO anon;

-- 3. Cleanup "Stale" Sessions (Optional but helpful)
-- If a session is active but the user is not in the room, it blocks the seat.
-- We can't easily detect "not in room" from here without Presence, but we can ensure
-- that if a user tries to join and finds a "ghost" session of THEMSELVES, it gets cleared.
-- This logic belongs in join_seat_atomic, but we can't easily patch it here without the full code.
-- Instead, we rely on the Host now being able to SEE the ghost seat (via fix #1) and KICK them.

