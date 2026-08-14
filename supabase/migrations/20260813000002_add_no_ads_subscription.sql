ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS no_ads_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_no_ads_until ON public.user_profiles (no_ads_until);
