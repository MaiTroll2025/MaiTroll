-- ============================================================
-- UTROMAIL & TROMAIL SYSTEM - DATABASE SCHEMA
-- ============================================================
-- Replaces TCPS with UTroMail (all users) + TroMail (staff/roles)
-- ============================================================

-- ============================================================
-- 1. ADD COLUMNS TO USER_PROFILES
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='utromail_address') THEN
    ALTER TABLE public.user_profiles ADD COLUMN utromail_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='utromail_enabled') THEN
    ALTER TABLE public.user_profiles ADD COLUMN utromail_enabled boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='unread_mail_count') THEN
    ALTER TABLE public.user_profiles ADD COLUMN unread_mail_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='mail_privacy_setting') THEN
    ALTER TABLE public.user_profiles ADD COLUMN mail_privacy_setting text DEFAULT 'mutual_followers' CHECK (mail_privacy_setting IN ('everyone', 'following', 'mutual_followers', 'verified_only'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='mail_request_enabled') THEN
    ALTER TABLE public.user_profiles ADD COLUMN mail_request_enabled boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='utromail_disabled') THEN
    ALTER TABLE public.user_profiles ADD COLUMN utromail_disabled boolean DEFAULT false;
  END IF;
END $$;

-- Generate utromail_address for existing users that don't have one
UPDATE public.user_profiles
SET utromail_address = LOWER(REGEXP_REPLACE(username, '[^a-zA-Z0-9]', '', 'g')) || '@utromail'
WHERE utromail_address IS NULL AND username IS NOT NULL;

-- Make utromail_address unique and not null
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='user_profiles_utromail_address_key') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_utromail_address_key UNIQUE (utromail_address);
  END IF;
END $$;

-- ============================================================
-- 2. UTROMAIL ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mail_address text NOT NULL UNIQUE,
  display_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_accounts IS 'UTroMail accounts for all users';

-- ============================================================
-- 3. TROMAIL ROLE ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tromail_role_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mail_address text NOT NULL UNIQUE,
  role_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.tromail_role_accounts IS 'TroMail accounts for staff/roles';

-- ============================================================
-- 4. UTROMAIL THREADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text,
  is_group boolean DEFAULT false,
  created_by uuid REFERENCES public.user_profiles(id),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_threads IS 'Mail threads (conversations)';

-- ============================================================
-- 5. UTROMAIL THREAD MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_thread_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.utromail_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  folder text DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'archive', 'trash', 'requests', 'starred', 'drafts')),
  is_muted boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

COMMENT ON TABLE public.utromail_thread_members IS 'Thread participants with per-user folder state';

CREATE INDEX IF NOT EXISTS idx_utromail_thread_members_user ON public.utromail_thread_members(user_id);
CREATE INDEX IF NOT EXISTS idx_utromail_thread_members_thread ON public.utromail_thread_members(thread_id);

-- ============================================================
-- 6. UTROMAIL MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.utromail_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_mail_address text NOT NULL,
  recipient_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  recipient_mail_address text,
  subject text,
  body text NOT NULL,
  body_html text,
  message_type text DEFAULT 'normal' CHECK (message_type IN ('normal', 'academy_notification', 'government', 'system', 'report')),
  is_starred boolean DEFAULT false,
  is_draft boolean DEFAULT false,
  parent_message_id uuid REFERENCES public.utromail_messages(id) ON DELETE SET NULL,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_messages IS 'Individual mail messages';

CREATE INDEX IF NOT EXISTS idx_utromail_messages_thread ON public.utromail_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_utromail_messages_sender ON public.utromail_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_utromail_messages_recipient ON public.utromail_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_utromail_messages_sent ON public.utromail_messages(sent_at DESC);

-- ============================================================
-- 7. UTROMAIL READ STATUS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.utromail_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

COMMENT ON TABLE public.utromail_read_status IS 'Per-user read status for messages';

CREATE INDEX IF NOT EXISTS idx_utromail_read_user ON public.utromail_read_status(user_id);

-- ============================================================
-- 8. UTROMAIL ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.utromail_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_attachments IS 'File attachments for mail messages';

-- ============================================================
-- 9. UTROMAIL BLOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

COMMENT ON TABLE public.utromail_blocks IS 'User-level mail blocks';

CREATE INDEX IF NOT EXISTS idx_utromail_blocks_blocker ON public.utromail_blocks(blocker_id);

-- ============================================================
-- 10. UTROMAIL REQUESTS (message requests from non-followers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.utromail_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'ignored', 'blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_requests IS 'Message requests from non-followers';

CREATE INDEX IF NOT EXISTS idx_utromail_requests_recipient ON public.utromail_requests(recipient_id);

-- ============================================================
-- 11. UTROMAIL DELIVERY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.utromail_messages(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'delivered' CHECK (status IN ('queued', 'delivered', 'failed', 'bounced')),
  error text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_delivery_log IS 'Message delivery tracking';

-- ============================================================
-- 12. UTROMAIL REPORTS (with screenshot support)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.utromail_messages(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES public.utromail_threads(id) ON DELETE SET NULL,
  report_reason text NOT NULL,
  screenshot_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  reviewed_by uuid REFERENCES public.user_profiles(id),
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_reports IS 'Mail abuse reports with screenshot evidence';

CREATE INDEX IF NOT EXISTS idx_utromail_reports_status ON public.utromail_reports(status);

-- ============================================================
-- 13. UTROMAIL NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.utromail_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.utromail_messages(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('new_message', 'message_request', 'academy_mail', 'government_mail', 'report_update')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.utromail_notifications IS 'Mail-related notifications';

CREATE INDEX IF NOT EXISTS idx_utromail_notif_user ON public.utromail_notifications(user_id, is_read);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to auto-generate utromail address on profile creation/update
CREATE OR REPLACE FUNCTION public.generate_utromail_address()
RETURNS trigger AS $$
DECLARE
  base_addr text;
  final_addr text;
  counter integer := 0;
BEGIN
  IF NEW.utromail_address IS NULL AND NEW.username IS NOT NULL THEN
    base_addr := LOWER(REGEXP_REPLACE(NEW.username, '[^a-zA-Z0-9]', '', 'g'));
    final_addr := base_addr || '@utromail';
    
    -- Handle duplicates by appending numbers
    WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE utromail_address = final_addr AND id != NEW.id) LOOP
      counter := counter + 1;
      final_addr := base_addr || counter::text || '@utromail';
    END LOOP;
    
    NEW.utromail_address := final_addr;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_utromail ON public.user_profiles;
CREATE TRIGGER trg_generate_utromail
  BEFORE INSERT OR UPDATE OF username ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_utromail_address();

-- Function to update unread count
CREATE OR REPLACE FUNCTION public.update_unread_mail_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles SET unread_mail_count = COALESCE(unread_mail_count, 0) + 1 WHERE id = NEW.recipient_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    UPDATE public.user_profiles SET unread_mail_count = GREATEST(COALESCE(unread_mail_count, 0) - 1, 0) WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_unread_mail ON public.utromail_read_status;
CREATE TRIGGER trg_update_unread_mail
  AFTER INSERT OR UPDATE ON public.utromail_read_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unread_mail_count();

-- Function to update thread last_message_at
CREATE OR REPLACE FUNCTION public.update_thread_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.utromail_threads SET last_message_at = NEW.sent_at, updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_thread_last_msg ON public.utromail_messages;
CREATE TRIGGER trg_update_thread_last_msg
  AFTER INSERT ON public.utromail_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_thread_last_message();

-- Function to auto-create utromail account
CREATE OR REPLACE FUNCTION public.ensure_utromail_account()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.utromail_accounts WHERE user_id = NEW.id) THEN
    INSERT INTO public.utromail_accounts (user_id, mail_address, display_name)
    VALUES (NEW.id, NEW.utromail_address, NEW.display_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_utromail_account ON public.user_profiles;
CREATE TRIGGER trg_ensure_utromail_account
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_utromail_account();

-- Function to check if user can receive mail (privacy + blocks)
CREATE OR REPLACE FUNCTION public.can_send_utromail(sender_id uuid, recipient_id uuid)
RETURNS boolean AS $$
DECLARE
  v_privacy text;
  v_blocked boolean;
  v_sender_follows boolean;
  v_recipient_follows boolean;
  v_mutual boolean;
  v_recipient_verified boolean;
  v_sender_staff boolean;
BEGIN
  -- Staff can always send
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = sender_id AND (
    is_admin OR role IN ('admin','ceo','superadmin','troll_officer','lead_troll_officer','secretary',
    'academy_teacher','academy_director','admissions_officer','moderator','attorney','prosecutor')
  )) INTO v_sender_staff;
  
  IF v_sender_staff THEN RETURN true; END IF;

  -- Check if sender is utromail_disabled
  IF EXISTS(SELECT 1 FROM public.user_profiles WHERE id = sender_id AND utromail_disabled = true) THEN
    RETURN false;
  END IF;

  -- Check if recipient blocks sender
  SELECT EXISTS(SELECT 1 FROM public.utromail_blocks WHERE blocker_id = recipient_id AND blocked_id = sender_id) INTO v_blocked;
  IF v_blocked THEN RETURN false; END IF;

  -- Get recipient privacy setting
  SELECT mail_privacy_setting INTO v_privacy FROM public.user_profiles WHERE id = recipient_id;
  IF v_privacy IS NULL THEN v_privacy := 'mutual_followers'; END IF;

  -- Check verified status
  SELECT (is_verified = true) INTO v_recipient_verified FROM public.user_profiles WHERE id = sender_id;

  -- Check follow relationships
  SELECT EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = sender_id AND following_id = recipient_id) INTO v_sender_follows;
  SELECT EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = recipient_id AND following_id = sender_id) INTO v_recipient_follows;
  v_mutual := v_sender_follows AND v_recipient_follows;

  CASE v_privacy
    WHEN 'everyone' THEN RETURN true;
    WHEN 'following' THEN RETURN v_sender_follows;
    WHEN 'mutual_followers' THEN RETURN v_mutual;
    WHEN 'verified_only' THEN RETURN v_recipient_verified;
    ELSE RETURN v_mutual;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to find existing 1-on-1 thread between two users
CREATE OR REPLACE FUNCTION public.find_utromail_thread(user_a uuid, user_b uuid)
RETURNS uuid AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  SELECT t.id INTO v_thread_id
  FROM public.utromail_threads t
  WHERE t.is_group = false
    AND EXISTS(SELECT 1 FROM public.utromail_thread_members m1 WHERE m1.thread_id = t.id AND m1.user_id = user_a)
    AND EXISTS(SELECT 1 FROM public.utromail_thread_members m2 WHERE m2.thread_id = t.id AND m2.user_id = user_b)
  LIMIT 1;
  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.utromail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tromail_role_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utromail_notifications ENABLE ROW LEVEL SECURITY;

-- utromail_accounts: users see own, staff see all
CREATE POLICY "Users see own utromail account" ON public.utromail_accounts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Staff see all utromail accounts" ON public.utromail_accounts FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin OR role IN ('admin','ceo','superadmin','moderator')))
);
CREATE POLICY "System manages utromail accounts" ON public.utromail_accounts FOR ALL USING (true);

-- tromail_role_accounts: public read, staff manage
CREATE POLICY "Tromail accounts are viewable by everyone" ON public.tromail_role_accounts FOR SELECT USING (true);
CREATE POLICY "Admins manage tromail accounts" ON public.tromail_role_accounts FOR ALL USING (
  EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin OR role IN ('admin','ceo','superadmin')))
);

-- utromail_threads: members can see their threads
CREATE POLICY "Thread members can view threads" ON public.utromail_threads FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.utromail_thread_members WHERE thread_id = utromail_threads.id AND user_id = auth.uid())
);
CREATE POLICY "Participants can create threads" ON public.utromail_threads FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can manage threads" ON public.utromail_threads FOR ALL USING (
  EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin OR role IN ('admin','ceo','superadmin')))
);

-- utromail_thread_members
CREATE POLICY "Users see own thread memberships" ON public.utromail_thread_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System manages thread members" ON public.utromail_thread_members FOR ALL USING (true);

-- utromail_messages: sender and recipients can see
CREATE POLICY "Participants can view messages" ON public.utromail_messages FOR SELECT USING (
  sender_id = auth.uid() OR
  recipient_id = auth.uid() OR
  EXISTS(SELECT 1 FROM public.utromail_thread_members WHERE thread_id = utromail_messages.thread_id AND user_id = auth.uid())
);
CREATE POLICY "Users can send messages" ON public.utromail_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Admins can manage messages" ON public.utromail_messages FOR ALL USING (
  EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin OR role IN ('admin','ceo','superadmin','moderator')))
);

-- utromail_read_status
CREATE POLICY "Users manage own read status" ON public.utromail_read_status FOR ALL USING (user_id = auth.uid());

-- utromail_attachments
CREATE POLICY "Participants can view attachments" ON public.utromail_attachments FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.utromail_messages m WHERE m.id = utromail_attachments.message_id AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid()))
);
CREATE POLICY "Senders can add attachments" ON public.utromail_attachments FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.utromail_messages m WHERE m.id = utromail_attachments.message_id AND m.sender_id = auth.uid())
);

-- utromail_blocks
CREATE POLICY "Users manage own blocks" ON public.utromail_blocks FOR ALL USING (blocker_id = auth.uid());

-- utromail_requests
CREATE POLICY "Users see own requests" ON public.utromail_requests FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "Users can create requests" ON public.utromail_requests FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Recipients can update requests" ON public.utromail_requests FOR UPDATE USING (recipient_id = auth.uid());

-- utromail_delivery_log
CREATE POLICY "Users see own delivery logs" ON public.utromail_delivery_log FOR SELECT USING (recipient_id = auth.uid() OR EXISTS(
  SELECT 1 FROM public.utromail_messages m WHERE m.id = utromail_delivery_log.message_id AND m.sender_id = auth.uid()
));
CREATE POLICY "System manages delivery logs" ON public.utromail_delivery_log FOR ALL USING (true);

-- utromail_reports
CREATE POLICY "Users see own reports" ON public.utromail_reports FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "Users can create reports" ON public.utromail_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins can manage reports" ON public.utromail_reports FOR ALL USING (
  EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin OR role IN ('admin','ceo','superadmin','moderator')))
);

-- utromail_notifications
CREATE POLICY "Users see own notifications" ON public.utromail_notifications FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON public.utromail_accounts TO authenticated;
GRANT ALL ON public.tromail_role_accounts TO authenticated;
GRANT ALL ON public.utromail_threads TO authenticated;
GRANT ALL ON public.utromail_thread_members TO authenticated;
GRANT ALL ON public.utromail_messages TO authenticated;
GRANT ALL ON public.utromail_read_status TO authenticated;
GRANT ALL ON public.utromail_attachments TO authenticated;
GRANT ALL ON public.utromail_blocks TO authenticated;
GRANT ALL ON public.utromail_requests TO authenticated;
GRANT ALL ON public.utromail_delivery_log TO authenticated;
GRANT ALL ON public.utromail_reports TO authenticated;
GRANT ALL ON public.utromail_notifications TO authenticated;
GRANT SELECT ON public.utromail_accounts TO anon;
GRANT SELECT ON public.tromail_role_accounts TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
