-- End All Broadcasts SQL Utility
-- Run this to immediately end all active broadcasts in the database

-- Step 1: Update all active streams to ended status
UPDATE streams
SET 
    is_live = false,
    status = 'ended',
    end_time = NOW()
WHERE is_live = true;

-- Step 2: Get count of ended broadcasts
SELECT 
    COUNT(*) as ended_broadcasts_count
FROM streams
WHERE 
    is_live = false 
    AND status = 'ended'
    AND end_time >= NOW() - INTERVAL '1 minute';

-- Step 3: View all streams that were ended
SELECT 
    id,
    broadcaster_id,
    title,
    status,
    is_live,
    start_time,
    end_time
FROM streams
WHERE 
    end_time >= NOW() - INTERVAL '5 minutes'
ORDER BY end_time DESC;

-- Alternative: Use this function to end all broadcasts
-- (Run in Supabase SQL Editor)
-- Note: For real-time disconnection from LiveKit rooms,
-- use the admin dashboard or LiveKit admin tools.
