import type { UserProfile } from './supabase'

const RTC_STAFF_ROLES = [
  'admin',
  'moderator',
  'troll_officer',
  'lead_troll_officer',
  'secretary',
  'officer',
  'hr_admin',
  'agency_hr_manager',
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
  'agency_hr',
  'agency_leader',
  'ceo_assistant',
  'noah_assistant',
]

export function canAccessRtcAdminMonitor(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false

  const roles = [profile.role, profile.troll_role].map((role) =>
    String(role || '').toLowerCase(),
  )
  const isBroadcasterOrTroller =
    profile.is_broadcaster === true ||
    profile.is_troller === true ||
    roles.some((role) => role === 'broadcaster' || role === 'troller')

  return (
    !isBroadcasterOrTroller &&
    (profile.is_admin === true || roles.some((role) => RTC_STAFF_ROLES.includes(role)))
  )
}
