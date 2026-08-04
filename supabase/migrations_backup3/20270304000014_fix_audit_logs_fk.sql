-- Migration: Fix Audit Logs and other FKs for Deletion
-- Description: Updates audit_logs and other tables to allow user deletion

-- 1. Audit Logs (Set Null to preserve history)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_logs_user_id_fkey') THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Notifications (Cascade - user doesn't need notifications if deleted)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notifications_user_id_fkey') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_user_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Messages (Cascade - clean up chat)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_user_id_fkey') THEN
        ALTER TABLE messages DROP CONSTRAINT messages_user_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        ALTER TABLE messages
        ADD CONSTRAINT messages_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Streams (Cascade - stream belongs to user)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'streams_user_id_fkey') THEN
        ALTER TABLE streams DROP CONSTRAINT streams_user_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
        ALTER TABLE streams
        ADD CONSTRAINT streams_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Followers / User Followers (Cascade)
DO $$
BEGIN
    -- Check for 'followers' table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') THEN
        -- follower_id
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'followers_follower_id_fkey') THEN
            ALTER TABLE followers DROP CONSTRAINT followers_follower_id_fkey;
        END IF;
        ALTER TABLE followers ADD CONSTRAINT followers_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;

        -- following_id / user_id
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'followers_following_id_fkey') THEN
            ALTER TABLE followers DROP CONSTRAINT followers_following_id_fkey;
        END IF;
        -- Assuming following_id or user_id, checking column name
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followers' AND column_name = 'following_id') THEN
             ALTER TABLE followers ADD CONSTRAINT followers_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 6. Moderation Logs (Set Null)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_logs') THEN
        -- moderator_id
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'moderation_logs_moderator_id_fkey') THEN
            ALTER TABLE moderation_logs DROP CONSTRAINT moderation_logs_moderator_id_fkey;
        END IF;
        ALTER TABLE moderation_logs ADD CONSTRAINT moderation_logs_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

        -- target_user_id
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'moderation_logs_target_user_id_fkey') THEN
            ALTER TABLE moderation_logs DROP CONSTRAINT moderation_logs_target_user_id_fkey;
        END IF;
        ALTER TABLE moderation_logs ADD CONSTRAINT moderation_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;
