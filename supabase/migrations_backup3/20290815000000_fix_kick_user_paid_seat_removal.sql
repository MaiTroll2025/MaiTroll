-- ============================================================================
-- Migration: Fix kick_user_paid to also remove user from stream seat
-- kick_user_paid was only banning the user and marking stream_participants
-- as removed, but it did NOT update stream_seat_sessions status to 'kicked'.
-- This caused the broadcast page to keep showing the seat box with the
-- user's UUID after a paid kick, because useStreamSeats only filters out
-- seats with status IN ('active', 'live', 'reserved', 'camera_starting').
-- ============================================================================

CREATE OR REPLACE FUNCTION kick_user_paid(p_stream_id UUID, p_target_user_id UUID, p_kicker_id UUID, p_duration_minutes INTEGER DEFAULT 1440)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER := 100;
    v_balance INTEGER;
BEGIN
    -- Check balance
    SELECT coins INTO v_balance FROM user_profiles WHERE id = p_kicker_id;

    IF v_balance IS NULL OR v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds (100 coins required)');
    END IF;

    -- Deduct coins
    UPDATE user_profiles SET coins = coins - v_cost WHERE id = p_kicker_id;

    -- Add to kick/ban list (default 24 hours, caller can override)
    INSERT INTO stream_bans (stream_id, user_id, banned_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, p_kicker_id, 'Paid Kick', NOW() + (p_duration_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (stream_id, user_id)
    DO UPDATE SET expires_at = NOW() + (p_duration_minutes || ' minutes')::INTERVAL, banned_by = p_kicker_id;

    -- Remove from viewers
    DELETE FROM stream_viewers WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    -- Mark participant as removed with reason for client-side redirect
    UPDATE stream_participants
    SET removed = true,
        removed_reason = 'Kicked by broadcaster'
    WHERE stream_id = p_stream_id
      AND user_id = p_target_user_id;

    -- Remove from stage seat so the broadcast page clears the seat box
    UPDATE stream_seat_sessions
    SET status = 'kicked',
        left_at = NOW(),
        updated_at = NOW()
    WHERE stream_id = p_stream_id
      AND user_id = p_target_user_id
      AND status IN ('active', 'live', 'reserved', 'camera_starting');

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
