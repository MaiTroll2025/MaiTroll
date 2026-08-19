-- Migration: Enforce max 6 guest seats for all users (admin included)
-- Description: seat_count now stores guest seats only (broadcaster is NOT a seat).
--              Max = 6 guest seats. Total boxes = seat_count + 1.

-- ============================================================================
-- streams table
-- ============================================================================

-- Cap existing data to 6 guest seats before tightening the constraint
UPDATE public.streams
SET seat_count = 6
WHERE seat_count > 6;

-- Drop old constraint
ALTER TABLE public.streams DROP CONSTRAINT IF EXISTS streams_seat_count_range;

-- Add new constraint: max 6 guest seats (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'streams_seat_count_range'
  ) THEN
    ALTER TABLE public.streams
      ADD CONSTRAINT streams_seat_count_range
      CHECK (seat_count >= 0 AND seat_count <= 6);
  END IF;
END $$;

-- Update comment
COMMENT ON COLUMN public.streams.seat_count IS
  'Number of guest seats (0-6). Broadcaster is NOT counted. Total boxes = seat_count + 1.';

-- ============================================================================
-- stream_smoke_events table
-- ============================================================================

-- Cap existing data to 6 guest seats before tightening the constraint
UPDATE public.stream_smoke_events
SET seat_count = 6
WHERE seat_count > 6;

-- Drop old inline constraint (name is system-generated)
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.stream_smoke_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%seat_count%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stream_smoke_events DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
END $$;

-- Add new named constraint: max 6 guest seats, 0 allowed (broadcaster only) (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stream_smoke_events_seat_count_range'
  ) THEN
    ALTER TABLE public.stream_smoke_events
      ADD CONSTRAINT stream_smoke_events_seat_count_range
      CHECK (seat_count >= 0 AND seat_count <= 6);
  END IF;
END $$;
