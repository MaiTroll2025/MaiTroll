-- Fix for user advertisement RLS policy
-- Allow active queued advertisements to be selected by regular users on the homepage.

ALTER POLICY "Everyone can view approved active advertisements" ON public.user_advertisements
USING ((status = 'approved' OR status = 'active') AND expires_at > NOW());
