-- Migration: Add request_trollseat RPC and approve_trollseat_cohost RPC
-- Date: 2026-05-18
--
-- Problem:
--   request_trollseat   — missing from SQL so viewer clicks did nothing
--   approve_trollseat_cohost — missing from SQL so broadcaster could not approve
--
-- This creates both RPCs + idempotent table setup so the full
-- viewer-request → broadcaster-approve pipeline works end-to-end.
--
-- Flow after this migration:
--   1. Viewer clicks seat → request_trollseat → seat → "pending_payment"
--      (if seat_price > 0 the viewer needs to pay in phase 2)
--   2. Frontend handles payment, calls mark_trollseat_paid → pending_payment
--      RPC transitions seat to "paid_pending_approval"
--   3. Broadcaster sees "paid_pending_approval" in UI, clicks Approve or Deny
--   4. approve_trollseat_cohost → occupied  (or deny → empty + refund)

-- ==========================================
-- 0. CREATE stream_trollseats TABLE (idempotent)
-- ==========================================

CREATE TABLE IF NOT EXISTS stream_trollseats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id       UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  seat_index      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'empty',
  user_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  broadcaster_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  seat_price      INTEGER NOT NULL DEFAULT 0,
  paid_amount     INTEGER NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  left_at         TIMESTAMPTZ,
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  refund_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One seat per index per stream (not removed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trollseats_stream_seat
  ON stream_trollseats(stream_id, seat_index)
  WHERE status != 'removed';

-- Speed up lookups by stream + status
CREATE INDEX IF NOT EXISTS idx_trollseats_stream_status
  ON stream_trollseats(stream_id, status);

-- Speed up user lookups
CREATE INDEX IF NOT EXISTS idx_trollseats_user_id
  ON stream_trollseats(user_id)
  WHERE user_id IS NOT NULL;

-- ==========================================
-- RLS
-- ==========================================

ALTER TABLE stream_trollseats ENABLE ROW LEVEL SECURITY;

-- Broadcaster can manage their own stream's seats
CREATE POLICY IF NOT EXISTS trollseats_broadcaster_all
  ON stream_trollseats FOR ALL
  USING (broadcaster_id = auth.uid())
  WITH CHECK (broadcaster_id = auth.uid());

-- Viewer requesting: can INSERT if stream exists
CREATE POLICY IF NOT EXISTS trollseats_viewer_insert
  ON stream_trollseats FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = stream_trollseats.stream_id
    )
  );

-- Anyone authenticated can read seats for any stream
CREATE POLICY IF NOT EXISTS trollseats_public_read
  ON stream_trollseats FOR SELECT
  USING (true);

-- ==========================================
-- 1. request_trollseat
--    Transitions first available "empty" seat →
--    "pending_payment" (paid) or "occupied" (free) for the requesting user.
--    Returns the updated seat row so the frontend can inspect the status.
-- ==========================================

CREATE OR REPLACE FUNCTION request_trollseat(
  p_stream_id   UUID,
  p_user_id     UUID
)
RETURNS TABLE (
  id              UUID,
  stream_id       UUID,
  seat_index      INTEGER,
  status          TEXT,
  user_id         UUID,
  broadcaster_id  UUID,
  seat_price      INTEGER,
  paid_amount     INTEGER,
  paid_at         TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  left_at         TIMESTAMPTZ,
  refunded_amount INTEGER,
  refund_reason   TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat   RECORD;
BEGIN
  --
  -- Claim the first empty seat for this stream using FOR UPDATE SKIP LOCKED
  -- so concurrent viewers never grab the same seat.
  --
  SELECT *
    INTO v_seat
    FROM stream_trollseats
   WHERE stream_id  = p_stream_id
     AND status     = 'empty'
   ORDER BY seat_index
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_seat IS NULL THEN
    RAISE EXCEPTION 'No empty trollseats available'
      USING HINT = 'The broadcaster may have filled or removed all trollseats';
  END IF;

  UPDATE stream_trollseats
     SET user_id    = p_user_id,
         status     = CASE
                        WHEN seat_price > 0 THEN 'pending_payment'
                        ELSE 'occupied'
                      END,
         updated_at = NOW()
   WHERE id = v_seat.id;

  RETURN QUERY
    SELECT s.id, s.stream_id, s.seat_index, s.status,
           s.user_id, s.broadcaster_id, s.seat_price,
           s.paid_amount, s.paid_at, s.approved_at, s.left_at,
           s.refunded_amount, s.refund_reason, s.created_at, s.updated_at
      FROM stream_trollseats s
     WHERE s.id = v_seat.id;
END;
$$;

GRANT EXECUTE ON FUNCTION request_trollseat(UUID, UUID) TO authenticated;

-- ==========================================
-- 2. approve_trollseat_cohost
--    Transitions seat from pending_payment / paid_pending_approval → occupied.
--    Called by the broadcaster when they approve a viewer's request.
-- ==========================================

CREATE OR REPLACE FUNCTION approve_trollseat_cohost(
  p_trollseat_id    UUID,
  p_broadcaster_id  UUID
)
RETURNS TABLE (
  id              UUID,
  stream_id       UUID,
  seat_index      INTEGER,
  status          TEXT,
  user_id         UUID,
  broadcaster_id  UUID,
  seat_price      INTEGER,
  paid_amount     INTEGER,
  paid_at         TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  left_at         TIMESTAMPTZ,
  refunded_amount INTEGER,
  refund_reason   TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat   RECORD;
BEGIN
  SELECT *
    INTO v_seat
    FROM stream_trollseats
   WHERE id = p_trollseat_id
   FOR UPDATE;

  IF v_seat IS NULL THEN
    RAISE EXCEPTION 'TrollSeat not found: %', p_trollseat_id;
  END IF;

  IF v_seat.broadcaster_id <> p_broadcaster_id THEN
    RAISE EXCEPTION 'Only the broadcaster can approve this trollseat'
      USING HINT = format('Expected broadcaster %s but got %s', v_seat.broadcaster_id, p_broadcaster_id);
  END IF;

  -- Must be in an approval-pending state
  IF v_seat.status NOT IN ('pending_payment', 'paid_pending_approval') THEN
    RAISE EXCEPTION 'TrollSeat "%" is not pending approval (current status: %)'
      USING v_seat.id, v_seat.status;
  END IF;

  UPDATE stream_trollseats
     SET status      = 'occupied',
         approved_at = NOW(),
         updated_at  = NOW()
   WHERE id = p_trollseat_id;

  RETURN QUERY
    SELECT s.id, s.stream_id, s.seat_index, s.status,
           s.user_id, s.broadcaster_id, s.seat_price,
           s.paid_amount, s.paid_at, s.approved_at, s.left_at,
           s.refunded_amount, s.refund_reason, s.created_at, s.updated_at
      FROM stream_trollseats s
     WHERE s.id = p_trollseat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_trollseat_cohost(UUID, UUID) TO authenticated;

-- ==========================================
-- 3. mark_trollseat_paid
--    After frontend successfully charges the viewer, this transitions the
--    seat from "pending_payment" → "paid_pending_approval" so the broadcaster
--    can see the request in their approval queue.
-- ==========================================

CREATE OR REPLACE FUNCTION mark_trollseat_paid(
  p_trollseat_id    UUID,
  p_user_id         UUID,
  p_paid_amount     INTEGER
)
RETURNS TABLE (
  id              UUID,
  stream_id       UUID,
  seat_index      INTEGER,
  status          TEXT,
  user_id         UUID,
  broadcaster_id  UUID,
  seat_price      INTEGER,
  paid_amount     INTEGER,
  paid_at         TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  left_at         TIMESTAMPTZ,
  refunded_amount INTEGER,
  refund_reason   TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat   RECORD;
BEGIN
  SELECT *
    INTO v_seat
    FROM stream_trollseats
   WHERE id = p_trollseat_id
   FOR UPDATE;

  IF v_seat IS NULL THEN
    RAISE EXCEPTION 'TrollSeat not found: %', p_trollseat_id;
  END IF;

  IF v_seat.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Only the seat holder can confirm payment';
  END IF;

  IF v_seat.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'TrollSeat "%" is not pending payment (current status: %)'
      USING v_seat.id, v_seat.status;
  END IF;

  UPDATE stream_trollseats
     SET status      = 'paid_pending_approval',
         paid_amount = p_paid_amount,
         paid_at     = NOW(),
         updated_at  = NOW()
   WHERE id = p_trollseat_id;

  RETURN QUERY
    SELECT s.id, s.stream_id, s.seat_index, s.status,
           s.user_id, s.broadcaster_id, s.seat_price,
           s.paid_amount, s.paid_at, s.approved_at, s.left_at,
           s.refunded_amount, s.refund_reason, s.created_at, s.updated_at
      FROM stream_trollseats s
     WHERE s.id = p_trollseat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_trollseat_paid(UUID, UUID, INTEGER) TO authenticated;

-- ==========================================
-- 4. deny_trollseat_cohost  (optional — useful for broadcaster "Deny" button)
--    Resets seat back to "empty" and refunds the viewer if they already paid.
-- ==========================================

CREATE OR REPLACE FUNCTION deny_trollseat_cohost(
  p_trollseat_id    UUID,
  p_broadcaster_id  UUID,
  p_deny_reason     TEXT DEFAULT NULL
)
RETURNS TABLE (
  success      BOOLEAN,
  refunded     INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat            RECORD;
  v_refunded_amount INTEGER := 0;
BEGIN
  SELECT *
    INTO v_seat
    FROM stream_trollseats
   WHERE id = p_trollseat_id
   FOR UPDATE;

  IF v_seat IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'TrollSeat not found'::TEXT;
    RETURN;
  END IF;

  IF v_seat.broadcaster_id <> p_broadcaster_id THEN
    RETURN QUERY SELECT FALSE, 0, 'Only the broadcaster can deny this trollseat'::TEXT;
    RETURN;
  END IF;

  IF v_seat.status NOT IN ('pending_payment', 'paid_pending_approval') THEN
    RETURN QUERY SELECT FALSE, 0,
                    format('TrollSeat is not pending approval (status: %)', v_seat.status)::TEXT;
    RETURN;
  END IF;

   -- Refund viewer directly — inline so we never depend on a
   -- grant_troll_coins RPC that may not exist in every deployment.
   IF v_seat.paid_amount > 0 AND v_seat.user_id IS NOT NULL THEN
     UPDATE public.user_profiles
        SET troll_coin = GREATEST(COALESCE(troll_coin, 0) + v_seat.paid_amount, 0)
      WHERE user_id = v_seat.user_id;

     -- Log the grant (mirrors admin_grant_troll_coin pattern)
     INSERT INTO public.admin_coin_grants (granted_to, granted_by, amount, reason)
     VALUES (v_seat.user_id, p_broadcaster_id, v_seat.paid_amount,
             'trollseat_denied_refund');

     -- Spend from broadcaster (allow going negative per existing pattern)
     PERFORM public.spend_troll_coins(
       p_broadcaster_id,       -- p_receiver_id
       v_seat.paid_amount,     -- p_amount
       'trollseat_deny',       -- p_source
       v_seat.stream_id::TEXT  -- p_item
     );

     v_refunded_amount := v_seat.paid_amount;
   END IF;

  UPDATE stream_trollseats
     SET status         = 'empty',
         user_id        = NULL,
         seat_price     = 0,
         paid_amount    = 0,
         paid_at        = NULL,
         approved_at    = NULL,
         refunded_amount= COALESCE(refunded_amount, 0) + v_refunded_amount,
         refund_reason  = p_deny_reason,
         updated_at     = NOW()
   WHERE id = p_trollseat_id;

  RETURN QUERY SELECT TRUE, v_refunded_amount, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION deny_trollseat_cohost(UUID, UUID, TEXT) TO authenticated;

-- ==========================================
-- COMMIT
-- ==========================================

COMMIT;
