-- Share-A-Thon Weekend Event System
-- Tables for event configuration, share submissions, participant tracking, and analytics
--
-- Relationship chain follows Mai Troll convention:
--   user_profiles(id) → streams(id) → stream_sessions
--   user_profiles(id) → battles (via streams)

-- Event configuration and status
CREATE TABLE IF NOT EXISTS public.shareathon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Share-A-Thon Weekend',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'waiting', 'active', 'completed')),
  goal_live_broadcasters INTEGER NOT NULL DEFAULT 10,
  current_live_broadcasters INTEGER NOT NULL DEFAULT 0,
  event_start_at TIMESTAMPTZ,
  event_end_at TIMESTAMPTZ,
  restrict_new_broadcasters BOOLEAN NOT NULL DEFAULT true,
  bonus_amount NUMERIC NOT NULL DEFAULT 5.00,
  cashout_fee_waived BOOLEAN NOT NULL DEFAULT true,
  badge_slug TEXT DEFAULT 'shareathon-weekend',
  peak_simultaneous_broadcasters INTEGER NOT NULL DEFAULT 0,
  total_battles_during_event INTEGER NOT NULL DEFAULT 0,
  total_shares_submitted INTEGER NOT NULL DEFAULT 0,
  new_user_registrations INTEGER NOT NULL DEFAULT 0,
  tips_earned_during_event NUMERIC NOT NULL DEFAULT 0,
  bonus_payout_total NUMERIC NOT NULL DEFAULT 0,
  cashout_fees_waived_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track eligible broadcasters (users with broadcaster status before event start)
-- user_id references user_profiles(id) following project convention
CREATE TABLE IF NOT EXISTS public.shareathon_eligible_broadcasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.shareathon_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_qualified BOOLEAN NOT NULL DEFAULT false,
  qualified_at TIMESTAMPTZ,
  stream_duration_minutes INTEGER NOT NULL DEFAULT 0,
  battles_participated INTEGER NOT NULL DEFAULT 0,
  shares_submitted INTEGER NOT NULL DEFAULT 0,
  shares_approved INTEGER NOT NULL DEFAULT 0,
  bonus_paid BOOLEAN NOT NULL DEFAULT false,
  bonus_paid_at TIMESTAMPTZ,
  cashout_fee_waived BOOLEAN NOT NULL DEFAULT false,
  disqualified BOOLEAN NOT NULL DEFAULT false,
  disqualification_reason TEXT,
  UNIQUE(event_id, user_id)
);

-- Share proof submissions from broadcasters
CREATE TABLE IF NOT EXISTS public.shareathon_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.shareathon_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'facebook', 'instagram', 'x', 'youtube', 'discord', 'reddit')),
  share_url TEXT,
  screenshot_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'more_info_requested')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Track stream sessions during the event for qualification
-- Follows the chain: user_profiles → streams → stream_sessions
CREATE TABLE IF NOT EXISTS public.shareathon_stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.shareathon_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track battles participated during the event
-- battles table links to streams, which link to user_profiles
CREATE TABLE IF NOT EXISTS public.shareathon_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.shareathon_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  battle_id UUID REFERENCES public.battles(id) ON DELETE SET NULL,
  participated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin verification queue log
CREATE TABLE IF NOT EXISTS public.shareathon_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.shareathon_events(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.shareathon_submissions(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'more_info_requested', 'revoked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shareathon_events_status ON public.shareathon_events(status);
CREATE INDEX IF NOT EXISTS idx_shareathon_eligible_event ON public.shareathon_eligible_broadcasters(event_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_eligible_user ON public.shareathon_eligible_broadcasters(user_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_qualified ON public.shareathon_eligible_broadcasters(event_id, is_qualified);
CREATE INDEX IF NOT EXISTS idx_shareathon_submissions_event ON public.shareathon_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_submissions_user ON public.shareathon_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_submissions_status ON public.shareathon_submissions(status);
CREATE INDEX IF NOT EXISTS idx_shareathon_streams_event ON public.shareathon_stream_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_streams_user ON public.shareathon_stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_battles_event ON public.shareathon_battles(event_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_battles_user ON public.shareathon_battles(user_id);
CREATE INDEX IF NOT EXISTS idx_shareathon_verification_event ON public.shareathon_verification_log(event_id);

-- Enable RLS
ALTER TABLE public.shareathon_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareathon_eligible_broadcasters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareathon_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareathon_stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareathon_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareathon_verification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shareathon_events
CREATE POLICY "Anyone can view shareathon events"
  ON public.shareathon_events FOR SELECT USING (true);

CREATE POLICY "Admins can manage shareathon events"
  ON public.shareathon_events FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

-- RLS Policies for shareathon_eligible_broadcasters
CREATE POLICY "Users can view their own eligibility"
  ON public.shareathon_eligible_broadcasters FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

CREATE POLICY "Admins can manage eligible broadcasters"
  ON public.shareathon_eligible_broadcasters FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

-- RLS Policies for shareathon_submissions
CREATE POLICY "Users can view their own submissions"
  ON public.shareathon_submissions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

CREATE POLICY "Users can create their own submissions"
  ON public.shareathon_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update submissions"
  ON public.shareathon_submissions FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

-- RLS Policies for shareathon_stream_sessions
CREATE POLICY "Users can view their own stream sessions"
  ON public.shareathon_stream_sessions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

CREATE POLICY "Admins can manage stream sessions"
  ON public.shareathon_stream_sessions FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

-- RLS Policies for shareathon_battles
CREATE POLICY "Users can view their own battle records"
  ON public.shareathon_battles FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

CREATE POLICY "Admins can manage battle records"
  ON public.shareathon_battles FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

-- RLS Policies for shareathon_verification_log
CREATE POLICY "Admins can view verification logs"
  ON public.shareathon_verification_log FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

CREATE POLICY "Admins can create verification logs"
  ON public.shareathon_verification_log FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin' OR is_admin = true));

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_shareathon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shareathon_events_updated_at ON public.shareathon_events;
CREATE TRIGGER shareathon_events_updated_at
  BEFORE UPDATE ON public.shareathon_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_shareathon_updated_at();

DROP TRIGGER IF EXISTS shareathon_submissions_updated_at ON public.shareathon_submissions;
CREATE TRIGGER shareathon_submissions_updated_at
  BEFORE UPDATE ON public.shareathon_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_shareathon_updated_at();

-- Grant permissions
GRANT ALL ON public.shareathon_events TO authenticated;
GRANT SELECT ON public.shareathon_events TO anon;
GRANT ALL ON public.shareathon_eligible_broadcasters TO authenticated;
GRANT SELECT ON public.shareathon_eligible_broadcasters TO anon;
GRANT ALL ON public.shareathon_submissions TO authenticated;
GRANT ALL ON public.shareathon_stream_sessions TO authenticated;
GRANT ALL ON public.shareathon_battles TO authenticated;
GRANT ALL ON public.shareathon_verification_log TO authenticated;

-- Insert default event row
INSERT INTO public.shareathon_events (title, description, status)
VALUES (
  'Share-A-Thon Weekend',
  'Exclusive event for current Mai Troll broadcasters. Stream, battle, and share to earn rewards!',
  'inactive'
)
ON CONFLICT DO NOTHING;
