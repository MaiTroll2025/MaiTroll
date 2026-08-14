BEGIN;

ALTER TABLE public.applications
  ALTER COLUMN lead_officer_approved DROP NOT NULL;

ALTER TABLE public.applications
  ALTER COLUMN lead_officer_approved DROP DEFAULT;

UPDATE public.applications
SET lead_officer_approved = null
WHERE status = 'pending'
  AND lead_officer_approved = false;

NOTIFY pgrst, 'reload schema';

COMMIT;