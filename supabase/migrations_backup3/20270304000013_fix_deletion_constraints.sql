-- Migration: Fix Deletion Constraints
-- Description: Updates foreign key constraints to allow user deletion (ON DELETE CASCADE or SET NULL)

-- 1. President Appointments (Cascade)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_appointments_president_user_id_fkey') THEN
        ALTER TABLE president_appointments DROP CONSTRAINT president_appointments_president_user_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_appointments_vice_president_user_id_fkey') THEN
        ALTER TABLE president_appointments DROP CONSTRAINT president_appointments_vice_president_user_id_fkey;
    END IF;

    ALTER TABLE president_appointments
    ADD CONSTRAINT president_appointments_president_user_id_fkey
    FOREIGN KEY (president_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

    ALTER TABLE president_appointments
    ADD CONSTRAINT president_appointments_vice_president_user_id_fkey
    FOREIGN KEY (vice_president_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
END $$;

-- 2. President Proposals (Cascade created_by, Set Null reviewed_by)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_proposals_created_by_fkey') THEN
        ALTER TABLE president_proposals DROP CONSTRAINT president_proposals_created_by_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_proposals_reviewed_by_fkey') THEN
        ALTER TABLE president_proposals DROP CONSTRAINT president_proposals_reviewed_by_fkey;
    END IF;

    ALTER TABLE president_proposals
    ADD CONSTRAINT president_proposals_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE CASCADE;

    ALTER TABLE president_proposals
    ADD CONSTRAINT president_proposals_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
END $$;

-- 3. President Announcements (Cascade)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_announcements_created_by_fkey') THEN
        ALTER TABLE president_announcements DROP CONSTRAINT president_announcements_created_by_fkey;
    END IF;

    ALTER TABLE president_announcements
    ADD CONSTRAINT president_announcements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE CASCADE;
END $$;

-- 4. President Audit Logs (Set Null)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_audit_logs_actor_id_fkey') THEN
        ALTER TABLE president_audit_logs DROP CONSTRAINT president_audit_logs_actor_id_fkey;
    END IF;

    ALTER TABLE president_audit_logs
    ADD CONSTRAINT president_audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
END $$;

-- 5. President Treasury Ledger (Set Null)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_treasury_ledger_actor_id_fkey') THEN
        ALTER TABLE president_treasury_ledger DROP CONSTRAINT president_treasury_ledger_actor_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_treasury_ledger_funded_by_fkey') THEN
        ALTER TABLE president_treasury_ledger DROP CONSTRAINT president_treasury_ledger_funded_by_fkey;
    END IF;

    ALTER TABLE president_treasury_ledger
    ADD CONSTRAINT president_treasury_ledger_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

    ALTER TABLE president_treasury_ledger
    ADD CONSTRAINT president_treasury_ledger_funded_by_fkey
    FOREIGN KEY (funded_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
END $$;

-- 6. President Elections (Set Null created_by)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'president_elections_created_by_fkey') THEN
        ALTER TABLE president_elections DROP CONSTRAINT president_elections_created_by_fkey;
    END IF;

    ALTER TABLE president_elections
    ADD CONSTRAINT president_elections_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
END $$;

-- 7. Manual Coin Orders (Cascade)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manual_coin_orders') THEN
        DECLARE r RECORD;
        BEGIN
            FOR r IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'manual_coin_orders' AND column_name = 'user_id' LOOP
                EXECUTE 'ALTER TABLE manual_coin_orders DROP CONSTRAINT ' || r.constraint_name;
            END LOOP;
            ALTER TABLE manual_coin_orders ADD CONSTRAINT manual_coin_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
        END;
    END IF;
END $$;

-- 8. Officer Time Off Requests (Set Null reviewed_by)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'officer_time_off_requests_reviewed_by_fkey') THEN
        ALTER TABLE officer_time_off_requests DROP CONSTRAINT officer_time_off_requests_reviewed_by_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'officer_time_off_requests') THEN
        -- Re-add with SET NULL only if table exists
        ALTER TABLE officer_time_off_requests
        ADD CONSTRAINT officer_time_off_requests_reviewed_by_fkey
        FOREIGN KEY (reviewed_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 9. Officer Live Assignments (Cascade)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'officer_live_assignments') THEN
         -- Attempt to find and replace officer_id constraint
         DECLARE r RECORD;
         BEGIN
            FOR r IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'officer_live_assignments' AND column_name = 'officer_id' LOOP
                EXECUTE 'ALTER TABLE officer_live_assignments DROP CONSTRAINT ' || r.constraint_name;
            END LOOP;
            -- Assuming officer_id references user_profiles
            ALTER TABLE officer_live_assignments ADD CONSTRAINT officer_live_assignments_officer_id_fkey FOREIGN KEY (officer_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
         END;
    END IF;
END $$;

-- 10. Officer Work Sessions (Cascade)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'officer_work_sessions') THEN
         DECLARE r RECORD;
         BEGIN
            FOR r IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name = 'officer_work_sessions' AND column_name = 'officer_id' LOOP
                EXECUTE 'ALTER TABLE officer_work_sessions DROP CONSTRAINT ' || r.constraint_name;
            END LOOP;
            ALTER TABLE officer_work_sessions ADD CONSTRAINT officer_work_sessions_officer_id_fkey FOREIGN KEY (officer_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
         END;
    END IF;
END $$;

-- 11. User Role Grants (Set Null granted_by)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_role_grants_granted_by_fkey') THEN
        ALTER TABLE user_role_grants DROP CONSTRAINT user_role_grants_granted_by_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_role_grants') THEN
        ALTER TABLE user_role_grants
        ADD CONSTRAINT user_role_grants_granted_by_fkey
        FOREIGN KEY (granted_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 12. Create Admin Helper to Force Delete
CREATE OR REPLACE FUNCTION public.admin_force_delete_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Check if admin
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Delete from auth.users (cascades to user_profiles and others)
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
