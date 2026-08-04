-- Rename "Neon City Showdown" to "Mai Troll Showdown"
UPDATE public.tournaments
SET 
  title = 'Mai Troll Showdown',
  description = REPLACE(description, 'Neon City Showdown', 'Mai Troll Showdown')
WHERE title = 'Neon City Showdown';
