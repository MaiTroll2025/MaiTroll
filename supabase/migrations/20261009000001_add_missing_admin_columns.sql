-- Add missing columns referenced by Admin Dashboard

-- Add jailed_until column to user_profiles (separate from banned_until)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS jailed_until TIMESTAMPTZ;

-- Add fraud_flags column to user_profiles for risk/fraud tracking
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]'::jsonb;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_user_profiles_jailed_until ON public.user_profiles(jailed_until) WHERE jailed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_fraud_flags ON public.user_profiles USING GIN(fraud_flags);

-- Comment on the new columns
COMMENT ON COLUMN public.user_profiles.jailed_until IS 'Timestamp when jail sentence expires (separate from ban)';
COMMENT ON COLUMN public.user_profiles.fraud_flags IS 'JSON array of fraud risk flags for this user';

-- Grant permissions
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;