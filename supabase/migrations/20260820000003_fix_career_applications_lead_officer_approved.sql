BEGIN;

ALTER TABLE public.career_applications
  ADD COLUMN IF NOT EXISTS lead_officer_approved boolean;

ALTER TABLE public.career_applications
  ALTER COLUMN lead_officer_approved DROP NOT NULL;

UPDATE public.career_applications
SET lead_officer_approved = null
WHERE lead_officer_approved IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;