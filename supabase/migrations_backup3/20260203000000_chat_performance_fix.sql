
-- P0 Chat Performance Fix: Denormalize stream_messages
-- This eliminates the N+1 query problem by storing user/vehicle data on the message itself.

ALTER TABLE public.stream_messages
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_avatar TEXT,
ADD COLUMN IF NOT EXISTS user_role TEXT,
ADD COLUMN IF NOT EXISTS user_troll_role TEXT,
ADD COLUMN IF NOT EXISTS user_badges JSONB,
ADD COLUMN IF NOT EXISTS user_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS vehicle_snapshot JSONB;

-- Create index on stream_id to ensure fast message retrieval
CREATE INDEX IF NOT EXISTS idx_stream_messages_stream_id ON public.stream_messages(stream_id);
