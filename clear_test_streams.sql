-- SQL Script to Identify and Delete Test Streams from Government/Broadcast Tables
-- Database: Supabase/PostgreSQL for Mai Troll Project
-- Date: 2026-02-05

-- ============================================================================
-- STEP 1: IDENTIFY TEST STREAMS
-- Criteria: Stream title contains test keywords OR user_id patterns
-- ============================================================================

-- First, let's identify all test streams based on title patterns
SELECT 
    id as stream_id,
    title,
    user_id,
    status,
    created_at
FROM public.streams
WHERE 
    -- Test stream name patterns (case-insensitive)
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
    LOWER(title) LIKE '%example%' OR
    LOWER(title) LIKE '%trial%'
ORDER BY created_at DESC;

-- Count of test streams identified
SELECT COUNT(*) as test_stream_count
FROM public.streams
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
-- STEP 2: COUNT RECORDS TO BE AFFECTED (Preview before deletion)
-- ============================================================================

-- Count stream_seat_sessions for test streams
SELECT COUNT(*) as seat_sessions_to_delete
FROM public.stream_seat_sessions
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
);

-- Count stream_messages for test streams
SELECT COUNT(*) as messages_to_delete
FROM public.stream_messages
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
);

-- Count stream_moderators for test streams
SELECT COUNT(*) as moderators_to_delete
FROM public.stream_moderators
WHERE broadcaster_id IN (
    SELECT user_id FROM public.streams
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
        LOWER(title) LIKE '%example%'
);

-- Count stream_bans for test streams
SELECT COUNT(*) as bans_to_delete
FROM public.stream_bans
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
);

-- Count stream_mutes for test streams
SELECT COUNT(*) as mutes_to_delete
FROM public.stream_mutes
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
);

-- Count court_cases related to test stream sessions
SELECT COUNT(*) as court_cases_to_delete
FROM public.court_cases
WHERE session_id IN (
    SELECT id FROM public.stream_seat_sessions
    WHERE stream_id IN (
        SELECT id FROM public.streams
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
            LOWER(title) LIKE '%example%'
    )
);

-- ============================================================================
-- STEP 3: DELETE TEST STREAMS (WITH CASCADE)
-- ============================================================================

-- The streams table has ON DELETE CASCADE for related tables:
-- - stream_seat_sessions (stream_id references streams(id) ON DELETE CASCADE)
-- - stream_messages (stream_id references streams(id) ON DELETE CASCADE)
-- - stream_bans (stream_id references streams(id) ON DELETE CASCADE)
-- - stream_mutes (stream_id references streams(id) ON DELETE CASCADE)

-- Delete test streams (cascade will handle related records)
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
-- STEP 4: DELETE ORPHANED MODERATORS (if broadcaster was deleted)
-- ============================================================================

-- Delete moderators where broadcaster was deleted (orphan records)
DELETE FROM public.stream_moderators
WHERE broadcaster_id NOT IN (SELECT DISTINCT user_id FROM public.streams);

-- ============================================================================
-- STEP 5: VERIFICATION - Show deletion summary
-- ============================================================================

-- Return summary of deleted records
SELECT 
    'streams' as table_name,
    COUNT(*) as records_deleted
FROM public.streams
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
    LOWER(title) LIKE '%example%'

UNION ALL

SELECT 
    'stream_seat_sessions' as table_name,
    COUNT(*) as records_deleted
FROM public.stream_seat_sessions
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
)

UNION ALL

SELECT 
    'stream_messages' as table_name,
    COUNT(*) as records_deleted
FROM public.stream_messages
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
)

UNION ALL

SELECT 
    'stream_bans' as table_name,
    COUNT(*) as records_deleted
FROM public.stream_bans
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
)

UNION ALL

SELECT 
    'stream_mutes' as table_name,
    COUNT(*) as records_deleted
FROM public.stream_mutes
WHERE stream_id IN (
    SELECT id FROM public.streams
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
        LOWER(title) LIKE '%example%'
)

UNION ALL

SELECT 
    'stream_moderators' as table_name,
    COUNT(*) as records_deleted
FROM public.stream_moderators
WHERE broadcaster_id NOT IN (SELECT DISTINCT user_id FROM public.streams)

UNION ALL

SELECT 
    'court_cases' as table_name,
    COUNT(*) as records_deleted
FROM public.court_cases
WHERE session_id IN (
    SELECT id FROM public.stream_seat_sessions
    WHERE stream_id IN (
        SELECT id FROM public.streams
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
            LOWER(title) LIKE '%example%'
    )
);

-- ============================================================================
-- STEP 6: FINAL STATUS CHECK
-- ============================================================================

-- Check remaining streams after cleanup
SELECT COUNT(*) as remaining_streams FROM public.streams;
SELECT COUNT(*) as remaining_seat_sessions FROM public.stream_seat_sessions;
SELECT COUNT(*) as remaining_messages FROM public.stream_messages;
