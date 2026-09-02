-- ============================================
-- 2026-09-02 Weekly Points + Friday Leaderboard Pool Rewards
-- ============================================
-- Server-authoritative weekly engagement points system.
--
-- Point model (per user, per week):
--   share = 5 pts, follow = 1 pt, invite = 1 pt, gift = 1 pt
--   Base maximum (no gift, no multiplier) = 7 pts (share+follow+invite).
--   If the user sent >= 1 Troll Coin gift (coins_spent >= 1) during the week,
--   a 2x weekly multiplier is applied to the ENTIRE weekly total (including the
--   gift point itself). Max with gift + multiplier = (5+1+1+1) * 2 = 16 pts.
--
-- Each action is awarded at most once per user per week (idempotent).
--
-- Friday payout: at end-of-week (Friday), 5% of admin_pool.trollcoins_balance
-- is paid to the Top 10 ranked users when the 5% slice is >= 10 coins.
-- If the pool or slice is below 10 coins, no payout is made (budget rolls over
-- naturally since admin_pool is untouched).
-- ============================================

BEGIN;

-- ============================================================
-- 1. Leaderboard settings (single admin-tunable row)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    share_points INTEGER NOT NULL DEFAULT 5 CHECK (share_points >= 0),
    follow_points INTEGER NOT NULL DEFAULT 1 CHECK (follow_points >= 0),
    invite_points INTEGER NOT NULL DEFAULT 1 CHECK (invite_points >= 0),
    gift_points INTEGER NOT NULL DEFAULT 1 CHECK (gift_points >= 0),
    gift_multiplier BOOLEAN NOT NULL DEFAULT true,
    multiplier_factor NUMERIC(4,2) NOT NULL DEFAULT 2.00 CHECK (multiplier_factor >= 1.00),
    friday_payout_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (friday_payout_percent >= 0 AND friday_payout_percent <= 100),
    friday_min_payout_coins BIGINT NOT NULL DEFAULT 10 CHECK (friday_min_payout_coins >= 0),
    friday_top_n INTEGER NOT NULL DEFAULT 10 CHECK (friday_top_n >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.weekly_leaderboard_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Weekly leaderboard metadata (one row per week)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_leaderboards (
    week_id TEXT PRIMARY KEY,                       -- 'YYYY-MM-DD' ending Friday
    week_start DATE NOT NULL,                       -- Saturday
    week_end DATE NOT NULL,                         -- Friday
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'payout_pending', 'payout_done', 'no_payout', 'cancelled')),
    friday_processed_at TIMESTAMPTZ,
    payout_total_coins BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_weekly_leaderboards_status ON public.weekly_leaderboards(status);

-- ============================================================
-- 3. Per-user weekly points (one row per user per week)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_user_points (
    week_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_points BIGINT NOT NULL DEFAULT 0,
    follow_points BIGINT NOT NULL DEFAULT 0,
    invite_points BIGINT NOT NULL DEFAULT 0,
    gift_points BIGINT NOT NULL DEFAULT 0,
    sent_troll_coin_gift BOOLEAN NOT NULL DEFAULT false,
    total_points BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (week_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_user_points_week ON public.weekly_user_points(week_id, total_points DESC, user_id);

-- ============================================================
-- 4. Audit log of every point event (dedup via unique constraint)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_point_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_action TEXT NOT NULL,                      -- 'share' | 'follow' | 'invite' | 'gift'
    base_points INTEGER NOT NULL,
    multiplier INTEGER NOT NULL DEFAULT 1,
    total_points BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (week_id, user_id, source_action)
);

CREATE INDEX IF NOT EXISTS idx_weekly_point_events_user
    ON public.weekly_point_events(week_id, user_id, created_at);

-- ============================================================
-- 5. Deduplicated gift log (one row per gift_transaction per week)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_gift_log (
    week_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gift_transaction_id UUID NOT NULL,
    coins_spent BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (week_id, gift_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_gift_log_user
    ON public.weekly_gift_log(week_id, user_id);

-- ============================================================
-- 6. Friday reward disbursement records (audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_rewards (
    week_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    base_points BIGINT NOT NULL,
    total_points BIGINT NOT NULL,
    reward_coins BIGINT NOT NULL,
    coin_transaction_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (week_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_weekly_rewards_week
    ON public.weekly_leaderboard_rewards(week_id, rank);
CREATE INDEX IF NOT EXISTS idx_weekly_rewards_user
    ON public.weekly_leaderboard_rewards(week_id, user_id);

-- ============================================================
-- 7. RLS policies
-- ============================================================
ALTER TABLE public.weekly_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_gift_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboard_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboard_settings ENABLE ROW LEVEL SECURITY;

-- Leaderboards metadata: public read
DROP POLICY IF EXISTS "Public read weekly leaderboards" ON public.weekly_leaderboards;
CREATE POLICY "Public read weekly leaderboards" ON public.weekly_leaderboards
    FOR SELECT TO authenticated USING (true);

-- User points: users read their own, admins/service_role full
DROP POLICY IF EXISTS "Users read own weekly points" ON public.weekly_user_points;
CREATE POLICY "Users read own weekly points" ON public.weekly_user_points
    FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access weekly_user_points" ON public.weekly_user_points;
CREATE POLICY "Service role full access weekly_user_points" ON public.weekly_user_points
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Point events: users read own
DROP POLICY IF EXISTS "Users read own point events" ON public.weekly_point_events;
CREATE POLICY "Users read own point events" ON public.weekly_point_events
    FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access weekly_point_events" ON public.weekly_point_events;
CREATE POLICY "Service role full access weekly_point_events" ON public.weekly_point_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gift log: users read own
DROP POLICY IF EXISTS "Users read own weekly gift log" ON public.weekly_gift_log;
CREATE POLICY "Users read own weekly gift log" ON public.weekly_gift_log
    FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access weekly_gift_log" ON public.weekly_gift_log;
CREATE POLICY "Service role full access weekly_gift_log" ON public.weekly_gift_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Rewards: public read (leaderboard visibility), service_role write
DROP POLICY IF EXISTS "Public read weekly rewards" ON public.weekly_leaderboard_rewards;
CREATE POLICY "Public read weekly rewards" ON public.weekly_leaderboard_rewards
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role full access weekly_rewards" ON public.weekly_leaderboard_rewards;
CREATE POLICY "Service role full access weekly_rewards" ON public.weekly_leaderboard_rewards
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Settings: admin/service_role only
DROP POLICY IF EXISTS "Admin manage weekly settings" ON public.weekly_leaderboard_settings;
CREATE POLICY "Admin manage weekly settings" ON public.weekly_leaderboard_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read weekly settings" ON public.weekly_leaderboard_settings
    FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 8. Internal helper: refresh a user's total_points for a week
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_refresh_user_total(p_week_id TEXT, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base BIGINT;
  v_mult INTEGER;
  v_sent BOOLEAN;
BEGIN
  SELECT
    COALESCE(wp.share_points,0) + COALESCE(wp.follow_points,0) + COALESCE(wp.invite_points,0) + COALESCE(wp.gift_points,0),
    wp.sent_troll_coin_gift
  INTO v_base, v_sent
  FROM public.weekly_user_points wp
  WHERE wp.week_id = p_week_id AND wp.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_mult := CASE WHEN v_sent THEN 2 ELSE 1 END;

  UPDATE public.weekly_user_points
  SET total_points = v_base * v_mult,
      last_updated = NOW()
  WHERE week_id = p_week_id AND user_id = p_user_id;
END;
$$;

-- ============================================================
-- 9. Get current week_id (ending Friday)
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_get_current_week()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT TO_CHAR(
    CURRENT_DATE + ((5 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 7) % 7),
    'YYYY-MM-DD'
  );
$$;

CREATE OR REPLACE FUNCTION public.weekly_get_week_dates(p_week_id TEXT DEFAULT NULL)
RETURNS TABLE (week_id TEXT, week_start DATE, week_end DATE, is_current BOOLEAN)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH target AS (
    SELECT COALESCE(p_week_id, (SELECT weekly_get_current_week()::TEXT)) AS week_id
  )
  SELECT
    t.week_id,
    (t.week_id::DATE - 6) AS week_start,
    t.week_id::DATE AS week_end,
    (t.week_id = (SELECT weekly_get_current_week())) AS is_current
  FROM target t
$$;

-- ============================================================
-- 10. Award a point (share/follow/invite/gift). Idempotent per action per week.
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_award_point(
  p_action TEXT,
  p_base_points INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_week_id TEXT;
  v_col TEXT;
  v_existing BIGINT;
  v_sent BOOLEAN;
  v_base BIGINT;
  v_mult INTEGER;
  v_total BIGINT;
  v_awarded INTEGER := 0;
  v_duplicate BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL OR p_action IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing parameters');
  END IF;

  v_week_id := (SELECT weekly_get_current_week());

  CASE p_action
    WHEN 'share' THEN v_col := 'share_points';
    WHEN 'follow' THEN v_col := 'follow_points';
    WHEN 'invite' THEN v_col := 'invite_points';
    WHEN 'gift' THEN v_col := 'gift_points';
    ELSE RAISE EXCEPTION 'Unknown weekly point action: %', p_action;
  END CASE;

  -- Ensure the week + user row exists.
  INSERT INTO public.weekly_leaderboards (week_id, week_start, week_end)
  VALUES (v_week_id, v_week_id::DATE - 6, v_week_id::DATE)
  ON CONFLICT (week_id) DO NOTHING;

  INSERT INTO public.weekly_user_points (week_id, user_id)
  VALUES (v_week_id, v_user_id)
  ON CONFLICT (week_id, user_id) DO NOTHING;

  -- Idempotency: only award once per action per week.
  EXECUTE format('SELECT COALESCE(%I, 0) FROM public.weekly_user_points WHERE week_id = $1 AND user_id = $2', v_col)
    INTO v_existing USING v_week_id, v_user_id;

  IF v_existing > 0 THEN
    v_duplicate := true;
  ELSE
    -- Award the base points for this action.
    EXECUTE format('UPDATE public.weekly_user_points SET %I = %I + $1 WHERE week_id = $2 AND user_id = $3', v_col, v_col)
      USING p_base_points, v_week_id, v_user_id;

    INSERT INTO public.weekly_point_events (week_id, user_id, source_action, base_points)
    VALUES (v_week_id, v_user_id, p_action, p_base_points)
    ON CONFLICT (week_id, user_id, source_action) DO UPDATE SET base_points = EXCLUDED.base_points;

    v_awarded := p_base_points;
  END IF;

  -- Recompute totals.
  PERFORM public.weekly_refresh_user_total(v_week_id, v_user_id);

  SELECT COALESCE(total_points,0), COALESCE(sent_troll_coin_gift, false)
  INTO v_total, v_sent
  FROM public.weekly_user_points
  WHERE week_id = v_week_id AND user_id = v_user_id;

  v_mult := CASE WHEN v_sent THEN 2 ELSE 1 END;

  UPDATE public.weekly_point_events
  SET multiplier = v_mult, total_points = v_total
  WHERE week_id = v_week_id AND user_id = v_user_id AND source_action = p_action;

  RETURN jsonb_build_object(
    'success', true,
    'week_id', v_week_id,
    'action', p_action,
    'duplicate', v_duplicate,
    'awarded', v_awarded,
    'multiplier', v_mult,
    'total_points', v_total
  );
END;
$$;

-- ============================================================
-- 11. Record a gift manually (server-authoritative). Idempotent.
-- Triggered automatically on gift_transactions insert via trigger below.
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_record_gift(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week_id TEXT;
  v_awarded INTEGER := 0;
  v_duplicate BOOLEAN := false;
  v_total BIGINT;
  v_sent BOOLEAN;
  v_mult INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing p_user_id');
  END IF;

  v_week_id := (SELECT weekly_get_current_week());

  INSERT INTO public.weekly_leaderboards (week_id, week_start, week_end)
  VALUES (v_week_id, v_week_id::DATE - 6, v_week_id::DATE)
  ON CONFLICT (week_id) DO NOTHING;

  INSERT INTO public.weekly_user_points (week_id, user_id)
  VALUES (v_week_id, p_user_id)
  ON CONFLICT (week_id, user_id) DO NOTHING;

  -- Gift base point is awarded once per week, regardless of the trigger firing
  -- (this RPC is an explicit fallback path).
  IF COALESCE((SELECT gift_points FROM public.weekly_user_points WHERE week_id = v_week_id AND user_id = p_user_id), 0) = 0 THEN
    UPDATE public.weekly_user_points
    SET gift_points = 1,
        sent_troll_coin_gift = true
    WHERE week_id = v_week_id AND user_id = p_user_id;

    INSERT INTO public.weekly_point_events (week_id, user_id, source_action, base_points, multiplier)
    VALUES (v_week_id, p_user_id, 'gift', 1, 1)
    ON CONFLICT (week_id, user_id, source_action) DO UPDATE
      SET base_points = EXCLUDED.base_points, total_points = EXCLUDED.total_points;

    v_awarded := 1;
  ELSE
    v_duplicate := true;
  END IF;

  PERFORM public.weekly_refresh_user_total(v_week_id, p_user_id);

  SELECT total_points, sent_troll_coin_gift
  INTO v_total, v_sent
  FROM public.weekly_user_points
  WHERE week_id = v_week_id AND user_id = p_user_id;

  v_mult := CASE WHEN v_sent THEN 2 ELSE 1 END;

  RETURN jsonb_build_object(
    'success', true,
    'week_id', v_week_id,
    'duplicate', v_duplicate,
    'awarded', v_awarded,
    'multiplier', v_mult,
    'total_points', v_total
  );
END;
$$;

-- ============================================================
-- 12. Trigger: auto-record gifts when a gift_transactions row is inserted.
--     Coins spent >= 1 => awards 1 gift point + enables the 2x multiplier.
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_gift_insert_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coins BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_coins := COALESCE(NEW.coins_spent, 0);

    IF v_coins >= 1 AND NEW.sender_id IS NOT NULL THEN
      -- Log the gift for audit / idempotency of the multiplier.
      INSERT INTO public.weekly_gift_log (week_id, user_id, gift_transaction_id, coins_spent)
      VALUES ((SELECT weekly_get_current_week()), NEW.sender_id, NEW.id, v_coins)
      ON CONFLICT DO NOTHING;

      -- Award the gift base point + enable multiplier (idempotent).
      PERFORM public.weekly_record_gift(NEW.sender_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger only when gift_transactions exists (it does in production;
-- the guard keeps the migration safe in environments where it is not yet present).
DO $$
BEGIN
  IF to_regclass('public.gift_transactions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS weekly_gift_insert_trigger_fn ON public.gift_transactions;
    CREATE TRIGGER weekly_gift_insert_trigger_fn
    AFTER INSERT ON public.gift_transactions
    FOR EACH ROW EXECUTE FUNCTION public.weekly_gift_insert_trigger();
  END IF;
END
$$;

-- ============================================================
-- 13. Leaderboard query (public read of current/past week)
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_get_leaderboard(
  p_week_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  display_name TEXT,
  total_points BIGINT,
  base_points BIGINT,
  multiplier INTEGER,
  sent_troll_coin_gift BOOLEAN
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH week AS (
    SELECT COALESCE(p_week_id, (SELECT weekly_get_current_week())) AS week_id
  ),
  ranked AS (
    SELECT
      wp.week_id,
      wp.user_id,
      COALESCE(wp.share_points,0) + COALESCE(wp.follow_points,0) + COALESCE(wp.invite_points,0) + COALESCE(wp.gift_points,0) AS base_points,
      wp.sent_troll_coin_gift,
      wp.total_points
    FROM public.weekly_user_points wp, week w
    WHERE wp.week_id = w.week_id
      AND (COALESCE(wp.share_points,0) + COALESCE(wp.follow_points,0) + COALESCE(wp.invite_points,0) + COALESCE(wp.gift_points,0)) > 0
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY r.total_points DESC NULLS LAST, r.base_points DESC NULLS LAST) AS rank,
    r.user_id,
    up.username,
    up.avatar_url,
    up.display_name,
    r.total_points,
    r.base_points,
    CASE WHEN r.sent_troll_coin_gift THEN 2 ELSE 1 END AS multiplier,
    r.sent_troll_coin_gift
  FROM ranked r
  JOIN week w ON true
  LEFT JOIN public.user_profiles up ON up.id = r.user_id
  ORDER BY r.total_points DESC NULLS LAST, r.base_points DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

-- ============================================================
-- 14. User summary (current user's own row + rank)
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_get_user_summary(p_week_id TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_week_id TEXT;
  v_rank INTEGER;
  v_base BIGINT;
  v_total BIGINT;
  v_sent BOOLEAN;
  v_mult INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  v_week_id := COALESCE(p_week_id, (SELECT weekly_get_current_week()));

  SELECT
    COALESCE(wp.share_points,0) + COALESCE(wp.follow_points,0) + COALESCE(wp.invite_points,0) + COALESCE(wp.gift_points,0),
    wp.total_points,
    wp.sent_troll_coin_gift
  INTO v_base, v_total, v_sent
  FROM public.weekly_user_points wp
  WHERE wp.week_id = v_week_id AND wp.user_id = v_user_id;

  IF v_total IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'week_id', v_week_id,
      'user_id', v_user_id,
      'rank', NULL,
      'base_points', 0,
      'total_points', 0,
      'multiplier', 1,
      'sent_troll_coin_gift', false,
      'actions', jsonb_build_object('share', false, 'follow', false, 'invite', false, 'gift', false)
    );
  END IF;

  v_mult := CASE WHEN v_sent THEN 2 ELSE 1 END;

  -- rank among active participants this week
  SELECT COUNT(*)::INTEGER + 1 INTO v_rank
  FROM public.weekly_user_points wp
  WHERE wp.week_id = v_week_id
    AND (COALESCE(wp.share_points,0) + COALESCE(wp.follow_points,0) + COALESCE(wp.invite_points,0) + COALESCE(wp.gift_points,0)) > 0
    AND (wp.total_points, wp.user_id) > (v_total, v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'week_id', v_week_id,
    'user_id', v_user_id,
    'rank', v_rank,
    'base_points', v_base,
    'total_points', v_total,
    'multiplier', v_mult,
    'sent_troll_coin_gift', v_sent,
    'actions', jsonb_build_object(
      'share', COALESCE((SELECT share_points > 0 FROM public.weekly_user_points WHERE week_id = v_week_id AND user_id = v_user_id), false),
      'follow', COALESCE((SELECT follow_points > 0 FROM public.weekly_user_points WHERE week_id = v_week_id AND user_id = v_user_id), false),
      'invite', COALESCE((SELECT invite_points > 0 FROM public.weekly_user_points WHERE week_id = v_week_id AND user_id = v_user_id), false),
      'gift', COALESCE((SELECT gift_points > 0 FROM public.weekly_user_points WHERE week_id = v_week_id AND user_id = v_user_id), false)
    )
  );
END;
$$;

-- ============================================================
-- 15. Friday payout (idempotent per week). Cron this on Fridays.
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_process_friday(p_week_id TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week_id TEXT;
  v_status TEXT;
  v_pool_balance NUMERIC;
  v_payout_percent NUMERIC;
  v_min_payout BIGINT;
  v_top_n INTEGER;
  v_payout_coins BIGINT;
  v_total_qualifying BIGINT;
  v_user_id UUID;
  v_base BIGINT;
  v_total BIGINT;
  v_rank INTEGER;
  v_share BIGINT;
  v_granted BIGINT;
  v_txn_id UUID;
  v_pool_row UUID;
  v_grand_total BIGINT := 0;
BEGIN
  v_week_id := COALESCE(p_week_id, (SELECT weekly_get_current_week()));

  -- Idempotency: skip if this week was already processed.
  SELECT status INTO v_status
  FROM public.weekly_leaderboards
  WHERE week_id = v_week_id;

  IF v_status IN ('payout_done', 'no_payout') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Week already processed', 'week_id', v_week_id, 'status', v_status);
  END IF;

  -- Load settings.
  SELECT friday_payout_percent, friday_min_payout_coins, friday_top_n
  INTO v_payout_percent, v_min_payout, v_top_n
  FROM public.weekly_leaderboard_settings WHERE id = 1;

  v_payout_percent := COALESCE(v_payout_percent, 5);
  v_min_payout := COALESCE(v_min_payout, 10);
  v_top_n := COALESCE(v_top_n, 10);

  -- Read the admin pool balance (single aggregate row, matching existing convention).
  SELECT id, trollcoins_balance INTO v_pool_row, v_pool_balance
  FROM public.admin_pool
  ORDER BY id
  LIMIT 1;

  IF v_pool_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'admin_pool row not found', 'week_id', v_week_id);
  END IF;

  v_payout_coins := FLOOR(COALESCE(v_pool_balance, 0) * (v_payout_percent / 100.0))::BIGINT;

  IF v_payout_coins < v_min_payout OR COALESCE(v_pool_balance, 0) < v_min_payout THEN
    -- Pool too small: no payout this week. Budget rolls over naturally.
    UPDATE public.weekly_leaderboards
    SET status = 'no_payout',
        friday_processed_at = NOW(),
        payout_total_coins = 0
    WHERE week_id = v_week_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Pool below minimum; no payout, budget rolls over',
      'week_id', v_week_id,
      'status', 'no_payout',
      'pool_balance', v_pool_balance,
      'payout_coins', v_payout_coins
    );
  END IF;

  -- Top-N ranked users with points > 0, ordered by total_points DESC.
  CREATE TEMP TABLE IF NOT EXISTS _weekly_top_users (
    rank INTEGER,
    user_id UUID,
    base_points BIGINT,
    total_points BIGINT
  ) ON COMMIT DROP;

  TRUNCATE _weekly_top_users;

  INSERT INTO _weekly_top_users (rank, user_id, base_points, total_points)
  SELECT
    ROW_NUMBER() OVER (ORDER BY wp.total_points DESC NULLS LAST, wp.user_id) AS rank,
    wp.user_id,
    COALESCE(wp.share_points,0)+COALESCE(wp.follow_points,0)+COALESCE(wp.invite_points,0)+COALESCE(wp.gift_points,0) AS base_points,
    wp.total_points
  FROM public.weekly_user_points wp
  WHERE wp.week_id = v_week_id
    AND wp.total_points > 0
  ORDER BY wp.total_points DESC NULLS LAST
  LIMIT v_top_n;

  SELECT COALESCE(SUM(total_points), 0) INTO v_total_qualifying FROM _weekly_top_users;

  IF v_total_qualifying = 0 THEN
    UPDATE public.weekly_leaderboards
    SET status = 'no_payout',
        friday_processed_at = NOW(),
        payout_total_coins = 0
    WHERE week_id = v_week_id;

    RETURN jsonb_build_object('success', true, 'message', 'No ranked users with points', 'week_id', v_week_id, 'status', 'no_payout');
  END IF;

  FOR v_rank, v_user_id, v_base, v_total IN
    SELECT rank, user_id, base_points, total_points FROM _weekly_top_users ORDER BY rank
  LOOP
    -- Split payout proportionally by total_points share.
    v_share := FLOOR((v_total::NUMERIC / v_total_qualifying::NUMERIC) * v_payout_coins)::BIGINT;

    IF v_share > 0 THEN
      -- Credit the user + record coin transaction (idempotent).
      v_txn_id := gen_random_uuid();

      UPDATE public.user_profiles
      SET troll_coins = COALESCE(troll_coins, 0) + v_share
      WHERE id = v_user_id;

      INSERT INTO public.coin_transactions (user_id, amount, type, transaction_type, metadata)
      VALUES (v_user_id, v_share, 'weekly_leaderboard_reward', 'weekly_leaderboard_reward',
        jsonb_build_object('week_id', v_week_id, 'rank', v_rank, 'txn_id', v_txn_id, 'source', 'weekly_leaderboard_friday'));

      INSERT INTO public.weekly_leaderboard_rewards (week_id, rank, user_id, base_points, total_points, reward_coins, coin_transaction_id)
      VALUES (v_week_id, v_rank, v_user_id, v_base, v_total, v_share, v_txn_id)
      ON CONFLICT (week_id, rank) DO UPDATE
        SET user_id = EXCLUDED.user_id,
          base_points = EXCLUDED.base_points,
          total_points = EXCLUDED.total_points,
          reward_coins = EXCLUDED.reward_coins,
          coin_transaction_id = EXCLUDED.coin_transaction_id;

      v_grand_total := v_grand_total + v_share;
    END IF;
  END LOOP;

  -- Deduct payout from the admin pool + ledger.
  UPDATE public.admin_pool
  SET trollcoins_balance = trollcoins_balance - v_grand_total,
      updated_at = NOW()
  WHERE id = v_pool_row;

  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id)
  VALUES (-v_grand_total, 'weekly_leaderboard_friday_payout', NULL);

  UPDATE public.weekly_leaderboards
  SET status = 'payout_done',
      friday_processed_at = NOW(),
      payout_total_coins = v_grand_total
  WHERE week_id = v_week_id;

  RETURN jsonb_build_object(
    'success', true,
    'week_id', v_week_id,
    'status', 'payout_done',
    'pool_balance', v_pool_balance,
    'payout_coins', v_payout_coins,
    'distributed_coins', v_grand_total,
    'winners', (SELECT COUNT(*)::INTEGER FROM _weekly_top_users WHERE total_points > 0),
    'top_n', v_top_n
  );
END;
$$;

-- ============================================================
-- 16. Grants
-- ============================================================
GRANT EXECUTE ON FUNCTION public.weekly_get_current_week() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_get_week_dates(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_get_leaderboard(TEXT, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_get_user_summary(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_award_point(TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_record_gift(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_process_friday(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_gift_insert_trigger() TO service_role;

-- ============================================================
-- 17. Schedule Friday payout (23:00 UTC on Fridays, while the week still
--     belongs to the Friday ending today). Guarded so environments without
--     pg_cron do not break the migration.
-- ============================================================
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'weekly_friday_payout'
    ) THEN
      PERFORM cron.schedule(
        'weekly_friday_payout',
        '0 23 * * 5',
        'SELECT public.weekly_process_friday()'
      );
    END IF;
  END IF;
END $$;

COMMIT;
