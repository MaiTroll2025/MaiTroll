-- ============================================================================
-- Mai Troll — UNIVERSE BATTLES: LiveKit room name for rounds
-- ============================================================================

-- Add livekit_room_name to universe_rounds so each active round has a stable
-- LiveKit room name that seats/audience can join.
ALTER TABLE public.universe_rounds
  ADD COLUMN IF NOT EXISTS livekit_room_name TEXT;

CREATE INDEX IF NOT EXISTS idx_universe_rounds_livekit_room
  ON public.universe_rounds (livekit_room_name);
