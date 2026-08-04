
-- Create tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'upcoming', 'open', 'live', 'ended')),
  season INTEGER DEFAULT 1,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  prize_pool TEXT,
  rules TEXT,
  description TEXT,
  max_participants INTEGER,
  entry_fee INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tournament_participants table
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

-- Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- Policies for tournaments
DROP POLICY IF EXISTS "Public can view tournaments" ON public.tournaments;
CREATE POLICY "Public can view tournaments" 
  ON public.tournaments FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Admins can manage tournaments" 
  ON public.tournaments FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Policies for tournament_participants
DROP POLICY IF EXISTS "Public can view participants" ON public.tournament_participants;
CREATE POLICY "Public can view participants" 
  ON public.tournament_participants FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can join open tournaments" ON public.tournament_participants;
CREATE POLICY "Users can join open tournaments" 
  ON public.tournament_participants FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM public.tournaments 
      WHERE id = tournament_id AND (status = 'open' OR status = 'upcoming')
    )
  );

DROP POLICY IF EXISTS "Users can update their own participation" ON public.tournament_participants;
CREATE POLICY "Users can update their own participation" 
  ON public.tournament_participants FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage participants" ON public.tournament_participants;
CREATE POLICY "Admins can manage participants" 
  ON public.tournament_participants FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Seed Data (Insert if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tournaments) THEN
    -- 1. Current Open Tournament
    INSERT INTO public.tournaments (title, subtitle, status, season, start_at, end_at, prize_pool, description, entry_fee, max_participants)
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

    -- 2. Upcoming Tournament
    INSERT INTO public.tournaments (title, subtitle, status, season, start_at, end_at, prize_pool, description, entry_fee, max_participants)
    VALUES (
      'Cyber-Troll Championship', 
      'Only the strongest survive the glitch.', 
      'upcoming', 
      1, 
      NOW() + INTERVAL '14 days', 
      NOW() + INTERVAL '21 days', 
      '1,000,000 Coins', 
      'Prepare for the biggest event of the season.', 
      500, 
      64
    );

    -- 3. Past Tournament
    INSERT INTO public.tournaments (title, subtitle, status, season, start_at, end_at, prize_pool, description, entry_fee, max_participants)
    VALUES (
      'Beta Testers Brawl', 
      'The first ever Mai Troll event.', 
      'ended', 
      0, 
      NOW() - INTERVAL '30 days', 
      NOW() - INTERVAL '25 days', 
      '10,000 Coins', 
      'Legacy tournament for early adopters.', 
      0, 
      32
    );
  END IF;
END $$;
