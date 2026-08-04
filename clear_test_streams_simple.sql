-- ============================================================================
-- CLEAR TEST STREAMS - SIMPLIFIED EXECUTION SCRIPT
-- ============================================================================
-- This script deletes test streams from the Mai Troll database
-- Test streams are identified by title containing test keywords
-- ============================================================================

-- Create a log table to track deletions
CREATE TABLE IF NOT EXISTS public.test_stream_deletion_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID,
    stream_title TEXT,
    deleted_at TIMESTAMPTZ DEFAULT now(),
    table_affected TEXT,
    records_deleted INTEGER
);

-- ============================================================================
-- STEP 1: Identify and log test streams before deletion
-- ============================================================================

INSERT INTO public.test_stream_deletion_log (stream_id, stream_title, table_affected, records_deleted)
SELECT 
    s.id,
    s.title,
    'streams',
    1
FROM public.streams s
WHERE 
    LOWER(s.title) LIKE '%test%' OR
    LOWER(s.title) LIKE '%demo%' OR
    LOWER(s.title) LIKE '%sample%' OR
    LOWER(s.title) LIKE '%temp%' OR
    LOWER(s.title) LIKE '%tmp%' OR
    LOWER(s.title) LIKE '%debug%' OR
    LOWER(s.title) LIKE '%internal%' OR
    LOWER(s.title) LIKE '%staging%' OR
    LOWER(s.title) LIKE '%dev%' OR
    LOWER(s.title) LIKE '%fake%' OR
    LOWER(s.title) LIKE '%mock%' OR
    LOWER(s.title) LIKE '%trial%' OR
    LOWER(s.title) LIKE '%example%'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 2: Delete test streams (cascade handles related records)
-- The streams table has ON DELETE CASCADE for:
-- - stream_seat_sessions
-- - stream_messages  
-- - stream_bans
-- - stream_mutes
-- ============================================================================

-- Count seat sessions to be deleted for logging
INSERT INTO public.test_stream_deletion_log (stream_id, stream_title, table_affected, records_deleted)
SELECT 
    s.id,
    s.title,
    'stream_seat_sessions_count',
    COALESCE((SELECT COUNT(*) FROM public.stream_seat_sessions WHERE stream_id = s.id), 0)
FROM public.streams s
WHERE 
    LOWER(s.title) LIKE '%test%' OR
    LOWER(s.title) LIKE '%demo%' OR
    LOWER(s.title) LIKE '%sample%' OR
    LOWER(s.title) LIKE '%temp%' OR
    LOWER(s.title) LIKE '%tmp%' OR
    LOWER(s.title) LIKE '%debug%' OR
    LOWER(s.title) LIKE '%internal%' OR
    LOWER(s.title) LIKE '%staging%' OR
    LOWER(s.title) LIKE '%dev%' OR
    LOWER(s.title) LIKE '%fake%' OR
    LOWER(s.title) LIKE '%mock%' OR
    LOWER(s.title) LIKE '%trial%' OR
    LOWER(s.title) LIKE '%example%'
ON CONFLICT DO NOTHING;

-- Count messages to be deleted for logging
INSERT INTO public.test_stream_deletion_log (stream_id, stream_title, table_affected, records_deleted)
SELECT 
    s.id,
    s.title,
    'stream_messages_count',
    COALESCE((SELECT COUNT(*) FROM public.stream_messages WHERE stream_id = s.id), 0)
FROM public.streams s
WHERE 
    LOWER(s.title) LIKE '%test%' OR
    LOWER(s.title) LIKE '%demo%' OR
    LOWER(s.title) LIKE '%sample%' OR
    LOWER(s.title) LIKE '%temp%' OR
    LOWER(s.title) LIKE '%tmp%' OR
    LOWER(s.title) LIKE '%debug%' OR
    LOWER(s.title) LIKE '%internal%' OR
    LOWER(s.title) LIKE '%staging%' OR
    LOWER(s.title) LIKE '%dev%' OR
    LOWER(s.title) LIKE '%fake%' OR
    LOWER(s.title) LIKE '%mock%' OR
    LOWER(s.title) LIKE '%trial%' OR
    LOWER(s.title) LIKE '%example%'
ON CONFLICT DO NOTHING;

-- Count bans to be deleted for logging
INSERT INTO public.test_stream_deletion_log (stream_id, stream_title, table_affected, records_deleted)
SELECT 
    s.id,
    s.title,
    'stream_bans_count',
    COALESCE((SELECT COUNT(*) FROM public.stream_bans WHERE stream_id = s.id), 0)
FROM public.streams s
WHERE 
    LOWER(s.title) LIKE '%test%' OR
    LOWER(s.title) LIKE '%demo%' OR
    LOWER(s.title) LIKE '%sample%' OR
    LOWER(s.title) LIKE '%temp%' OR
    LOWER(s.title) LIKE '%tmp%' OR
    LOWER(s.title) LIKE '%debug%' OR
    LOWER(s.title) LIKE '%internal%' OR
    LOWER(s.title) LIKE '%staging%' OR
    LOWER(s.title) LIKE '%dev%' OR
    LOWER(s.title) LIKE '%fake%' OR
    LOWER(s.title) LIKE '%mock%' OR
    LOWER(s.title) LIKE '%trial%' OR
    LOWER(s.title) LIKE '%example%'
ON CONFLICT DO NOTHING;

-- Count mutes to be deleted for logging
INSERT INTO public.test_stream_deletion_log (stream_id, stream_title, table_affected, records_deleted)
SELECT 
    s.id,
    s.title,
    'stream_mutes_count',
    COALESCE((SELECT COUNT(*) FROM public.stream_mutes WHERE stream_id = s.id), 0)
FROM public.streams s
WHERE 
    LOWER(s.title) LIKE '%test%' OR
    LOWER(s.title) LIKE '%demo%' OR
    LOWER(s.title) LIKE '%sample%' OR
    LOWER(s.title) LIKE '%temp%' OR
    LOWER(s.title) LIKE '%tmp%' OR
    LOWER(s.title) LIKE '%debug%' OR
    LOWER(s.title) LIKE '%internal%' OR
    LOWER(s.title) LIKE '%staging%' OR
    LOWER(s.title) LIKE '%dev%' OR
    LOWER(s.title) LIKE '%fake%' OR
    LOWER(s.title) LIKE '%mock%' OR
    LOWER(s.title) LIKE '%trial%' OR
    LOWER(s.title) LIKE '%example%'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Execute the actual deletion
-- ============================================================================

-- Delete test streams (ON DELETE CASCADE handles related records)
DELETE FROM public.streams
WHERE 
    LOWER(title) LIKE '%test%' OR
    LOWER(title) LIKE '%demo%' OR
    LOWER(title) LIKE '%sample%' OR
    LOWER(title) LIKE '%temp%' OR
    LOWER(title) LIKE '%tmp%' OR
    LOWER(title) LIKE '%debug%' OR
    LOWER(title) LIKE '%internal%' OR
    LOWER(title) LIKE '%staging%' OR
    LOWER(title) LIKE '%dev%' OR
    LOWER(title) LIKE '%fake%' OR
    LOWER(title) LIKE '%mock%' OR
    LOWER(title) LIKE '%trial%' OR
    LOWER(title) LIKE '%example%';

-- ============================================================================
-- STEP 4: Clean up orphaned moderators
-- ============================================================================

-- Count orphaned moderators for logging
INSERT INTO public.test_stream_deletion_log (stream_id, stream_title, table_affected, records_deleted)
SELECT 
    NULL,
    'orphaned_moderators',
    'stream_moderators_orphaned_count',
    COUNT(*)
FROM public.stream_moderators
WHERE broadcaster_id NOT IN (SELECT DISTINCT user_id FROM public.streams)
ON CONFLICT DO NOTHING;

-- Delete orphaned moderators
DELETE FROM public.stream_moderators
WHERE broadcaster_id NOT IN (SELECT DISTINCT user_id FROM public.streams);

-- ============================================================================
-- STEP 5: Summary Report
-- ============================================================================

SELECT '=== DELETION SUMMARY ===' as message;

SELECT 
    'streams' as table_name,
    COUNT(*) as records_deleted
FROM public.test_stream_deletion_log
WHERE table_affected = 'streams';

SELECT 
    'stream_seat_sessions' as table_name,
    SUM(records_deleted) as records_deleted
FROM public.test_stream_deletion_log
WHERE table_affected = 'stream_seat_sessions_count';

SELECT 
    'stream_messages' as table_name,
    SUM(records_deleted) as records_deleted
FROM public.test_stream_deletion_log
WHERE table_affected = 'stream_messages_count';

SELECT 
    'stream_bans' as table_name,
    SUM(records_deleted) as records_deleted
FROM public.test_stream_deletion_log
WHERE table_affected = 'stream_bans_count';

SELECT 
    'stream_mutes' as table_name,
    SUM(records_deleted) as records_deleted
FROM public.test_stream_deletion_log
WHERE table_affected = 'stream_mutes_count';

SELECT 
    'stream_moderators (orphaned)' as table_name,
    SUM(records_deleted) as records_deleted
FROM public.test_stream_deletion_log
WHERE table_affected = 'stream_moderators_orphaned_count';

-- Cleanup log table (optional - remove this line if you want to keep the log)
DROP TABLE IF EXISTS public.test_stream_deletion_log;
