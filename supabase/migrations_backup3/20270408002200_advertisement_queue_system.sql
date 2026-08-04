-- Advertisement Queue System Update
-- Add queue positions, slot tracking, and rotation logic

ALTER TABLE public.user_advertisements 
ADD COLUMN IF NOT EXISTS queue_position INTEGER,
ADD COLUMN IF NOT EXISTS is_active_slot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS slot_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS display_duration_seconds INTEGER DEFAULT 604800; -- 7 days per ad slot

-- Update status options
ALTER TABLE public.user_advertisements 
DROP CONSTRAINT IF EXISTS user_advertisements_status_check;

ALTER TABLE public.user_advertisements
ADD CONSTRAINT user_advertisements_status_check 
CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'queued', 'active'));

-- Function to manage ad queue rotation
-- p_force: if true, rotate even if current ad hasn't reached 7 days
CREATE OR REPLACE FUNCTION public.rotate_ad_queue(p_force BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_ad UUID;
    v_current_active UUID;
    v_current_slot_start TIMESTAMP WITH TIME ZONE;
    v_rotation_count INT := 0;
    v_should_rotate BOOLEAN := false;
BEGIN
    -- Check for active ads
    SELECT id, slot_start_time INTO v_current_active, v_current_slot_start
    FROM public.user_advertisements
    WHERE status = 'active'
    ORDER BY slot_start_time ASC
    LIMIT 1;

    -- Determine if we should rotate
    IF p_force THEN
        v_should_rotate := TRUE;
    ELSIF v_current_active IS NULL THEN
        v_should_rotate := TRUE;
    ELSIF v_current_slot_start < (NOW() - INTERVAL '7 days') THEN
        v_should_rotate := TRUE;
    END IF;

    IF v_should_rotate THEN
        -- Mark current active ad as queued (if any)
        IF v_current_active IS NOT NULL THEN
            UPDATE public.user_advertisements
            SET status = 'queued', is_active_slot = false
            WHERE id = v_current_active;

            v_rotation_count := v_rotation_count + 1;
        END IF;

        -- Get next ad in queue
        SELECT id INTO v_next_ad
        FROM public.user_advertisements
        WHERE status = 'queued'
        ORDER BY queue_position ASC NULLS LAST, approved_at ASC
        LIMIT 1;

        IF v_next_ad IS NOT NULL THEN
            -- Activate next ad
            UPDATE public.user_advertisements
            SET 
                status = 'active', 
                is_active_slot = true,
                slot_start_time = NOW()
            WHERE id = v_next_ad;

            v_rotation_count := v_rotation_count + 1;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'rotations_performed', v_rotation_count,
        'current_active_ad', v_current_active,
        'next_active_ad', v_next_ad
    );
END;
$$;

-- Function to add approved ad to queue and activate immediately
-- When approving, move current active ad to queued first, then activate the new one
CREATE OR REPLACE FUNCTION public.add_ad_to_queue(p_ad_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_position INTEGER;
    v_current_active UUID;
BEGIN
    -- Move current active ad to queued (if any)
    UPDATE public.user_advertisements
    SET 
        status = 'queued',
        is_active_slot = false
    WHERE status = 'active';

    -- Get max queue position for the new ad
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_position
    FROM public.user_advertisements
    WHERE status IN ('queued', 'active');

    -- Activate the new ad
    UPDATE public.user_advertisements
    SET 
        status = 'active',
        queue_position = v_position,
        is_active_slot = true,
        slot_start_time = NOW()
    WHERE id = p_ad_id;

    RETURN jsonb_build_object('success', true, 'queue_position', v_position);
END;
$$;

-- Function to increment user ad impressions
CREATE OR REPLACE FUNCTION public.increment_user_ad_impressions(ad_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_advertisements
    SET impressions_count = impressions_count + 1
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment user ad clicks
CREATE OR REPLACE FUNCTION public.increment_user_ad_clicks(ad_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_advertisements
    SET clicks_count = clicks_count + 1
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rotate_ad_queue() TO service_role;
GRANT EXECUTE ON FUNCTION public.add_ad_to_queue(UUID) TO authenticated;
