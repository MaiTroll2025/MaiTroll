-- Create first-party anonymous site-usage analytics and admin-only aggregates.
CREATE TABLE IF NOT EXISTS public.site_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'search_query')),
  session_id UUID NOT NULL,
  page_path TEXT NOT NULL CHECK (char_length(page_path) BETWEEN 1 AND 500 AND left(page_path, 1) = '/'),
  referrer_host TEXT CHECK (referrer_host IS NULL OR char_length(referrer_host) <= 255),
  campaign_source TEXT CHECK (campaign_source IS NULL OR char_length(campaign_source) <= 100),
  campaign_medium TEXT CHECK (campaign_medium IS NULL OR char_length(campaign_medium) <= 100),
  campaign_name TEXT CHECK (campaign_name IS NULL OR char_length(campaign_name) <= 100),
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  bandwidth_bytes BIGINT NOT NULL DEFAULT 0 CHECK (bandwidth_bytes BETWEEN 0 AND 1073741824),
  search_term TEXT CHECK (
    (event_type = 'page_view' AND search_term IS NULL)
    OR (
      event_type = 'search_query'
      AND search_term IS NOT NULL
      AND search_term IN ('maitroll', '#maitroll')
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_analytics_events_created_at
  ON public.site_analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_events_session_created
  ON public.site_analytics_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_events_page_created
  ON public.site_analytics_events (page_path, created_at DESC)
  WHERE event_type = 'page_view';

ALTER TABLE public.site_analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous site analytics inserts" ON public.site_analytics_events;
CREATE POLICY "Allow anonymous site analytics inserts"
  ON public.site_analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read site analytics" ON public.site_analytics_events;
CREATE POLICY "Admins can read site analytics"
  ON public.site_analytics_events
  FOR SELECT TO authenticated
  USING (public.can_access_rtc_admin_monitor(auth.uid()));

GRANT INSERT ON public.site_analytics_events TO anon, authenticated;
GRANT SELECT ON public.site_analytics_events TO authenticated;

CREATE OR REPLACE FUNCTION public.get_site_usage_analytics(p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_rtc_admin_monitor(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to view site analytics'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'pageViews', COUNT(*) FILTER (WHERE event_type = 'page_view'),
    'uniqueSessions', COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'page_view'),
    'bandwidthBytes', COALESCE(SUM(bandwidth_bytes) FILTER (WHERE event_type = 'page_view'), 0),
    'maitrollSearches', COUNT(*) FILTER (WHERE event_type = 'search_query' AND search_term = 'maitroll'),
    'hashtagSearches', COUNT(*) FILTER (WHERE event_type = 'search_query' AND search_term = '#maitroll'),
    'topPages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('path', page_path, 'views', page_views))
      FROM (
        SELECT page_path, COUNT(*) AS page_views
        FROM public.site_analytics_events
        WHERE event_type = 'page_view' AND created_at >= p_since
        GROUP BY page_path
        ORDER BY page_views DESC
        LIMIT 8
      ) pages
    ), '[]'::JSONB),
    'topSources', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('source', source, 'visits', visits))
      FROM (
        SELECT COALESCE(
                 NULLIF(concat_ws(' / ', NULLIF(campaign_source, ''), NULLIF(campaign_medium, ''), NULLIF(campaign_name, '')), ''),
                 NULLIF(referrer_host, ''),
                 'Direct'
               ) AS source,
               COUNT(DISTINCT session_id) AS visits
        FROM public.site_analytics_events
        WHERE event_type = 'page_view' AND created_at >= p_since
        GROUP BY 1
        ORDER BY visits DESC
        LIMIT 8
      ) sources
    ), '[]'::JSONB),
    'deviceBreakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('device', device_type, 'visits', visits))
      FROM (
        SELECT device_type, COUNT(*) AS visits
        FROM public.site_analytics_events
        WHERE event_type = 'page_view' AND created_at >= p_since
        GROUP BY device_type
        ORDER BY visits DESC
      ) devices
    ), '[]'::JSONB)
  )
  INTO v_result
  FROM public.site_analytics_events
  WHERE created_at >= p_since;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.get_site_usage_analytics(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_usage_analytics(TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
