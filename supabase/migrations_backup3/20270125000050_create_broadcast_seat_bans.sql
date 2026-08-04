-- Create broadcast_seat_bans table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.broadcast_seat_bans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    banned_by UUID REFERENCES user_profiles(id),
    banned_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

ALTER TABLE public.broadcast_seat_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read seat bans" ON public.broadcast_seat_bans;
CREATE POLICY "Everyone can read seat bans" ON public.broadcast_seat_bans
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Officers and Admins can manage seat bans" ON public.broadcast_seat_bans;
CREATE POLICY "Officers and Admins can manage seat bans" ON public.broadcast_seat_bans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = COALESCE(
                (SELECT banned_by FROM public.broadcast_seat_bans WHERE id = current_setting('app.current_user_id')::uuid),
                current_setting('app.current_user_id')::uuid
            )
            AND (role IN ('admin', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                 OR is_admin = true
                 OR is_troll_officer = true
                 OR is_lead_officer = true)
        )
    );

-- Create kick_participant_atomic function for stream seats
-- This function kicks a participant from a stream seat and optionally bans them
CREATE OR REPLACE FUNCTION public.kick_participant_atomic(
    p_stream_id UUID,
    p_target_user_id UUID,
    p_reason TEXT DEFAULT 'Kicked by host'
)
RETURNS TABLE (success BOOLEAN, message TEXT, is_kicked BOOLEAN, banned BOOLEAN) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_active_session RECORD;
    v_banned BOOLEAN := false;
BEGIN
    -- Check if caller has permission
    v_role := public.get_staff_role(auth.uid());
    
    IF v_role NOT IN ('admin', 'lead_troll_officer', 'troll_officer') THEN
        -- Also allow stream owner to kick
        IF NOT EXISTS (
            SELECT 1 FROM streams 
            WHERE id = p_stream_id 
            AND user_id = auth.uid()
        ) THEN
            RETURN QUERY SELECT false, 'Not authorized to kick participants', false, false;
            RETURN;
        END IF;
    END IF;

    -- Find active seat session for the target user
    SELECT * INTO v_active_session
    FROM stream_seat_sessions
    WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id
    AND status = 'active'
    LIMIT 1;

    IF FOUND THEN
        -- Mark the session as kicked
        UPDATE stream_seat_sessions
        SET status = 'kicked',
            kick_reason = p_reason,
            left_at = NOW()
        WHERE id = v_active_session.id;

        -- Log the kick
        INSERT INTO stream_kicks (stream_id, user_id, kicked_by, reason)
        VALUES (p_stream_id, p_target_user_id, auth.uid(), p_reason);

        -- Add to broadcast_seat_bans for 24 hours to prevent immediate re-entry
        -- This affects the room-based seat system (broadcast_seats table)
        INSERT INTO broadcast_seat_bans (room, user_id, banned_by, banned_until, reason)
        SELECT 
            'officer-stream',  -- Default room name
            p_target_user_id,
            auth.uid(),
            NOW() + INTERVAL '24 hours',
            p_reason
        WHERE NOT EXISTS (
            SELECT 1 FROM broadcast_seat_bans 
            WHERE room = 'officer-stream' 
            AND user_id = p_target_user_id
            AND banned_until > NOW()
        );

        v_banned := true;

        RETURN QUERY SELECT true, 'User kicked from stream seat', true, v_banned;
    ELSE
        -- No active session found, but still log the kick attempt for record
        INSERT INTO stream_kicks (stream_id, user_id, kicked_by, reason)
        VALUES (p_stream_id, p_target_user_id, auth.uid(), p_reason);

        -- Add ban anyway to prevent joining
        INSERT INTO broadcast_seat_bans (room, user_id, banned_by, banned_until, reason)
        VALUES (
            'officer-stream',
            p_target_user_id,
            auth.uid(),
            NOW() + INTERVAL '24 hours',
            p_reason
        );

        v_banned := true;

        RETURN QUERY SELECT true, 'User kicked (no active seat session)', false, v_banned;
    END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.kick_participant_atomic(UUID, UUID, TEXT) TO authenticated;
