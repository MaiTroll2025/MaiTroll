ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS maitalent_link_status TEXT,
  ADD COLUMN IF NOT EXISTS maitalent_link_platform TEXT DEFAULT 'troll-city',
  ADD COLUMN IF NOT EXISTS maitalent_external_user_id UUID,
  ADD COLUMN IF NOT EXISTS maitalent_link_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profiles.maitalent_link_status IS 'Current MaiTalent linkage status for the Mai Troll profile';
COMMENT ON COLUMN public.user_profiles.maitalent_link_platform IS 'Platform identifier used for the linked MaiTalent account';
COMMENT ON COLUMN public.user_profiles.maitalent_external_user_id IS 'Mai Troll user identifier associated with the MaiTalent link';
COMMENT ON COLUMN public.user_profiles.maitalent_link_verified_at IS 'Timestamp when the MaiTalent link was verified';
