-- Moderation offense tracking for escalating penalties
CREATE TABLE IF NOT EXISTS public.moderation_offenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context TEXT NOT NULL, -- 'chat' | 'flying_chat' | 'utromail' | 'wall' | 'post' | 'comment'
  content TEXT,
  matched_terms TEXT[],
  offense_count INTEGER NOT NULL DEFAULT 1,
  action_taken TEXT NOT NULL DEFAULT 'warning', -- warning | jail_30m | jail_7d | jail_3m
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_offenses_user ON public.moderation_offenses(user_id, created_at DESC);

ALTER TABLE public.moderation_offenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own offenses" ON public.moderation_offenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages offenses" ON public.moderation_offenses
  FOR ALL USING (auth.role() = 'service_role');

-- Banned keyword dictionary (server-side)
CREATE TABLE IF NOT EXISTS public.moderation_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL UNIQUE,
  category TEXT,
  severity INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active keywords" ON public.moderation_keywords
  FOR SELECT USING (active = true);

CREATE POLICY "Service role manages keywords" ON public.moderation_keywords
  FOR ALL USING (auth.role() = 'service_role');