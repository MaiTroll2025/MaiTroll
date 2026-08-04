-- ============================================================================
-- AUCTION WATCHLIST FEATURE
-- ============================================================================
-- Allows users to watchlist auction shows and individual lots
-- ============================================================================

-- Create table for auction show watchlist
CREATE TABLE IF NOT EXISTS public.auction_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auction_show_id UUID NOT NULL REFERENCES public.auction_shows(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, auction_show_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_auction_watchlist_user_id ON public.auction_watchlist(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_watchlist_show_id ON public.auction_watchlist(auction_show_id);

-- Enable RLS
ALTER TABLE public.auction_watchlist ENABLE ROW LEVEL SECURITY;

-- Users can view their own watchlist
DROP POLICY IF EXISTS "Users view own auction watchlist" ON public.auction_watchlist;
CREATE POLICY "Users view own auction watchlist" ON public.auction_watchlist
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert into their own watchlist
DROP POLICY IF EXISTS "Users insert own auction watchlist" ON public.auction_watchlist;
CREATE POLICY "Users insert own auction watchlist" ON public.auction_watchlist
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can delete from their own watchlist
DROP POLICY IF EXISTS "Users delete own auction watchlist" ON public.auction_watchlist;
CREATE POLICY "Users delete own auction watchlist" ON public.auction_watchlist
    FOR DELETE
    USING (user_id = auth.uid());

-- Function to check if an auction show is watchlisted by a user
CREATE OR REPLACE FUNCTION public.is_auction_watchlisted(
    p_user_id UUID,
    p_auction_show_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_watchlisted BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.auction_watchlist
        WHERE user_id = p_user_id
          AND auction_show_id = p_auction_show_id
    ) INTO v_watchlisted;

    RETURN v_watchlisted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get watchlist count for an auction show
CREATE OR REPLACE FUNCTION public.get_auction_watchlist_count(
    p_auction_show_id UUID
)
RETURNS BIGINT AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.auction_watchlist
    WHERE auction_show_id = p_auction_show_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
