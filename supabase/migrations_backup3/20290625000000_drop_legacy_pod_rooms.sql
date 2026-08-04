-- ============================================================
-- DROP LEGACY TrollPods (pod_rooms) SYSTEM
-- This removes all tables, functions, and policies related to
-- the old pod_rooms system. The current Agora podcast system
-- uses the `podcasts`, `podcast_episodes`, and `podcast_rtc_logs` tables.
-- ============================================================

-- Drop RLS policies first (to avoid dependency issues)
DO $$
BEGIN
  -- pod_bans policies
  DROP POLICY IF EXISTS "Hosts and Officers can insert bans" ON public.pod_bans;
  DROP POLICY IF EXISTS "Everyone can view bans" ON public.pod_bans;
  DROP POLICY IF EXISTS "Hosts and Officers can delete bans" ON public.pod_bans;

  -- pod_chat_bans policies
  DROP POLICY IF EXISTS "Hosts and Officers can insert chat bans" ON public.pod_chat_bans;
  DROP POLICY IF EXISTS "Everyone can view chat bans" ON public.pod_chat_bans;
  DROP POLICY IF EXISTS "Hosts and Officers can delete chat bans" ON public.pod_chat_bans;

  -- pod_room_participants policies
  DROP POLICY IF EXISTS "Users can leave or Host can kick" ON public.pod_room_participants;
  DROP POLICY IF EXISTS "Users can view participants" ON public.pod_room_participants;
  DROP POLICY IF EXISTS "Users can join pods" ON public.pod_room_participants;
  DROP POLICY IF EXISTS "Users can update own participation" ON public.pod_room_participants;

  -- pod_rooms policies
  DROP POLICY IF EXISTS "Public View Pods" ON public.pod_rooms;
  DROP POLICY IF EXISTS "Host Manage Pods" ON public.pod_rooms;
  DROP POLICY IF EXISTS "Users can view pod rooms" ON public.pod_rooms;
  DROP POLICY IF EXISTS "Authenticated users can create pod rooms" ON public.pod_rooms;
  DROP POLICY IF EXISTS "Hosts can update own pod rooms" ON public.pod_rooms;
  DROP POLICY IF EXISTS "Hosts can delete own pod rooms" ON public.pod_rooms;
END $$;

-- Remove tables from realtime publication (IF EXISTS not supported for ALTER PUBLICATION)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.pod_bans;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.pod_chat_bans;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.pod_rooms;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.pod_room_participants;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.pod_chat_messages;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.pod_episodes;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Drop tables in dependency order (child tables first)
DROP TABLE IF EXISTS public.pod_chat_bans CASCADE;
DROP TABLE IF EXISTS public.pod_bans CASCADE;
DROP TABLE IF EXISTS public.pod_chat_messages CASCADE;
DROP TABLE IF EXISTS public.pod_room_participants CASCADE;
DROP TABLE IF EXISTS public.pod_episodes CASCADE;
DROP TABLE IF EXISTS public.pod_rooms CASCADE;

-- Drop RPC functions related to pod_rooms
DROP FUNCTION IF EXISTS public.end_pod(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_start_pod() CASCADE;

-- Drop any remaining triggers on pod_rooms tables (should be handled by CASCADE)
-- Drop indexes (should be handled by CASCADE but being explicit)
DROP INDEX IF EXISTS idx_pod_rooms_status;
DROP INDEX IF EXISTS idx_pod_rooms_host_id;
DROP INDEX IF EXISTS idx_pod_rooms_is_live;
DROP INDEX IF EXISTS idx_pod_bans_room_id;
DROP INDEX IF EXISTS idx_pod_bans_user_id;
DROP INDEX IF EXISTS idx_pod_chat_bans_room_id;
DROP INDEX IF EXISTS idx_pod_chat_bans_user_id;
DROP INDEX IF EXISTS idx_pod_chat_messages_room_id;
DROP INDEX IF EXISTS idx_pod_room_participants_room_id;
DROP INDEX IF EXISTS idx_pod_episodes_room_id;

-- Verify cleanup
DO $$
BEGIN
  RAISE NOTICE 'Legacy TrollPods (pod_rooms) system tables dropped successfully.';
  RAISE NOTICE 'Current Agora podcast system (podcasts, podcast_episodes, podcast_rtc_logs) is preserved.';
END $$;
