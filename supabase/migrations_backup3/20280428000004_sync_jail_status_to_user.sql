-- Auto-sync jail status with user_profiles.is_jailed
-- This trigger ensures that whenever a jail record is inserted, updated, or deleted,
-- the corresponding user's is_jailed flag reflects their current jail status.

CREATE OR REPLACE FUNCTION public.sync_jail_status_to_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Determine which user ID to check (could be NEW or OLD depending on operation)
  IF (TG_OP = 'DELETE') THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Update the user's is_jailed status based on whether they have any active jail record
  UPDATE public.user_profiles
  SET is_jailed = EXISTS (
    SELECT 1 FROM public.jail 
    WHERE user_id = v_user_id 
      AND release_time > NOW() 
      AND status = 'jailed'
  )
  WHERE id = v_user_id;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on jail table
DROP TRIGGER IF EXISTS trigger_sync_jail_status ON public.jail;
CREATE TRIGGER trigger_sync_jail_status
  AFTER INSERT OR UPDATE OR DELETE ON public.jail
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_jail_status_to_user();