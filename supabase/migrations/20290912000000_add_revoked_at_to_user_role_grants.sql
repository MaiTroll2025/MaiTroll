-- Add revoked_at column to user_role_grants
-- Fixes: "column ur.revoked_at does not exist" error in is_admin() function
-- The is_admin() function references ur.revoked_at but the column was missing.

ALTER TABLE public.user_role_grants
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;