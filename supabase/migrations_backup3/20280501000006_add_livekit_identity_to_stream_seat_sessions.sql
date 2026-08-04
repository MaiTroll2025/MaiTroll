-- Migration: Add LiveKit participant identity to active stream seat sessions
-- Description: Store LiveKit participant identity on the current stream seat session ledger so the frontend can match published tracks to seat rows.

ALTER TABLE public.stream_seat_sessions
  ADD COLUMN IF NOT EXISTS livekit_participant_identity TEXT;

-- Optional: Preserve the existing active session identity if it was already set via a different table or process.
-- No additional data migration is performed here; new seat live events will populate this field.
