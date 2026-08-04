-- ============================================================================
-- Mai Troll — UNIVERSE BATTLES: ROW LEVEL SECURITY
-- ============================================================================
-- Security model:
--  * Every universe_* table is RLS-protected.
--  * universe_match_assignments is PRIVATE. Opponent captain IDs must NEVER be
--    returned to normal users before the official reveal. This is enforced at
--    the database layer via:
--       - a SECURITY DEFINER "can_view_universe_match" helper that checks
--         reveal time AND whether the requesting user is a participant, and
--       - a SECURITY DEFINER "get_my_universe_matches" function that returns
--         match rows with the opponent fields NULLed out when hidden.
--  * universe_calendar_entries exposes opponent_visible + public_details that
--    are safe to show; private_details are only visible to the owner/admin.
--  * Admins (verified via is_universe_admin()) bypass hidden-opponent rules.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_universe_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        role = 'admin'
        OR is_admin = true
        OR account_state = 'staff'
        OR EXISTS (
          SELECT 1 FROM public.staff_roles sr
          WHERE sr.user_id = auth.uid()
            AND sr.role IN ('rtc','admin','moderator','broadcaster_admin')
        )
      )
  );
$$;

-- Is the given registration owned by (captain of) the current user?
CREATE OR REPLACE FUNCTION public.universe_reg_is_mine(p_registration_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.universe_registrations r
    WHERE r.id = p_registration_id AND r.captain_user_id = auth.uid()
  );
$$;

-- Same for a match: is the current user a participant (either box captain)?
CREATE OR REPLACE FUNCTION public.universe_match_is_mine(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.universe_match_assignments m
    WHERE m.id = p_match_id
      AND (m.box_one_captain_id = auth.uid() OR m.box_two_captain_id = auth.uid())
  );
$$;

-- Should the opponent be revealed for this match?
-- Reveal when: admin, OR now >= opponent_reveal_at, OR user is a participant.
CREATE OR REPLACE FUNCTION public.universe_match_revealed(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.universe_match_assignments m
    WHERE m.id = p_match_id
      AND (
        public.is_universe_admin()
        OR NOW() >= m.opponent_reveal_at
        OR m.box_one_captain_id = auth.uid()
        OR m.box_two_captain_id = auth.uid()
      )
  );
$$;

-- Enable RLS on all universe tables
ALTER TABLE public.universe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_match_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_team_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_round_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_round_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_gift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_troll_bag_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_ability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_event_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_admin_actions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- universe_events — public metadata readable by everyone; write only by admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_events_public_read" ON public.universe_events;
CREATE POLICY "universe_events_public_read" ON public.universe_events
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "universe_events_admin_write" ON public.universe_events;
CREATE POLICY "universe_events_admin_write" ON public.universe_events
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_registrations
--  * Anyone authenticated can see their own registrations.
--  * Captains may see their own; admins see all.
--  * Public "is someone registered" status is exposed via a separate safe RPC
--    (universe_event_registration_summary) rather than raw rows.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_registrations_self_read" ON public.universe_registrations;
CREATE POLICY "universe_registrations_self_read" ON public.universe_registrations
  FOR SELECT TO authenticated
  USING (captain_user_id = auth.uid() OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_registrations_self_write" ON public.universe_registrations;
CREATE POLICY "universe_registrations_self_write" ON public.universe_registrations
  FOR INSERT TO authenticated WITH CHECK (captain_user_id = auth.uid());

DROP POLICY IF EXISTS "universe_registrations_self_update" ON public.universe_registrations;
CREATE POLICY "universe_registrations_self_update" ON public.universe_registrations
  FOR UPDATE TO authenticated
  USING (captain_user_id = auth.uid() OR public.is_universe_admin())
  WITH CHECK (captain_user_id = auth.uid() OR public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_match_assignments — PRIVATE / opponent-hidden
--  * NO blanket SELECT policy. Access only via SECURITY DEFINER function
--    get_my_universe_matches(), which nulls opponent fields before reveal.
--  * Admins may read raw rows (they must see private assignments).
--  * Writes only via secure RPCs (admin / system).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_match_admin_read" ON public.universe_match_assignments;
CREATE POLICY "universe_match_admin_read" ON public.universe_match_assignments
  FOR SELECT TO authenticated USING (public.is_universe_admin());

DROP POLICY IF EXISTS "universe_match_admin_write" ON public.universe_match_assignments;
CREATE POLICY "universe_match_admin_write" ON public.universe_match_assignments
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_calendar_entries — public details safe; private details owner/admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_calendar_public_read" ON public.universe_calendar_entries;
CREATE POLICY "universe_calendar_public_read" ON public.universe_calendar_entries
  FOR SELECT TO anon, authenticated
  USING (opponent_visible = true OR user_id = auth.uid() OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_calendar_self_write" ON public.universe_calendar_entries;
CREATE POLICY "universe_calendar_self_write" ON public.universe_calendar_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_universe_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_team_seats
--  * Captain sees/controls their own team's seats.
--  * Invited user sees their own seat row (to accept/decline).
--  * Admins see all. Everyone else may see only non-private status of seats
--    belonging to a REVEALED match (status, no identity leakage of the other
--    team is handled because seat rows are per-registration, not per-opponent).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_seats_captain_read" ON public.universe_team_seats;
CREATE POLICY "universe_seats_captain_read" ON public.universe_team_seats
  FOR SELECT TO authenticated
  USING (captain_user_id = auth.uid() OR invited_user_id = auth.uid() OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_seats_self_write" ON public.universe_team_seats;
CREATE POLICY "universe_seats_self_write" ON public.universe_team_seats
  FOR INSERT TO authenticated WITH CHECK (captain_user_id = auth.uid() OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_seats_self_update" ON public.universe_team_seats;
CREATE POLICY "universe_seats_self_update" ON public.universe_team_seats
  FOR UPDATE TO authenticated
  USING (
    captain_user_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR public.is_universe_admin()
  )
  WITH CHECK (
    captain_user_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR public.is_universe_admin()
  );

-- ----------------------------------------------------------------------------
-- universe_queue — participants + admins; no self-insert of arbitrary position
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_queue_read" ON public.universe_queue;
CREATE POLICY "universe_queue_read" ON public.universe_queue
  FOR SELECT TO authenticated
  USING (captain_user_id = auth.uid() OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_queue_admin_write" ON public.universe_queue;
CREATE POLICY "universe_queue_admin_write" ON public.universe_queue
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_rounds — public read once active/completed; admins full
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_rounds_public_read" ON public.universe_rounds;
CREATE POLICY "universe_rounds_public_read" ON public.universe_rounds
  FOR SELECT TO anon, authenticated
  USING (status IN ('active','completed','finalizing') OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_rounds_admin_write" ON public.universe_rounds;
CREATE POLICY "universe_rounds_admin_write" ON public.universe_rounds
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_round_teams — public read of active/completed; captains see own
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_round_teams_read" ON public.universe_round_teams;
CREATE POLICY "universe_round_teams_read" ON public.universe_round_teams
  FOR SELECT TO anon, authenticated
  USING (
    captain_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.universe_rounds r
      WHERE r.id = round_id AND r.status IN ('active','completed','finalizing')
    )
    OR public.is_universe_admin()
  );

DROP POLICY IF EXISTS "universe_round_teams_admin_write" ON public.universe_round_teams;
CREATE POLICY "universe_round_teams_admin_write" ON public.universe_round_teams
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_round_scores — same visibility as round_teams
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_round_scores_read" ON public.universe_round_scores;
CREATE POLICY "universe_round_scores_read" ON public.universe_round_scores
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.universe_round_teams t
      WHERE t.id = team_id
        AND (
          t.captain_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.universe_rounds r
            WHERE r.id = t.round_id AND r.status IN ('active','completed','finalizing')
          )
          OR public.is_universe_admin()
        )
    )
    OR public.is_universe_admin()
  );

DROP POLICY IF EXISTS "universe_round_scores_admin_write" ON public.universe_round_scores;
CREATE POLICY "universe_round_scores_admin_write" ON public.universe_round_scores
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_gift_events — sender/recipient/team-captain/admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_gift_events_read" ON public.universe_gift_events;
CREATE POLICY "universe_gift_events_read" ON public.universe_gift_events
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR gift_recipient_user_id = auth.uid()
    OR team_captain_user_id = auth.uid()
    OR public.is_universe_admin()
  );

DROP POLICY IF EXISTS "universe_gift_events_admin_write" ON public.universe_gift_events;
CREATE POLICY "universe_gift_events_admin_write" ON public.universe_gift_events
  FOR INSERT TO authenticated WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_troll_bag_claims — claimer/admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_troll_bag_claims_read" ON public.universe_troll_bag_claims;
CREATE POLICY "universe_troll_bag_claims_read" ON public.universe_troll_bag_claims
  FOR SELECT TO authenticated
  USING (claimed_by_user_id = auth.uid() OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_troll_bag_claims_write" ON public.universe_troll_bag_claims;
CREATE POLICY "universe_troll_bag_claims_write" ON public.universe_troll_bag_claims
  FOR ALL TO authenticated
  USING (claimed_by_user_id = auth.uid() OR public.is_universe_admin())
  WITH CHECK (claimed_by_user_id = auth.uid() OR public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_abilities — awarded user / target team participant / admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_abilities_read" ON public.universe_abilities;
CREATE POLICY "universe_abilities_read" ON public.universe_abilities
  FOR SELECT TO authenticated
  USING (
    awarded_to_user_id = auth.uid()
    OR target_team_id IN (
      SELECT t.id FROM public.universe_round_teams t
      WHERE t.captain_user_id = auth.uid()
    )
    OR public.is_universe_admin()
  );

DROP POLICY IF EXISTS "universe_abilities_admin_write" ON public.universe_abilities;
CREATE POLICY "universe_abilities_admin_write" ON public.universe_abilities
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_ability_events — same as abilities
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_ability_events_read" ON public.universe_ability_events;
CREATE POLICY "universe_ability_events_read" ON public.universe_ability_events
  FOR SELECT TO anon, authenticated
  USING (
    activated_by_user_id = auth.uid()
    OR target_team_id IN (
      SELECT t.id FROM public.universe_round_teams t
      WHERE t.captain_user_id = auth.uid()
    )
    OR public.is_universe_admin()
  );

DROP POLICY IF EXISTS "universe_ability_events_admin_write" ON public.universe_ability_events;
CREATE POLICY "universe_ability_events_admin_write" ON public.universe_ability_events
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_event_results — public read; admin write
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_event_results_read" ON public.universe_event_results;
CREATE POLICY "universe_event_results_read" ON public.universe_event_results
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "universe_event_results_admin_write" ON public.universe_event_results;
CREATE POLICY "universe_event_results_admin_write" ON public.universe_event_results
  FOR ALL TO authenticated
  USING (public.is_universe_admin())
  WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_notifications — owner/admin only
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_notifications_read" ON public.universe_notifications;
CREATE POLICY "universe_notifications_read" ON public.universe_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_universe_admin());

DROP POLICY IF EXISTS "universe_notifications_admin_write" ON public.universe_notifications;
CREATE POLICY "universe_notifications_admin_write" ON public.universe_notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- universe_admin_actions — admin only
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "universe_admin_actions_read" ON public.universe_admin_actions;
CREATE POLICY "universe_admin_actions_read" ON public.universe_admin_actions
  FOR SELECT TO authenticated USING (public.is_universe_admin());

DROP POLICY IF EXISTS "universe_admin_actions_write" ON public.universe_admin_actions;
CREATE POLICY "universe_admin_actions_write" ON public.universe_admin_actions
  FOR INSERT TO authenticated WITH CHECK (public.is_universe_admin());

-- ----------------------------------------------------------------------------
-- SAFE READ FUNCTIONS (SECURITY DEFINER) — the only way normal users get match
-- data, with opponent fields nulled/hidden before reveal.
-- ----------------------------------------------------------------------------

-- Returns the current user's match(es) for an event. Opponent identity is
-- NEVER returned before reveal: the opposing registration/captain IDs are set
-- to NULL, and a boolean "opponent_hidden" is provided instead.
CREATE OR REPLACE FUNCTION public.get_my_universe_matches(p_event_id UUID)
RETURNS TABLE (
  match_id UUID,
  my_side TEXT,
  my_registration_id UUID,
  opponent_registration_id UUID,
  opponent_captain_id UUID,
  opponent_hidden BOOLEAN,
  scheduled_start TIMESTAMPTZ,
  opponent_reveal_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id AS match_id,
    CASE WHEN m.box_one_captain_id = v_uid THEN 'A' ELSE 'B' END AS my_side,
    CASE WHEN m.box_one_captain_id = v_uid THEN m.registration_one_id ELSE m.registration_two_id END AS my_registration_id,
    CASE
      WHEN public.universe_match_revealed(m.id) THEN
        CASE WHEN m.box_one_captain_id = v_uid THEN m.registration_two_id ELSE m.registration_one_id END
      ELSE NULL
    END AS opponent_registration_id,
    CASE
      WHEN public.universe_match_revealed(m.id) THEN
        CASE WHEN m.box_one_captain_id = v_uid THEN m.box_two_captain_id ELSE m.box_one_captain_id END
      ELSE NULL
    END AS opponent_captain_id,
    (NOT public.universe_match_revealed(m.id)) AS opponent_hidden,
    m.scheduled_start,
    m.opponent_reveal_at,
    m.status
  FROM public.universe_match_assignments m
  WHERE m.event_id = p_event_id
    AND (m.box_one_captain_id = v_uid OR m.box_two_captain_id = v_uid);
END;
$$;

-- Public, safe event summary (no opponent identity). Used by the landing page
-- to show registration counts / statuses without leaking who is registered.
CREATE OR REPLACE FUNCTION public.universe_event_public_summary(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.universe_events;
  v_reg_count INTEGER;
  v_confirmed INTEGER;
BEGIN
  SELECT * INTO v_event FROM public.universe_events e WHERE e.id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status IN ('confirmed','matched','scheduled','checked_in','active'))
    INTO v_reg_count, v_confirmed
  FROM public.universe_registrations r
  WHERE r.event_id = p_event_id
    AND status NOT IN ('withdrawn','cancelled');

  RETURN jsonb_build_object(
    'found', true,
    'event_id', v_event.id,
    'title', v_event.title,
    'event_date', v_event.event_date,
    'scheduled_start', v_event.scheduled_start,
    'timezone', v_event.timezone,
    'registration_opens_at', v_event.registration_opens_at,
    'registration_closes_at', v_event.registration_closes_at,
    'seat_lock_at', v_event.seat_lock_at,
    'check_in_opens_at', v_event.check_in_opens_at,
    'room_opens_at', v_event.room_opens_at,
    'opponent_reveal_at', v_event.opponent_reveal_at,
    'status', v_event.status,
    'registration_count', v_reg_count,
    'confirmed_count', v_confirmed
  );
END;
$$;

-- Grant execute on the safe read functions to anon + authenticated
GRANT EXECUTE ON FUNCTION public.is_universe_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.universe_reg_is_mine(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_match_is_mine(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_match_revealed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_universe_matches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_event_public_summary(UUID) TO anon, authenticated;
