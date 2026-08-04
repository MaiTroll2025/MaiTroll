-- ============================================================================
-- Mai Troll — UNIVERSE MODE: SHOWDOWN SIGN-UP SYSTEM
-- ============================================================================
-- Rebuilds the Universe tab as a SHOWDOWN sign-up experience instead of an
-- overview command center. Anyone can register for the next Universe Battle.
-- On sign-up the system:
--   * mints an auto-generated, ANONYMOUS battle name (blind matching — a user
--     cannot see who they will fight until the official reveal)
--   * creates the battle and a calendar entry for that user
--   * fills the battle toward a 30-user cap, then overflows additional
--     registrations to the next configured battle date (default Friday)
--   * lets a registered user invite up to 3 friends; when a friend accepts
--     they are automatically added to the same battle as a GUEST
--   * exposes a realtime-synced public sign-up list + left-side queue
--
-- All scheduling stays fixed at 7:00 PM America/Denver (Mountain Time).
-- The regular battle system is NOT touched.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NEW TABLES
-- ----------------------------------------------------------------------------

-- universe_showdown_battles: one battle per official date, capacity 30.
CREATE TABLE IF NOT EXISTS public.universe_showdown_battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  capacity INTEGER NOT NULL DEFAULT 30,
  registered_count INTEGER NOT NULL DEFAULT 0,
  guest_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','full','sealed','active','completed','cancelled')),
  is_overflow BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_date UNIQUE (event_date),
  CONSTRAINT chk_universe_showdown_mountain_time CHECK (timezone = 'America/Denver'),
  CONSTRAINT chk_universe_showdown_capacity CHECK (capacity > 0 AND capacity <= 30)
);

CREATE INDEX IF NOT EXISTS idx_universe_showdown_start ON public.universe_showdown_battles (scheduled_start);
CREATE INDEX IF NOT EXISTS idx_universe_showdown_status ON public.universe_showdown_battles (status);

-- universe_showdown_signups: each participating user (and each accepted guest).
-- battle_name is the auto-generated anonymous handle used in the blind UI.
CREATE TABLE IF NOT EXISTS public.universe_showdown_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID NOT NULL REFERENCES public.universe_showdown_battles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  battle_name TEXT NOT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  invited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  seat_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','withdrawn','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_signup_battle_user UNIQUE (battle_id, user_id),
  CONSTRAINT chk_universe_showdown_seat CHECK (seat_index >= 0 AND seat_index <= 30)
);

CREATE INDEX IF NOT EXISTS idx_universe_showdown_signups_battle ON public.universe_showdown_signups (battle_id);
CREATE INDEX IF NOT EXISTS idx_universe_showdown_signups_user ON public.universe_showdown_signups (user_id);

-- universe_showdown_invites: captain (primary signup) -> up to 3 guests.
CREATE TABLE IF NOT EXISTS public.universe_showdown_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID NOT NULL REFERENCES public.universe_showdown_battles(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_invite UNIQUE (battle_id, inviter_user_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_universe_showdown_invites_battle ON public.universe_showdown_invites (battle_id);
CREATE INDEX IF NOT EXISTS idx_universe_showdown_invites_invited ON public.universe_showdown_invites (invited_user_id);
CREATE INDEX IF NOT EXISTS idx_universe_showdown_invites_inviter ON public.universe_showdown_invites (inviter_user_id);

-- ----------------------------------------------------------------------------
-- 2. ADMIN-CONFIGURED BATTLE DATES (default: two per week, one overflow Friday)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_showdown_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  is_overflow BOOLEAN NOT NULL DEFAULT false,
  capacity INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_date_cfg UNIQUE (event_date),
  CONSTRAINT chk_universe_showdown_cfg_mountain CHECK (timezone = 'America/Denver')
);

CREATE INDEX IF NOT EXISTS idx_universe_showdown_dates_start ON public.universe_showdown_dates (scheduled_start);

-- Seed two default weekly slots: Tuesday 7PM (primary) and Friday 7PM (overflow).
-- 7:00 PM America/Denver.
INSERT INTO public.universe_showdown_dates (event_date, scheduled_start, is_overflow, capacity)
SELECT d, (d + TIME '19:00:00') AT TIME ZONE 'America/Denver', ov, 30
FROM (
  VALUES
    (DATE '2026-07-21', false),  -- Tuesday
    (DATE '2026-07-24', true)    -- Friday (overflow / second date)
) AS t(d, ov)
WHERE NOT EXISTS (SELECT 1 FROM public.universe_showdown_dates WHERE event_date = d)
ON CONFLICT (event_date) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. HELPERS
-- ----------------------------------------------------------------------------

-- Build the anonymous battle name pool (adjective + noun + 3-digit tag).
CREATE OR REPLACE FUNCTION public.universe_random_battle_name()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_adj_pool TEXT[];
  v_noun_pool TEXT[];
  v_adj TEXT;
  v_noun TEXT;
  v_tag INTEGER;
  v_name TEXT;
  v_tries INTEGER := 0;
BEGIN
  v_adj_pool := ARRAY['Neon','Void','Crimson','Hyper','Shadow','Plasma','Rogue','Toxic','Astro','Cyber','Lunar','Solar','Frost','Ember','Rift','Static','Vapor','Gloom','Quantum','Savage'];
  v_noun_pool := ARRAY['Troll','Reaper','Phantom','Glitch','Comet','Vortex','Specter','Bandit','Sentinel','Nomad','Wraith','Razor','Titan','Echo','Drifter','Forge','Pulse','Hunter','Menace','Raider'];

  LOOP
    v_adj := v_adj_pool[1 + floor(random() * array_length(v_adj_pool, 1))];
    v_noun := v_noun_pool[1 + floor(random() * array_length(v_noun_pool, 1))];
    v_tag := floor(random() * 900 + 100)::INTEGER;
    v_name := v_adj || v_noun || '#' || v_tag::TEXT;
    v_tries := v_tries + 1;
    EXIT WHEN v_tries > 8 OR NOT EXISTS (
      SELECT 1 FROM public.universe_showdown_signups s
      JOIN public.universe_showdown_battles b ON b.id = s.battle_id
      WHERE s.battle_name = v_name AND b.status <> 'cancelled'
    );
  END LOOP;
  RETURN v_name;
END;
$$;

-- Resolve the target battle: the next OPEN battle with capacity, otherwise the
-- next overflow/future date. Creates the battle row on demand from configured dates.
CREATE OR REPLACE FUNCTION public.universe_resolve_showdown_battle(p_as_of TIMESTAMPTZ DEFAULT NOW())
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_battle UUID;
  v_date RECORD;
BEGIN
  -- 1. Prefer a non-full, non-sealed battle starting in the future.
  SELECT b.id INTO v_battle
  FROM public.universe_showdown_battles b
  WHERE b.status IN ('open')
    AND b.registered_count + b.guest_count < b.capacity
    AND b.scheduled_start >= p_as_of
  ORDER BY b.scheduled_start ASC
  LIMIT 1;

  IF v_battle IS NOT NULL THEN
    RETURN v_battle;
  END IF;

  -- 2. Otherwise create from the next configured date that has no battle yet.
  FOR v_date IN
    SELECT * FROM public.universe_showdown_dates
    WHERE enabled = true AND scheduled_start >= p_as_of
    ORDER BY scheduled_start ASC
  LOOP
    INSERT INTO public.universe_showdown_battles (event_date, scheduled_start, timezone, capacity, is_overflow)
    VALUES (v_date.event_date, v_date.scheduled_start, 'America/Denver', v_date.capacity, v_date.is_overflow)
    ON CONFLICT (event_date) DO NOTHING
    RETURNING id INTO v_battle;

    IF v_battle IS NULL THEN
      SELECT id INTO v_battle FROM public.universe_showdown_battles WHERE event_date = v_date.event_date;
    END IF;

    IF v_battle IS NOT NULL THEN
      -- Update status if it became full while empty.
      UPDATE public.universe_showdown_battles
      SET status = CASE
            WHEN registered_count + guest_count >= capacity THEN 'full'
            ELSE 'open' END,
          updated_at = NOW()
      WHERE id = v_battle;
      RETURN v_battle;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Keep battle counts + calendar + queue in sync after a signup write.
CREATE OR REPLACE FUNCTION public.universe_sync_showdown_battle(p_battle_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_b RECORD;
BEGIN
  SELECT * INTO v_b FROM public.universe_showdown_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.universe_showdown_battles
  SET registered_count = (
        SELECT COUNT(*) FROM public.universe_showdown_signups
        WHERE battle_id = p_battle_id AND is_guest = false AND status = 'active'
      ),
      guest_count = (
        SELECT COUNT(*) FROM public.universe_showdown_signups
        WHERE battle_id = p_battle_id AND is_guest = true AND status = 'active'
      ),
      status = CASE
        WHEN status IN ('active','completed','cancelled') THEN status
        WHEN (registered_count + guest_count) >= capacity THEN 'full'
        ELSE 'open' END,
      updated_at = NOW()
  WHERE id = p_battle_id;

  -- Realtime: nudge a calendar entry existence so subscribers refresh.
  INSERT INTO public.universe_calendar_entries (
    event_id, match_id, user_id, entry_type, title, scheduled_start,
    timezone, opponent_visible, public_details, private_details, status
  )
  SELECT NULL, NULL, NULL, 'event',
         'Universe Showdown — ' || to_char(v_b.event_date, 'Dy Mon DD'),
         v_b.scheduled_start, 'America/Denver', false,
         jsonb_build_object('capacity', v_b.capacity, 'registered', v_b.registered_count, 'guests', v_b.guest_count, 'blind', true),
         '{}'::jsonb, 'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.universe_calendar_entries
    WHERE entry_type = 'event' AND scheduled_start = v_b.scheduled_start
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. CORE RPCS
-- ----------------------------------------------------------------------------

-- Sign up ANY authenticated user for the next Universe Showdown battle.
CREATE OR REPLACE FUNCTION public.universe_showdown_register()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_battle UUID;
  v_name TEXT;
  v_seat INTEGER;
  v_signup_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in to join the showdown');
  END IF;

  -- Already signed up? return existing.
  SELECT s.id, s.battle_id INTO v_signup_id, v_battle
  FROM public.universe_showdown_signups s
  WHERE s.user_id = v_uid AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1;

  IF v_signup_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already', true, 'signup_id', v_signup_id, 'battle_id', v_battle, 'battle_name', (SELECT battle_name FROM public.universe_showdown_signups WHERE id = v_signup_id));
  END IF;

  v_battle := public.universe_resolve_showdown_battle(NOW());
  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No Universe Battle is open for registration right now');
  END IF;

  v_name := public.universe_random_battle_name();
  SELECT COALESCE(MAX(seat_index), 0) + 1 INTO v_seat
  FROM public.universe_showdown_signups WHERE battle_id = v_battle AND status = 'active';

  INSERT INTO public.universe_showdown_signups (battle_id, user_id, battle_name, is_guest, seat_index)
  VALUES (v_battle, v_uid, v_name, false, v_seat)
  RETURNING id INTO v_signup_id;

  PERFORM public.universe_sync_showdown_battle(v_battle);

  RETURN jsonb_build_object('success', true, 'signup_id', v_signup_id, 'battle_id', v_battle, 'battle_name', v_name);
END;
$$;

-- Withdraw from a showdown battle.
CREATE OR REPLACE FUNCTION public.universe_showdown_withdraw()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_battle UUID;
  v_signup_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, battle_id INTO v_signup_id, v_battle
  FROM public.universe_showdown_signups
  WHERE user_id = v_uid AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_signup_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in a battle');
  END IF;

  UPDATE public.universe_showdown_signups SET status = 'withdrawn', updated_at = NOW() WHERE id = v_signup_id;
  PERFORM public.universe_sync_showdown_battle(v_battle);

  RETURN jsonb_build_object('success', true, 'battle_id', v_battle);
END;
$$;

-- Invite a friend (up to 3). Only the primary signup holder may invite.
CREATE OR REPLACE FUNCTION public.universe_showdown_invite(
  p_invited_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_my_signup RECORD;
  v_invite_count INTEGER;
  v_invite_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_uid = p_invited_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot invite yourself');
  END IF;

  SELECT * INTO v_my_signup
  FROM public.universe_showdown_signups
  WHERE user_id = v_uid AND is_guest = false AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_my_signup IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Register before inviting guests');
  END IF;

  SELECT COUNT(*) INTO v_invite_count
  FROM public.universe_showdown_invites
  WHERE battle_id = v_my_signup.battle_id AND inviter_user_id = v_uid AND status IN ('pending','accepted');

  IF v_invite_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You can invite at most 3 guests');
  END IF;

  INSERT INTO public.universe_showdown_invites (battle_id, inviter_user_id, invited_user_id, status)
  VALUES (v_my_signup.battle_id, v_uid, p_invited_user_id, 'pending')
  ON CONFLICT (battle_id, inviter_user_id, invited_user_id)
  DO UPDATE SET status = 'pending', updated_at = NOW()
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('success', true, 'invite_id', v_invite_id);
END;
$$;

-- Respond to a guest invitation.
CREATE OR REPLACE FUNCTION public.universe_showdown_respond_invite(
  p_invite_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_invite RECORD;
  v_name TEXT;
  v_seat INTEGER;
  v_signup_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invite
  FROM public.universe_showdown_invites WHERE id = p_invite_id AND invited_user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already resolved');
  END IF;

  IF NOT p_accept THEN
    UPDATE public.universe_showdown_invites SET status = 'declined', updated_at = NOW() WHERE id = p_invite_id;
    RETURN jsonb_build_object('success', true, 'status', 'declined');
  END IF;

  -- Auto-add the accepting user to the same battle as a guest.
  v_name := public.universe_random_battle_name();
  SELECT COALESCE(MAX(seat_index), 0) + 1 INTO v_seat
  FROM public.universe_showdown_signups WHERE battle_id = v_invite.battle_id AND status = 'active';

  INSERT INTO public.universe_showdown_signups (battle_id, user_id, battle_name, is_guest, invited_by, seat_index)
  VALUES (v_invite.battle_id, v_uid, v_name, true, v_invite.inviter_user_id, v_seat)
  ON CONFLICT (battle_id, user_id) DO UPDATE SET is_guest = true, status = 'active', updated_at = NOW()
  RETURNING id INTO v_signup_id;

  UPDATE public.universe_showdown_invites SET status = 'accepted', updated_at = NOW() WHERE id = p_invite_id;
  PERFORM public.universe_sync_showdown_battle(v_invite.battle_id);

  RETURN jsonb_build_object('success', true, 'status', 'accepted', 'battle_id', v_invite.battle_id, 'battle_name', v_name);
END;
$$;

-- Remove/cancel a pending or accepted guest invite (captain only).
CREATE OR REPLACE FUNCTION public.universe_showdown_remove_invite(
  p_invite_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_invite RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO v_invite
  FROM public.universe_showdown_invites WHERE id = p_invite_id AND inviter_user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your invitation');
  END IF;

  UPDATE public.universe_showdown_invites SET status = 'removed', updated_at = NOW() WHERE id = p_invite_id;

  -- If the guest already accepted, withdraw their guest signup.
  UPDATE public.universe_showdown_signups
  SET status = 'removed', updated_at = NOW()
  WHERE battle_id = v_invite.battle_id AND user_id = v_invite.invited_user_id AND is_guest = true;

  PERFORM public.universe_sync_showdown_battle(v_invite.battle_id);
  RETURN jsonb_build_object('success', true, 'status', 'removed');
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. PUBLIC / BLIND READ VIEWS (usernames hidden, battle names visible)
-- ----------------------------------------------------------------------------

-- Public sign-up roster: shows auto battle names + status, NEVER real usernames.
CREATE OR REPLACE VIEW public.universe_showdown_public AS
SELECT
  b.id AS battle_id,
  b.event_date,
  b.scheduled_start,
  b.capacity,
  b.registered_count,
  b.guest_count,
  b.status AS battle_status,
  b.is_overflow,
  s.id AS signup_id,
  s.battle_name,
  s.is_guest,
  s.seat_index,
  s.status AS signup_status,
  s.created_at
FROM public.universe_showdown_battles b
JOIN public.universe_showdown_signups s ON s.battle_id = b.id
WHERE s.status = 'active' AND b.status <> 'cancelled';

-- Left-side live queue (ordered by seat for the active/next battle).
CREATE OR REPLACE VIEW public.universe_showdown_queue AS
SELECT
  b.id AS battle_id,
  b.scheduled_start,
  s.id AS signup_id,
  s.battle_name,
  s.is_guest,
  s.seat_index,
  row_number() OVER (PARTITION BY b.id ORDER BY s.seat_index ASC) AS queue_position
FROM public.universe_showdown_battles b
JOIN public.universe_showdown_signups s ON s.battle_id = b.id
WHERE s.status = 'active' AND b.status IN ('open','full','sealed')
ORDER BY b.scheduled_start ASC, s.seat_index ASC;

-- ----------------------------------------------------------------------------
-- 6. GRANTS
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.universe_showdown_battles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universe_showdown_signups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.universe_showdown_invites TO authenticated;
GRANT SELECT ON public.universe_showdown_dates TO authenticated;
GRANT SELECT ON public.universe_showdown_public TO authenticated;
GRANT SELECT ON public.universe_showdown_queue TO authenticated;

GRANT EXECUTE ON FUNCTION public.universe_random_battle_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_resolve_showdown_battle(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_sync_showdown_battle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_showdown_register() TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_showdown_withdraw() TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_showdown_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_showdown_respond_invite(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.universe_showdown_remove_invite(UUID) TO authenticated;

-- ============================================================================
-- RLS — everyone may VIEW the blind roster/queue; participants may only edit
-- their own rows. Opponent real identities are never exposed (only battle_name).
-- ============================================================================
ALTER TABLE public.universe_showdown_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_showdown_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_showdown_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_showdown_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Showdown battles visible to all" ON public.universe_showdown_battles;
CREATE POLICY "Showdown battles visible to all" ON public.universe_showdown_battles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Showdown signups visible to all (blind)" ON public.universe_showdown_signups;
CREATE POLICY "Showdown signups visible to all (blind)" ON public.universe_showdown_signups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own signup" ON public.universe_showdown_signups;
CREATE POLICY "Users manage own signup" ON public.universe_showdown_signups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Showdown invites visible to participants" ON public.universe_showdown_invites;
CREATE POLICY "Showdown invites visible to participants" ON public.universe_showdown_invites
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own invites" ON public.universe_showdown_invites;
CREATE POLICY "Users manage own invites" ON public.universe_showdown_invites
  FOR ALL USING (auth.uid() = inviter_user_id OR auth.uid() = invited_user_id)
  WITH CHECK (auth.uid() = inviter_user_id);

DROP POLICY IF EXISTS "Showdown dates visible to all" ON public.universe_showdown_dates;
CREATE POLICY "Showdown dates visible to all" ON public.universe_showdown_dates
  FOR SELECT USING (true);

-- Update triggers
CREATE OR REPLACE FUNCTION public.universe_showdown_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_universe_showdown_battles_updated ON public.universe_showdown_battles;
CREATE TRIGGER trg_universe_showdown_battles_updated BEFORE UPDATE ON public.universe_showdown_battles
  FOR EACH ROW EXECUTE FUNCTION public.universe_showdown_set_updated_at();

DROP TRIGGER IF EXISTS trg_universe_showdown_signups_updated ON public.universe_showdown_signups;
CREATE TRIGGER trg_universe_showdown_signups_updated BEFORE UPDATE ON public.universe_showdown_signups
  FOR EACH ROW EXECUTE FUNCTION public.universe_showdown_set_updated_at();

DROP TRIGGER IF EXISTS trg_universe_showdown_invites_updated ON public.universe_showdown_invites;
CREATE TRIGGER trg_universe_showdown_invites_updated BEFORE UPDATE ON public.universe_showdown_invites
  FOR EACH ROW EXECUTE FUNCTION public.universe_showdown_set_updated_at();
