-- Mai Troll Calendar & Event Management System
-- Complete event scheduling, participation, notifications, and access control

-- ============================================================
-- CLEANUP (remove partial tables from any prior failed run)
-- ============================================================
DROP TRIGGER IF EXISTS tc_auto_update_event_status ON public.events;
DROP TRIGGER IF EXISTS trigger_update_event_status ON public.events;
DROP FUNCTION IF EXISTS public.auto_update_event_status();
DROP FUNCTION IF EXISTS public.update_event_status();
DROP FUNCTION IF EXISTS public.create_event(text, text, text, date, time with time zone, time with time zone, text, text, text, text, uuid, text, integer, text, text, integer, text[], text, text, text, text[], jsonb);
DROP FUNCTION IF EXISTS public.create_event(text, text, text, date, uuid, text, time with time zone, time with time zone, text, text, text, text, integer, text, text, integer, text[], text, text, text, text[], jsonb);
DROP FUNCTION IF EXISTS public.create_event(text, text, text, time with time zone, time with time zone, text, text, text, text, uuid, text, integer, text, text, integer, text[], text, text, text, text[], jsonb);
DROP FUNCTION IF EXISTS public.register_for_event(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.cancel_event_registration(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_upcoming_events(integer, integer);
DROP FUNCTION IF EXISTS public.get_events_by_date_range(date, date);

DROP TABLE IF EXISTS public.event_invites CASCADE;
DROP TABLE IF EXISTS public.event_access_rules CASCADE;
DROP TABLE IF EXISTS public.event_notifications CASCADE;
DROP TABLE IF EXISTS public.event_participants CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.event_categories CASCADE;

-- ============================================================
-- EVENT CATEGORIES (expandable by administrators)
-- ============================================================
CREATE TABLE public.event_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📅',
  color TEXT DEFAULT '#8B5CF6',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed default event categories
INSERT INTO public.event_categories (slug, name, description, icon, color, sort_order) VALUES
  ('pride_event', 'Pride Event', 'LGBTQ+ celebration events', '🏳️‍🌈', '#EC4899', 1),
  ('trollathon', 'Trollathon', 'Extended streaming marathon events', '🎮', '#8B5CF6', 2),
  ('auction_event', 'Auction Event', 'Live auction events', '🔨', '#F59E0B', 3),
  ('gaming_tournament', 'Gaming Tournament', 'Competitive gaming events', '🎯', '#10B981', 4),
  ('family_war', 'Family War', 'Troll Family battles', '⚔️', '#EF4444', 5),
  ('community_meeting', 'Community Meeting', 'Town hall and community gatherings', '🏛️', '#3B82F6', 6),
  ('president_town_hall', 'President Town Hall', 'Presidential addresses', '🎤', '#F97316', 7),
  ('academy_class', 'Academy Class', 'Educational sessions', '📚', '#06B6D4', 8),
  ('church_service', 'Church Service', 'Religious services', '⛪', '#A855F7', 9),
  ('share_a_thon', 'Share-A-Thon', 'Sharing and promotion events', '📢', '#EC4899', 10),
  ('charity_event', 'Charity Event', 'Fundraising and charity', '💝', '#14B8A6', 11),
  ('creator_event', 'Creator Event', 'Creator-focused events', '✨', '#F472B6', 12),
  ('voice_room_event', 'Voice Room Event', 'Voice chat events', '🎙️', '#6366F1', 13),
  ('battle_event', 'Battle Event', 'Battle competitions', '⚡', '#DC2626', 14),
  ('custom_event', 'Custom Event', 'Administrator-defined custom events', '📌', '#6B7280', 99)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- EVENTS (core table)
-- ============================================================
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.event_categories(id),
  category_slug TEXT NOT NULL DEFAULT 'custom_event',

  -- Event timing
  event_date DATE NOT NULL,
  start_time TIME WITH TIME ZONE,
  end_time TIME WITH TIME ZONE,
  timezone TEXT DEFAULT 'UTC',

  -- Media
  banner_image_url TEXT,
  thumbnail_url TEXT,
  event_color TEXT DEFAULT '#8B5CF6',

  -- Creator & ownership
  creator_id UUID NOT NULL REFERENCES public.user_profiles(id),
  creator_username TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled', 'archived')),

  -- Participation
  max_participants INTEGER,
  registration_locked BOOLEAN DEFAULT false,
  registration_opens_at TIMESTAMP WITH TIME ZONE,
  registration_closes_at TIMESTAMP WITH TIME ZONE,

  -- Visibility & access
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only')),
  access_level TEXT DEFAULT 'everyone' CHECK (access_level IN (
    'everyone', 'verified_users', 'founding_officers', 'staff', 'creators', 'agencies',
    'specific_levels', 'specific_users', 'invite_only'
  )),
  min_level INTEGER DEFAULT 1,

  -- Requirements & rules
  requirements TEXT[] DEFAULT '{}',
  rules TEXT,

  -- Location (optional - for virtual/physical events)
  location_type TEXT DEFAULT 'virtual' CHECK (location_type IN ('virtual', 'physical', 'hybrid')),
  location_details TEXT,
  stream_id UUID,

  -- Notification settings
  notifications_enabled BOOLEAN DEFAULT true,
  reminder_7d_sent BOOLEAN DEFAULT false,
  reminder_3d_sent BOOLEAN DEFAULT false,
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  started_notification_sent BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category_slug);
CREATE INDEX IF NOT EXISTS idx_events_creator ON public.events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON public.events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_date_status ON public.events(event_date, status);

-- ============================================================
-- EVENT PARTICIPANTS
-- ============================================================
CREATE TABLE public.event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  username TEXT NOT NULL,
  avatar_url TEXT,

  -- Participation status
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN (
    'registered', 'confirmed', 'waitlisted', 'attended', 'no_show', 'cancelled', 'banned'
  )),

  -- Registration details
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  attended_at TIMESTAMP WITH TIME ZONE,

  -- Additional info
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_status ON public.event_participants(status);

-- ============================================================
-- EVENT NOTIFICATIONS
-- ============================================================
CREATE TABLE public.event_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id),

  -- Notification details
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'event_created', 'event_updated', 'event_cancelled', 'event_reminder_7d',
    'event_reminder_3d', 'event_reminder_24h', 'event_reminder_1h', 'event_started',
    'event_ended', 'registration_confirmed', 'registration_waitlisted', 'registration_cancelled',
    'invite_received', 'event_full', 'event_available'
  )),

  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Delivery status
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,

  -- Action URL
  action_url TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_notifications_event ON public.event_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_user ON public.event_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_type ON public.event_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_event_notifications_unread ON public.event_notifications(user_id, is_read) WHERE is_read = false;

-- ============================================================
-- EVENT ACCESS RULES
-- ============================================================
CREATE TABLE public.event_access_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Rule type
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'role', 'level', 'badge', 'achievement', 'custom'
  )),

  -- Rule details
  rule_key TEXT NOT NULL,
  rule_value TEXT,
  rule_operator TEXT DEFAULT 'equals' CHECK (rule_operator IN ('equals', 'gte', 'lte', 'contains', 'in')),

  -- Is this rule required or optional
  is_required BOOLEAN DEFAULT true,

  -- Description
  description TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(event_id, rule_type, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_event_access_rules_event ON public.event_access_rules(event_id);

-- ============================================================
-- EVENT INVITES
-- ============================================================
CREATE TABLE public.event_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  invited_by UUID NOT NULL REFERENCES public.user_profiles(id),

  -- Invite status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

  -- Message
  invite_message TEXT,

  -- Timpires
  expires_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(event_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_invites_event ON public.event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_user ON public.event_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_status ON public.event_invites(status);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Update event status based on current time
CREATE OR REPLACE FUNCTION public.auto_update_event_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    IF NEW.status = 'upcoming' AND NEW.event_date <= CURRENT_DATE THEN
      IF NEW.start_time IS NULL THEN
        NEW.status := 'live';
      END IF;
    END IF;

    IF NEW.status = 'live' AND NEW.event_date < CURRENT_DATE THEN
      NEW.status := 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS tc_auto_update_event_status ON public.events;
CREATE TRIGGER tc_auto_update_event_status
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_event_status();

-- Create event RPC
CREATE OR REPLACE FUNCTION public.create_event(
  p_title TEXT,
  p_description TEXT,
  p_category_slug TEXT,
  p_event_date DATE,
  p_creator_id UUID,
  p_creator_username TEXT,
  p_start_time TIME WITH TIME ZONE DEFAULT NULL,
  p_end_time TIME WITH TIME ZONE DEFAULT NULL,
  p_timezone TEXT DEFAULT 'UTC',
  p_banner_image_url TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_event_color TEXT DEFAULT '#8B5CF6',
  p_max_participants INTEGER DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_access_level TEXT DEFAULT 'everyone',
  p_min_level INTEGER DEFAULT 1,
  p_requirements TEXT[] DEFAULT '{}',
  p_rules TEXT DEFAULT NULL,
  p_location_type TEXT DEFAULT 'virtual',
  p_location_details TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_category_id UUID;
BEGIN
  -- Get category
  SELECT id INTO v_category_id FROM public.event_categories WHERE slug = p_category_slug AND is_active = true;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.event_categories WHERE slug = 'custom_event';
  END IF;

  -- Create event
  INSERT INTO public.events (
    title, description, category_id, category_slug,
    event_date, start_time, end_time, timezone,
    banner_image_url, thumbnail_url, event_color,
    creator_id, creator_username,
    max_participants, visibility, access_level, min_level,
    requirements, rules, location_type, location_details,
    tags, metadata
  ) VALUES (
    p_title, p_description, v_category_id, p_category_slug,
    p_event_date, p_start_time, p_end_time, p_timezone,
    p_banner_image_url, p_thumbnail_url, p_event_color,
    p_creator_id, p_creator_username,
    p_max_participants, p_visibility, p_access_level, p_min_level,
    p_requirements, p_rules, p_location_type, p_location_details,
    p_tags, p_metadata
  ) RETURNING id INTO v_event_id;

  RETURN json_build_object('success', true, 'event_id', v_event_id);
END;
$$;

-- Register for event RPC
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id UUID,
  p_user_id UUID,
  p_username TEXT,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_participant_count INTEGER;
  v_existing_registration RECORD;
BEGIN
  -- Get event
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Check if event is open for registration
  IF v_event.status IN ('completed', 'cancelled', 'archived') THEN
    RETURN json_build_object('success', false, 'error', 'Event is not open for registration');
  END IF;

  -- Check if registration is locked
  IF v_event.registration_locked THEN
    RETURN json_build_object('success', false, 'error', 'Registration is locked for this event');
  END IF;

  -- Check if already registered
  SELECT * INTO v_existing_registration FROM public.event_participants
  WHERE event_id = p_event_id AND user_id = p_user_id;

  IF FOUND THEN
    IF v_existing_registration.status = 'cancelled' THEN
      -- Re-register
      UPDATE public.event_participants
      SET status = 'registered', registered_at = now()
      WHERE id = v_existing_registration.id;
      RETURN json_build_object('success', true, 'status', 'registered');
    END IF;
    RETURN json_build_object('success', false, 'error', 'Already registered for this event');
  END IF;

  -- Check capacity
  IF v_event.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_participant_count
    FROM public.event_participants
    WHERE event_id = p_event_id AND status IN ('registered', 'confirmed');

    IF v_participant_count >= v_event.max_participants THEN
      -- Add to waitlist
      INSERT INTO public.event_participants (event_id, user_id, username, avatar_url, status)
      VALUES (p_event_id, p_user_id, p_username, p_avatar_url, 'waitlisted');
      RETURN json_build_object('success', true, 'status', 'waitlisted');
    END IF;
  END IF;

  -- Register
  INSERT INTO public.event_participants (event_id, user_id, username, avatar_url, status)
  VALUES (p_event_id, p_user_id, p_username, p_avatar_url, 'registered');

  RETURN json_build_object('success', true, 'status', 'registered');
END;
$$;

-- Cancel registration RPC
CREATE OR REPLACE FUNCTION public.cancel_event_registration(
  p_event_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registration RECORD;
  v_next_waitlisted RECORD;
BEGIN
  SELECT * INTO v_registration FROM public.event_participants
  WHERE event_id = p_event_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Registration not found');
  END IF;

  IF v_registration.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Registration already cancelled');
  END IF;

  UPDATE public.event_participants
  SET status = 'cancelled'
  WHERE id = v_registration.id;

  -- If there was a waitlist, promote the first person
  IF v_registration.status IN ('registered', 'confirmed') THEN
    SELECT * INTO v_next_waitlisted FROM public.event_participants
    WHERE event_id = p_event_id AND status = 'waitlisted'
    ORDER BY registered_at ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.event_participants
      SET status = 'registered'
      WHERE id = v_next_waitlisted.id;
    END IF;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Get upcoming events RPC
CREATE OR REPLACE FUNCTION public.get_upcoming_events(
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events JSON;
BEGIN
  SELECT json_agg(e ORDER BY e.event_date ASC, e.start_time ASC)
  INTO v_events
  FROM (
    SELECT
      ev.id, ev.title, ev.description, ev.category_slug,
      ev.event_date, ev.start_time, ev.end_time, ev.timezone,
      ev.banner_image_url, ev.thumbnail_url, ev.event_color,
      ev.creator_id, ev.creator_username,
      ev.status, ev.max_participants, ev.visibility,
      ev.access_level, ev.min_level,
      ev.requirements, ev.rules,
      ev.location_type, ev.location_details,
      ev.tags, ev.metadata,
      ev.created_at, ev.updated_at,
      ec.name as category_name, ec.icon as category_icon, ec.color as category_color,
      (SELECT COUNT(*) FROM public.event_participants ep WHERE ep.event_id = ev.id AND ep.status IN ('registered', 'confirmed')) as participant_count
    FROM public.events ev
    LEFT JOIN public.event_categories ec ON ev.category_id = ec.id
    WHERE ev.status IN ('upcoming', 'live')
      AND ev.visibility = 'public'
    ORDER BY ev.event_date ASC, ev.start_time ASC
    LIMIT p_limit
    OFFSET p_offset
  ) e;

  RETURN json_build_object('success', true, 'events', COALESCE(v_events, '[]'::json));
END;
$$;

-- Get events by date range RPC
CREATE OR REPLACE FUNCTION public.get_events_by_date_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events JSON;
BEGIN
  SELECT json_agg(e ORDER BY e.event_date ASC, e.start_time ASC)
  INTO v_events
  FROM (
    SELECT
      ev.id, ev.title, ev.description, ev.category_slug,
      ev.event_date, ev.start_time, ev.end_time, ev.timezone,
      ev.banner_image_url, ev.thumbnail_url, ev.event_color,
      ev.creator_id, ev.creator_username,
      ev.status, ev.max_participants, ev.visibility,
      ev.access_level, ev.min_level,
      ev.requirements, ev.rules,
      ev.location_type, ev.location_details,
      ev.tags, ev.metadata,
      ev.created_at, ev.updated_at,
      ec.name as category_name, ec.icon as category_icon, ec.color as category_color,
      (SELECT COUNT(*) FROM public.event_participants ep WHERE ep.event_id = ev.id AND ep.status IN ('registered', 'confirmed')) as participant_count
    FROM public.events ev
    LEFT JOIN public.event_categories ec ON ev.category_id = ec.id
    WHERE ev.event_date BETWEEN p_start_date AND p_end_date
      AND ev.visibility = 'public'
    ORDER BY ev.event_date ASC, ev.start_time ASC
  ) e;

  RETURN json_build_object('success', true, 'events', COALESCE(v_events, '[]'::json));
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- event_categories: everyone can read active categories
CREATE POLICY "Anyone can read active event categories" ON public.event_categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage event categories" ON public.event_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );

-- events: public events visible to all, private to participants/invited
CREATE POLICY "Anyone can view public events" ON public.events
  FOR SELECT USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = events.id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_invites WHERE event_id = events.id AND invited_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator')))
  );
CREATE POLICY "Authenticated users can create events" ON public.events
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator', 'staff')))
  );
CREATE POLICY "Creators can update own events" ON public.events
  FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "Admins can manage all events" ON public.events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );

-- event_participants: users see own, event creators see all for their events
CREATE POLICY "Users can view own participations" ON public.event_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_participants.event_id AND creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator')))
  );
CREATE POLICY "Users can register themselves" ON public.event_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own registration" ON public.event_participants
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Event creators can manage participants" ON public.event_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_participants.event_id AND creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );

-- event_notifications: users see own
CREATE POLICY "Users can view own notifications" ON public.event_notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.event_notifications
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.event_notifications
  FOR INSERT WITH CHECK (true);

-- event_access_rules: follow event access
CREATE POLICY "Users can view access rules for visible events" ON public.event_access_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_access_rules.event_id
      AND (e.visibility = 'public' OR e.creator_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner'))))
    )
  );
CREATE POLICY "Event creators can manage access rules" ON public.event_access_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_access_rules.event_id AND creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );

-- event_invites: users see own invites, event creators see all
CREATE POLICY "Users can view own invites" ON public.event_invites
  FOR SELECT USING (
    invited_user_id = auth.uid()
    OR invited_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_invites.event_id AND creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );
CREATE POLICY "Event creators can create invites" ON public.event_invites
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_invites.event_id AND creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );
CREATE POLICY "Users can update own invites" ON public.event_invites
  FOR UPDATE USING (invited_user_id = auth.uid());

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON FUNCTION public.create_event(
  TEXT, TEXT, TEXT, DATE, TIME WITH TIME ZONE, TIME WITH TIME ZONE,
  TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, INTEGER,
  TEXT[], TEXT, TEXT, TEXT, TEXT[], JSONB
) TO authenticated;
GRANT ALL ON FUNCTION public.register_for_event(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_event_registration(UUID, UUID) TO authenticated;
GRANT ALL ON FUNCTION public.get_upcoming_events(INTEGER, INTEGER) TO authenticated;
GRANT ALL ON FUNCTION public.get_events_by_date_range(DATE, DATE) TO authenticated;

GRANT ALL ON public.event_categories TO authenticated;
GRANT ALL ON public.events TO authenticated;
GRANT ALL ON public.event_participants TO authenticated;
GRANT ALL ON public.event_notifications TO authenticated;
GRANT ALL ON public.event_access_rules TO authenticated;
GRANT ALL ON public.event_invites TO authenticated;

GRANT ALL ON public.event_categories TO service_role;
GRANT ALL ON public.events TO service_role;
GRANT ALL ON public.event_participants TO service_role;
GRANT ALL ON public.event_notifications TO service_role;
GRANT ALL ON public.event_access_rules TO service_role;
GRANT ALL ON public.event_invites TO service_role;
