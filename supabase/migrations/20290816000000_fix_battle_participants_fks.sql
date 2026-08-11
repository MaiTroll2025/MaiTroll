-- ============================================================================
-- Add missing foreign keys to battle_participants
-- ============================================================================
-- battle_participants.user_id -> user_profiles(id)
-- battle_participants.battle_id -> battles(id)
-- battle_participants.source_stream_id -> streams(id)
--
-- Uses IF NOT EXISTS checks to avoid breaking existing data or duplicate
-- constraint application on environments that already have partial FKs.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'battle_participants'
      AND constraint_name = 'battle_participants_battle_id_fkey'
  ) THEN
    ALTER TABLE public.battle_participants
      ADD CONSTRAINT battle_participants_battle_id_fkey
      FOREIGN KEY (battle_id) REFERENCES public.battles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'battle_participants'
      AND constraint_name = 'battle_participants_user_id_fkey'
  ) THEN
    ALTER TABLE public.battle_participants
      ADD CONSTRAINT battle_participants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'battle_participants'
      AND constraint_name = 'battle_participants_source_stream_id_fkey'
  ) THEN
    ALTER TABLE public.battle_participants
      ADD CONSTRAINT battle_participants_source_stream_id_fkey
      FOREIGN KEY (source_stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;
  END IF;
END $$;
