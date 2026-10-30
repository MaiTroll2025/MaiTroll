CREATE OR REPLACE FUNCTION public.trigger_notify_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text := COALESCE(NULLIF(NEW.username, ''), 'New user');
BEGIN
  PERFORM public.notify_staff(
    'new_user_signup',
    'New User Signup',
    '@' || v_username || ' just joined MaiTroll.',
    jsonb_build_object(
      'signup_user_id', NEW.id,
      'signup_username', v_username,
      'route', '/admin/users'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_signup ON public.user_profiles;
CREATE TRIGGER trg_notify_admin_signup
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_admin_signup();
