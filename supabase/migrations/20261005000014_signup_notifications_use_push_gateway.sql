-- Signup notifications are emitted by the signup Edge Function so Android
-- receives them through FCM and browser clients through the shared push gateway.
DROP TRIGGER IF EXISTS trg_notify_admin_signup ON public.user_profiles;
