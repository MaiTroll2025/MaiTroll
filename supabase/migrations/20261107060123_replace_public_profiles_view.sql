-- Replace the security-definer public profile view with a narrow public table.
-- Anonymous viewers can read only these explicitly public profile fields.
BEGIN;

-- The object may be a view from an earlier rollout or a table from a
-- partially completed rollout; remove either shape before creating the table.
DO $$
BEGIN
  IF to_regclass('public.public_profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = 'public.public_profiles'::regclass
        AND relkind = 'v'
    ) THEN
      EXECUTE 'DROP VIEW public.public_profiles';
    ELSE
      EXECUTE 'DROP TABLE public.public_profiles';
    END IF;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.public_profiles (
  id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  banner_url TEXT,
  bio TEXT
);

INSERT INTO public.public_profiles (
  id, username, display_name, avatar_url, cover_url, banner_url, bio
)
SELECT
  id, username, display_name, avatar_url, cover_url, banner_url, bio
FROM public.user_profiles
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  cover_url = EXCLUDED.cover_url,
  banner_url = EXCLUDED.banner_url,
  bio = EXCLUDED.bio;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are readable" ON public.public_profiles;
CREATE POLICY "Public profiles are readable"
  ON public.public_profiles
  FOR SELECT
  USING (true);

REVOKE ALL ON TABLE public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_public_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_profiles (
    id, username, display_name, avatar_url, cover_url, banner_url, bio
  )
  VALUES (
    NEW.id, NEW.username, NEW.display_name, NEW.avatar_url,
    NEW.cover_url, NEW.banner_url, NEW.bio
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    cover_url = EXCLUDED.cover_url,
    banner_url = EXCLUDED.banner_url,
    bio = EXCLUDED.bio;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_public_profile_after_user_profile_change
  ON public.user_profiles;
CREATE TRIGGER sync_public_profile_after_user_profile_change
  AFTER INSERT OR UPDATE OF username, display_name, avatar_url, cover_url, banner_url, bio
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_public_profile();

COMMIT;
