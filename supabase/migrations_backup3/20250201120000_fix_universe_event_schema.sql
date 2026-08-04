
-- 1. Fix schema for tournaments table
-- Ensure columns exist
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS season INTEGER DEFAULT 1;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS prize_pool TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS rules TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS max_participants INTEGER;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS entry_fee INTEGER DEFAULT 0;

-- FIX: Ensure prize_pool is TEXT (Handle case where it was created as INTEGER)
ALTER TABLE public.tournaments ALTER COLUMN prize_pool TYPE TEXT;

-- 2. Update Status Constraint safely
DO $$
BEGIN
    ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
    ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_status_check 
    CHECK (status IN ('draft', 'upcoming', 'open', 'live', 'ended'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Ensure tournament_participants table exists
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated', 'withdrawn', 'winner')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  points INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  rank INTEGER,
  stats JSONB DEFAULT '{}'::jsonb,
  UNIQUE(tournament_id, user_id)
);

-- 4. Add columns to tournament_participants if it already existed
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::jsonb;

-- 5. Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- 6. Create/Update Policies
DROP POLICY IF EXISTS "Public can view tournaments" ON public.tournaments;
CREATE POLICY "Public can view tournaments" ON public.tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view participants" ON public.tournament_participants;
CREATE POLICY "Public can view participants" ON public.tournament_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join open tournaments" ON public.tournament_participants;
CREATE POLICY "Users can join open tournaments" ON public.tournament_participants FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.tournaments 
    WHERE id = tournament_id AND (status = 'open' OR status = 'upcoming')
  )
);

DROP POLICY IF EXISTS "Users can update their own participation" ON public.tournament_participants;
CREATE POLICY "Users can update their own participation" ON public.tournament_participants FOR UPDATE
USING (auth.uid() = user_id);

-- 7. Seed Data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tournaments WHERE title = 'Mai Troll Showdown') THEN
    INSERT INTO public.tournaments (
      title, subtitle, status, season, start_at, end_at, 
      prize_pool, description, entry_fee, max_participants
    )
    VALUES (
      'Mai Troll Showdown', 
      'The ultimate battle for street supremacy.', 
      'open', 
      1, 
      NOW() + INTERVAL '2 days', 
      NOW() + INTERVAL '7 days', 
      '500,000 Coins + Rare Badge', 
      'Join the Mai Troll Showdown! Battle your way to the top in this single-elimination bracket. Winner takes all.', 
      100, 
      128
    );
  END IF;
END $$;
