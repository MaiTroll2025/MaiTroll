-- Tromail RPC Functions

-- Function to send Tromail message (secure, prevents spoofing)
CREATE OR REPLACE FUNCTION send_tromail_message(
  p_sender_user_id UUID,
  p_sender_role TEXT,
  p_sender_tromail_address TEXT,
  p_subject TEXT,
  p_body TEXT,
  p_is_admin_email BOOLEAN,
  p_is_important BOOLEAN,
  p_related_meeting_id UUID,
  p_recipient_user_ids UUID[],
  p_recipient_roles TEXT[]
) RETURNS TABLE(success BOOLEAN, message_id UUID, error TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_id UUID;
  v_recipient_user_id UUID;
  v_recipient_role TEXT;
  v_recipient_tromail_address TEXT;
  v_index INTEGER;
BEGIN
  -- Verify sender has active Tromail account
  IF NOT EXISTS (
    SELECT 1 FROM tromail_accounts
    WHERE user_id = p_sender_user_id
    AND is_active = true
  ) THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Sender does not have an active Tromail account'::TEXT;
    RETURN;
  END IF;

  -- Verify sender can send admin emails if flagged
  IF p_is_admin_email THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = p_sender_user_id
      AND (is_admin = true OR role IN ('admin', 'ceo', 'secretary', 'admin_assistant', 'ceo_assistant'))
    ) THEN
      RETURN QUERY SELECT false, NULL::UUID, 'Sender not authorized to send admin emails'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Verify recipient count matches
  IF array_length(p_recipient_user_ids, 1) IS NULL OR array_length(p_recipient_roles, 1) IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Recipient arrays cannot be empty'::TEXT;
    RETURN;
  END IF;

  IF array_length(p_recipient_user_ids, 1) != array_length(p_recipient_roles, 1) THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Recipient arrays must have same length'::TEXT;
    RETURN;
  END IF;

  -- Insert the message
  INSERT INTO tromail_messages (
    sender_user_id,
    sender_role,
    sender_tromail_address,
    subject,
    body,
    is_admin_email,
    is_important,
    related_meeting_id
  ) VALUES (
    p_sender_user_id,
    p_sender_role,
    p_sender_tromail_address,
    p_subject,
    p_body,
    p_is_admin_email,
    p_is_important,
    p_related_meeting_id
  ) RETURNING id INTO v_message_id;

  -- Create recipients
  FOR v_index IN 1..array_length(p_recipient_user_ids, 1) LOOP
    v_recipient_user_id := p_recipient_user_ids[v_index];
    v_recipient_role := p_recipient_roles[v_index];

    -- Get recipient's Tromail address
    SELECT tromail_address INTO v_recipient_tromail_address
    FROM tromail_accounts
    WHERE user_id = v_recipient_user_id
    AND is_active = true;

    IF v_recipient_tromail_address IS NOT NULL THEN
      INSERT INTO tromail_recipients (
        message_id,
        recipient_user_id,
        recipient_role,
        recipient_tromail_address
      ) VALUES (
        v_message_id,
        v_recipient_user_id,
        v_recipient_role,
        v_recipient_tromail_address
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT true, v_message_id, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::UUID, SQLERRM::TEXT;
END;
$$;

-- Function to get inbox for a user
CREATE OR REPLACE FUNCTION get_tromail_inbox(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  message_id UUID,
  recipient_user_id UUID,
  recipient_role TEXT,
  recipient_tromail_address TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_starred BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  sender_user_id UUID,
  sender_role TEXT,
  sender_tromail_address TEXT,
  subject TEXT,
  body TEXT,
  is_admin_email BOOLEAN,
  is_important BOOLEAN,
  related_meeting_id UUID,
  message_created_at TIMESTAMP WITH TIME ZONE,
  message_updated_at TIMESTAMP WITH TIME ZONE,
  sender_username TEXT
)
LANGUAGE sql
AS $$
  SELECT
    tr.id,
    tr.message_id,
    tr.recipient_user_id,
    tr.recipient_role,
    tr.recipient_tromail_address,
    tr.read_at,
    tr.archived_at,
    tr.deleted_at,
    tr.is_starred,
    tr.created_at,
    tm.sender_user_id,
    tm.sender_role,
    tm.sender_tromail_address,
    tm.subject,
    tm.body,
    tm.is_admin_email,
    tm.is_important,
    tm.related_meeting_id,
    tm.created_at as message_created_at,
    tm.updated_at as message_updated_at,
    up.username as sender_username
  FROM tromail_recipients tr
  JOIN tromail_messages tm ON tm.id = tr.message_id
  LEFT JOIN user_profiles up ON up.id = tm.sender_user_id
  WHERE tr.recipient_user_id = p_user_id
  AND tr.deleted_at IS NULL
  ORDER BY tr.created_at DESC;
$$;

-- Function to get sent messages for a user
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
  ORDER BY tm.created_at DESC;
$$;

-- Function to get important/starred messages for a user
CREATE OR REPLACE FUNCTION get_tromail_important(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  message_id UUID,
  recipient_user_id UUID,
  recipient_role TEXT,
  recipient_tromail_address TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_starred BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  sender_user_id UUID,
  sender_role TEXT,
  sender_tromail_address TEXT,
  subject TEXT,
  body TEXT,
  is_admin_email BOOLEAN,
  is_important BOOLEAN,
  related_meeting_id UUID,
  message_created_at TIMESTAMP WITH TIME ZONE,
  message_updated_at TIMESTAMP WITH TIME ZONE,
  sender_username TEXT
)
LANGUAGE sql
AS $$
  SELECT
    tr.id,
    tr.message_id,
    tr.recipient_user_id,
    tr.recipient_role,
    tr.recipient_tromail_address,
    tr.read_at,
    tr.archived_at,
    tr.deleted_at,
    tr.is_starred,
    tr.created_at,
    tm.sender_user_id,
    tm.sender_role,
    tm.sender_tromail_address,
    tm.subject,
    tm.body,
    tm.is_admin_email,
    tm.is_important,
    tm.related_meeting_id,
    tm.created_at as message_created_at,
    tm.updated_at as message_updated_at,
    up.username as sender_username
  FROM tromail_recipients tr
  JOIN tromail_messages tm ON tm.id = tr.message_id
  LEFT JOIN user_profiles up ON up.id = tm.sender_user_id
  WHERE tr.recipient_user_id = p_user_id
  AND tr.deleted_at IS NULL
  AND (tr.is_starred = true OR tm.is_important = true)
  ORDER BY tr.created_at DESC;
$$;

-- Function to get admin emails for a user
CREATE OR REPLACE FUNCTION get_tromail_admin(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  message_id UUID,
  recipient_user_id UUID,
  recipient_role TEXT,
  recipient_tromail_address TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_starred BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  sender_user_id UUID,
  sender_role TEXT,
  sender_tromail_address TEXT,
  subject TEXT,
  body TEXT,
  is_admin_email BOOLEAN,
  is_important BOOLEAN,
  related_meeting_id UUID,
  message_created_at TIMESTAMP WITH TIME ZONE,
  message_updated_at TIMESTAMP WITH TIME ZONE,
  sender_username TEXT
)
LANGUAGE sql
AS $$
  SELECT
    tr.id,
    tr.message_id,
    tr.recipient_user_id,
    tr.recipient_role,
    tr.recipient_tromail_address,
    tr.read_at,
    tr.archived_at,
    tr.deleted_at,
    tr.is_starred,
    tr.created_at,
    tm.sender_user_id,
    tm.sender_role,
    tm.sender_tromail_address,
    tm.subject,
    tm.body,
    tm.is_admin_email,
    tm.is_important,
    tm.related_meeting_id,
    tm.created_at as message_created_at,
    tm.updated_at as message_updated_at,
    up.username as sender_username
  FROM tromail_recipients tr
  JOIN tromail_messages tm ON tm.id = tr.message_id
  LEFT JOIN user_profiles up ON up.id = tm.sender_user_id
  WHERE tr.recipient_user_id = p_user_id
  AND tr.deleted_at IS NULL
  AND tm.is_admin_email = true
  ORDER BY tr.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_tromail_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_tromail_inbox TO authenticated;
GRANT EXECUTE ON FUNCTION get_tromail_sent TO authenticated;
GRANT EXECUTE ON FUNCTION get_tromail_important TO authenticated;
GRANT EXECUTE ON FUNCTION get_tromail_admin TO authenticated;