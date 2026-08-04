-- Add user source and broadcast/gaming context columns to user_earning_events
-- This ensures every earning event shows: from which user, and whether it was
-- during a broadcast, HytroGaming stream, or other source.

BEGIN;

-- ============================================
-- 1. Add missing context columns to user_earning_events
-- ============================================
ALTER TABLE public.user_earning_events
  ADD COLUMN IF NOT EXISTS from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_earning_events
  ADD COLUMN IF NOT EXISTS from_user_name text;

ALTER TABLE public.user_earning_events
  ADD COLUMN IF NOT EXISTS stream_id uuid;

ALTER TABLE public.user_earning_events
  ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_earning_events
  ADD COLUMN IF NOT EXISTS is_hytro_gaming boolean NOT NULL DEFAULT false;

-- Add FK for stream_id if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'user_earning_events_stream_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'user_earning_events'
  ) THEN
    ALTER TABLE public.user_earning_events
      ADD CONSTRAINT user_earning_events_stream_id_fkey
      FOREIGN KEY (stream_id)
      REFERENCES public.streams(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 2. Create indexes for the new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_earning_events_from_user_id
  ON public.user_earning_events(from_user_id);

CREATE INDEX IF NOT EXISTS idx_user_earning_events_stream_id
  ON public.user_earning_events(stream_id);

CREATE INDEX IF NOT EXISTS idx_user_earning_events_is_broadcast
  ON public.user_earning_events(is_broadcast) WHERE is_broadcast = true;

CREATE INDEX IF NOT EXISTS idx_user_earning_events_is_hytro_gaming
  ON public.user_earning_events(is_hytro_gaming) WHERE is_hytro_gaming = true;

-- ============================================
-- 3. Backfill: populate from_user_id / from_user_name from details jsonb
-- ============================================
UPDATE public.user_earning_events
SET from_user_id = (details->>'from_user_id')::uuid
WHERE from_user_id IS NULL
  AND details ? 'from_user_id'
  AND details->>'from_user_id' IS NOT NULL;

UPDATE public.user_earning_events
SET from_user_name = details->>'from_user_name'
WHERE from_user_name IS NULL
  AND details ? 'from_user_name'
  AND details->>'from_user_name' IS NOT NULL;

-- ============================================
-- 4. Backfill: populate stream_id from details jsonb
-- ============================================
UPDATE public.user_earning_events
SET stream_id = (details->>'stream_id')::uuid
WHERE stream_id IS NULL
  AND details ? 'stream_id'
  AND details->>'stream_id' IS NOT NULL;

-- ============================================
-- 5. Backfill: set is_broadcast / is_hytro_gaming flags from source_type and details
-- ============================================
UPDATE public.user_earning_events
SET is_broadcast = true
WHERE is_broadcast = false
  AND (
    source_type IN ('gift', 'gift_received', 'gift_bonus', 'guest_box_income', 'broadcast_tip')
    OR (details->>'is_broadcast')::boolean = true
    OR details->>'source' = 'broadcast'
  );

UPDATE public.user_earning_events
SET is_hytro_gaming = true
WHERE is_hytro_gaming = false
  AND (
    source_type IN ('gaming_gift', 'hytro_gaming', 'gaming_tip')
    OR (details->>'is_hytro_gaming')::boolean = true
    OR details->>'source' = 'hytro_gaming'
    OR details->>'source' = 'gaming'
  );

-- ============================================
-- 6. Ensure coin_transactions stream_id FK exists (idempotent)
-- ============================================
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

-- ============================================
-- 7. Add is_broadcast / is_hytro_gaming to coin_transactions for fast filtering
-- ============================================
ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;

ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS is_hytro_gaming boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_coin_transactions_is_broadcast
  ON public.coin_transactions(is_broadcast) WHERE is_broadcast = true;

CREATE INDEX IF NOT EXISTS idx_coin_transactions_is_hytro_gaming
  ON public.coin_transactions(is_hytro_gaming) WHERE is_hytro_gaming = true;

-- Backfill coin_transactions flags from metadata
UPDATE public.coin_transactions
SET is_broadcast = true
WHERE is_broadcast = false
  AND (
    (metadata->>'is_broadcast')::boolean = true
    OR metadata->>'source' = 'broadcast'
    OR type IN ('gift_received', 'gift_bonus', 'guest_box_income')
  );

UPDATE public.coin_transactions
SET is_hytro_gaming = true
WHERE is_hytro_gaming = false
  AND (
    (metadata->>'is_hytro_gaming')::boolean = true
    OR metadata->>'source' = 'hytro_gaming'
    OR metadata->>'source' = 'gaming'
    OR (metadata->>'category') = 'gaming'
  );

COMMIT;
