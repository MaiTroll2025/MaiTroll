-- Fix events table: change start_time and end_time from TIME WITH TIME ZONE to TIMESTAMP WITH TIME ZONE
-- This resolves PostgreSQL error 42883: "operator does not exist: time with time zone <= timestamp with time zone"
-- which occurs when queries compare these columns against timestamp values.

ALTER TABLE public.events
  ALTER COLUMN start_time TYPE TIMESTAMP WITH TIME ZONE USING (event_date + start_time),
  ALTER COLUMN end_time TYPE TIMESTAMP WITH TIME ZONE USING (event_date + end_time);

-- Update create_event function parameters to match
CREATE OR REPLACE FUNCTION public.create_event(
  p_title TEXT,
  p_description TEXT,
  p_category_slug TEXT,
  p_event_date DATE,
  p_creator_id UUID,
  p_creator_username TEXT,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_timezone TEXT DEFAULT 'UTC',
  p_banner_image_url TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_event_color TEXT DEFAULT '#8B5CF6',
  p_max_participants INTEGER DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_access_level TEXT DEFAULT 'everyone',
  p_min_level INTEGER DEFAULT 1,
  p_requirements TEXT[] DEFAULT '{}',
  p_rules TEXT DEFAULT NULL,
  p_location_type TEXT DEFAULT 'virtual',
  p_location_details TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_category_id UUID;
BEGIN
  SELECT id INTO v_category_id FROM public.event_categories WHERE slug = p_category_slug AND is_active = true;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.event_categories WHERE slug = 'custom_event';
  END IF;

  INSERT INTO public.events (
    title, description, category_id, category_slug,
    event_date, start_time, end_time, timezone,
    banner_image_url, thumbnail_url, event_color,
    creator_id, creator_username,
    max_participants, visibility, access_level, min_level,
    requirements, rules, location_type, location_details,
    tags, metadata
  ) VALUES (
    p_title, p_description, v_category_id, p_category_slug,
    p_event_date, p_start_time, p_end_time, p_timezone,
    p_banner_image_url, p_thumbnail_url, p_event_color,
    p_creator_id, p_creator_username,
    p_max_participants, p_visibility, p_access_level, p_min_level,
    p_requirements, p_rules, p_location_type, p_location_details,
    p_tags, p_metadata
  ) RETURNING id INTO v_event_id;

  RETURN json_build_object('success', true, 'event_id', v_event_id);
END;
$$;

-- Update GRANT to match new signature
GRANT ALL ON FUNCTION public.create_event(
  TEXT, TEXT, TEXT, DATE, UUID, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER,
  TEXT[], TEXT, TEXT, TEXT, TEXT[], JSONB
) TO authenticated;
