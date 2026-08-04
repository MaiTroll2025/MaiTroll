-- Enable Supabase Realtime for UTroMail tables
-- This allows real-time subscriptions for message delivery and notifications

ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_threads;
