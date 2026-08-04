-- Drop OneSignal-specific tables and policies
-- OneSignal has been fully replaced by VAPID Web Push using web_push_subscriptions

-- Drop policies first (to avoid dependency issues)
DROP POLICY IF EXISTS "Users can insert their OneSignal token" ON public.onesignal_tokens;
DROP POLICY IF EXISTS "Users can update their OneSignal token" ON public.onesignal_tokens;
DROP POLICY IF EXISTS "Users can read their OneSignal token" ON public.onesignal_tokens;
DROP POLICY IF EXISTS "Service role can manage all OneSignal tokens" ON public.onesignal_tokens;

-- Drop the table
DROP TABLE IF EXISTS public.onesignal_tokens CASCADE;
