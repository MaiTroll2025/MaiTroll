-- Secure public tables identified by linter
-- Enforcing AUTHENTICATED ONLY access (No Public/Anon Read)

-- 1. gift_ledger
ALTER TABLE public.gift_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own gifts" ON public.gift_ledger;
CREATE POLICY "Users view own gifts" ON public.gift_ledger
    FOR SELECT USING (auth.role() = 'authenticated' AND (auth.uid() = sender_id OR auth.uid() = receiver_id));

-- 2. broadcaster_stats
ALTER TABLE public.broadcaster_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view broadcaster stats" ON public.broadcaster_stats;
DROP POLICY IF EXISTS "Authenticated view broadcaster stats" ON public.broadcaster_stats;
CREATE POLICY "Authenticated view broadcaster stats" ON public.broadcaster_stats
    FOR SELECT USING (auth.role() = 'authenticated');

-- 3. battles
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view battles" ON public.battles;
DROP POLICY IF EXISTS "Authenticated view battles" ON public.battles;
CREATE POLICY "Authenticated view battles" ON public.battles
    FOR SELECT USING (auth.role() = 'authenticated');

-- 4. districts
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated view districts" ON public.districts;
CREATE POLICY "Authenticated view districts" ON public.districts
    FOR SELECT USING (auth.role() = 'authenticated');

-- 5. auction_bids
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Authenticated view auction bids" ON public.auction_bids;
CREATE POLICY "Authenticated view auction bids" ON public.auction_bids
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users insert own bids" ON public.auction_bids;
CREATE POLICY "Users insert own bids" ON public.auction_bids
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = bidder_user_id);

-- 6. stream_seat_sessions
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Authenticated view stream seat sessions" ON public.stream_seat_sessions;
CREATE POLICY "Authenticated view stream seat sessions" ON public.stream_seat_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

-- 7. house_upgrades (Likely legacy or catalog)
ALTER TABLE public.house_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view house upgrades" ON public.house_upgrades;
DROP POLICY IF EXISTS "Authenticated view house upgrades" ON public.house_upgrades;
CREATE POLICY "Authenticated view house upgrades" ON public.house_upgrades
    FOR SELECT USING (auth.role() = 'authenticated');

-- 8. user_house_upgrades (Likely legacy)
ALTER TABLE public.user_house_upgrades ENABLE ROW LEVEL SECURITY;
-- No policy = Service Role only (safe default if unused or unknown owner column)
