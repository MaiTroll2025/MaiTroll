-- ============================================================================
-- AUCTION LOTS — allow 'queued' as a valid lot status
-- The auction UI (Auction Studio, Auctioneer Dashboard, Live Auction Room)
-- uses `status = 'queued'` for lots waiting in the show queue. The base
-- constraint only permitted ('upcoming','live','sold','unsold','cancelled',
-- 'removed'), which would reject queued-lot inserts. This extends the
-- constraint permissively (idempotent). It never tightens the constraint.
-- ============================================================================

DO $$
DECLARE
  v_sql text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auction_lots_status_check'
      AND conrelid = 'auction_lots'::regclass
  ) THEN
    -- Rebuild the constraint to include 'queued'. Postgres cannot ALTER a CHECK
    -- constraint's expression, so we drop and recreate it with the superset of
    -- allowed values (preserving every value already permitted).
    ALTER TABLE auction_lots DROP CONSTRAINT IF EXISTS auction_lots_status_check;
    ALTER TABLE auction_lots ADD CONSTRAINT auction_lots_status_check
      CHECK (status IN ('upcoming', 'queued', 'live', 'sold', 'unsold', 'cancelled', 'removed'));
  END IF;
END $$;
