-- Add bypass_broadcast_restriction column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS bypass_broadcast_restriction BOOLEAN DEFAULT FALSE;

-- Allow admin to update this column (ensure RLS policies permit it, though admin usually bypasses RLS or has a policy)
-- Since we are using an Edge Function with Service Role for updates, RLS on update might not strictly block it,
-- but good to be aware. The Edge Function uses service_role key so it bypasses RLS.

COMMENT ON COLUMN public.user_profiles.bypass_broadcast_restriction IS 'If true, user can broadcast immediately without waiting 24 hours';
