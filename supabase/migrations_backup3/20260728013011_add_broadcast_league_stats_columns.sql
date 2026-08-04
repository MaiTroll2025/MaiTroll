-- Add missing columns referenced by frontend queries

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS sub_tier TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS league_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gifts_sent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_xp BIGINT DEFAULT 0;
