-- ============================================================================
-- BUG FIX: moderation_actions status + jail FK relationship
-- Fixes:
--   1. moderation_actions.status = "completed" rejected by check constraint
--   2. jail <-> user_profiles FK relationship missing from schema cache
-- ============================================================================

BEGIN;

-- ============================================================================
-- FIX 1: Add 'completed' to moderation_actions status check
-- ============================================================================
DO $$
BEGIN
    -- Drop existing constraint
    ALTER TABLE public.moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_status_check;

    -- Recreate with 'completed' included
    ALTER TABLE public.moderation_actions
    ADD CONSTRAINT moderation_actions_status_check
    CHECK (status IN ('active', 'expired', 'revoked', 'appealed', 'pending', 'reviewed', 'resolved', 'rejected', 'completed'));

    RAISE NOTICE 'Updated moderation_actions status check to include "completed"';
END $$;

-- Update any existing rows that might have invalid status
UPDATE public.moderation_actions
SET status = 'completed'
WHERE status = 'resolved'
  AND action_type IN ('ban_user', 'mute_user', 'warn_user');

-- ============================================================================
-- FIX 2: Ensure jail has FK to user_profiles
-- ============================================================================
DO $$
BEGIN
    -- Check if the FK exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'jail_user_id_fkey'
        AND table_name = 'jail'
    ) THEN
        -- Delete orphaned jail records
        DELETE FROM public.jail
        WHERE user_id IS NOT NULL
        AND user_id NOT IN (SELECT id FROM public.user_profiles);

        -- Add the FK
        ALTER TABLE public.jail
        ADD CONSTRAINT jail_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

        RAISE NOTICE 'Added jail_user_id_fkey foreign key constraint';
    ELSE
        RAISE NOTICE 'jail_user_id_fkey already exists';
    END IF;
END $$;

-- Also ensure jail_transactions has FK if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jail_transactions') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'jail_transactions_jail_id_fkey'
            AND table_name = 'jail_transactions'
        ) THEN
            -- Delete orphaned records
            DELETE FROM public.jail_transactions
            WHERE jail_id IS NOT NULL
            AND jail_id NOT IN (SELECT id FROM public.jail);

            ALTER TABLE public.jail_transactions
            ADD CONSTRAINT jail_transactions_jail_id_fkey
            FOREIGN KEY (jail_id) REFERENCES public.jail(id) ON DELETE CASCADE;

            RAISE NOTICE 'Added jail_transactions_jail_id_fkey';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'jail_transactions_user_id_fkey'
            AND table_name = 'jail_transactions'
        ) THEN
            DELETE FROM public.jail_transactions
            WHERE user_id IS NOT NULL
            AND user_id NOT IN (SELECT id FROM public.user_profiles);

            ALTER TABLE public.jail_transactions
            ADD CONSTRAINT jail_transactions_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

            RAISE NOTICE 'Added jail_transactions_user_id_fkey';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- FIX 3: Reload PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE 'Bug fixes complete: moderation_actions status + jail FK relationships';
END $$;

COMMIT;
