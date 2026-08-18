-- ============================================================================
-- Fix battle_status enum to include values used by random battle system
-- ============================================================================
-- Error: new row for relation "streams" violates check constraint
-- "streams_battle_status_check"
--
-- The battle_status enum on streams is missing 'starting' and 'waiting',
-- which are used by find_random_battle_match and cleanup RPCs.
-- ============================================================================

ALTER TYPE public.battle_status ADD VALUE IF NOT EXISTS 'waiting';
ALTER TYPE public.battle_status ADD VALUE IF NOT EXISTS 'starting';
