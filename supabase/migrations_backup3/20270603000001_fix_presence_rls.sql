-- Migration: Fix presence tables RLS for frontend inserts
-- Timestamp: 20270603000001

-- 1. Fix user_presence_routes RLS to allow authenticated inserts
-- The frontend needs to upsert presence data, but the current policy only allows updates
-- Using auth.uid() ensures the user is authenticated and the user_id matches their session
DROP POLICY IF EXISTS "users can upsert own route presence" ON public.user_presence_routes;
CREATE POLICY "users can upsert own route presence"
  ON public.user_presence_routes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Create user_presence table if it doesn't exist (referenced in frontend)
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_online BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS and create policies for user_presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own presence" ON public.user_presence;
CREATE POLICY "users can view own presence"
  ON public.user_presence
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can insert own presence" ON public.user_presence;
CREATE POLICY "users can insert own presence"
  ON public.user_presence
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users can update own presence" ON public.user_presence;
CREATE POLICY "users can update own presence"
  ON public.user_presence
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_presence_routes TO authenticated;