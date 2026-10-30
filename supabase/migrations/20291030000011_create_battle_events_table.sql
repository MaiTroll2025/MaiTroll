-- Create battle_events table if not exists
CREATE TABLE IF NOT EXISTS public.battle_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'troll', 'sudden_death_start', 'guest_join', 'guest_leave', etc.
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  amount NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on battle_events
ALTER TABLE public.battle_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'battle_events' AND policyname = 'Public read battle events'
  ) THEN
    CREATE POLICY "Public read battle events" ON public.battle_events
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'battle_events' AND policyname = 'Authenticated insert battle events'
  ) THEN
    CREATE POLICY "Authenticated insert battle events" ON public.battle_events
      FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.battles b
        WHERE b.id = battle_id
        AND (EXISTS (SELECT 1 FROM public.streams s WHERE s.id = b.challenger_stream_id AND s.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.streams s WHERE s.id = b.opponent_stream_id AND s.user_id = auth.uid()))
      ));
  END IF;
END $$;

-- Create indexes for battle events
CREATE INDEX IF NOT EXISTS idx_battle_events_battle_id ON public.battle_events(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_events_created_at ON public.battle_events(created_at DESC);

-- Add realtime publication for battle_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'battle_events' AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_events;
  END IF;
END $$;

COMMENT ON TABLE public.battle_events IS 'Tracks events during battles including trolls, guest joins/leaves, and sudden death';
