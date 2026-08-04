-- RPC functions for mod actions: set_to_user and remove_officer

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.set_user_role(UUID);
DROP FUNCTION IF EXISTS public.remove_broadofficer(UUID);

-- Function to set user to regular user (removes all officer roles)
CREATE FUNCTION public.set_user_role(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    role = 'user',
    is_troll_officer = FALSE,
    is_lead_officer = FALSE,
    is_prosecutor = FALSE,
    is_attorney = FALSE,
    is_secretary = FALSE,
    troll_role = 'user',
    officer_level = NULL
  WHERE id = p_user_id;
END;
$$;

-- Function to remove broadofficer status only
CREATE FUNCTION public.remove_broadofficer(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    is_troll_officer = FALSE,
    is_lead_officer = FALSE,
    is_prosecutor = FALSE,
    is_attorney = FALSE,
    troll_role = 'user'
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_broadofficer(UUID) TO authenticated;