-- Fix: Add missing unique partial index for global_events.dedupe_key
-- The create_global_event() RPC uses ON CONFLICT (dedupe_key) DO NOTHING
-- but the supporting unique index was missing in production, causing 42P10.
-- This is a partial index: only non-null dedupe_key values participate in
-- uniqueness, so events without a dedupe_key always insert normally.

BEGIN;

-- 1. Report any existing duplicate dedupe_key values before adding uniqueness.
--    If duplicates exist, the CREATE UNIQUE INDEX below will fail with a clear
--    error. Do NOT delete data blindly — review duplicates first.
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM public.global_events
  WHERE dedupe_key IS NOT NULL
  GROUP BY dedupe_key
  HAVING COUNT(*) > 1;

  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % duplicate dedupe_key values in global_events. Review before adding unique index.', dup_count;
  ELSE
    RAISE NOTICE 'No duplicate dedupe_key values found. Safe to create unique index.';
  END IF;
END $$;

-- 2. Create the unique partial index that the ON CONFLICT (dedupe_key) clause requires.
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_events_dedupe_key_unique
  ON public.global_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMIT;
