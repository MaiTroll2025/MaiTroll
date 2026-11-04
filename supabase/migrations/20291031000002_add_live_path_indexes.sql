-- Index the high-frequency predicates used by live audience, seat, and battle
-- queries. These are additive and do not change frontend behavior.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_stream_audience_presence_active_stream_rank
  ON public.stream_audience_presence (stream_id, gift_total DESC, joined_at ASC)
  WHERE is_active = TRUE AND left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_stream_user_status
  ON public.stream_seat_sessions (stream_id, user_id, status)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_stream_guest_status
  ON public.stream_seat_sessions (stream_id, guest_id, status)
  WHERE guest_id IS NOT NULL;

COMMIT;
