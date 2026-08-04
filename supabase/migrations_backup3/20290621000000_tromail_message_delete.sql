ALTER TABLE public.tromail_messages
  ADD COLUMN IF NOT EXISTS sender_deleted_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "tromail_messages_sender_delete" ON public.tromail_messages;
CREATE POLICY "tromail_messages_sender_delete" ON public.tromail_messages
  FOR UPDATE
  USING (sender_user_id = auth.uid())
  WITH CHECK (sender_user_id = auth.uid());

DROP POLICY IF EXISTS "tromail_recipients_update_own" ON public.tromail_recipients;
CREATE POLICY "tromail_recipients_update_own" ON public.tromail_recipients
  FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

CREATE OR REPLACE FUNCTION get_tromail_sent(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  sender_user_id UUID,
  sender_role TEXT,
  sender_tromail_address TEXT,
  subject TEXT,
  body TEXT,
  is_admin_email BOOLEAN,
  is_important BOOLEAN,
  related_meeting_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
AS $$
  SELECT
    tm.id,
    tm.sender_user_id,
    tm.sender_role,
    tm.sender_tromail_address,
    tm.subject,
    tm.body,
    tm.is_admin_email,
    tm.is_important,
    tm.related_meeting_id,
    tm.created_at,
    tm.updated_at
  FROM tromail_messages tm
  WHERE tm.sender_user_id = p_user_id
  AND tm.sender_deleted_at IS NULL
  ORDER BY tm.created_at DESC;
$$;
