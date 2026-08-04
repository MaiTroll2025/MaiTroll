-- ============================================================================
-- AUCTION INVENTORY QUANTITY RESERVATION
-- Adds authoritative quantity tracking to auction_lots so that adding an item
-- to a show atomically reserves stock, prevents double-reservation across
-- shows, restores reservations on removal/cancel, and moves reserved -> sold
-- after a successful sale. The DB is the source of truth; the client may only
-- call these atomic functions.
-- ============================================================================

-- 1. Quantity columns. We keep the legacy `quantity` column as a convenience
--    alias but make the four canonical columns authoritative.
ALTER TABLE auction_lots
  ADD COLUMN IF NOT EXISTS quantity_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_available integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_sold integer NOT NULL DEFAULT 0;

-- 2. Backfill canonical columns from the legacy `quantity` value for any
--    existing rows that have not yet been split out. Available starts equal to
--    total (nothing reserved/sold yet).
UPDATE auction_lots
SET
  quantity_total = GREATEST(0, COALESCE(quantity, 0)),
  quantity_available = GREATEST(0, COALESCE(quantity, 0)) - GREATEST(0, COALESCE(quantity_reserved, 0)) - GREATEST(0, COALESCE(quantity_sold, 0))
WHERE quantity_total = 0 AND COALESCE(quantity, 0) > 0;

-- 3. Constraints. Stop negative quantities and keep available in sync on write.
--    NOTE: PostgreSQL does not support `ADD CONSTRAINT IF NOT EXISTS`, so we
--    guard the DDL with a DO block that checks pg_constraint first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_auction_lots_qty_nonneg'
      AND conrelid = 'auction_lots'::regclass
  ) THEN
    ALTER TABLE auction_lots
      ADD CONSTRAINT chk_auction_lots_qty_nonneg
      CHECK (
        quantity_total >= 0 AND quantity_available >= 0
        AND quantity_reserved >= 0 AND quantity_sold >= 0
      );
  END IF;
END $$;

-- 4. Unique reservation per (show, lot) so the same units can never be reserved
--    for two shows. We enforce this logically inside the reserve function, but
--    also add a partial unique index keyed on (auction_show_id, id) for clarity
--    once a lot is attached to a show (a lot is inherently unique per show).
--    Instead we rely on quantity math + the atomic function below.

CREATE INDEX IF NOT EXISTS idx_auction_lots_qty ON auction_lots(auction_show_id, quantity_available);

-- 5. Atomic reservation function. Reserves `p_qty` units of a source inventory
--    lot for a destination show lot. Uses a row lock + inventory math so two
--    concurrent requests cannot over-reserve. Idempotent per (source, dest).
CREATE OR REPLACE FUNCTION reserve_auction_inventory(
  p_source_lot_id uuid,
  p_dest_lot_id uuid,
  p_show_id uuid,
  p_qty integer
)
RETURNS jsonb
AS $$
DECLARE
  v_src auction_lots%ROWTYPE;
  v_reserved integer;
  v_available integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be at least 1');
  END IF;

  -- Lock the source row so concurrent reservations serialize.
  SELECT * INTO v_src FROM auction_lots WHERE id = p_source_lot_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Source inventory item not found');
  END IF;

  -- Only the owning auctioneer may reserve.
  IF NOT is_show_auctioneer(v_src.auction_show_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to reserve this inventory');
  END IF;

  -- Already reserved for this destination? Return current state (idempotent).
  SELECT quantity_reserved INTO v_reserved
  FROM auction_lots WHERE id = p_dest_lot_id;

  v_available := GREATEST(0, v_src.quantity_total - v_src.quantity_reserved - v_src.quantity_sold);

  IF v_reserved IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Destination lot not found');
  END IF;

  IF v_reserved >= p_qty THEN
    RETURN jsonb_build_object(
      'success', true, 'already_reserved', true,
      'reserved', v_reserved, 'available', v_available
    );
  END IF;

  IF v_available < p_qty THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Not enough available stock',
      'available', v_available, 'requested', p_qty
    );
  END IF;

  -- Reserve on the source, reflect on the destination.
  UPDATE auction_lots
  SET quantity_reserved = quantity_reserved + p_qty,
      quantity_available = GREATEST(0, quantity_total - quantity_reserved - p_qty - quantity_sold),
      updated_at = now()
  WHERE id = p_source_lot_id;

  UPDATE auction_lots
  SET quantity_reserved = p_qty,
      updated_at = now()
  WHERE id = p_dest_lot_id;

  RETURN jsonb_build_object(
    'success', true,
    'reserved', p_qty,
    'available', GREATEST(0, v_src.quantity_total - v_src.quantity_reserved - p_qty - v_src.quantity_sold)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Restore reservation when an item is removed from a show or the show is
--    cancelled. Returns reserved units back to available on the source.
CREATE OR REPLACE FUNCTION restore_auction_inventory_reservation(
  p_source_lot_id uuid,
  p_dest_lot_id uuid
)
RETURNS jsonb
AS $$
DECLARE
  v_reserved integer := 0;
BEGIN
  SELECT quantity_reserved INTO v_reserved FROM auction_lots WHERE id = p_dest_lot_id FOR UPDATE;
  IF v_reserved IS NULL OR v_reserved <= 0 THEN
    RETURN jsonb_build_object('success', true, 'restored', 0);
  END IF;

  UPDATE auction_lots
  SET quantity_reserved = GREATEST(0, quantity_reserved - v_reserved),
      quantity_available = GREATEST(0, quantity_total - GREATEST(0, quantity_reserved - v_reserved) - quantity_sold),
      updated_at = now()
  WHERE id = p_source_lot_id;

  UPDATE auction_lots
  SET quantity_reserved = 0, updated_at = now()
  WHERE id = p_dest_lot_id;

  RETURN jsonb_build_object('success', true, 'restored', v_reserved);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Move reserved -> sold after a successful sale, and restore any remaining
--    unsold reserved units. Called from mark_lot_sold / the create-order path.
CREATE OR REPLACE FUNCTION finalize_auction_inventory_sale(
  p_source_lot_id uuid,
  p_dest_lot_id uuid,
  p_sold_qty integer
)
RETURNS jsonb
AS $$
DECLARE
  v_reserved integer := 0;
  v_sold integer := 0;
  v_restore integer := 0;
BEGIN
  SELECT quantity_reserved, quantity_sold INTO v_reserved, v_sold
  FROM auction_lots WHERE id = p_dest_lot_id FOR UPDATE;

  v_sold := GREATEST(0, p_sold_qty);
  v_restore := GREATEST(0, v_reserved - v_sold);

  -- Source: reserved decreases by sold units; available increases by restored.
  UPDATE auction_lots
  SET quantity_reserved = GREATEST(0, quantity_reserved - LEAST(v_reserved, v_sold + v_restore)),
      quantity_sold = quantity_sold + v_sold,
      quantity_available = GREATEST(0, quantity_total - GREATEST(0, quantity_reserved - LEAST(v_reserved, v_sold + v_restore)) - (quantity_sold + v_sold)),
      updated_at = now()
  WHERE id = p_source_lot_id;

  -- Destination: record sold; clear reservation (already covered by source math).
  UPDATE auction_lots
  SET quantity_sold = quantity_sold + v_sold,
      quantity_reserved = GREATEST(0, quantity_reserved - (v_sold + v_restore)),
      quantity_available = GREATEST(0, quantity_total - GREATEST(0, quantity_reserved - (v_sold + v_restore)) - (quantity_sold + v_sold)),
      updated_at = now()
  WHERE id = p_dest_lot_id;

  RETURN jsonb_build_object('success', true, 'sold', v_sold, 'restored', v_restore);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger: keep quantity_available consistent whenever reserved/sold change
--    as a safety net (the functions above already maintain it).
CREATE OR REPLACE FUNCTION trg_auction_lot_qty_sync()
RETURNS TRIGGER
AS $$
BEGIN
  NEW.quantity_available := GREATEST(0,
    NEW.quantity_total - GREATEST(0, NEW.quantity_reserved) - GREATEST(0, NEW.quantity_sold));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auction_lot_qty_sync ON auction_lots;
CREATE TRIGGER trigger_auction_lot_qty_sync
  BEFORE UPDATE ON auction_lots
  FOR EACH ROW
  WHEN (NEW.quantity_reserved IS DISTINCT FROM OLD.quantity_reserved
        OR NEW.quantity_sold IS DISTINCT FROM OLD.quantity_sold
        OR NEW.quantity_total IS DISTINCT FROM OLD.quantity_total)
  EXECUTE FUNCTION trg_auction_lot_qty_sync();

-- 9. Grants
GRANT EXECUTE ON FUNCTION reserve_auction_inventory(uuid, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_auction_inventory_reservation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_auction_inventory_sale(uuid, uuid, integer) TO authenticated;

-- 10. Realtime: expose auction_lots quantity changes to live clients.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='auction_lots')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='auction_lots') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_lots;
  END IF;
END $$;

COMMENT ON FUNCTION reserve_auction_inventory IS 'Atomically reserve auction inventory units for a show lot';
COMMENT ON FUNCTION restore_auction_inventory_reservation IS 'Restore reserved auction inventory when an item is removed/cancelled';
COMMENT ON FUNCTION finalize_auction_inventory_sale IS 'Move reserved units to sold after a successful auction sale';
