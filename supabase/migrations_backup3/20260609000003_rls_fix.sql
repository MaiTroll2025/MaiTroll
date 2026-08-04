-- ============================================================
-- RLS FIX: Drop recursive policies and replace with simple ones
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop old recursive policies
DROP POLICY IF EXISTS "Anyone can read active event categories" ON public.event_categories;
DROP POLICY IF EXISTS "Admins can manage event categories" ON public.event_categories;
DROP POLICY IF EXISTS "Anyone can view public events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
DROP POLICY IF EXISTS "Creators can update own events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage all events" ON public.events;
DROP POLICY IF EXISTS "Users can view own participations" ON public.event_participants;
DROP POLICY IF EXISTS "Users can register themselves" ON public.event_participants;
DROP POLICY IF EXISTS "Users can update own registration" ON public.event_participants;
DROP POLICY IF EXISTS "Event creators can manage participants" ON public.event_participants;

-- Enable RLS
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- Simple policies (no cross-table subqueries = no recursion)
CREATE POLICY "Public can read event categories" ON public.event_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage event categories" ON public.event_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

CREATE POLICY "Public can view public events" ON public.events FOR SELECT USING (visibility = 'public');
CREATE POLICY "Creators can update own events" ON public.events FOR UPDATE USING (creator_id = auth.uid());
CREATE POLICY "Admins can manage all events" ON public.events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

CREATE POLICY "Users can view participants" ON public.event_participants FOR SELECT USING (true);
CREATE POLICY "Users can insert own registration" ON public.event_participants FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own event_notifications" ON public.event_notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Public can view access rules" ON public.event_access_rules FOR SELECT USING (true);

CREATE POLICY "Users can view own invites" ON public.event_invites FOR SELECT USING (invited_user_id = auth.uid());
CREATE POLICY "Admins can manage invites" ON public.event_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);
