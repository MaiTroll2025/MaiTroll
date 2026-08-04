-- Create broadcasts view for ExploreFeed compatibility
-- This view maps the streams table to the expected schema for the ExploreFeed component

-- Safely drop existing broadcasts object (whether table or view)
DO $$ 
BEGIN 
    -- Try dropping as view first
    BEGIN
        DROP VIEW IF EXISTS public.broadcasts CASCADE;
    EXCEPTION 
        WHEN wrong_object_type THEN NULL; -- Ignore if it's a table
    END;
    
    -- Try dropping as table
    BEGIN
        DROP TABLE IF EXISTS public.broadcasts CASCADE;
    EXCEPTION 
        WHEN wrong_object_type THEN NULL; -- Ignore if it's a view
    END;
END $$;

CREATE OR REPLACE VIEW public.broadcasts WITH (security_invoker = true) AS
SELECT
    s.id,
    s.broadcaster_id, -- Keep original name to preserve FK relationship detection
    s.title,
    s.category,
    s.current_viewers AS viewer_count,
    s.start_time AS started_at,
    s.thumbnail_url,
    s.is_live,
    s.created_at
FROM
    public.streams s;

-- Grant permissions
GRANT SELECT ON public.broadcasts TO anon, authenticated, service_role;
