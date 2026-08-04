-- ============================================================================
-- Mai Troll DATABASE BUG FIX MIGRATION - TRIGGERS & CONSTRAINTS
-- Generated from Bug Center Report Export (2026-06-29)
-- Fixes: #1-6 (recipient_id trigger), #29 (ON CONFLICT constraint)
-- Apply this if 20260627000001 was not fully applied or errors persist.
-- ============================================================================;

BEGIN;

-- ============================================================================
-- FIX BUGS #1-6: record "new" has no field "recipient_id"
-- A trigger function references NEW.recipient_id but the target table
-- doesn't have that column. Auto-detect and fix broken triggers.
-- ============================================================================

DO $$
DECLARE
    trigger_rec RECORD;
    new_src TEXT;
    fix_count INT := 0;
BEGIN
    RAISE NOTICE '=== Scanning for broken triggers referencing recipient_id ===';

    FOR trigger_rec IN
        SELECT
            t.tgname AS trigger_name,
            t.tgrelid::regclass AS table_name,
            p.oid AS func_oid,
            p.proname AS function_name,
            p.prosrc AS func_source
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE NOT t.tgisinternal
          AND p.prosrc LIKE '%recipient_id%'
    LOOP
        -- Check if the trigger's table actually has a recipient_id column
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_name = trigger_rec.table_name::text
              AND c.column_name = 'recipient_id'
        ) THEN
            RAISE NOTICE 'BROKEN TRIGGER: % on table % references recipient_id but column does not exist. Function: %',
                trigger_rec.trigger_name, trigger_rec.table_name, trigger_rec.function_name;

            -- Auto-fix: replace NEW.recipient_id with NEW.receiver_id if that column exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_name = trigger_rec.table_name::text
                  AND c.column_name = 'receiver_id'
            ) THEN
                new_src := replace(trigger_rec.func_source, 'recipient_id', 'receiver_id');
                BEGIN
                    EXECUTE format(
                        'CREATE OR REPLACE FUNCTION %I(%s) RETURNS TRIGGER LANGUAGE plpgsql AS $body$ %s $body$',
                        trigger_rec.function_name,
                        '',
                        new_src
                    );
                    fix_count := fix_count + 1;
                    RAISE NOTICE 'FIXED: Replaced recipient_id with receiver_id in function %', trigger_rec.function_name;
                EXCEPTION
                    WHEN others THEN
                        RAISE NOTICE 'FAILED to fix function %: %', trigger_rec.function_name, SQLERRM;
                END;
            ELSE
                -- If neither recipient_id nor receiver_id exists, comment out the reference
                RAISE NOTICE 'CANNOT AUTO-FIX: Table % has neither recipient_id nor receiver_id. Manual review needed.',
                    trigger_rec.table_name;
            END IF;
        ELSE
            RAISE NOTICE 'OK: Trigger % on table % correctly references recipient_id (column exists)',
                trigger_rec.trigger_name, trigger_rec.table_name;
        END IF;
    END LOOP;

    RAISE NOTICE '=== Trigger fix complete. Fixed % triggers. ===', fix_count;
END $$;


-- ============================================================================
-- FIX BUG #29: 42P10 - no unique constraint for ON CONFLICT
-- Ensure all tables used with ON CONFLICT have proper unique constraints.
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== Checking ON CONFLICT constraints ===';

    -- 1. user_follows: UNIQUE(follower_id, following_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_follows') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'user_follows'::regclass
              AND contype = 'u'
              AND conname = 'user_follows_follower_following_unique'
        ) THEN
            -- Deduplicate existing rows first
            DELETE FROM user_follows uf
            WHERE uf.id NOT IN (
                SELECT MIN(uf2.id) FROM user_follows uf2
                GROUP BY uf2.follower_id, uf2.following_id
            );

            BEGIN
                ALTER TABLE user_follows
                ADD CONSTRAINT user_follows_follower_following_unique
                UNIQUE (follower_id, following_id);
                RAISE NOTICE 'ADDED: UNIQUE(follower_id, following_id) on user_follows';
            EXCEPTION
                WHEN others THEN
                    RAISE NOTICE 'FAILED to add user_follows constraint: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'OK: user_follows unique constraint already exists';
        END IF;
    END IF;

    -- 2. utromail_read_status: UNIQUE(message_id, user_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'utromail_read_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'utromail_read_status'::regclass
              AND contype = 'u'
              AND conname = 'utromail_read_status_message_user_unique'
        ) THEN
            BEGIN
                ALTER TABLE utromail_read_status
                ADD CONSTRAINT utromail_read_status_message_user_unique
                UNIQUE (message_id, user_id);
                RAISE NOTICE 'ADDED: UNIQUE(message_id, user_id) on utromail_read_status';
            EXCEPTION
                WHEN undefined_column THEN
                    RAISE NOTICE 'SKIP: utromail_read_status missing message_id or user_id column';
                WHEN others THEN
                    RAISE NOTICE 'FAILED to add utromail_read_status constraint: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'OK: utromail_read_status unique constraint already exists';
        END IF;
    END IF;

    -- 3. user_presence: UNIQUE(user_id) - should already have PK
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_presence') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'user_presence'::regclass
              AND contype = 'u'
        ) THEN
            BEGIN
                ALTER TABLE user_presence
                ADD CONSTRAINT user_presence_user_id_unique
                UNIQUE (user_id);
                RAISE NOTICE 'ADDED: UNIQUE(user_id) on user_presence';
            EXCEPTION
                WHEN others THEN
                    RAISE NOTICE 'FAILED to add user_presence constraint: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'OK: user_presence has unique constraint';
        END IF;
    END IF;

    -- 4. user_presence_routes: UNIQUE(user_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_presence_routes') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'user_presence_routes'::regclass
              AND contype = 'u'
        ) THEN
            BEGIN
                ALTER TABLE user_presence_routes
                ADD CONSTRAINT user_presence_routes_user_id_unique
                UNIQUE (user_id);
                RAISE NOTICE 'ADDED: UNIQUE(user_id) on user_presence_routes';
            EXCEPTION
                WHEN others THEN
                    RAISE NOTICE 'FAILED to add user_presence_routes constraint: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'OK: user_presence_routes has unique constraint';
        END IF;
    END IF;

    RAISE NOTICE '=== Constraint fix complete ===';
END $$;


-- ============================================================================
-- NOTIFY: Reload schema cache so PostgREST picks up changes
-- ============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
