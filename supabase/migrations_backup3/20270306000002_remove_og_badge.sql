-- Remove the 'og' badge from the catalog to prevent duplicates
-- The system now uses the 'is_og_user' column and specific frontend logic (yellow star) for OG status.
DELETE FROM public.badge_catalog
WHERE slug = 'og';
