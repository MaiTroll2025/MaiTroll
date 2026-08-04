-- ============================================================================
-- Allow seat_count = 0 (broadcaster only, no guest seats)
-- ============================================================================
-- Drop the old constraint that required seat_count >= 1
ALTER TABLE public.streams DROP CONSTRAINT IF EXISTS streams_seat_count_range;

-- Add new constraint allowing 0-12
ALTER TABLE public.streams
  ADD CONSTRAINT streams_seat_count_range
  CHECK (seat_count >= 0 AND seat_count <= 12);

-- Update default to 0 (no seats by default)
ALTER TABLE public.streams ALTER COLUMN seat_count SET DEFAULT 0;

-- Update comment
COMMENT ON COLUMN public.streams.seat_count IS
  'Total number of boxes in broadcast layout (0-12). 0 = broadcaster only, no guest seats. Broadcaster counts as box 1 when seats are added.';
