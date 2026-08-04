BEGIN;

-- Add a foreign key from job_applications.user_id to user_profiles.id
-- to fix the schema cache relationship between job_applications and user_profiles
ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_user_id_fkey_to_user_profiles
  FOREIGN KEY (user_id)
  REFERENCES public.user_profiles(id)
  ON DELETE RESTRICT;

COMMIT;