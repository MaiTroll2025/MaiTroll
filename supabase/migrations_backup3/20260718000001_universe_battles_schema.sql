-- ============================================================================
-- Mai Troll — UNIVERSE BATTLES: CORE SCHEMA
-- ============================================================================
-- Separates the "Universe Battles" competition system from the regular
-- battle system. All tables are prefixed universe_* and never touch existing
-- battle/tournament tables.
--
-- Official schedule rule: every Universe Battle starts at 7:00 PM America/Denver
-- (Mountain Time). The `timezone` column is ALWAYS 'America/Denver'. The app
-- displays MDT during DST and MST otherwise, but the stored instant is fixed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. universe_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  seat_lock_at TIMESTAMPTZ,
  check_in_opens_at TIMESTAMPTZ,
  room_opens_at TIMESTAMPTZ,
  opponent_reveal_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','registration_open','registration_closed','seat_locked','check_in','room_open','active','paused','completed','cancelled','rescheduled')),
  current_round_id UUID,
  champion_user_id UUID,
  default_round_duration_seconds INTEGER NOT NULL DEFAULT 600,
  ability_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_universe_event_mountain_time CHECK (timezone = 'America/Denver')
);

CREATE INDEX IF NOT EXISTS idx_universe_events_scheduled_start ON public.universe_events (scheduled_start);
CREATE INDEX IF NOT EXISTS idx_universe_events_status ON public.universe_events (status);
CREATE INDEX IF NOT EXISTS idx_universe_events_date ON public.universe_events (event_date);

-- ----------------------------------------------------------------------------
-- 2. universe_registrations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  captain_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','confirmed','matched','scheduled','checked_in','active','completed','withdrawn','cancelled','disqualified','no_show')),
  registered_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  matched_at TIMESTAMPTZ,
  scheduled_battle_at TIMESTAMPTZ,
  attendance_confirmed BOOLEAN NOT NULL DEFAULT false,
  rules_accepted BOOLEAN NOT NULL DEFAULT false,
  withdrawn_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_registration_event_captain UNIQUE (event_id, captain_user_id)
);

CREATE INDEX IF NOT EXISTS idx_universe_registrations_event ON public.universe_registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_universe_registrations_captain ON public.universe_registrations (captain_user_id);
CREATE INDEX IF NOT EXISTS idx_universe_registrations_status ON public.universe_registrations (event_id, status);

-- ----------------------------------------------------------------------------
-- 3. universe_match_assignments (PRIVATE — opponent hidden until reveal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_match_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  registration_one_id UUID NOT NULL REFERENCES public.universe_registrations(id) ON DELETE CASCADE,
  registration_two_id UUID NOT NULL REFERENCES public.universe_registrations(id) ON DELETE CASCADE,
  box_one_captain_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  box_two_captain_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMPTZ NOT NULL,
  opponent_reveal_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','matched','scheduled','check_in','room_open','active','completed','cancelled','forfeited')),
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_universe_match_distinct_registrations CHECK (registration_one_id <> registration_two_id),
  CONSTRAINT chk_universe_match_distinct_captains CHECK (box_one_captain_id <> box_two_captain_id)
);

CREATE INDEX IF NOT EXISTS idx_universe_match_event ON public.universe_match_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_universe_match_reg_one ON public.universe_match_assignments (registration_one_id);
CREATE INDEX IF NOT EXISTS idx_universe_match_reg_two ON public.universe_match_assignments (registration_two_id);
CREATE INDEX IF NOT EXISTS idx_universe_match_box_one ON public.universe_match_assignments (box_one_captain_id);
CREATE INDEX IF NOT EXISTS idx_universe_match_box_two ON public.universe_match_assignments (box_two_captain_id);

-- ----------------------------------------------------------------------------
-- 4. universe_calendar_entries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_calendar_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.universe_events(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.universe_match_assignments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('event','registration','match','reminder','check_in','reveal','completed','cancelled')),
  title TEXT NOT NULL,
  scheduled_start TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  opponent_visible BOOLEAN NOT NULL DEFAULT false,
  public_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  private_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_universe_calendar_mountain_time CHECK (timezone = 'America/Denver')
);

CREATE INDEX IF NOT EXISTS idx_universe_calendar_user ON public.universe_calendar_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_universe_calendar_event ON public.universe_calendar_entries (event_id);
CREATE INDEX IF NOT EXISTS idx_universe_calendar_match ON public.universe_calendar_entries (match_id);
CREATE INDEX IF NOT EXISTS idx_universe_calendar_start ON public.universe_calendar_entries (scheduled_start);

-- ----------------------------------------------------------------------------
-- 5. universe_team_seats
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_team_seats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.universe_registrations(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.universe_match_assignments(id) ON DELETE SET NULL,
  captain_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL CHECK (seat_number IN (1,2,3)),
  invited_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'empty'
    CHECK (status IN ('empty','invited','accepted','declined','removed','expired','checked_in','connected','disconnected','locked')),
  invited_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One seat number per registration (max 3 seats per captain)
  CONSTRAINT uq_universe_seat_registration_number UNIQUE (registration_id, seat_number),
  -- One invited user per event-team (captain + event). A user cannot occupy
  -- two seat slots on the same captain's team.
  CONSTRAINT uq_universe_seat_invited_event UNIQUE (event_id, captain_user_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_universe_seats_registration ON public.universe_team_seats (registration_id);
CREATE INDEX IF NOT EXISTS idx_universe_seats_event ON public.universe_team_seats (event_id);
CREATE INDEX IF NOT EXISTS idx_universe_seats_invited ON public.universe_team_seats (invited_user_id);
CREATE INDEX IF NOT EXISTS idx_universe_seats_captain ON public.universe_team_seats (captain_user_id);

-- ----------------------------------------------------------------------------
-- 6. universe_queue
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.universe_registrations(id) ON DELETE CASCADE,
  captain_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','confirmed','matched','scheduled','waiting','next','battling','eliminated','withdrawn','disqualified','winner')),
  accepted_seat_one UUID,
  accepted_seat_two UUID,
  accepted_seat_three UUID,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_queue_event_registration UNIQUE (event_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_universe_queue_event ON public.universe_queue (event_id);
CREATE INDEX IF NOT EXISTS idx_universe_queue_captain ON public.universe_queue (captain_user_id);
CREATE INDEX IF NOT EXISTS idx_universe_queue_position ON public.universe_queue (event_id, position);

-- ----------------------------------------------------------------------------
-- 7. universe_rounds
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_id UUID REFERENCES public.universe_match_assignments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','finalizing','completed','cancelled')),
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  server_end_at TIMESTAMPTZ,
  winner_side TEXT CHECK (winner_side IN ('A','B')),
  winning_captain_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  losing_captain_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actual_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_round_event_number UNIQUE (event_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_universe_rounds_event ON public.universe_rounds (event_id);
CREATE INDEX IF NOT EXISTS idx_universe_rounds_match ON public.universe_rounds (match_id);

-- ----------------------------------------------------------------------------
-- 8. universe_round_teams
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_round_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.universe_rounds(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('A','B')),
  captain_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seat_one_user_id UUID,
  seat_two_user_id UUID,
  seat_three_user_id UUID,
  team_status TEXT NOT NULL DEFAULT 'active'
    CHECK (team_status IN ('active','disconnected','eliminated','forfeited','no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_round_team_side UNIQUE (round_id, side)
);

CREATE INDEX IF NOT EXISTS idx_universe_round_teams_round ON public.universe_round_teams (round_id);
CREATE INDEX IF NOT EXISTS idx_universe_round_teams_captain ON public.universe_round_teams (captain_user_id);

-- ----------------------------------------------------------------------------
-- 9. universe_round_scores
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_round_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.universe_rounds(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.universe_round_teams(id) ON DELETE CASCADE,
  captain_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  actual_score BIGINT NOT NULL DEFAULT 0,
  displayed_score BIGINT NOT NULL DEFAULT 0,
  captain_score_contribution BIGINT NOT NULL DEFAULT 0,
  seat_one_score_contribution BIGINT NOT NULL DEFAULT 0,
  seat_two_score_contribution BIGINT NOT NULL DEFAULT 0,
  seat_three_score_contribution BIGINT NOT NULL DEFAULT 0,
  unique_gifters INTEGER NOT NULL DEFAULT 0,
  highest_single_gift BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_round_score_team UNIQUE (round_id, team_id),
  CONSTRAINT chk_universe_round_score_nonneg CHECK (actual_score >= 0 AND displayed_score >= 0)
);

CREATE INDEX IF NOT EXISTS idx_universe_round_scores_round ON public.universe_round_scores (round_id);
CREATE INDEX IF NOT EXISTS idx_universe_round_scores_team ON public.universe_round_scores (team_id);

-- ----------------------------------------------------------------------------
-- 10. universe_gift_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_gift_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.universe_rounds(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.universe_round_teams(id) ON DELETE CASCADE,
  gift_recipient_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  team_captain_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  gift_id UUID,
  amount BIGINT NOT NULL,
  battle_points BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_gift_events_round ON public.universe_gift_events (round_id);
CREATE INDEX IF NOT EXISTS idx_universe_gift_events_team ON public.universe_gift_events (team_id);
CREATE INDEX IF NOT EXISTS idx_universe_gift_events_recipient ON public.universe_gift_events (gift_recipient_user_id);

-- ----------------------------------------------------------------------------
-- 11. universe_troll_bag_claims
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_troll_bag_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.universe_rounds(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.universe_match_assignments(id) ON DELETE SET NULL,
  claimed_by_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ability_type TEXT,
  ability_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','granted','consumed','expired','invalidated')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_troll_bag_claims_round ON public.universe_troll_bag_claims (round_id);
CREATE INDEX IF NOT EXISTS idx_universe_troll_bag_claims_user ON public.universe_troll_bag_claims (claimed_by_user_id);

-- ----------------------------------------------------------------------------
-- 12. universe_abilities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_abilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.universe_match_assignments(id) ON DELETE SET NULL,
  round_id UUID REFERENCES public.universe_rounds(id) ON DELETE CASCADE,
  awarded_to_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  awarded_to_team_id UUID REFERENCES public.universe_round_teams(id) ON DELETE CASCADE,
  ability_type TEXT NOT NULL
    CHECK (ability_type IN ('triple_gifts','timer_troll','hidden_challenger_score','turtle_mode','troll_mode','officer_fee','scramble_score')),
  target_team_id UUID REFERENCES public.universe_round_teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'awarded'
    CHECK (status IN ('awarded','available','activating','active','revealing','expired','consumed','cancelled','invalidated')),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  reveal_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  effect_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_abilities_round ON public.universe_abilities (round_id);
CREATE INDEX IF NOT EXISTS idx_universe_abilities_user ON public.universe_abilities (awarded_to_user_id);
CREATE INDEX IF NOT EXISTS idx_universe_abilities_target ON public.universe_abilities (target_team_id);

-- ----------------------------------------------------------------------------
-- 13. universe_ability_events (activation ledger / instant effects)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_ability_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ability_id UUID NOT NULL REFERENCES public.universe_abilities(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.universe_rounds(id) ON DELETE CASCADE,
  activated_by_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_team_id UUID REFERENCES public.universe_round_teams(id) ON DELETE CASCADE,
  ability_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  effect_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_ability_events_round ON public.universe_ability_events (round_id);

-- ----------------------------------------------------------------------------
-- 14. universe_event_results
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_event_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.universe_events(id) ON DELETE CASCADE,
  champion_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  champion_seat_one UUID,
  champion_seat_two UUID,
  champion_seat_three UUID,
  total_rounds_won INTEGER NOT NULL DEFAULT 0,
  total_actual_score BIGINT NOT NULL DEFAULT 0,
  team_gift_total BIGINT NOT NULL DEFAULT 0,
  captain_contribution BIGINT NOT NULL DEFAULT 0,
  seat_one_contribution BIGINT NOT NULL DEFAULT 0,
  seat_two_contribution BIGINT NOT NULL DEFAULT 0,
  seat_three_contribution BIGINT NOT NULL DEFAULT 0,
  unique_supporters INTEGER NOT NULL DEFAULT 0,
  highest_single_gift BIGINT NOT NULL DEFAULT 0,
  longest_winning_streak INTEGER NOT NULL DEFAULT 0,
  final_battle_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_event_results_event ON public.universe_event_results (event_id);

-- ----------------------------------------------------------------------------
-- 15. universe_notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.universe_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_notifications_user ON public.universe_notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_universe_notifications_event ON public.universe_notifications (event_id);

-- ----------------------------------------------------------------------------
-- 16. universe_admin_actions (audit log — every manual action logged)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_admin_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.universe_events(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_admin_actions_event ON public.universe_admin_actions (event_id);
CREATE INDEX IF NOT EXISTS idx_universe_admin_actions_admin ON public.universe_admin_actions (admin_user_id);

-- ----------------------------------------------------------------------------
-- Triggers: keep updated_at current
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universe_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'universe_events','universe_registrations','universe_match_assignments',
    'universe_calendar_entries','universe_team_seats','universe_queue',
    'universe_rounds','universe_round_teams','universe_round_scores',
    'universe_gift_events','universe_troll_bag_claims','universe_abilities',
    'universe_ability_events','universe_event_results','universe_notifications',
    'universe_admin_actions'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$I_updated_at ON public.%1$I;
       CREATE TRIGGER trg_%1$I_updated_at BEFORE UPDATE ON public.%1$I
       FOR EACH ROW EXECUTE FUNCTION public.universe_set_updated_at();',
      t
    );
  END LOOP;
END $$;
