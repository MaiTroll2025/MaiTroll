-- Fix gift_items RLS: allow public read access to the gift catalog
-- The deny_all policy prevents broadcaster from enriching gift overlay data
DROP POLICY IF EXISTS "deny_all" ON public.gift_items;
CREATE POLICY "public_read_gift_items" ON public.gift_items
  FOR SELECT USING (true);
