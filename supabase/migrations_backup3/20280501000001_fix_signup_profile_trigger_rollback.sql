-- Repair signup profile creation.
-- The profile row is the critical path; welcome transaction logging must never
-- roll it back. This migration is intentionally separate in case the previous
-- launch-blocker migration already ran.

CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
  v_email text;
  v_role text;
BEGIN
  v_username := trim(both '_' from regexp_replace(lower(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(NEW.raw_app_meta_data->>'username', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user'
  )), '[^a-z0-9_]+', '_', 'g')) || '_' || substr(replace(NEW.id::text, '-', ''), 1, 12);

  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );

  v_email := COALESCE(NEW.email, '');
  v_role := CASE WHEN lower(v_email) = 'Mai Troll2025@gmail.com' THEN 'admin' ELSE 'user' END;

  INSERT INTO public.user_profiles (
    id,
    user_id,
    username,
    avatar_url,
    bio,
    role,
    tier,
    troll_coins,
    total_earned_coins,
    total_spent_coins,
    email,
    terms_accepted,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    v_username,
    v_avatar_url,
    'New troll in the city!',
    v_role,
    'Bronze',
    250,
    250,
    0,
    v_email,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = COALESCE(public.user_profiles.user_id, EXCLUDED.user_id),
    email = COALESCE(public.user_profiles.email, EXCLUDED.email),
    username = COALESCE(public.user_profiles.username, EXCLUDED.username),
    avatar_url = COALESCE(public.user_profiles.avatar_url, EXCLUDED.avatar_url),
    role = COALESCE(public.user_profiles.role, EXCLUDED.role),
    troll_coins = CASE
      WHEN public.user_profiles.troll_coins IS NULL OR public.user_profiles.troll_coins < 250 THEN 250
      WHEN public.user_profiles.troll_coins = 500 THEN 250
      ELSE public.user_profiles.troll_coins
    END,
    total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 250),
    updated_at = now();

  BEGIN
    INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    SELECT NEW.id, 'purchase', 250, 'Welcome bonus coins', now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.coin_transactions
      WHERE user_id = NEW.id
        AND description IN ('Welcome bonus coins', 'Welcome bonus coins!')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Welcome coin transaction skipped for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

INSERT INTO public.user_profiles (
  id,
  user_id,
  username,
  avatar_url,
  bio,
  role,
  tier,
  troll_coins,
  total_earned_coins,
  total_spent_coins,
  email,
  terms_accepted,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.id,
  trim(both '_' from regexp_replace(lower(COALESCE(
    NULLIF(au.raw_user_meta_data->>'username', ''),
    NULLIF(au.raw_app_meta_data->>'username', ''),
    NULLIF(split_part(COALESCE(au.email, ''), '@', 1), ''),
    'user'
  )), '[^a-z0-9_]+', '_', 'g')) || '_' || substr(replace(au.id::text, '-', ''), 1, 12),
  COALESCE(
    au.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || substr(replace(au.id::text, '-', ''), 1, 12)
  ),
  'New troll in the city!',
  CASE WHEN lower(COALESCE(au.email, '')) = 'Mai Troll2025@gmail.com' THEN 'admin' ELSE 'user' END,
  'Bronze',
  250,
  250,
  0,
  COALESCE(au.email, ''),
  false,
  COALESCE(au.created_at, now()),
  now()
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.handle_user_signup() TO service_role, authenticated;

NOTIFY pgrst, 'reload schema';
