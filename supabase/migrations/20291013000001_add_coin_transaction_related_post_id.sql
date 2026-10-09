ALTER TABLE IF EXISTS public.coin_transactions
  ADD COLUMN IF NOT EXISTS related_post_id UUID;
