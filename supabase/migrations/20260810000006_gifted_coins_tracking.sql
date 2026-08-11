-- ============================================================================
-- Gifted coins tracking fix
-- Ensure gifted coins are tracked separately from troll coins in stats
-- ============================================================================

-- gifted_coins column on user_profiles tracks coins RECEIVED as gifts (separate from troll_coins wallet)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gifted_coins integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gifts_received integer DEFAULT 0;

-- broadcast_league_stats should track gift coins received separately from troll coins
ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS gifted_coins_received integer DEFAULT 0;

-- Ensure coin_transactions tracks gift type clearly
ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS is_gift boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_coin_transactions_gift ON public.coin_transactions(is_gift);
