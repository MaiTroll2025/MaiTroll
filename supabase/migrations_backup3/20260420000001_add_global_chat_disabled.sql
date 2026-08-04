-- Add global chat disabled column for blocking user from all chat (troll wall, streams, TCPS)

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS chat_disabled_until TIMESTAMPTZ;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_chat_disabled_until 
ON public.user_profiles (chat_disabled_until) 
WHERE chat_disabled_until IS NOT NULL;

-- Also add chat_disabled as a boolean flag (easier for checking)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS chat_disabled BOOLEAN NOT NULL DEFAULT false;