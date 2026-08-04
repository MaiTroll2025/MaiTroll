-- ============================================================================
-- Migration: Add free kick RPC
-- kick_user_paid requires 100 coins. This new function provides the same
-- behavior (ban + remove from viewers + mark participant removed) but
-- without any coin cost, so regular users can kick for free.
-- ============================================================================

CREATE OR REPLACE FUNCTION kick_user_free(p_stream_id UUID, p_target_user_id UUID, p_kicker_id UUID, p_duration_minutes INTEGER DEFAULT 1440)
RETURNS JSONB AS $$
BEGIN
    -- Add to kick/ban list (default 24 hours, caller can override)
    INSERT INTO stream_bans (stream_id, user_id, banned_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, p_kicker_id, 'Kicked', NOW() + (p_duration_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (stream_id, user_id)
    DO UPDATE SET expires_at = NOW() + (p_duration_minutes || ' minutes')::INTERVAL, banned_by = p_kicker_id;

    -- Remove from viewers
    DELETE FROM stream_viewers WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    -- Mark participant as removed with reason for client-side redirect
    UPDATE stream_participants
    SET removed = true,
        removed_reason = 'Kicked by broadcaster',
        removed_at = NOW()
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

GRANT EXECUTE ON FUNCTION kick_user_free(UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION kick_user_free(UUID, UUID, UUID, INTEGER) TO anon;
