BEGIN;

-- Keep public profile reads available to anonymous visitors.
DROP POLICY IF EXISTS "Public can read user_profiles" ON public.user_profiles;
CREATE POLICY "Public can read user_profiles"
  ON public.user_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);
GRANT SELECT ON public.user_profiles TO anon, authenticated;

-- Restore the missing relationship used by Treelz comment author embeds.
DO $$
BEGIN
  IF to_regclass('public.treelz_comments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.treelz_comments'::regclass
         AND conname = 'treelz_comments_user_id_user_profiles_fkey'
     ) THEN
    ALTER TABLE public.treelz_comments
      ADD CONSTRAINT treelz_comments_user_id_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END;
$$;

-- Keep post like counts consistent with the likes table without callable,
-- SECURITY DEFINER increment/decrement RPCs.
CREATE OR REPLACE FUNCTION public.sync_treelz_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.treelz_posts
    SET likes_count = COALESCE(likes_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;

  UPDATE public.treelz_posts
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0),
      updated_at = now()
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS treelz_likes_update_post_count ON public.treelz_likes;
CREATE TRIGGER treelz_likes_update_post_count
  AFTER INSERT OR DELETE ON public.treelz_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_treelz_post_likes_count();

-- Only permit a signed-in user to claim their own daily blocker allotment.
CREATE OR REPLACE FUNCTION public.grant_daily_blockers(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_grant TIMESTAMPTZ;
  v_total_blockers INTEGER;
  v_granted INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You may only claim blockers for your own account.';
  END IF;

  SELECT last_blocker_grant_at, COALESCE(blockers, 0)
    INTO v_last_grant, v_total_blockers
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found.';
  END IF;

  IF v_last_grant IS NULL OR v_last_grant < now() - INTERVAL '24 hours' THEN
    v_granted := 5;
    v_total_blockers := v_total_blockers + v_granted;
    UPDATE public.user_profiles
      SET blockers = v_total_blockers,
          last_blocker_grant_at = now()
      WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'blockers_granted', v_granted,
    'total_blockers', v_total_blockers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_daily_blockers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_daily_blockers(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
