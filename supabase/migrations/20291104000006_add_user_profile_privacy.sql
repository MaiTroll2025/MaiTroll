ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
