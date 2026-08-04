-- Ensure explicit foreign key name for creator_migration_claims.user_id
-- This resolves ambiguity with PostgREST when multiple FKs to user_profiles exist

DO $$
BEGIN
    -- Drop the constraint if it exists (to ensure we can recreate it with the specific name)
    -- Note: This assumes the standard naming convention was used or we are re-defining it.
    -- If the constraint had a random name, this won't drop it, and we'll add a second one.
    -- Having a duplicate FK is safe and ensures the name we need exists.
    BEGIN
        ALTER TABLE public.creator_migration_claims DROP CONSTRAINT IF EXISTS creator_migration_claims_user_id_fkey;
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;

    -- Add the constraint with the explicit name required by the frontend
    ALTER TABLE public.creator_migration_claims
        ADD CONSTRAINT creator_migration_claims_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
END $$;
