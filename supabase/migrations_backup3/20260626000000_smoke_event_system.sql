-- ============================================================
-- SMOKE EVENT SYSTEM - Migration (SAFE v4)
-- Tables first, then helper function, then RLS, then RPCs
-- ============================================================

-- ============================================================
-- TABLES (created first so helper function can reference them)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stream_smoke_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  seat_count integer DEFAULT 6 CHECK (seat_count >= 1 AND seat_count <= 12),
  raffle_enabled boolean DEFAULT true,
  troll_drop_enabled boolean DEFAULT true,
  song_queue_enabled boolean DEFAULT true,
  dj_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_smoke_event_per_stream
  ON public.stream_smoke_events (stream_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.troll_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  coin_value integer NOT NULL CHECK (coin_value > 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds IN (3, 10, 30)),
  total_bills integer NOT NULL DEFAULT 25 CHECK (total_bills > 0 AND total_bills <= 500),
  status text DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.troll_drop_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  troll_drop_id uuid NOT NULL REFERENCES public.troll_drops(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bill_index integer NOT NULL,
  coin_value integer NOT NULL,
  claimed_at timestamptz DEFAULT now(),
  UNIQUE(troll_drop_id, bill_index)
);

CREATE TABLE IF NOT EXISTS public.stream_song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  dj_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  song_title text NOT NULL,
  artist text,
  song_link text,
  total_cost integer DEFAULT 10,
  dj_share integer DEFAULT 5,
  admin_share integer DEFAULT 5,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'played', 'skipped', 'refunded')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stream_raffles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  smoke_event_id uuid REFERENCES public.stream_smoke_events(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ticket_cost integer DEFAULT 500,
  status text DEFAULT 'active' CHECK (status IN ('active', 'drawing', 'completed', 'cancelled')),
  draw_interval_minutes integer DEFAULT 30,
  current_round integer DEFAULT 1,
  next_draw_at timestamptz NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stream_raffle_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.stream_raffles(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  ticket_number bigint GENERATED ALWAYS AS IDENTITY,
  cost integer DEFAULT 500,
  purchased_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stream_raffle_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.stream_raffles(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  place integer NOT NULL CHECK (place IN (1, 2, 3)),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  prize_usd numeric(12,2) NOT NULL,
  selected_at timestamptz DEFAULT now(),
  payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'approved', 'paid', 'void')),
  UNIQUE(raffle_id, round_number, place)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.stream_smoke_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_drop_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_song_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_raffle_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_raffle_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "smoke_events_read" ON public.stream_smoke_events;
CREATE POLICY "smoke_events_read" ON public.stream_smoke_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "smoke_events_write" ON public.stream_smoke_events;
CREATE POLICY "smoke_events_write" ON public.stream_smoke_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'owner')));

DROP POLICY IF EXISTS "troll_drops_read" ON public.troll_drops;
CREATE POLICY "troll_drops_read" ON public.troll_drops FOR SELECT USING (true);
DROP POLICY IF EXISTS "troll_drops_write" ON public.troll_drops;
CREATE POLICY "troll_drops_write" ON public.troll_drops FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'owner')));

DROP POLICY IF EXISTS "troll_drop_claims_read" ON public.troll_drop_claims;
CREATE POLICY "troll_drop_claims_read" ON public.troll_drop_claims FOR SELECT USING (true);
DROP POLICY IF EXISTS "troll_drop_claims_insert" ON public.troll_drop_claims;
CREATE POLICY "troll_drop_claims_insert" ON public.troll_drop_claims FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "song_requests_read" ON public.stream_song_requests;
CREATE POLICY "song_requests_read" ON public.stream_song_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "song_requests_insert" ON public.stream_song_requests;
CREATE POLICY "song_requests_insert" ON public.stream_song_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "raffles_read" ON public.stream_raffles;
CREATE POLICY "raffles_read" ON public.stream_raffles FOR SELECT USING (true);
DROP POLICY IF EXISTS "raffles_write" ON public.stream_raffles;
CREATE POLICY "raffles_write" ON public.stream_raffles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'owner')));

DROP POLICY IF EXISTS "raffle_tickets_read" ON public.stream_raffle_tickets;
CREATE POLICY "raffle_tickets_read" ON public.stream_raffle_tickets FOR SELECT USING (true);
DROP POLICY IF EXISTS "raffle_tickets_insert" ON public.stream_raffle_tickets;
CREATE POLICY "raffle_tickets_insert" ON public.stream_raffle_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "raffle_winners_read" ON public.stream_raffle_winners;
CREATE POLICY "raffle_winners_read" ON public.stream_raffle_winners FOR SELECT USING (true);
DROP POLICY IF EXISTS "raffle_winners_write" ON public.stream_raffle_winners;
CREATE POLICY "raffle_winners_write" ON public.stream_raffle_winners FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'owner')));

-- ============================================================
-- HELPER FUNCTION (after tables exist)
-- ============================================================
CREATE OR REPLACE FUNCTION public._smoke_check_admin_or_host(p_stream_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR up.is_admin = true
        OR up.role = 'owner'
        OR EXISTS (
          SELECT 1 FROM public.streams s
          WHERE s.id = p_stream_id AND s.user_id = auth.uid()
        )
      )
  );
$$;

-- ============================================================
-- RPC: Start Smoke Event
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_smoke_event(
  p_stream_id uuid,
  p_seat_count integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_smoke_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF NOT public._smoke_check_admin_or_host(p_stream_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin or stream host can start a smoke event');
  END IF;

  p_seat_count := GREATEST(1, LEAST(12, p_seat_count));

  UPDATE public.stream_smoke_events
  SET is_active = false, ended_at = now(), updated_at = now()
  WHERE stream_id = p_stream_id AND is_active = true;

  INSERT INTO public.stream_smoke_events (stream_id, created_by, seat_count)
  VALUES (p_stream_id, v_user_id, p_seat_count)
  RETURNING id INTO v_smoke_id;

  INSERT INTO public.stream_raffles (stream_id, smoke_event_id, created_by, next_draw_at)
  VALUES (p_stream_id, v_smoke_id, v_user_id, now() + interval '30 minutes');

  RETURN jsonb_build_object(
    'success', true,
    'smoke_event_id', v_smoke_id,
    'seat_count', p_seat_count,
    'message', 'Smoke Event started!'
  );
END;
$$;

-- ============================================================
-- RPC: End Smoke Event
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_smoke_event(p_stream_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public._smoke_check_admin_or_host(p_stream_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin or stream host can end a smoke event');
  END IF;

  UPDATE public.stream_smoke_events
  SET is_active = false, ended_at = now(), updated_at = now()
  WHERE stream_id = p_stream_id AND is_active = true;

  UPDATE public.stream_raffles
  SET status = 'completed', ended_at = now(), updated_at = now()
  WHERE stream_id = p_stream_id AND status = 'active';

  RETURN jsonb_build_object('success', true, 'message', 'Smoke Event ended');
END;
$$;

-- ============================================================
-- RPC: Start Troll Drop (with smoke event check)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_troll_drop(
  p_stream_id uuid,
  p_coin_value integer,
  p_duration_seconds integer,
  p_total_bills integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_drop_id uuid;
  v_smoke record;
BEGIN
  IF NOT public._smoke_check_admin_or_host(p_stream_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin or stream host can start a troll drop');
  END IF;

  SELECT * INTO v_smoke FROM public.stream_smoke_events
  WHERE stream_id = p_stream_id AND is_active = true AND troll_drop_enabled = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active smoke event with Troll Drop enabled');
  END IF;

  IF p_duration_seconds NOT IN (3, 10, 30) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid duration. Use 3, 10, or 30 seconds.');
  END IF;

  p_coin_value := GREATEST(1, p_coin_value);
  p_total_bills := GREATEST(1, LEAST(500, p_total_bills));

  UPDATE public.troll_drops
  SET status = 'ended', ends_at = now()
  WHERE stream_id = p_stream_id AND status = 'active';

  INSERT INTO public.troll_drops (stream_id, created_by, coin_value, duration_seconds, total_bills, ends_at)
  VALUES (p_stream_id, auth.uid(), p_coin_value, p_duration_seconds, p_total_bills,
          now() + (p_duration_seconds || ' seconds')::interval)
  RETURNING id INTO v_drop_id;

  RETURN jsonb_build_object(
    'success', true,
    'drop_id', v_drop_id,
    'coin_value', p_coin_value,
    'duration_seconds', p_duration_seconds,
    'total_bills', p_total_bills,
    'message', 'Troll Drop started!'
  );
END;
$$;

-- ============================================================
-- RPC: Claim Troll Drop Bill (FIX: validates bill_index range)
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_troll_drop_bill(
  p_troll_drop_id uuid,
  p_bill_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_drop record;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_drop FROM public.troll_drops
  WHERE id = p_troll_drop_id AND status = 'active' AND ends_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Drop not found or expired');
  END IF;

  -- FIX: Validate bill_index is within valid range
  IF p_bill_index < 1 OR p_bill_index > v_drop.total_bills THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bill index');
  END IF;

  -- ATOMIC CLAIM: Insert first, unique constraint prevents duplicates
  BEGIN
    INSERT INTO public.troll_drop_claims (troll_drop_id, stream_id, user_id, bill_index, coin_value)
    VALUES (p_troll_drop_id, v_drop.stream_id, v_user_id, p_bill_index, v_drop.coin_value);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill already claimed');
  END;

  -- Credit user
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_drop.coin_value,
      total_earned_coins = COALESCE(total_earned_coins, 0) + v_drop.coin_value,
      updated_at = now()
  WHERE id = v_user_id;

  -- Log to coin_ledger if table exists (best-effort)
  BEGIN
    INSERT INTO public.coin_ledger (user_id, counterparty_id, type, direction, coins, amount_usd, meta, created_at)
    VALUES (v_user_id, v_drop.created_by, 'troll_drop', 'credit', v_drop.coin_value, 0,
            jsonb_build_object('drop_id', p_troll_drop_id, 'bill_index', p_bill_index), now());
  EXCEPTION WHEN undefined_table THEN
    NULL; -- coin_ledger not available, skip
  END;

  RETURN jsonb_build_object(
    'success', true,
    'coins_earned', v_drop.coin_value,
    'message', 'Claimed ' || v_drop.coin_value || ' coins!'
  );
END;
$$;

-- ============================================================
-- RPC: Buy Raffle Ticket
-- ============================================================
CREATE OR REPLACE FUNCTION public.buy_raffle_ticket(
  p_raffle_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raffle record;
  v_user_id uuid;
  v_cost integer;
  v_balance integer;
  v_ticket_count integer;
  i integer;
BEGIN
  v_user_id := auth.uid();

  IF p_quantity < 1 OR p_quantity > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid quantity (1-10)');
  END IF;

  SELECT * INTO v_raffle FROM public.stream_raffles
  WHERE id = p_raffle_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raffle not found or not active');
  END IF;

  v_cost := v_raffle.ticket_cost * p_quantity;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_cost,
      total_spent_coins = COALESCE(total_spent_coins, 0) + v_cost,
      updated_at = now()
  WHERE id = v_user_id AND COALESCE(troll_coins, 0) >= v_cost;

  IF NOT FOUND THEN
    SELECT COALESCE(troll_coins, 0) INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins', 'required', v_cost, 'balance', v_balance);
  END IF;

  FOR i IN 1..p_quantity LOOP
    INSERT INTO public.stream_raffle_tickets (raffle_id, stream_id, user_id, round_number, cost)
    VALUES (p_raffle_id, v_raffle.stream_id, v_user_id, v_raffle.current_round, v_raffle.ticket_cost);
  END LOOP;

  SELECT COUNT(*) INTO v_ticket_count FROM public.stream_raffle_tickets
  WHERE raffle_id = p_raffle_id AND user_id = v_user_id AND round_number = v_raffle.current_round;

  SELECT COALESCE(troll_coins, 0) INTO v_balance FROM public.user_profiles WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'tickets_purchased', p_quantity,
    'total_tickets', v_ticket_count,
    'cost', v_cost,
    'new_balance', v_balance
  );
END;
$$;

-- ============================================================
-- RPC: Draw Raffle Winners (FIX: row locking to prevent double draw)
-- ============================================================
CREATE OR REPLACE FUNCTION public.draw_raffle_winners(p_raffle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raffle record;
  v_stream_id uuid;
  v_winner1 uuid;
  v_winner2 uuid;
  v_winner3 uuid;
  v_round integer;
BEGIN
  -- Lock the raffle row to prevent concurrent draws
  SELECT r.*, s.id AS sid INTO v_raffle
  FROM public.stream_raffles r
  JOIN public.streams s ON s.id = r.stream_id
  WHERE r.id = p_raffle_id AND r.status = 'active'
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raffle not found or not active');
  END IF;

  v_stream_id := v_raffle.sid;

  IF NOT public._smoke_check_admin_or_host(v_stream_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admin or stream host can draw winners');
  END IF;

  v_round := v_raffle.current_round;

  SELECT user_id INTO v_winner1 FROM public.stream_raffle_tickets
  WHERE raffle_id = p_raffle_id AND round_number = v_round
  GROUP BY user_id ORDER BY random() LIMIT 1;

  SELECT user_id INTO v_winner2 FROM public.stream_raffle_tickets
  WHERE raffle_id = p_raffle_id AND round_number = v_round AND user_id != v_winner1
  GROUP BY user_id ORDER BY random() LIMIT 1;

  SELECT user_id INTO v_winner3 FROM public.stream_raffle_tickets
  WHERE raffle_id = p_raffle_id AND round_number = v_round AND user_id != v_winner1 AND user_id != v_winner2
  GROUP BY user_id ORDER BY random() LIMIT 1;

  IF v_winner1 IS NOT NULL THEN
    INSERT INTO public.stream_raffle_winners (raffle_id, stream_id, round_number, place, user_id, prize_usd)
    VALUES (p_raffle_id, v_stream_id, v_round, 1, v_winner1, 25.00);
  END IF;

  IF v_winner2 IS NOT NULL THEN
    INSERT INTO public.stream_raffle_winners (raffle_id, stream_id, round_number, place, user_id, prize_usd)
    VALUES (p_raffle_id, v_stream_id, v_round, 2, v_winner2, 15.00);
  END IF;

  IF v_winner3 IS NOT NULL THEN
    INSERT INTO public.stream_raffle_winners (raffle_id, stream_id, round_number, place, user_id, prize_usd)
    VALUES (p_raffle_id, v_stream_id, v_round, 3, v_winner3, 5.00);
  END IF;

  UPDATE public.stream_raffles
  SET current_round = current_round + 1,
      next_draw_at = now() + (draw_interval_minutes || ' minutes')::interval,
      updated_at = now()
  WHERE id = p_raffle_id;

  RETURN jsonb_build_object(
    'success', true,
    'round', v_round,
    'winners', jsonb_build_array(
      jsonb_build_object('place', 1, 'user_id', v_winner1, 'prize', 25.00),
      jsonb_build_object('place', 2, 'user_id', v_winner2, 'prize', 15.00),
      jsonb_build_object('place', 3, 'user_id', v_winner3, 'prize', 5.00)
    )
  );
END;
$$;

-- ============================================================
-- RPC: Request Song (FIX: always credits 5 to DJ + 5 to host separately)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_stream_song(
  p_stream_id uuid,
  p_song_title text,
  p_artist text DEFAULT NULL,
  p_song_link text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_smoke_event record;
  v_stream record;
  v_balance integer;
  v_dj_credited boolean := false;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_smoke_event FROM public.stream_smoke_events
  WHERE stream_id = p_stream_id AND is_active = true AND song_queue_enabled = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Song queue not available for this stream');
  END IF;

  -- ATOMIC: Check balance AND deduct
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - 10,
      total_spent_coins = COALESCE(total_spent_coins, 0) + 10,
      updated_at = now()
  WHERE id = v_user_id AND COALESCE(troll_coins, 0) >= 10;

  IF NOT FOUND THEN
    SELECT COALESCE(troll_coins, 0) INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'Need 10 troll coins to request a song', 'balance', v_balance);
  END IF;

  -- Get stream host for admin pool
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;

  -- Credit 5 coins to DJ if exists
  IF v_smoke_event.dj_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + 5,
        total_earned_coins = COALESCE(total_earned_coins, 0) + 5,
        updated_at = now()
    WHERE id = v_smoke_event.dj_user_id;
    v_dj_credited := true;
  END IF;

  -- Credit 5 coins to stream host (admin pool) - always, even if same as DJ
  IF v_stream.user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + 5,
        total_earned_coins = COALESCE(total_earned_coins, 0) + 5,
        updated_at = now()
    WHERE id = v_stream.user_id;
  END IF;

  INSERT INTO public.stream_song_requests (stream_id, requested_by, dj_user_id, song_title, artist, song_link)
  VALUES (p_stream_id, v_user_id, v_smoke_event.dj_user_id, p_song_title, p_artist, p_song_link);

  SELECT COALESCE(troll_coins, 0) INTO v_balance FROM public.user_profiles WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Song request submitted!',
    'cost', 10,
    'new_balance', v_balance
  );
END;
$$;

-- ============================================================
-- SECURITY: GRANT/REVOKE - Only authenticated users can call RPCs
-- ============================================================
REVOKE ALL ON FUNCTION public.start_smoke_event FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_smoke_event FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_troll_drop FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_troll_drop_bill FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buy_raffle_ticket FROM PUBLIC;
REVOKE ALL ON FUNCTION public.draw_raffle_winners FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_stream_song FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_smoke_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_smoke_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_troll_drop TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_troll_drop_bill TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_raffle_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION public.draw_raffle_winners TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_stream_song TO authenticated;
