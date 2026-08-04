-- RLS policies for broadcast_minute_tracking and livekit_usage_tracking.
-- These tables track per-participant RTC minutes and must be secured
-- so users can only see their own data, while admins can see all.

-- ============================================================
-- broadcast_minute_tracking RLS
-- ============================================================
ALTER TABLE public.broadcast_minute_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own minute tracking rows
CREATE POLICY "Users can view own broadcast minute tracking"
  ON public.broadcast_minute_tracking
  FOR SELECT
  USING (
    participant_identity = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.streams s
      WHERE s.id = broadcast_minute_tracking.stream_id
      AND s.broadcaster_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND (up.is_admin = true OR up.role IN ('admin', 'superadmin', 'ceo', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary'))
    )
  );

-- Broadcasters can insert their own tracking rows
CREATE POLICY "Broadcasters can insert own minute tracking"
  ON public.broadcast_minute_tracking
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.streams s
      WHERE s.id = broadcast_minute_tracking.stream_id
      AND s.broadcaster_id = auth.uid()
    )
  );

-- Service role can manage all rows (for server-side functions)
CREATE POLICY "Service role can manage all minute tracking"
  ON public.broadcast_minute_tracking
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- livekit_usage_tracking RLS
-- ============================================================
ALTER TABLE public.livekit_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage tracking rows
CREATE POLICY "Users can view own livekit usage tracking"
  ON public.livekit_usage_tracking
  FOR SELECT
  USING (
    participant_identity = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.streams s
      WHERE s.id = livekit_usage_tracking.stream_id
      AND s.broadcaster_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND (up.is_admin = true OR up.role IN ('admin', 'superadmin', 'ceo', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary'))
    )
  );

-- Broadcasters can insert their own usage rows
CREATE POLICY "Broadcasters can insert own usage tracking"
  ON public.livekit_usage_tracking
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.streams s
      WHERE s.id = livekit_usage_tracking.stream_id
      AND s.broadcaster_id = auth.uid()
    )
  );

-- Service role can manage all rows (for server-side functions)
CREATE POLICY "Service role can manage all usage tracking"
  ON public.livekit_usage_tracking
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_minute_tracking TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.livekit_usage_tracking TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_broadcast_participant_join(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_broadcast_participant_leave(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extend_broadcast_with_gift(uuid, bigint, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_gift_broadcast_extension() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_broadcast_minute_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_broadcast_minute_stats() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';