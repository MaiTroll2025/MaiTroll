-- ============================================================
-- XTROLLZ APPLICATION ROLE
-- Add xtrollz_role to applications and update approval
-- to set is_broadcaster on user profile.
-- ============================================================

BEGIN;

ALTER TABLE public.xtrollz_applications
  ADD COLUMN IF NOT EXISTS xtrollz_role text CHECK (xtrollz_role IN ('streamer', 'viewer'));

CREATE INDEX IF NOT EXISTS idx_xtrollz_applications_xtrollz_role
  ON public.xtrollz_applications(xtrollz_role);

COMMIT;

NOTIFY pgrst, 'reload schema';
