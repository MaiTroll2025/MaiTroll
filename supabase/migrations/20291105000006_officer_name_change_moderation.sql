ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS name_change_restricted_until timestamptz,
  ADD COLUMN IF NOT EXISTS name_change_restricted_by uuid;

CREATE OR REPLACE FUNCTION public.enforce_name_change_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.name_change_restricted_until IS DISTINCT FROM OLD.name_change_restricted_until
     OR NEW.name_change_restricted_by IS DISTINCT FROM OLD.name_change_restricted_by THEN
    IF current_setting('app.name_change_moderation', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Only an authorized officer can change name-change restrictions'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_actor = OLD.id
     AND (
       NEW.username IS DISTINCT FROM OLD.username
       OR NEW.display_name IS DISTINCT FROM OLD.display_name
       OR NEW.full_name IS DISTINCT FROM OLD.full_name
     )
     AND OLD.name_change_restricted_until > clock_timestamp() THEN
    RAISE EXCEPTION 'Name changes are restricted until %', OLD.name_change_restricted_until
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_name_change_restriction ON public.user_profiles;
CREATE TRIGGER enforce_name_change_restriction
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_name_change_restriction();

CREATE OR REPLACE FUNCTION public.notify_officers_of_user_name_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metadata jsonb;
  v_old_display_name text;
  v_new_display_name text;
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.id
     OR (
       NEW.username IS NOT DISTINCT FROM OLD.username
       AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name
       AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name
     ) THEN
    RETURN NEW;
  END IF;

  v_old_display_name := COALESCE(NULLIF(OLD.display_name, ''), NULLIF(OLD.full_name, ''), OLD.username);
  v_new_display_name := COALESCE(NULLIF(NEW.display_name, ''), NULLIF(NEW.full_name, ''), NEW.username);
  v_metadata := jsonb_build_object(
    'tab_key', 'officer-operations',
    'entity_id', NEW.id::text,
    'route', '/admin/users',
    'source', 'user_profiles',
    'subject_user_id', NEW.id,
    'username_before', OLD.username,
    'username_after', NEW.username,
    'display_name_before', v_old_display_name,
    'display_name_after', v_new_display_name,
    'priority', 'normal'
  );

  INSERT INTO public.notifications (
    user_id, type, title, message, link, metadata, data,
    is_read, created_at, updated_at, tab_key, entity_id, severity, priority, source
  )
  SELECT
    officer.id,
    'user_name_changed',
    'User changed their name',
    format('@%s changed their name to %s', OLD.username, v_new_display_name),
    '/admin/users',
    v_metadata,
    v_metadata,
    false,
    clock_timestamp(),
    clock_timestamp(),
    'officer-operations',
    NEW.id::text,
    'info',
    'normal',
    'user_profiles'
  FROM public.user_profiles officer
  WHERE officer.id <> NEW.id
    AND (
      officer.is_troll_officer IS TRUE
      OR officer.is_lead_officer IS TRUE
      OR COALESCE((to_jsonb(officer)->>'is_lead_troll_officer')::boolean, false)
      OR lower(COALESCE(officer.role::text, '')) IN ('troll_officer', 'lead_troll_officer')
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_officers_of_user_name_change ON public.user_profiles;
CREATE TRIGGER notify_officers_of_user_name_change
  AFTER UPDATE OF username, display_name, full_name ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_officers_of_user_name_change();

CREATE OR REPLACE FUNCTION public.moderate_user_name_change(
  p_user_id uuid,
  p_action text,
  p_display_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_display_name text;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles officer
    WHERE officer.id = v_actor
      AND (
        officer.is_troll_officer IS TRUE
        OR officer.is_lead_officer IS TRUE
        OR COALESCE((to_jsonb(officer)->>'is_lead_troll_officer')::boolean, false)
        OR lower(COALESCE(officer.role::text, '')) IN ('troll_officer', 'lead_troll_officer')
      )
  ) THEN
    RAISE EXCEPTION 'Troll officer access required' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('default_name', 'change_name', 'restrict_name_change') THEN
    RAISE EXCEPTION 'Invalid name moderation action';
  END IF;

  IF p_action = 'restrict_name_change' THEN
    PERFORM set_config('app.name_change_moderation', 'on', true);
    UPDATE public.user_profiles
    SET name_change_restricted_until = clock_timestamp() + interval '3 days',
        name_change_restricted_by = v_actor,
        updated_at = clock_timestamp()
    WHERE id = p_user_id;
  ELSE
    v_display_name := CASE
      WHEN p_action = 'default_name' THEN 'MAiTroll User'
      ELSE NULLIF(btrim(p_display_name), '')
    END;

    IF v_display_name IS NULL OR length(v_display_name) > 80 THEN
      RAISE EXCEPTION 'Enter a display name between 1 and 80 characters';
    END IF;

    PERFORM set_config('app.name_change_moderation', 'on', true);
    UPDATE public.user_profiles
    SET display_name = v_display_name,
        full_name = v_display_name,
        updated_at = clock_timestamp()
    WHERE id = p_user_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile was not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_name_change_restriction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_officers_of_user_name_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.moderate_user_name_change(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_user_name_change(uuid, text, text)
  TO authenticated, service_role;
