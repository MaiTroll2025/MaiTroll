-- Fix PGRST200 errors - Run each block separately in Supabase SQL Editor

-- Note: This migration drops existing FKs pointing to auth.users and recreates them pointing to public.user_profiles

-- 1. CHURCH PRAYER REPLIES
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'church_prayer_replies_user_id_fkey'
    ) THEN
        ALTER TABLE public.church_prayer_replies
        DROP CONSTRAINT church_prayer_replies_user_id_fkey;
    END IF;
    ALTER TABLE public.church_prayer_replies
    ADD CONSTRAINT church_prayer_replies_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);
END $$;

-- 2. MODERATION ACTIONS - actor_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'moderation_actions_actor_id_fkey'
    ) THEN
        ALTER TABLE public.moderation_actions
        DROP CONSTRAINT moderation_actions_actor_id_fkey;
    END IF;
    ALTER TABLE public.moderation_actions
    ADD CONSTRAINT moderation_actions_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id);
END $$;

-- 3. MODERATION ACTIONS - target_user_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'moderation_actions_target_user_id_fkey'
    ) THEN
        ALTER TABLE public.moderation_actions
        DROP CONSTRAINT moderation_actions_target_user_id_fkey;
    END IF;
    ALTER TABLE public.moderation_actions
    ADD CONSTRAINT moderation_actions_target_user_id_fkey
    FOREIGN KEY (target_user_id) REFERENCES public.user_profiles(id);
END $$;

-- 4. USER REPORTS - reporter_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_reports_reporter_id_fkey'
    ) THEN
        ALTER TABLE public.user_reports
        DROP CONSTRAINT user_reports_reporter_id_fkey;
    END IF;
    ALTER TABLE public.user_reports
    ADD CONSTRAINT user_reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES public.user_profiles(id);
END $$;

-- 5. USER REPORTS - reported_user_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_reports_reported_user_id_fkey'
    ) THEN
        ALTER TABLE public.user_reports
        DROP CONSTRAINT user_reports_reported_user_id_fkey;
    END IF;
    ALTER TABLE public.user_reports
    ADD CONSTRAINT user_reports_reported_user_id_fkey
    FOREIGN KEY (reported_user_id) REFERENCES public.user_profiles(id);
END $$;

-- 6. USER REPORTS - reviewed_by
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_reports_reviewed_by_fkey'
    ) THEN
        ALTER TABLE public.user_reports
        DROP CONSTRAINT user_reports_reviewed_by_fkey;
    END IF;
    ALTER TABLE public.user_reports
    ADD CONSTRAINT user_reports_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.user_profiles(id);
END $$;

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';