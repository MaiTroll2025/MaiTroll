ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS stream_id uuid;

CREATE INDEX IF NOT EXISTS idx_coin_transactions_stream_id
  ON public.coin_transactions(stream_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'coin_transactions_stream_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'coin_transactions'
  ) THEN
    ALTER TABLE public.coin_transactions
      ADD CONSTRAINT coin_transactions_stream_id_fkey
      FOREIGN KEY (stream_id)
      REFERENCES public.streams(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.coin_transactions ct
SET stream_id = s.id
FROM public.streams s
WHERE ct.stream_id IS NULL
  AND ct.metadata ? 'stream_id'
  AND s.id::text = ct.metadata->>'stream_id';
