-- Invite followers/following to broadcast
-- Sends a notification to all users who follow the broadcaster AND all users the broadcaster follows

CREATE OR REPLACE FUNCTION public.invite_followers_to_broadcast(
    p_stream_id UUID,
    p_inviter_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stream public.streams%ROWTYPE;
    v_inviter_username TEXT;
    v_inviter_display_name TEXT;
    v_invitee_ids UUID[];
    v_invitee_count INTEGER := 0;
    v_notification_id UUID;
    v_created_at TIMESTAMPTZ := NOW();
BEGIN
    -- Get stream info
    SELECT * INTO v_stream
    FROM public.streams
    WHERE id = p_stream_id;

    IF v_stream.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
    END IF;

    -- Verify inviter is the host
    IF v_stream.user_id != p_inviter_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only host can invite');
    END IF;

    -- Get inviter display name
    SELECT username, display_name
    INTO v_inviter_username, v_inviter_display_name
    FROM public.user_profiles
    WHERE id = p_inviter_id;

    -- Get all invitees: followers AND following
    SELECT ARRAY(
        SELECT DISTINCT uf.following_id
        FROM public.user_follows uf
        WHERE uf.follower_id = p_inviter_id
        
        UNION
        
        SELECT DISTINCT uf.follower_id
        FROM public.user_follows uf
        WHERE uf.following_id = p_inviter_id
    ) INTO v_invitee_ids;

    -- Filter out the inviter themselves and users already in the stream
    v_invitee_ids := ARRAY(
        SELECT UNNEST(v_invitee_ids) EXCEPT
        SELECT user_id FROM public.streams WHERE id = p_stream_id
    );

    v_invitee_count := array_length(v_invitee_ids, 1);

    IF v_invitee_count = 0 THEN
        RETURN jsonb_build_object('success', true, 'invited_count', 0, 'message', 'No followers/following to invite');
    END IF;

    -- Create notification for each invitee
    FOR i IN 1..array_length(v_invitee_ids, 1) LOOP
        INSERT INTO public.notifications (
            user_id,
            message,
            type,
            metadata
        ) VALUES (
            v_invitee_ids[i],
            v_inviter_username || ' invited you to their broadcast: ' || COALESCE(v_stream.title, 'Live Stream') || ' → Join now',
            'broadcast_invite',
            jsonb_build_object(
                'stream_id', p_stream_id::TEXT,
                'inviter_id', p_inviter_id::TEXT,
                'inviter_username', v_inviter_username,
                'stream_title', v_stream.title,
                'stream_category', v_stream.category
            )
        );
    END LOOP;

    -- Log the invite action in stream_messages
    INSERT INTO public.stream_messages (
        stream_id,
        user_id,
        content,
        type
    ) VALUES (
        p_stream_id,
        p_inviter_id,
        'INVITE_EVENT:' || v_invitee_count || ' followers/following invited',
        'system'
    );

    RETURN jsonb_build_object(
        'success', true,
        'invited_count', v_invitee_count,
        'message', 'Invited ' || v_invitee_count || ' followers and following'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_followers_to_broadcast(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_followers_to_broadcast(UUID, UUID) TO service_role;