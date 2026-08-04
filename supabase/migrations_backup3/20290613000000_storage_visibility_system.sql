-- Storage Visibility System Migration
-- Saves streams to Supabase only, removes Cloudflare R2/Stream dependencies
-- Adds storage tracking with real-time visibility for broadcasters and content owners

-- 1. Add storage_category column to saved_streams
ALTER TABLE public.saved_streams 
ADD COLUMN IF NOT EXISTS storage_category TEXT DEFAULT 'broadcast_recording',
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS recording_duration INTEGER DEFAULT 0;

-- Storage categories: 'broadcast_recording' | 'gaming_recording' | 'troll_wall_media' | 'profile_media' | 'stream_thumbnail' | 'hytro_game_file' | 'hytro_screenshot' | 'hytro_video' | 'other'

-- 2. Add file_size and duration tracking to broadcast_replays (for metadata)
ALTER TABLE public.broadcast_replays
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;

-- 3. Create user_storage_usage table for tracking aggregate storage per user
CREATE TABLE IF NOT EXISTS public.user_storage_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    broadcast_recordings_bytes BIGINT NOT NULL DEFAULT 0,
    gaming_files_bytes BIGINT NOT NULL DEFAULT 0,
    screenshots_bytes BIGINT NOT NULL DEFAULT 0,
    videos_bytes BIGINT NOT NULL DEFAULT 0,
    wall_media_bytes BIGINT NOT NULL DEFAULT 0,
    profile_media_bytes BIGINT NOT NULL DEFAULT 0,
    thumbnails_bytes BIGINT NOT NULL DEFAULT 0,
    other_bytes BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_storage_usage_user_id ON public.user_storage_usage(user_id);

-- RLS: Users can view their own storage usage
ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own storage usage" ON public.user_storage_usage
    FOR SELECT USING (auth.uid() = user_id);

-- 4. Drop Cloudflare columns from streams (no longer needed)
-- These columns store Cloudflare Stream references that we're removing
ALTER TABLE public.streams
DROP COLUMN IF EXISTS cloudflare_recording_id,
DROP COLUMN IF EXISTS cloudflare_playback_url;

-- 5. Drop Cloudflare R2 key column from broadcast_replays if it exists
ALTER TABLE public.broadcast_replays
DROP COLUMN IF EXISTS cloudflare_r2_key;

-- 6. Create function to calculate next tier and fee based on usage
CREATE OR REPLACE FUNCTION public.get_storage_tier(p_total_bytes BIGINT)
RETURNS TABLE (
    tier_start BIGINT,
    tier_end BIGINT,
    monthly_fee INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_total_bytes < 10737418240 THEN 0 -- 0-10GB
            WHEN p_total_bytes < 26843545600 THEN 10737418240 -- 10-25GB
            WHEN p_total_bytes < 53687091200 THEN 26843545600 -- 25-50GB
            WHEN p_total_bytes < 107374182400 THEN 53687091200 -- 50-100GB
            ELSE 107374182400 -- 100GB+
        END as tier_start,
        CASE
            WHEN p_total_bytes < 10737418240 THEN 10737418240
            WHEN p_total_bytes < 26843545600 THEN 26843545600
            WHEN p_total_bytes < 53687091200 THEN 53687091200
            WHEN p_total_bytes < 107374182400 THEN 107374182400
            ELSE NULL -- no upper limit after 100GB
        END as tier_end,
        CASE
            WHEN p_total_bytes < 10737418240 THEN 50 -- 50 coins for 0-10GB
            WHEN p_total_bytes < 26843545600 THEN 100 -- 100 coins for 10-25GB
            WHEN p_total_bytes < 53687091200 THEN 250 -- 250 coins for 25-50GB
            WHEN p_total_bytes < 107374182400 THEN 500 -- 500 coins for 50-100GB
            ELSE 1000 -- 1000 coins for 100GB+
        END as monthly_fee;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to calculate tier percentage
CREATE OR REPLACE FUNCTION public.get_storage_percentage(p_total_bytes BIGINT)
RETURNS NUMERIC AS $$
DECLARE
    tier_start BIGINT;
    tier_end BIGINT;
    percentage NUMERIC;
BEGIN
    SELECT tier_start, tier_end INTO tier_start, tier_end
    FROM public.get_storage_tier(p_total_bytes);
    
    IF tier_end IS NULL THEN
        RETURN 100; -- At or above max tier
    END IF;
    
    percentage := ROUND(((p_total_bytes - tier_start)::NUMERIC / (tier_end - tier_start)::NUMERIC * 100), 1);
    RETURN GREATEST(0, LEAST(99, percentage));
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to get storage breakdown for a user
CREATE OR REPLACE FUNCTION public.get_user_storage_breakdown(p_user_id UUID)
RETURNS TABLE (
    category TEXT,
    bytes BIGINT
) AS $$
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
$$ LANGUAGE plpgsql;

-- 9. Update auto-save trigger to use Supabase storage categories
DROP TRIGGER IF EXISTS trigger_auto_save_stream_on_end ON public.streams;
CREATE TRIGGER trigger_auto_save_stream_on_end
    AFTER UPDATE ON public.streams
    FOR EACH ROW
    WHEN (OLD.status != 'ended' AND NEW.status = 'ended')
    EXECUTE FUNCTION public.auto_save_stream_on_end();

-- 10. Add trigger to recalculate storage usage when saved_streams changes
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
    -- Calculate totals from saved_streams
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
    
    -- Upsert user_storage_usage
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

-- 11. Update the auto_save_stream_on_end function to set proper category
CREATE OR REPLACE FUNCTION public.auto_save_stream_on_end()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Only trigger on status change to 'ended'
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        -- Get broadcaster user_id
        v_user_id := NEW.broadcaster_id;
        
        -- Auto-save for broadcaster (category determined by stream category)
        INSERT INTO public.saved_streams (user_id, stream_id, source, storage_category)
        VALUES (v_user_id, NEW.id, 'auto_stream_end', 
            CASE 
                WHEN NEW.category = 'gaming' THEN 'gaming_recording'
                ELSE 'broadcast_recording'
            END)
        ON CONFLICT (user_id, stream_id) DO NOTHING;
        
        -- Also auto-save for participants who were in the stream
        INSERT INTO public.saved_streams (user_id, stream_id, source, storage_category)
        SELECT DISTINCT
            ss.user_id,
            NEW.id,
            'auto_stream_end',
            CASE 
                WHEN NEW.category = 'gaming' THEN 'gaming_recording'
                ELSE 'broadcast_recording'
            END
        FROM public.stream_seat_sessions ss
        WHERE ss.stream_id = NEW.id
          AND ss.user_id IS NOT NULL
          AND ss.joined_at IS NOT NULL
        ON CONFLICT (user_id, stream_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;