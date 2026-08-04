-- ============================================================================
-- Mai Troll — Allow anonymous (non-auth) users to watch random battles
-- ============================================================================
-- Anonymous viewers can already read `streams`, but the battle controller
-- (useBattleViewController) loads the arena by reading the `battles` table.
-- Without public SELECT on `battles`, anonymous viewers hit "Battle not found"
-- and cannot watch a random battle. `battle_participants` already has a public
-- read policy, so only `battles` needs the grant.
-- ============================================================================

DROP POLICY IF EXISTS "Public view battles anon" ON public.battles;
CREATE POLICY "Public view battles anon" ON public.battles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Re-affirm the broad public read in case the prior policy was not applied.
DROP POLICY IF EXISTS "Public view battles" ON public.battles;
CREATE POLICY "Public view battles" ON public.battles
  FOR SELECT TO anon, authenticated
  USING (true);
