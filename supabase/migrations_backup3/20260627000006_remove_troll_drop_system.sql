-- ============================================================================
-- REMOVE: Troll Drop System
-- Feature not ready for production. Removes the troll_drops table and
-- related RPC functions. Code files remain but are unreachable (routes removed).
-- ============================================================================

BEGIN;

-- Drop the troll_drops table if it exists
DROP TABLE IF EXISTS public.troll_drops CASCADE;

-- Drop related RPC functions
DROP FUNCTION IF EXISTS public.start_troll_drop(UUID, TEXT);
DROP FUNCTION IF EXISTS public.claim_troll_drop_bill(UUID, UUID);

-- Remove troll_drop from notification type enum if it exists
DO $$
BEGIN
    -- Remove 'troll_drop' from any enum or check constraints that reference it
    -- This is safe even if the constraint doesn't exist
    ALTER TABLE IF EXISTS public.notifications
        DROP CONSTRAINT IF EXISTS notifications_type_check;
END $$;

COMMIT;
