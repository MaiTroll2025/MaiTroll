ALTER TABLE public.academy_admissions_applications
  ADD COLUMN IF NOT EXISTS agreement_signed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_url text,
  ADD COLUMN IF NOT EXISTS loan_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loan_bucket text;
