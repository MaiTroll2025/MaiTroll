-- Add reason column to coin_ledger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'reason') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN reason text;
    END IF;
END $$;
