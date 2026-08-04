-- Create streams table if it doesn't exist (Moved from moderation.sql to fix dependency)
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'pending', -- pending, live, ended
  box_count INTEGER DEFAULT 1,
  seat_price INTEGER DEFAULT 0,
  are_seats_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Ensure RLS on streams
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Public read streams'
  ) THEN
    CREATE POLICY "Public read streams" ON public.streams FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Broadcasters manage streams'
  ) THEN
    CREATE POLICY "Broadcasters manage streams" ON public.streams FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;


-- Stream Messages
CREATE TABLE IF NOT EXISTS public.stream_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stream messages are viewable by everyone" ON public.stream_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert their own messages" ON public.stream_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
