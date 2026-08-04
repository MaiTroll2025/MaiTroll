ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mai_ecosystem_linked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS maitalent_linked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mai_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mai_link_source TEXT,
  ADD COLUMN IF NOT EXISTS external_account_id TEXT;

COMMENT ON COLUMN public.user_profiles.mai_ecosystem_linked IS 'Whether the Mai Troll profile is linked to the MaiTalent ecosystem';
COMMENT ON COLUMN public.user_profiles.maitalent_linked IS 'Whether the Mai Troll profile has a valid MaiTalent link';
COMMENT ON COLUMN public.user_profiles.mai_linked_at IS 'Timestamp when the MaiTalent link was established';
COMMENT ON COLUMN public.user_profiles.mai_link_source IS 'Source of the MaiTalent link, such as profile_page or broadcast_flow';
COMMENT ON COLUMN public.user_profiles.external_account_id IS 'External account identifier used for the MaiTalent link';

UPDATE public.user_profiles
SET
  mai_ecosystem_linked = COALESCE(mai_ecosystem_linked, FALSE),
  maitalent_linked = COALESCE(maitalent_linked, (
    maitalent_link_status IS NOT NULL AND maitalent_link_status IN ('linked', 'review', 'flagged', 'pending', 'success')
  )),
  mai_linked_at = COALESCE(mai_linked_at, maitalent_link_verified_at),
  mai_link_source = COALESCE(mai_link_source, maitalent_link_platform),
  external_account_id = COALESCE(external_account_id, maitalent_external_user_id::TEXT)
WHERE
  mai_ecosystem_linked IS NULL
  OR maitalent_linked IS NULL
  OR mai_linked_at IS NULL
  OR mai_link_source IS NULL
  OR external_account_id IS NULL;
