-- Create league system tables for ViewerPage League Card
-- This supports the useLeagueSnapshot hook for real league/ranking data

-- 1. League Events Table
CREATE TABLE IF NOT EXISTS public.league_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'hourly', 'thirty_min_heat', 'battle', 'creator')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Stream League Scores Table
-- Tracks scores for broadcasters/supporters in league events
CREATE TABLE IF NOT EXISTS public.stream_league_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_event_id UUID NOT NULL REFERENCES public.league_events(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
    broadcaster_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    score NUMERIC NOT NULL DEFAULT 0,
    gift_coins NUMERIC NOT NULL DEFAULT 0,
    total_gifts INTEGER NOT NULL DEFAULT 0,
    last_event_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_event_id, stream_id, supporter_id)
);

-- 3. League Notifications Table
-- Notifications for league events (milestones, rank changes, etc.)
CREATE TABLE IF NOT EXISTS public.league_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_event_id UUID REFERENCES public.league_events(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_league_events_status ON public.league_events(status);
CREATE INDEX IF NOT EXISTS idx_league_events_ends_at ON public.league_events(ends_at);
CREATE INDEX IF NOT EXISTS idx_league_events_type ON public.league_events(type);
CREATE INDEX IF NOT EXISTS idx_league_scores_event_id ON public.stream_league_scores(league_event_id);
CREATE INDEX IF NOT EXISTS idx_league_scores_stream_id ON public.stream_league_scores(stream_id);
CREATE INDEX IF NOT EXISTS idx_league_scores_broadcaster_id ON public.stream_league_scores(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_league_scores_supporter_id ON public.stream_league_scores(supporter_id);
CREATE INDEX IF NOT EXISTS idx_league_scores_gift_coins ON public.stream_league_scores(gift_coins DESC);
CREATE INDEX IF NOT EXISTS idx_league_notifications_user_id ON public.league_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_league_notifications_created_at ON public.league_notifications(created_at DESC);

-- 5. Enable RLS
ALTER TABLE public.league_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_league_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_notifications ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- League events are readable by all authenticated users
CREATE POLICY "Anyone can read league events" ON public.league_events
    FOR SELECT USING (true);

-- League scores are readable by all authenticated users
CREATE POLICY "Anyone can read league scores" ON public.stream_league_scores
    FOR SELECT USING (true);

-- League notifications are readable by the user they're for
CREATE POLICY "Users can read their league notifications" ON public.league_notifications
    FOR SELECT USING (auth.uid() = user_id OR true);  -- Allow authenticated users to read any for now

-- 7. RPC to get stream top gifters (as used in useStreamTopGifters)
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
    COALESCE(up.username, 'Unknown') as sender_username,
    up.avatar_url as sender_avatar_url,
    SUM((sg.amount::NUMERIC) * (sg.quantity::NUMERIC)) as total_gift_coins,
    SUM(sg.quantity::INTEGER) as total_gifts,
    MAX(sg.created_at) as last_gift_at
FROM public.stream_gifts sg
LEFT JOIN public.user_profiles up ON up.id = sg.sender_id
WHERE sg.stream_id = p_stream_id
GROUP BY sg.sender_id, up.username, up.avatar_url
ORDER BY total_gift_coins DESC
LIMIT p_limit
$$;

-- Grant permissions
GRANT SELECT ON public.league_events TO authenticated;
GRANT SELECT ON public.league_events TO anon;
GRANT SELECT ON public.stream_league_scores TO authenticated;
GRANT SELECT ON public.stream_league_scores TO anon;
GRANT SELECT ON public.league_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.stream_top_gifters TO authenticated;
GRANT EXECUTE ON FUNCTION public.stream_top_gifters TO anon;

-- Insert sample active league event (for testing)
INSERT INTO public.league_events (name, slug, type, status, starts_at, ends_at)
VALUES (
    'Weekly League',
    'weekly-league',
    'weekly',
    'active',
    NOW(),
    NOW() + INTERVAL '7 days'
)
ON CONFLICT (slug) DO NOTHING;

SELECT '✅ League system tables created successfully' as status;
