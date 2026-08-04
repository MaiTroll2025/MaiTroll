-- Fix PostgREST PGRST201 ambiguity between auction_lots and auction_shows
-- The circular FK (auction_lots.auction_show_id → auction_shows AND auction_shows.current_lot_id → auction_lots)
-- causes PostgREST to fail when embedding relationships, breaking unrelated queries.
-- Solution: drop the reverse FK (current_lot_id) and keep it as a plain UUID column.

ALTER TABLE auction_shows DROP CONSTRAINT IF EXISTS fk_current_lot;

-- The current_lot_id column remains as a plain UUID for application-level management

SELECT 'Fixed auction_lots/auction_shows PostgREST ambiguity' as status;
