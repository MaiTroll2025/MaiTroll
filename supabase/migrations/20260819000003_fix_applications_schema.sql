-- Fix applications table schema for careers page and admin views

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_officer_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_officer_reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_officer_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS store_description text,
  ADD COLUMN IF NOT EXISTS product_types text,
  ADD COLUMN IF NOT EXISTS contact_email text;

DROP INDEX IF EXISTS idx_applications_user_id;
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_type ON public.applications(type);
