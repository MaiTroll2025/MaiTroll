-- Drop the conflicting function signature if it exists
DROP FUNCTION IF EXISTS public.find_opponent(uuid, text, text, integer);

-- Ensure the correct one is there (re-definition is safe as it replaces)
-- This was already defined in 20270120008000_troll_battles_setup.sql, but we just want to ensure the old one is gone.
