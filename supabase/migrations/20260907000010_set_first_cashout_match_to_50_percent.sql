-- Change the first cashout promotion from a full match to a 50% match.
ALTER TABLE public.cashout_promotions
  ALTER COLUMN match_type SET DEFAULT 'percentage',
  ALTER COLUMN match_percentage SET DEFAULT 50;

UPDATE public.cashout_promotions
SET match_type = 'percentage',
    match_percentage = 50,
    updated_at = NOW()
WHERE slug = 'first_cashout_match';
