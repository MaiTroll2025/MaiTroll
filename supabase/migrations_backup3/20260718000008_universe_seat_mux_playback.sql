-- ============================================================================
-- Mai Troll — UNIVERSE BATTLES: Mux playback IDs per seat.
--
-- Battlers PUBLISH to the round's LiveKit room. A server egress (LiveKit ->
-- Mux) writes each seat's stream to Mux, populating these columns, so
-- registered viewers + the queue can watch via Mux low-latency HLS (they are
-- never on LiveKit unless they are actively battling).
-- ============================================================================

ALTER TABLE public.universe_round_teams
  ADD COLUMN IF NOT EXISTS host_mux_playback_id TEXT,
  ADD COLUMN IF NOT EXISTS seat_one_mux_playback_id TEXT,
  ADD COLUMN IF NOT EXISTS seat_two_mux_playback_id TEXT,
  ADD COLUMN IF NOT EXISTS seat_three_mux_playback_id TEXT;

CREATE INDEX IF NOT EXISTS idx_universe_round_teams_host_mux
  ON public.universe_round_teams (host_mux_playback_id);
