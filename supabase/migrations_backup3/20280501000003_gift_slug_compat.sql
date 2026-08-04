-- Compatibility migration for gift systems expecting a `slug` column.
-- Some runtime paths/RPCs still reference `slug` while schema stores `gift_slug`.

ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.gifts
SET slug = COALESCE(
  NULLIF(slug, ''),
  NULLIF(gift_slug, ''),
  NULLIF(LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')), ''),
  id::text
)
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.gift_items
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.gift_items
SET slug = COALESCE(
  NULLIF(slug, ''),
  NULLIF(gift_slug, ''),
  NULLIF(LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')), ''),
  id::text
)
WHERE slug IS NULL OR slug = '';

