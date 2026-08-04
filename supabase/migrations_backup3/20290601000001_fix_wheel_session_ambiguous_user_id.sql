-- Fix SQL 42702/42703: ambiguous column reference "user_id" in get_or_create_wheel_session
-- Also ensures the wheel_sessions table exists (it may not if the original migration wasn't applied).
-- The WHERE clause referenced bare "user_id" which is ambiguous between the table column
-- and the RETURN TABLE output variable. Fix: use wheel_sessions.user_id everywhere.

-- Ensure the wheel_sessions table exists
CREATE TABLE IF NOT EXISTS public.wheel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ DEFAULT now(),
  bankrupt_landed BOOLEAN DEFAULT false,
  total_spins INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_wheel_sessions_user ON public.wheel_sessions(user_id, session_start DESC);

ALTER TABLE public.wheel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY public.wheel_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their wheel sessions" ON public.wheel_sessions;
CREATE POLICY "Users can manage their wheel sessions" ON public.wheel_sessions
  FOR ALL USING (auth.uid() = user_id);

GRANT SELECT ON public.wheel_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_wheel_session()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  session_start TIMESTAMPTZ,
  bankrupt_landed BOOLEAN,
  total_spins INTEGER
) AS $$
DECLARE
  v_session RECORD;
  v_user_id UUID;
  v_today DATE;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_today := CURRENT_DATE;

  -- Check for existing session today (fully qualified column reference)
  SELECT * INTO v_session
  FROM wheel_sessions
  WHERE wheel_sessions.user_id = v_user_id
    AND DATE(wheel_sessions.session_start) = v_today
  ORDER BY wheel_sessions.session_start DESC
  LIMIT 1;

  -- Create new session if none exists
  IF v_session IS NULL THEN
    INSERT INTO wheel_sessions (user_id, session_start, bankrupt_landed, total_spins)
    VALUES (v_user_id, NOW(), false, 0)
    RETURNING * INTO v_session;
  END IF;

  -- Return session data
  RETURN QUERY
    SELECT v_session.id, v_session.user_id, v_session.session_start, v_session.bankrupt_landed, v_session.total_spins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_or_create_wheel_session TO authenticated;
