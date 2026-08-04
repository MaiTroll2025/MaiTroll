-- Fix missing RLS policies for tromail_calendar_events and tromail_calendar_event_recipients
-- Secretary (and other authorized roles) need INSERT, UPDATE, DELETE on calendar events

-- Drop existing select policy to recreate with proper naming
DROP POLICY IF EXISTS "tromail_calendar_events_select" ON tromail_calendar_events;
CREATE POLICY "tromail_calendar_events_select" ON tromail_calendar_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tromail_calendar_event_recipients r
      WHERE r.calendar_event_id = id
      AND r.recipient_user_id = auth.uid()
    )
    OR created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_admin = true
    )
  );

-- INSERT policy: secretary and authorized roles can create calendar events
CREATE POLICY "tromail_calendar_events_insert" ON tromail_calendar_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary', 'ceo', 'lead_troll_officer', 'troll_officer', 'prosecutor', 'attorney', 'auctioneer')
        OR up.is_admin = true
      )
    )
  );

-- UPDATE policy: creator or admin can update calendar events
CREATE POLICY "tromail_calendar_events_update" ON tromail_calendar_events
  FOR UPDATE USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

-- DELETE policy: creator or admin can delete calendar events
CREATE POLICY "tromail_calendar_events_delete" ON tromail_calendar_events
  FOR DELETE USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

-- Fix tromail_calendar_event_recipients policies
DROP POLICY IF EXISTS "tromail_calendar_event_recipients_select" ON tromail_calendar_event_recipients;
CREATE POLICY "tromail_calendar_event_recipients_select" ON tromail_calendar_event_recipients
  FOR SELECT USING (
    recipient_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tromail_calendar_events e
      WHERE e.id = calendar_event_id
      AND e.created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

-- INSERT policy for recipients: event creator or admin/secretary can add recipients
CREATE POLICY "tromail_calendar_event_recipients_insert" ON tromail_calendar_event_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tromail_calendar_events e
      WHERE e.id = calendar_event_id
      AND e.created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

-- DELETE policy for recipients: event creator or admin/secretary can remove recipients
CREATE POLICY "tromail_calendar_event_recipients_delete" ON tromail_calendar_event_recipients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tromail_calendar_events e
      WHERE e.id = calendar_event_id
      AND e.created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );
