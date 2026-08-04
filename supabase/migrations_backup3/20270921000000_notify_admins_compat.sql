-- Compatibility shim: notify_admins wrapper
-- Some triggers/functions expect public.notify_admins(...) to exist.

CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prefer the newer unified staff notifier if it exists
  IF to_regprocedure('public.notify_staff(text,text,text,jsonb)') IS NOT NULL THEN
    PERFORM public.notify_staff(p_type, p_title, p_message, p_metadata);
    RETURN;
  END IF;

  -- Fallback: notify admins only
  INSERT INTO public.notifications (user_id, type, title, message, metadata, priority, created_at, is_read)
  SELECT id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::jsonb), COALESCE(p_priority, 'normal'), NOW(), FALSE
  FROM public.user_profiles
  WHERE role = 'admin' OR is_admin = true;
END;
$$;

-- Overload for older call sites
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(p_type, p_title, p_message, p_metadata, 'normal');
END;
$$;

-- Overload for older call sites
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(p_type, p_title, p_message, '{}'::jsonb, 'normal');
END;
$$;
