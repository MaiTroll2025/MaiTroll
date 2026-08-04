
-- Migration: Fix President Appointments Relationship
-- Description: Explicitly names the foreign key constraints for president_appointments to ensure client queries work.

-- Drop existing constraints if they exist (to avoid duplicates or conflicts)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_appointments_president_user_id_fkey') THEN
        ALTER TABLE president_appointments DROP CONSTRAINT president_appointments_president_user_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_appointments_vice_president_user_id_fkey') THEN
        ALTER TABLE president_appointments DROP CONSTRAINT president_appointments_vice_president_user_id_fkey;
    END IF;
END $$;

-- Re-add constraints with explicit names
ALTER TABLE president_appointments
ADD CONSTRAINT president_appointments_president_user_id_fkey
FOREIGN KEY (president_user_id) REFERENCES user_profiles(id);

ALTER TABLE president_appointments
ADD CONSTRAINT president_appointments_vice_president_user_id_fkey
FOREIGN KEY (vice_president_user_id) REFERENCES user_profiles(id);

-- Reload schema cache (handled by Supabase usually, but good to know this changes schema)
