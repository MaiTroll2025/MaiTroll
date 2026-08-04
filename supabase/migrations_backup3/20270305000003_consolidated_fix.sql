-- Consolidated Fix: Add Bypass Column + Harden RLS Policies
-- Run this script in the Supabase SQL Editor to apply all pending changes.

BEGIN;

-- ============================================================================
-- 1. Feature: Broadcast Bypass (Admin Override for 24h rule)
-- ============================================================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS bypass_broadcast_restriction BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. Security: Harden RLS Policies for 8 Tables
-- ============================================================================

-- A. gift_ledger
ALTER TABLE public.gift_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own gifts" ON public.gift_ledger;
DROP POLICY IF EXISTS "Service Role Bypass" ON public.gift_ledger;
CREATE POLICY "Users view own gifts" ON public.gift_ledger
    FOR SELECT USING (auth.role() = 'authenticated' AND (auth.uid() = sender_id OR auth.uid() = receiver_id));

-- B. broadcaster_stats
ALTER TABLE public.broadcaster_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view broadcaster stats" ON public.broadcaster_stats;
DROP POLICY IF EXISTS "Authenticated view broadcaster stats" ON public.broadcaster_stats;
DROP POLICY IF EXISTS "Users view own stats" ON public.broadcaster_stats;
CREATE POLICY "Users view own stats" ON public.broadcaster_stats
    FOR SELECT USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- View for broadcaster_stats
DROP VIEW IF EXISTS public.broadcaster_stats_public;
CREATE VIEW public.broadcaster_stats_public AS
SELECT user_id, total_gifts_24h, total_gifts_all_time, last_updated_at
FROM public.broadcaster_stats;
GRANT SELECT ON public.broadcaster_stats_public TO authenticated;

-- C. battles
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view battles" ON public.battles;
DROP POLICY IF EXISTS "Authenticated view battles" ON public.battles;
DROP POLICY IF EXISTS "Participants view own battles" ON public.battles;
CREATE POLICY "Participants view own battles" ON public.battles
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.streams s WHERE s.id = battles.challenger_stream_id AND s.broadcaster_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.streams s WHERE s.id = battles.opponent_stream_id AND s.broadcaster_id = auth.uid())
        )
    );

-- View for battles
DROP VIEW IF EXISTS public.battles_public;
CREATE VIEW public.battles_public AS
SELECT id AS battle_id, challenger_stream_id, opponent_stream_id, status, winner_stream_id, score_challenger, score_opponent, created_at, started_at, ended_at
FROM public.battles;
GRANT SELECT ON public.battles_public TO authenticated;

-- D. districts
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated view districts" ON public.districts;
CREATE POLICY "Authenticated view districts" ON public.districts
    FOR SELECT USING (auth.role() = 'authenticated');

-- E. auction_bids
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Authenticated view auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Users view own bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Users insert own bids" ON public.auction_bids;
CREATE POLICY "Users view own bids" ON public.auction_bids
    FOR SELECT USING (auth.role() = 'authenticated' AND auth.uid() = bidder_user_id);
CREATE POLICY "Users insert own bids" ON public.auction_bids
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = bidder_user_id);

-- View for auction_bids
DROP VIEW IF EXISTS public.auction_bids_public;
CREATE VIEW public.auction_bids_public AS
SELECT id AS bid_id, auction_id, amount, created_at, bidder_user_id
FROM public.auction_bids;
GRANT SELECT ON public.auction_bids_public TO authenticated;

-- F. stream_seat_sessions
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Authenticated view stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Users view own seat session" ON public.stream_seat_sessions;
CREATE POLICY "Users view own seat session" ON public.stream_seat_sessions
    FOR SELECT USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- View for stream_seat_sessions
DROP VIEW IF EXISTS public.stream_seat_sessions_public;
CREATE VIEW public.stream_seat_sessions_public AS
SELECT stream_id, seat_index, user_id, joined_at
FROM public.stream_seat_sessions
WHERE status = 'active';
GRANT SELECT ON public.stream_seat_sessions_public TO authenticated;

-- G. house_upgrades
ALTER TABLE public.house_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view house upgrades" ON public.house_upgrades;
DROP POLICY IF EXISTS "Authenticated view house upgrades" ON public.house_upgrades;
CREATE POLICY "Authenticated view house upgrades" ON public.house_upgrades
    FOR SELECT USING (auth.role() = 'authenticated');

-- H. user_house_upgrades
ALTER TABLE public.user_house_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view user house upgrades" ON public.user_house_upgrades;
DROP POLICY IF EXISTS "Authenticated view user house upgrades" ON public.user_house_upgrades;
DROP POLICY IF EXISTS "Service Role Full Access" ON public.user_house_upgrades;
CREATE POLICY "Service Role Full Access" ON public.user_house_upgrades
    FOR ALL USING (auth.role() = 'service_role');

COMMIT;
