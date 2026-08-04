-- ============================================================
-- Fix utromail bugs reported by Bug Center
-- ============================================================

-- Bug #1: Add missing unique constraint on utromail_read_status
-- The ON CONFLICT clause in utromailService.ts requires this constraint.
-- Also fixes the utromail_thread_members upsert onConflict mismatch
-- (service code was using onConflict: 'thread_id,user_id,folder' but
--  the table only has UNIQUE(thread_id, user_id)).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'utromail_read_status'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'utromail_read_status_message_id_user_id_unique'
  ) THEN
    ALTER TABLE public.utromail_read_status
      ADD CONSTRAINT utromail_read_status_message_id_user_id_unique
      UNIQUE (message_id, user_id);
  END IF;
END $$;

-- Bug #2: Create missing find_utromail_thread function
CREATE OR REPLACE FUNCTION public.find_utromail_thread(user_a uuid, user_b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  SELECT tm.thread_id INTO v_thread_id
  FROM public.utromail_thread_members tm
  JOIN public.utromail_thread_members tm2
    ON tm.thread_id = tm2.thread_id
   AND tm2.user_id = user_b
  WHERE tm.user_id = user_a
  AND tm.thread_id IN (
    SELECT thread_id
    FROM public.utromail_thread_members
    WHERE user_id = user_b
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.utromail_thread_members tm3
    WHERE tm3.thread_id = tm.thread_id
      AND tm3.user_id NOT IN (user_a, user_b)
  )
  LIMIT 1;

  RETURN v_thread_id;
END;
$$;

-- Bug #3: Create missing can_send_utromail function
-- (function may exist in schema but not deployed to DB)
CREATE OR REPLACE FUNCTION public.can_send_utromail(sender_id uuid, recipient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privacy text;
  v_blocked boolean;
  v_sender_follows boolean;
  v_recipient_follows boolean;
  v_mutual boolean;
  v_recipient_verified boolean;
  v_sender_staff boolean;
  v_recipient_staff boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = sender_id
      AND (
        is_admin OR role IN ('admin','ceo','superadmin','troll_officer','lead_troll_officer','secretary',
        'academy_teacher','academy_director','admissions_officer','moderator','attorney','prosecutor')
      )
  ) INTO v_sender_staff;

  IF v_sender_staff THEN RETURN true; END IF;

  IF EXISTS(SELECT 1 FROM public.user_profiles WHERE id = sender_id AND utromail_disabled = true) THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.utromail_blocks
    WHERE blocker_id = recipient_id AND blocked_id = sender_id
  ) INTO v_blocked;
  IF v_blocked THEN RETURN false; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = recipient_id
      AND (
        is_admin OR role IN ('admin','ceo','superadmin','troll_officer','lead_troll_officer','secretary',
        'academy_teacher','academy_director','admissions_officer','moderator','attorney','prosecutor')
      )
  ) INTO v_recipient_staff;

  IF v_recipient_staff THEN RETURN true; END IF;

  SELECT mail_privacy_setting INTO v_privacy
  FROM public.user_profiles WHERE id = recipient_id;
  IF v_privacy IS NULL THEN v_privacy := 'mutual_followers'; END IF;

  SELECT (is_verified = true) INTO v_recipient_verified
  FROM public.user_profiles WHERE id = sender_id;

  SELECT EXISTS(
    SELECT 1 FROM public.user_follows
    WHERE follower_id = sender_id AND following_id = recipient_id
  ) INTO v_sender_follows;

  SELECT EXISTS(
    SELECT 1 FROM public.user_follows
    WHERE follower_id = recipient_id AND following_id = sender_id
  ) INTO v_recipient_follows;

  v_mutual := v_sender_follows AND v_recipient_follows;

  CASE v_privacy
    WHEN 'everyone' THEN RETURN true;
    WHEN 'following' THEN RETURN v_sender_follows;
    WHEN 'mutual_followers' THEN RETURN v_mutual;
    WHEN 'verified_only' THEN RETURN v_recipient_verified;
    ELSE RETURN v_mutual;
  END CASE;
END;
$$;

-- Bug #4: Add missing FK constraint utromail_requests_sender_id_fkey
-- The utromail_requests table needs a proper FK from sender_id to user_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'utromail_requests_sender_id_fkey'
  ) THEN
    ALTER TABLE public.utromail_requests
      ADD CONSTRAINT utromail_requests_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Also ensure the recipient_id FK constraint exists with proper name
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'utromail_requests_recipient_id_fkey'
  ) THEN
    ALTER TABLE public.utromail_requests
      ADD CONSTRAINT utromail_requests_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION public.find_utromail_thread(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_send_utromail(uuid, uuid) TO authenticated, anon;