-- Fix missing foreign key relationships causing PGRST200 errors

-- president_proposals.created_by -> user_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_proposals_created_by_fkey'
  ) THEN
    ALTER TABLE public.president_proposals
      ADD CONSTRAINT president_proposals_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- stream_seat_sessions.user_id -> user_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stream_seat_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE public.stream_seat_sessions
      ADD CONSTRAINT stream_seat_sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- stream_viewers.user_id -> user_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stream_viewers_user_id_fkey'
  ) THEN
    ALTER TABLE public.stream_viewers
      ADD CONSTRAINT stream_viewers_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_league_members.league_id -> leagues
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_league_members_league_id_fkey'
  ) THEN
    ALTER TABLE public.user_league_members
      ADD CONSTRAINT user_league_members_league_id_fkey
        FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_subscriptions.subscriber_id -> user_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_subscriptions_subscriber_id_fkey'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_subscriber_id_fkey
        FOREIGN KEY (subscriber_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
