-- Update stream_seats table to match new schema
-- and create stream_audience_presence table for audience presence

-- Step 1: Update stream_seats table
BEGIN;

-- Add new columns
ALTER TABLE public.stream_seats
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS livekit_participant_identity TEXT,
  ADD COLUMN IF NOT EXISTS seat_price_paid INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Convert is_active boolean to status text
-- We'll set status based on is_active: true -> 'live', false -> 'empty'
-- Note: We cannot directly alter column type from boolean to text using USING in all versions, so we do:
-- Add a new status column, populate it, then drop is_active and rename status to is_active? 
-- But we want to rename to status. Let's do:

-- Add a new column for status
ALTER TABLE public.stream_seats
  ADD COLUMN IF NOT EXISTS status TEXT;

-- Update status based on is_active
UPDATE public.stream_seats
SET status = CASE 
  WHEN is_active THEN 'live'
  ELSE 'empty'
END;

-- Set default for status to 'empty' for any nulls (shouldn't happen, but safe)
UPDATE public.stream_seats
SET status = 'empty'
WHERE status IS NULL;

-- Now we can drop the is_active column
ALTER TABLE public.stream_seats
  DROP COLUMN IF EXISTS is_active;

-- Add a check constraint for status
ALTER TABLE public.stream_seats
  ADD CONSTRAINT stream_seats_status_check 
  CHECK (status IN ('empty', 'reserved', 'camera_starting', 'live', 'failed'));

-- Step 2: Create stream_audience_presence table
CREATE TABLE IF NOT EXISTS public.stream_audience_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id TEXT NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  gift_total INTEGER NOT NULL DEFAULT 0,
  seat_id INTEGER, -- References stream_seats.seat_index (integer)
  role TEXT NOT NULL DEFAULT 'audience' CHECK (role IN ('audience', 'seat', 'broadcaster')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stream_audience_presence_stream_id ON public.stream_audience_presence(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_audience_presence_user_id ON public.stream_audience_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_audience_presence_is_active ON public.stream_audience_presence(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_stream_audience_presence_gift_total ON public.stream_audience_presence(gift_total);

COMMIT;