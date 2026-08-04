-- ============================================================
-- XTROLLZ APPLICATION DOCUMENTS
-- Private ID storage with short-lived signed URLs
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.xtrollz_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.xtrollz_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size integer,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_documents_application_id
ON public.xtrollz_application_documents(application_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_documents_user_id
ON public.xtrollz_application_documents(user_id);

ALTER TABLE public.xtrollz_application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own XTrollz documents"
ON public.xtrollz_application_documents;

CREATE POLICY "Users can insert own XTrollz documents"
ON public.xtrollz_application_documents
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users cannot view XTrollz documents"
ON public.xtrollz_application_documents;

CREATE POLICY "Users cannot view XTrollz documents"
ON public.xtrollz_application_documents
FOR SELECT
TO authenticated
USING (false);

GRANT INSERT
ON public.xtrollz_application_documents
TO authenticated;

GRANT ALL
ON public.xtrollz_application_documents
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
