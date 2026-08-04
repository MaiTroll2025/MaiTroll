-- Fix missing FK relationships and columns causing PGRST200 and 22P02 errors

-- 1. Add broadcaster_id column to streams and FK to user_profiles
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS broadcaster_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'streams_broadcaster_id_fkey'
  ) THEN
    ALTER TABLE public.streams
      ADD CONSTRAINT streams_broadcaster_id_fkey
        FOREIGN KEY (broadcaster_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.streams SET broadcaster_id = user_id WHERE broadcaster_id IS NULL AND user_id IS NOT NULL;

-- 2. Add FK: president_appointments.president_user_id → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_appointments_president_user_id_fkey'
  ) THEN
    ALTER TABLE public.president_appointments
      ADD CONSTRAINT president_appointments_president_user_id_fkey
        FOREIGN KEY (president_user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Add FK: president_appointments.vice_president_user_id → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_appointments_vice_president_user_id_fkey'
  ) THEN
    ALTER TABLE public.president_appointments
      ADD CONSTRAINT president_appointments_vice_president_user_id_fkey
        FOREIGN KEY (vice_president_user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Add FK: president_appointments.removed_by → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_appointments_removed_by_fkey'
  ) THEN
    ALTER TABLE public.president_appointments
      ADD CONSTRAINT president_appointments_removed_by_fkey
        FOREIGN KEY (removed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Add FK: president_candidates.election_id → president_elections(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_candidates_election_id_fkey'
  ) THEN
    ALTER TABLE public.president_candidates
      ADD CONSTRAINT president_candidates_election_id_fkey
        FOREIGN KEY (election_id) REFERENCES public.president_elections(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Add FK: president_elections.winner_candidate_id → president_candidates(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_elections_winner_candidate_id_fkey'
  ) THEN
    ALTER TABLE public.president_elections
      ADD CONSTRAINT president_elections_winner_candidate_id_fkey
        FOREIGN KEY (winner_candidate_id) REFERENCES public.president_candidates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Add FK: president_elections.created_by → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_elections_created_by_fkey'
  ) THEN
    ALTER TABLE public.president_elections
      ADD CONSTRAINT president_elections_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Add FKs for president_votes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_votes_election_id_fkey'
  ) THEN
    ALTER TABLE public.president_votes
      ADD CONSTRAINT president_votes_election_id_fkey
        FOREIGN KEY (election_id) REFERENCES public.president_elections(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_votes_candidate_id_fkey'
  ) THEN
    ALTER TABLE public.president_votes
      ADD CONSTRAINT president_votes_candidate_id_fkey
        FOREIGN KEY (candidate_id) REFERENCES public.president_candidates(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'president_votes_voter_id_fkey'
  ) THEN
    ALTER TABLE public.president_votes
      ADD CONSTRAINT president_votes_voter_id_fkey
        FOREIGN KEY (voter_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 9. Add missing columns to user_profiles referenced by frontend
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username_style TEXT DEFAULT NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_gold BOOLEAN NOT NULL DEFAULT false;