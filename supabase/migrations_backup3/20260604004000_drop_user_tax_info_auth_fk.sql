-- Relax FK to allow seeding user_tax_info without auth.users rows
ALTER TABLE IF EXISTS public.user_tax_info
  DROP CONSTRAINT IF EXISTS user_tax_info_user_id_fkey;

-- Optionally tie to user_profiles instead using a NOT VALID constraint so
-- existing rows that don't yet have user_profiles can remain temporarily.
ALTER TABLE IF EXISTS public.user_tax_info
  ADD CONSTRAINT user_tax_info_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE
  NOT VALID;
