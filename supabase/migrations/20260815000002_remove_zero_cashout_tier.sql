-- Remove the $0 cashout tier from the database
-- The frontend no longer exposes this tier and it should not be selectable.

DELETE FROM public.cashout_tiers
WHERE coin_amount = 0
  AND cash_amount = 0;
 