-- Fix missing column coin_ledger.to_userid
-- This column is required for tracking the recipient in gift/transfer transactions

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'to_userid') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN to_userid uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_coin_ledger_to_userid ON public.coin_ledger(to_userid);
    END IF;
END $$;
