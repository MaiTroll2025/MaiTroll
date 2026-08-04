-- ============================================================================
-- Add seat_count column to streams table
-- ============================================================================
-- This adds a dedicated seat_count column (1-12 total boxes, broadcaster = box 1)
-- to replace the overloaded box_count semantics. Existing box_count values are
-- preserved for backwards compatibility; seat_count defaults to box_count.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'seat_count'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN seat_count INTEGER NOT NULL DEFAULT 6;
  END IF;
END $$;

-- Backfill: set seat_count from existing box_count where available
UPDATE public.streams
SET seat_count = GREATEST(1, LEAST(12, COALESCE(box_count, 6)))
WHERE seat_count IS NULL OR seat_count = 6;

-- Add constraint to keep seat_count in valid range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'streams_seat_count_range'
      AND table_schema = 'public'
      AND table_name = 'streams'
  ) THEN
    ALTER TABLE public.streams
      ADD CONSTRAINT streams_seat_count_range
      CHECK (seat_count >= 1 AND seat_count <= 12);
  END IF;
END $$;

-- RLS: only admin can update seat_count directly (broadcasters use the app UI)
-- Existing RLS policies on streams table already cover this; no new policy needed
-- since seat_count is updated via the same authenticated context as box_count.

COMMENT ON COLUMN public.streams.seat_count IS
  'Total number of boxes in broadcast layout (1-20). Broadcaster counts as box 1. Replaces box_count for layout decisions.';
