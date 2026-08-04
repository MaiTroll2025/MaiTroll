-- Tromail - Internal Role-Based Email System for Mai Troll
-- Migration: Create tables and RPC functions for Tromail

-- Create tromail_accounts table
CREATE TABLE IF NOT EXISTS tromail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  display_name TEXT,
  tromail_address TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tromail_messages table
CREATE TABLE IF NOT EXISTS tromail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL,
  sender_tromail_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_admin_email BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  related_meeting_id UUID REFERENCES staff_meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tromail_recipients table
CREATE TABLE IF NOT EXISTS tromail_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES tromail_messages(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL,
  recipient_tromail_address TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_starred BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tromail_calendar_events table
CREATE TABLE IF NOT EXISTS tromail_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by_role TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'meeting',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  meeting_id UUID REFERENCES staff_meetings(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tromail_calendar_event_recipients table
CREATE TABLE IF NOT EXISTS tromail_calendar_event_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id UUID REFERENCES tromail_calendar_events(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE tromail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tromail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tromail_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tromail_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tromail_calendar_event_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies for tromail_accounts
CREATE POLICY "tromail_accounts_select" ON tromail_accounts
  FOR SELECT USING (true);

CREATE POLICY "tromail_accounts_insert" ON tromail_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = user_id
      AND (
        up.role IN ('admin', 'secretary', 'prosecutor', 'attorney', 'auctioneer', 'troll_officer', 'lead_troll_officer', 'tcnn_news_caster', 'tcnn_chief_news_caster', 'journalist', 'agency_hr_manager', 'agency_hr', 'agency_leader', 'troll_family_leader', 'ceo_assistant', 'noah_assistant', 'noah_admin', 'ceo')
        OR up.is_admin = true
        OR up.organization_id IS NOT NULL
      )
    )
  );

-- RLS policies for tromail_messages
CREATE POLICY "tromail_messages_select_sender" ON tromail_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tromail_accounts ta
      WHERE ta.user_id = auth.uid()
      AND ta.is_active = true
    )
  );

-- RLS policies for tromail_recipients
CREATE POLICY "tromail_recipients_select" ON tromail_recipients
  FOR SELECT USING (recipient_user_id = auth.uid());

CREATE POLICY "tromail_recipients_insert" ON tromail_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tromail_accounts ta
      WHERE ta.user_id = auth.uid()
      AND ta.is_active = true
    )
  );

-- RLS policies for tromail_calendar_events
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

-- RLS policies for tromail_calendar_event_recipients
CREATE POLICY "tromail_calendar_event_recipients_select" ON tromail_calendar_event_recipients
  FOR SELECT USING (recipient_user_id = auth.uid());