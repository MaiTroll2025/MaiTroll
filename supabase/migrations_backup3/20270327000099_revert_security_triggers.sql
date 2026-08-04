-- Revert security triggers to allow client-side updates
DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_protect_streams ON public.streams;

-- Also drop the function if we want to be thorough, but dropping triggers is enough to stop the enforcement
-- DROP FUNCTION IF EXISTS public.protect_sensitive_columns();
