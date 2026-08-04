-- Fix inmate communication: create jail_notifications table and set proper RLS policies.
--
-- Root cause: The jail_notifications table was only created in ad-hoc SQL scripts
-- (jail_enhancements.sql / complete_jail_court_attorney_prosecutor_system.sql) that were
-- never run through the numbered migration pipeline. InmatesPage tries to insert
-- jail_notifications records when users send messages to inmates, but the table
-- doesn't exist — the insert silently fails, so inmates never get notified.
--
-- Additionally, the existing ad-hoc scripts had an INSERT policy restricted to staff
-- roles only, which would block notification creation even if the table existed.
-- The CHECK constraint also used 'message_received' while the frontend sends
-- 'inmate_message_received', causing a constraint violation.

CREATE TABLE IF NOT EXISTS public.jail_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jail_notifications_user ON public.jail_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_jail_notifications_read ON public.jail_notifications(user_id, is_read);

ALTER TABLE public.jail_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can create jail notifications" ON public.jail_notifications;
DROP POLICY IF EXISTS "Users can view own jail notifications" ON public.jail_notifications;

CREATE POLICY "Authenticated users can create jail notifications" ON public.jail_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own jail notifications" ON public.jail_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own jail notifications" ON public.jail_notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own jail notifications" ON public.jail_notifications
  FOR DELETE USING (user_id = auth.uid());
