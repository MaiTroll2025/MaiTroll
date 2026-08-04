-- Fix schema cache and missing database objects
-- Generated: 2026-07-29

-- 1. Add missing columns to existing tables

-- user_profiles: add thumbnail_url
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- stream_mutes: add expires_at
ALTER TABLE public.stream_mutes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- stream_viewers: add last_seen
ALTER TABLE public.stream_viewers
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- families: add is_political_party
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS is_political_party BOOLEAN NOT NULL DEFAULT false;

-- streams: add seat_prices for per-box pricing
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS seat_prices INTEGER[] DEFAULT NULL;

COMMENT ON COLUMN public.streams.seat_prices IS 'Array of prices for each seat/box. Index 0 = host (usually 0/free), index 1+ = guest seats. NULL means use seat_price for all seats.';

-- 2. Fix stream_gifts sender_id and receiver_id foreign keys
-- These must reference user_profiles (not auth.users) so PostgREST
-- can discover the relationship for joins in stream_top_gifters etc.
-- Also add the amount column if missing (used by stream_top_gifters).
ALTER TABLE public.stream_gifts
  ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 0;

ALTER TABLE public.stream_gifts
  DROP CONSTRAINT IF EXISTS stream_gifts_sender_id_fkey,
  ADD CONSTRAINT stream_gifts_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.stream_gifts
  DROP CONSTRAINT IF EXISTS stream_gifts_receiver_id_fkey,
  ADD CONSTRAINT stream_gifts_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 3. Add missing foreign key for user_league_members.league_id
ALTER TABLE public.user_league_members
  DROP CONSTRAINT IF EXISTS user_league_members_league_id_fkey,
  ADD CONSTRAINT user_league_members_league_id_fkey
    FOREIGN KEY (league_id) REFERENCES public.user_leagues(id) ON DELETE CASCADE;

-- 4. Ensure user_subscriptions.tier_id references subscription_tiers properly
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_tier_id_fkey,
  ADD CONSTRAINT user_subscriptions_tier_id_fkey
    FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers(id);

-- 5. Ensure podcasts.host_user_id references user_profiles properly
-- First add the column if it doesn't exist, then add the FK
ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS host_user_id UUID;

ALTER TABLE public.podcasts
  DROP CONSTRAINT IF EXISTS podcasts_host_user_id_fkey,
  ADD CONSTRAINT podcasts_host_user_id_fkey
    FOREIGN KEY (host_user_id) REFERENCES public.user_profiles(id);

-- 6. Add missing foreign keys for bribe_logs to user_profiles
ALTER TABLE public.bribe_logs
  DROP CONSTRAINT IF EXISTS bribe_logs_from_user_fkey,
  ADD CONSTRAINT bribe_logs_from_user_fkey
    FOREIGN KEY (briber_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.bribe_logs
  DROP CONSTRAINT IF EXISTS bribe_logs_to_user_fkey,
  ADD CONSTRAINT bribe_logs_to_user_fkey
    FOREIGN KEY (bribee_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.bribe_logs
  DROP CONSTRAINT IF EXISTS bribe_logs_exposed_by_fkey,
  ADD CONSTRAINT bribe_logs_exposed_by_fkey
    FOREIGN KEY (exposed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 6. Create missing tables if they don't exist

-- broadcast_missions
CREATE TABLE IF NOT EXISTS public.broadcast_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  broadcaster_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  target_type TEXT NOT NULL DEFAULT 'viewers',
  target_value INTEGER NOT NULL DEFAULT 100,
  current_progress INTEGER NOT NULL DEFAULT 0,
  reward_coins INTEGER DEFAULT 0,
  reward_xp INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broadcast_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view broadcast missions for active streams"
  ON public.broadcast_missions FOR SELECT
  USING (true);

CREATE POLICY "Broadcasters can manage their own broadcast missions"
  ON public.broadcast_missions FOR ALL
  USING (broadcaster_id = auth.uid())
  WITH CHECK (broadcaster_id = auth.uid());

-- broadcast_troll_usages
CREATE TABLE IF NOT EXISTS public.broadcast_troll_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  broadcaster_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  troll_type TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broadcast_troll_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view broadcast troll usages"
  ON public.broadcast_troll_usages FOR SELECT
  USING (true);

CREATE POLICY "Broadcasters can manage their own troll usages"
  ON public.broadcast_troll_usages FOR ALL
  USING (broadcaster_id = auth.uid())
  WITH CHECK (broadcaster_id = auth.uid());

-- officer_stream_logs
CREATE TABLE IF NOT EXISTS public.officer_stream_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  actions_taken INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.officer_stream_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers can insert own logs"
  ON public.officer_stream_logs FOR INSERT
  WITH CHECK (officer_id = auth.uid());

CREATE POLICY "Officers can update own logs"
  ON public.officer_stream_logs FOR UPDATE
  USING (officer_id = auth.uid())
  WITH CHECK (officer_id = auth.uid());

CREATE POLICY "Officers can view own logs"
  ON public.officer_stream_logs FOR SELECT
  USING (officer_id = auth.uid());

GRANT ALL ON TABLE public.officer_stream_logs TO anon;
GRANT ALL ON TABLE public.officer_stream_logs TO authenticated;
GRANT ALL ON TABLE public.officer_stream_logs TO service_role;

-- 7. Create or replace stream_top_gifters function
CREATE OR REPLACE FUNCTION public.stream_top_gifters(
  p_stream_id UUID,
  p_limit INT DEFAULT 8
)
RETURNS TABLE (
  sender_id UUID,
  sender_username TEXT,
  sender_avatar_url TEXT,
  total_gift_coins NUMERIC,
  total_gifts INTEGER,
  last_gift_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    sg.sender_id,
    COALESCE(up.username, 'Unknown') AS sender_username,
    up.avatar_url AS sender_avatar_url,
    SUM((sg.amount::NUMERIC) * (sg.quantity::NUMERIC)) AS total_gift_coins,
    SUM(sg.quantity::INTEGER) AS total_gifts,
    MAX(sg.created_at) AS last_gift_at
  FROM public.stream_gifts sg
  LEFT JOIN public.user_profiles up ON up.id = sg.sender_id
  WHERE sg.stream_id = p_stream_id
  GROUP BY sg.sender_id, up.username, up.avatar_url
  ORDER BY total_gift_coins DESC
  LIMIT p_limit
$$;

-- 8. Grant execute permission for stream_top_gifters
GRANT EXECUTE ON FUNCTION public.stream_top_gifters(UUID, INT) TO anon, authenticated;

-- 9. Refresh schema cache by creating a dummy change
-- (PostgREST auto-refreshes schema cache on DDL changes)
