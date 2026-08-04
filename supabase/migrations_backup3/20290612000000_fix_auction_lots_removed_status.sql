-- Fix auction_lots status constraint to support 'removed' status
-- Frontend code sets status='removed' when deleting lots, but the CHECK constraint doesn't allow it

-- Fix the status column constraint
ALTER TABLE auction_lots DROP CONSTRAINT IF EXISTS auction_lots_status_check;
ALTER TABLE auction_lots ADD CONSTRAINT auction_lots_status_check
  CHECK (status IN ('upcoming', 'live', 'sold', 'unsold', 'cancelled', 'removed'));

-- Also fix status_extended to include 'removed' for consistency
ALTER TABLE auction_lots DROP CONSTRAINT IF EXISTS auction_lots_status_extended_check;
ALTER TABLE auction_lots ADD CONSTRAINT auction_lots_status_extended_check
  CHECK (status_extended IN (
    'draft', 'available', 'queued', 'live', 'sold',
    'packed', 'shipped', 'delivered', 'removed'
  ));
