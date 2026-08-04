-- Migration: Create atomic increment_stream_engagement RPC
-- Server-authoritative function for all engagement counter updates

CREATE OR REPLACE FUNCTION public.increment_stream_engagement(
    p_stream_type text,
    p_stream_id uuid,
    p_likes bigint DEFAULT 0,
    p_reactions bigint DEFAULT 0,
    p_messages bigint DEFAULT 0,
    p_gifts bigint DEFAULT 0,
    p_gift_coins bigint DEFAULT 0,
    p_user_id uuid DEFAULT NULL
)
RETURNS public.stream_engagement
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_stream_exists boolean;
    v_stream_status text;
    v_result public.stream_engagement;
BEGIN
    -- Require authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Validate stream_type
    IF p_stream_type NOT IN ('broadcast', 'hytrogame', 'podcast') THEN
        RAISE EXCEPTION 'Invalid stream_type: %. Must be broadcast, hytrogame, or podcast', p_stream_type;
    END IF;

    -- Validate stream_id
    IF p_stream_id IS NULL THEN
        RAISE EXCEPTION 'stream_id is required';
    END IF;

    -- Reject negative increments
    IF p_likes < 0 OR p_reactions < 0 OR p_messages < 0 OR p_gifts < 0 OR p_gift_coins < 0 THEN
        RAISE EXCEPTION 'Negative increments are not allowed';
    END IF;

    -- Reject absurd batch values (max 1000 per call)
    IF p_likes > 1000 OR p_reactions > 1000 OR p_messages > 1000 OR p_gifts > 1000 THEN
        RAISE EXCEPTION 'Batch value exceeds maximum of 1000 per call';
    END IF;

    -- Confirm the referenced live session exists and is not finalized
    SELECT status INTO v_stream_status
    FROM public.streams
    WHERE id = p_stream_id;

    v_stream_exists := FOUND;

    IF NOT v_stream_exists THEN
        RAISE EXCEPTION 'Stream not found: %', p_stream_id;
    END IF;

    IF v_stream_status = 'ended' THEN
        RAISE EXCEPTION 'Cannot add engagement to ended stream: %', p_stream_id;
    END IF;

    -- Insert or update the engagement summary row atomically
    INSERT INTO public.stream_engagement (
        stream_type, stream_id,
        total_likes, total_reactions, total_messages, total_gifts, total_gift_coins,
        last_like_at, last_reaction_at, last_message_at, last_gift_at, updated_at
    ) VALUES (
        p_stream_type, p_stream_id,
        p_likes, p_reactions, p_messages, p_gifts, p_gift_coins,
        CASE WHEN p_likes > 0 THEN now() ELSE NULL END,
        CASE WHEN p_reactions > 0 THEN now() ELSE NULL END,
        CASE WHEN p_messages > 0 THEN now() ELSE NULL END,
        CASE WHEN p_gifts > 0 THEN now() ELSE NULL END,
        now()
    )
    ON CONFLICT (stream_type, stream_id)
    DO UPDATE SET
        total_likes = public.stream_engagement.total_likes + EXCLUDED.total_likes,
        total_reactions = public.stream_engagement.total_reactions + EXCLUDED.total_reactions,
        total_messages = public.stream_engagement.total_messages + EXCLUDED.total_messages,
        total_gifts = public.stream_engagement.total_gifts + EXCLUDED.total_gifts,
        total_gift_coins = public.stream_engagement.total_gift_coins + EXCLUDED.total_gift_coins,
        last_like_at = CASE
            WHEN EXCLUDED.total_likes > 0 THEN now()
            ELSE public.stream_engagement.last_like_at
        END,
        last_reaction_at = CASE
            WHEN EXCLUDED.total_reactions > 0 THEN now()
            ELSE public.stream_engagement.last_reaction_at
        END,
        last_message_at = CASE
            WHEN EXCLUDED.total_messages > 0 THEN now()
            ELSE public.stream_engagement.last_message_at
        END,
        last_gift_at = CASE
            WHEN EXCLUDED.total_gifts > 0 THEN now()
            ELSE public.stream_engagement.last_gift_at
        END,
        updated_at = now()
    RETURNING * INTO v_result;

    -- Track unique user activity if user_id provided
    IF p_user_id IS NOT NULL AND (p_likes > 0 OR p_reactions > 0 OR p_messages > 0 OR p_gifts > 0) THEN
        INSERT INTO public.stream_engagement_users (
            stream_type, stream_id, user_id,
            has_liked, has_reacted, has_chatted, has_gifted,
            like_count, reaction_count, message_count, gift_count, gift_coins,
            last_activity_at
        ) VALUES (
            p_stream_type, p_stream_id, p_user_id,
            p_likes > 0, p_reactions > 0, p_messages > 0, p_gifts > 0,
            p_likes, p_reactions, p_messages, p_gifts, p_gift_coins,
            now()
        )
        ON CONFLICT (stream_type, stream_id, user_id)
        DO UPDATE SET
            has_liked = public.stream_engagement_users.has_liked OR EXCLUDED.has_liked,
            has_reacted = public.stream_engagement_users.has_reacted OR EXCLUDED.has_reacted,
            has_chatted = public.stream_engagement_users.has_chatted OR EXCLUDED.has_chatted,
            has_gifted = public.stream_engagement_users.has_gifted OR EXCLUDED.has_gifted,
            like_count = public.stream_engagement_users.like_count + EXCLUDED.like_count,
            reaction_count = public.stream_engagement_users.reaction_count + EXCLUDED.reaction_count,
            message_count = public.stream_engagement_users.message_count + EXCLUDED.message_count,
            gift_count = public.stream_engagement_users.gift_count + EXCLUDED.gift_count,
            gift_coins = public.stream_engagement_users.gift_coins + EXCLUDED.gift_coins,
            last_activity_at = now();

        -- Update unique counters on stream_engagement when a user performs their first action of a type
        UPDATE public.stream_engagement
        SET
            unique_likers = (SELECT COUNT(*) FROM public.stream_engagement_users WHERE stream_type = p_stream_type AND stream_id = p_stream_id AND has_liked = true),
            unique_reactors = (SELECT COUNT(*) FROM public.stream_engagement_users WHERE stream_type = p_stream_type AND stream_id = p_stream_id AND has_reacted = true),
            unique_chatters = (SELECT COUNT(*) FROM public.stream_engagement_users WHERE stream_type = p_stream_type AND stream_id = p_stream_id AND has_chatted = true),
            unique_gifters = (SELECT COUNT(*) FROM public.stream_engagement_users WHERE stream_type = p_stream_type AND stream_id = p_stream_id AND has_gifted = true)
        WHERE stream_type = p_stream_type AND stream_id = p_stream_id;
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_stream_engagement TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_stream_engagement TO anon;

ALTER FUNCTION public.increment_stream_engagement OWNER TO postgres;