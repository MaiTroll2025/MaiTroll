-- Add capacity queue table for managing participant limits
CREATE TABLE IF NOT EXISTS stream_capacity_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    guest_id TEXT, -- For guest users (TC-* format)
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'cancelled', 'expired')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one active queue entry per user per stream
    UNIQUE(stream_id, user_id, status) DEFERRABLE INITIALLY DEFERRED,
    UNIQUE(stream_id, guest_id, status) DEFERRABLE INITIALLY DEFERRED,

    -- At least one of user_id or guest_id must be provided
    CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stream_capacity_queue_stream_status ON stream_capacity_queue(stream_id, status);
CREATE INDEX IF NOT EXISTS idx_stream_capacity_queue_user ON stream_capacity_queue(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stream_capacity_queue_guest ON stream_capacity_queue(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stream_capacity_queue_requested_at ON stream_capacity_queue(requested_at);

-- Add RLS policies
ALTER TABLE stream_capacity_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue entries
CREATE POLICY "Users can view own queue entries" ON stream_capacity_queue
    FOR SELECT USING (
        auth.uid() = user_id OR
        (guest_id IS NOT NULL AND guest_id = auth.jwt() ->> 'guest_id')
    );

-- Users can insert their own queue entries
CREATE POLICY "Users can insert own queue entries" ON stream_capacity_queue
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        (guest_id IS NOT NULL AND guest_id = auth.jwt() ->> 'guest_id')
    );

-- Users can update their own queue entries
CREATE POLICY "Users can update own queue entries" ON stream_capacity_queue
    FOR UPDATE USING (
        auth.uid() = user_id OR
        (guest_id IS NOT NULL AND guest_id = auth.jwt() ->> 'guest_id')
    );

-- Function to clean up expired queue entries (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_expired_queue_entries()
RETURNS void AS $$
BEGIN
    UPDATE stream_capacity_queue
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'waiting'
    AND requested_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to get next user from queue when capacity opens up
CREATE OR REPLACE FUNCTION process_capacity_queue(stream_uuid UUID)
RETURNS TABLE (
    user_id UUID,
    guest_id TEXT,
    requested_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT q.user_id, q.guest_id, q.requested_at
    FROM stream_capacity_queue q
    WHERE q.stream_id = stream_uuid
    AND q.status = 'waiting'
    ORDER BY q.requested_at ASC
    LIMIT 1;

    -- Mark as processed (we'll handle this in application logic)
    -- UPDATE stream_capacity_queue SET status = 'processed' WHERE ... (handled by app)
END;
$$ LANGUAGE plpgsql;