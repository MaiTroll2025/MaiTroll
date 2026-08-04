-- Fix coin_ledger schema to match modern requirements
DO $$
BEGIN
    -- Ensure delta column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'delta') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN delta bigint;
        
        -- Migrate data if coins column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'coins') THEN
             UPDATE public.coin_ledger 
             SET delta = CASE 
                WHEN direction = 'debit' OR direction = 'out' THEN -coins
                ELSE coins
             END;
        ELSE
             UPDATE public.coin_ledger SET delta = 0;
        END IF;
        
        -- Set NOT NULL after update (handle potential NULLs)
        UPDATE public.coin_ledger SET delta = 0 WHERE delta IS NULL;
        ALTER TABLE public.coin_ledger ALTER COLUMN delta SET NOT NULL;
    END IF;

    -- Ensure bucket column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'bucket') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN bucket text DEFAULT 'paid' NOT NULL;
    END IF;

    -- Ensure source column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'source') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN source text DEFAULT 'system' NOT NULL;
    END IF;

    -- Ensure ref_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'ref_id') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN ref_id text;
    END IF;

    -- Ensure reason column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'reason') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN reason text;
    END IF;

    -- Ensure metadata column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'metadata') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN metadata jsonb;
    END IF;
    
    -- Ensure direction column exists (it should, but just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'direction') THEN
         ALTER TABLE public.coin_ledger ADD COLUMN direction text;
    END IF;
    
    -- Sync direction with delta
    UPDATE public.coin_ledger
    SET direction = CASE
        WHEN delta < 0 THEN 'out'
        ELSE 'in'
    END
    WHERE direction IS NULL OR (delta < 0 AND direction != 'out') OR (delta >= 0 AND direction != 'in');

    -- Drop old check constraints if they conflict
    ALTER TABLE public.coin_ledger DROP CONSTRAINT IF EXISTS coin_ledger_direction_check;
    ALTER TABLE public.coin_ledger DROP CONSTRAINT IF EXISTS coin_ledger_coin_type_check;

END $$;
