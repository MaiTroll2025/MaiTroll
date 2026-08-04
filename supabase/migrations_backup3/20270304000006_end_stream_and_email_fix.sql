-- Ensure columns exist for payout
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payout_paypal_email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payout_paypal_email_updated_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS troll_role TEXT DEFAULT 'user';

-- Ensure streams table has is_live column (it was missing in 20250202 schema but used in logic)
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- Ensure moderation logs table exists
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type TEXT NOT NULL,
    target_user_id UUID,
    moderator_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RPC to End Stream (Accessible by Owner or Moderators)
-- CREATE OR REPLACE FUNCTION end_stream(stream_id UUID)
-- RETURNS JSONB AS $$
-- DECLARE
--     target_stream streams%ROWTYPE;
--     caller_id UUID;
--     is_mod BOOLEAN;
-- BEGIN
--     caller_id := auth.uid();
--     
--     -- Check if stream exists
--     SELECT * INTO target_stream FROM streams WHERE id = stream_id;
--     IF target_stream.id IS NULL THEN
--         RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
--     END IF;

--     -- Check Permissions
--     -- 1. Owner
--     IF target_stream.user_id = caller_id THEN
--         UPDATE streams 
--         SET status = 'ended', is_live = false, ended_at = NOW()
--         WHERE id = stream_id;
--         RETURN jsonb_build_object('success', true);
--     END IF;

--     -- 2. Admin/Moderator Check
--     SELECT EXISTS (
--         SELECT 1 FROM user_profiles 
--         WHERE id = caller_id AND (role = 'admin' OR troll_role IN ('admin', 'moderator', 'troll_officer'))
--     ) INTO is_mod;

--     IF is_mod THEN
--         UPDATE streams 
--         SET status = 'ended', is_live = false, ended_at = NOW()
--         WHERE id = stream_id;
--         
--         -- Log action (if table exists)
--         BEGIN
--             INSERT INTO moderation_logs (action_type, target_user_id, moderator_id, details)
--             VALUES ('force_end_stream', target_stream.user_id, caller_id, jsonb_build_object('stream_id', stream_id));
--         EXCEPTION WHEN OTHERS THEN
--             NULL; -- Ignore logging error
--         END;
--         
--         RETURN jsonb_build_object('success', true);
--     END IF;

--     RETURN jsonb_build_object('success', false, 'message', 'Permission denied');
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
