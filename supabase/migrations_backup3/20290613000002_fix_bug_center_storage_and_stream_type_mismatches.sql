CREATE OR REPLACE FUNCTION public.get_user_storage_breakdown(p_user_id UUID)
RETURNS TABLE (
    category TEXT,
    bytes BIGINT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 'Broadcast Recordings'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category = 'broadcast_recording' THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id

    UNION ALL

    SELECT 'Hytro Games Files'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category IN ('hytro_game_file', 'gaming_recording') THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id

    UNION ALL

    SELECT 'Screenshots'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category = 'hytro_screenshot' THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id

    UNION ALL

    SELECT 'Videos'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category = 'hytro_video' THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id

    UNION ALL

    SELECT 'Troll Wall Media'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category = 'troll_wall_media' THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id

    UNION ALL

    SELECT 'Profile Media'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category = 'profile_media' THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id

    UNION ALL

    SELECT 'Stream Thumbnails'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category = 'stream_thumbnail' THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id

    UNION ALL

    SELECT 'Other'::TEXT, COALESCE(SUM(CASE WHEN ss.storage_category = 'other' THEN ss.file_size_bytes ELSE 0 END), 0)::BIGINT
    FROM public.saved_streams ss
    WHERE ss.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_storage_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_total BIGINT;
    v_broadcast BIGINT;
    v_gaming_files BIGINT;
    v_screenshots BIGINT;
    v_videos BIGINT;
    v_wall_media BIGINT;
    v_profile_media BIGINT;
    v_thumbnails BIGINT;
    v_other BIGINT;
BEGIN
    SELECT
        COALESCE(SUM(file_size_bytes), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category = 'broadcast_recording' THEN file_size_bytes ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category IN ('hytro_game_file', 'gaming_recording') THEN file_size_bytes ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category = 'hytro_screenshot' THEN file_size_bytes ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category = 'hytro_video' THEN file_size_bytes ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category = 'troll_wall_media' THEN file_size_bytes ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category = 'profile_media' THEN file_size_bytes ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category = 'stream_thumbnail' THEN file_size_bytes ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN storage_category = 'other' THEN file_size_bytes ELSE 0 END), 0)::BIGINT
    INTO
        v_total, v_broadcast, v_gaming_files, v_screenshots, v_videos,
        v_wall_media, v_profile_media, v_thumbnails, v_other
    FROM public.saved_streams
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);

    INSERT INTO public.user_storage_usage (
        user_id, total_bytes, broadcast_recordings_bytes, gaming_files_bytes,
        screenshots_bytes, videos_bytes, wall_media_bytes, profile_media_bytes,
        thumbnails_bytes, other_bytes
    ) VALUES (
        COALESCE(NEW.user_id, OLD.user_id),
        v_total, v_broadcast, v_gaming_files, v_screenshots, v_videos,
        v_wall_media, v_profile_media, v_thumbnails, v_other
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_bytes = v_total,
        broadcast_recordings_bytes = v_broadcast,
        gaming_files_bytes = v_gaming_files,
        screenshots_bytes = v_screenshots,
        videos_bytes = v_videos,
        wall_media_bytes = v_wall_media,
        profile_media_bytes = v_profile_media,
        thumbnails_bytes = v_thumbnails,
        other_bytes = v_other,
        last_updated = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_user_storage_usage ON public.saved_streams;
CREATE TRIGGER trg_update_user_storage_usage
    AFTER INSERT OR UPDATE OR DELETE ON public.saved_streams
    FOR EACH ROW EXECUTE FUNCTION public.update_user_storage_usage();

CREATE OR REPLACE FUNCTION public.get_active_streams_v2(
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_sort_by TEXT DEFAULT 'visibility'
)
RETURNS TABLE (
    id UUID,
    broadcaster_id UUID,
    title TEXT,
    category TEXT,
    current_viewers INTEGER,
    start_time TIMESTAMPTZ,
    thumbnail_url TEXT,
    broadcaster_username TEXT,
    broadcaster_avatar TEXT,
    broadcaster_dob TEXT,
    visibility_score NUMERIC,
    hot_score NUMERIC,
    is_rising BOOLEAN,
    is_trending BOOLEAN,
    momentum_level NUMERIC,
    stream_momentum JSONB
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.broadcaster_id,
        s.title,
        s.category,
        s.current_viewers,
        s.start_time,
        s.thumbnail_url,
        u.username,
        u.avatar_url,
        u.date_of_birth::TEXT,
        COALESCE(vs.final_visibility_score, 0),
        COALESCE(vs.hot_score, 0),
        COALESCE(vs.is_rising, false),
        COALESCE(vs.is_trending, false),
        COALESCE(mt.momentum_level, 0),
        jsonb_build_object(
            'momentum', COALESCE(mt.momentum_level, 0),
            'is_boosted', COALESCE(mt.is_boosted, false),
            'velocity_trend', COALESCE(mt.velocity_trend, 'stable'),
            'viewers_2min', COALESCE(mt.viewers_2min, 0),
            'chat_2min', COALESCE(mt.chat_2min, 0)
        )
    FROM streams s
    JOIN user_profiles u ON s.broadcaster_id = u.id
    LEFT JOIN visibility_scores vs ON s.id = vs.content_id AND vs.content_type = 'stream'
    LEFT JOIN momentum_tracking mt ON s.id = mt.content_id AND mt.content_type = 'stream'
    WHERE s.is_live = true
    ORDER BY
        CASE p_sort_by
            WHEN 'visibility' THEN COALESCE(vs.final_visibility_score, 0)
            WHEN 'hot' THEN COALESCE(vs.hot_score, 0)
            WHEN 'rising' THEN CASE WHEN vs.is_rising = true THEN COALESCE(mt.momentum_level, 0) ELSE 0 END
            WHEN 'viewers' THEN s.current_viewers
            ELSE COALESCE(vs.final_visibility_score, 0)
        END DESC,
        s.start_time DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
