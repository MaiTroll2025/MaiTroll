BEGIN;

-- ============================================================================
-- Restrict admin messaging and admin-post comments/replies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: is_admin_user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        is_admin = true
        OR LOWER(COALESCE(role, '')) IN ('admin', 'superadmin', 'ceo')
        OR LOWER(COALESCE(troll_role, '')) IN ('admin', 'superadmin', 'ceo')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Helper: user_is_staff_or_approved
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_is_staff_or_approved(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  -- Check user_profiles for staff/admin flags/roles
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        is_admin = true
        OR LOWER(COALESCE(role, '')) IN (
          'admin','superadmin','ceo','lead_troll_officer','troll_officer','secretary',
          'broadcaster','broadofficer','ceo_assistant','noah_assistant'
        )
        OR LOWER(COALESCE(troll_role, '')) IN (
          'admin','superadmin','ceo','lead_troll_officer','troll_officer','secretary',
          'broadcaster','broadofficer','ceo_assistant','noah_assistant'
        )
        OR is_lead_officer = true
        OR is_troll_officer = true
        OR is_ceo_assistant = true
        OR is_noah_assistant = true
      )
  ) INTO v_is_staff;

  IF v_is_staff THEN
    RETURN true;
  END IF;

  -- Check career_applications table if it exists
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'career_applications'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.career_applications
      WHERE user_id = p_user_id AND status = 'approved'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check applications table if it exists
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'applications'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.applications
      WHERE user_id = p_user_id AND status = 'approved'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_is_staff_or_approved(uuid) TO authenticated, service_role;

-- ============================================================================
-- 2. messages: restrict DM/reply to admins (only if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'messages'
  ) THEN
    -- Drop all existing INSERT policies on messages
    DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
    DROP POLICY IF EXISTS "auth_insert_own" ON public.messages;
    DROP POLICY IF EXISTS "authenticated_users_can_insert_messages" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_self" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
    DROP POLICY IF EXISTS "messages_paid_insert" ON public.messages;

    CREATE POLICY "Restricted messages insert"
      ON public.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (auth.uid() = sender_id OR auth.uid() = user_id)
        AND (
          public.user_is_staff_or_approved(auth.uid())
          OR NOT public.is_admin_user(receiver_id)
          OR EXISTS (
            SELECT 1 FROM public.messages
            WHERE sender_id = receiver_id
              AND receiver_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 3. troll_post_comments: restrict comments on admin posts (only if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'troll_post_comments'
  ) THEN
    DROP POLICY IF EXISTS "Users can insert their own comments" ON public.troll_post_comments;
    DROP POLICY IF EXISTS "auth_insert_own" ON public.troll_post_comments;

    CREATE POLICY "Restricted comments insert on admin posts"
      ON public.troll_post_comments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND (
          public.user_is_staff_or_approved(auth.uid())
          OR NOT EXISTS (
            SELECT 1 FROM public.troll_posts
            WHERE id = post_id
              AND public.is_admin_user(user_id)
          )
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 4. troll_wall_posts: restrict replies to admin wall posts (only if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'troll_wall_posts'
  ) THEN
    DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.troll_wall_posts;
    DROP POLICY IF EXISTS "Users can create wall posts" ON public.troll_wall_posts;
    DROP POLICY IF EXISTS "auth_insert_own" ON public.troll_wall_posts;

    CREATE POLICY "Restricted wall posts insert"
      ON public.troll_wall_posts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND (
          public.user_is_staff_or_approved(auth.uid())
          OR reply_to_post_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.troll_wall_posts parent
            WHERE parent.id = reply_to_post_id
              AND public.is_admin_user(parent.user_id)
          )
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
