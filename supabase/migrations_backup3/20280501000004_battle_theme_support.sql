-- Production-safe battle background theme support.
-- Stores the selected theme on each battle row with a safe default.

ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS battle_theme text;

ALTER TABLE public.battles
  ALTER COLUMN battle_theme SET DEFAULT 'default';

UPDATE public.battles
SET battle_theme = 'default'
WHERE battle_theme IS NULL OR btrim(battle_theme) = '';
