-- Align outbound-click visibility with the RTC monitor's server-side access
-- check so explicitly authorized monitor users can read analytics and realtime events.
DROP POLICY IF EXISTS "Admins can view outbound clicks" ON public.outbound_clicks;

CREATE POLICY "RTC monitor users can view outbound clicks"
  ON public.outbound_clicks
  FOR SELECT
  TO authenticated
  USING (public.can_access_rtc_admin_monitor(auth.uid()));

GRANT SELECT ON public.outbound_clicks TO authenticated;
GRANT INSERT ON public.outbound_clicks TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
