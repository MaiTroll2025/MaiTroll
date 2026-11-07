import type { UserProfile } from './supabase'

const RTC_STAFF_ROLES = [
  'admin',
  'moderator',
  'troll_officer',
  'lead_troll_officer',
  'secretary',
  'officer',
  'hr_admin',
  'ceo',
  'superadmin',
  'empire_partner',
  'auctioneer',
  'attorney',
  'prosecutor',
  'pastor',
  'journalist',
  'tcnn_news_caster',
  'tcnn_chief_news_caster',
  'ceo_assistant',
  'noah_assistant',
]

export function canAccessRtcAdminMonitor(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false

  const roles = [profile.role, profile.troll_role].map((role) =>
    String(role || '').toLowerCase(),
  )
  const isAdmin =
    profile.is_admin === true ||
    profile.is_superadmin === true ||
    roles.some((role) => ['admin', 'superadmin', 'ceo', 'owner'].includes(role))
  const isBroadcasterOrTroller =
    profile.is_broadcaster === true ||
    profile.is_troller === true ||
    roles.some((role) => role === 'broadcaster' || role === 'troller')

  return (
    isAdmin ||
    (!isBroadcasterOrTroller && roles.some((role) => RTC_STAFF_ROLES.includes(role)))
  )
}
