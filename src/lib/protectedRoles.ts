const PROTECTED_ROLE_TYPES = new Set([
  'troll_officer',
  'lead_troll_officer',
  'admin',
  'ceo_assistant',
  'secretary',
  'prosecutor',
  'attorney',
  'judge',
  'court_officer',
  'pastor',
  'journalist',
  'news_caster',
  'chief_news_caster',
  'agency_leader',
  'agency_hr',
  'agency_hr_manager',
  'noah_assistant',
  'owner',
  'superadmin',
  'staff',
  'moderator',
  'president',
  'vice_president',
  'ceo',
])

const PROTECTED_ROLE_NAMES = new Set([
  'Troll Officer',
  'Lead Troll Officer',
  'Admin',
  'CEO Assistant',
  'Secretary',
  'Prosecutor',
  'Attorney',
  'Judge',
  'Court Officer',
  'Pastor',
  'Journalist',
  'News Caster',
  'Chief News Caster',
  'Agency Leader',
  'Agency HR',
  'Agency HR Manager',
  'Noah Assistant',
  'Owner',
  'Superadmin',
  'Staff',
  'Moderator',
  'President',
  'Vice President',
  'CEO',
])

export function isProtectedPlatformRole(profile: any): boolean {
  if (!profile) return false

  const role = String(profile.role || '').toLowerCase().trim()
  const trollRole = String(profile.troll_role || '').toLowerCase().trim()

  if (PROTECTED_ROLE_TYPES.has(role)) return true
  if (PROTECTED_ROLE_TYPES.has(trollRole)) return true

  if (profile.is_admin || profile.is_superadmin || profile.is_ceo) return true
  if (profile.is_staff || profile.is_troll_officer || profile.is_lead_officer) return true

  const displayName = String(profile.username || profile.display_name || '').trim()
  if (displayName && PROTECTED_ROLE_NAMES.has(displayName)) return true

  return false
}

export function getProtectedRoleReason(profile: any): string | null {
  if (!profile) return null

  const role = String(profile.role || '').toLowerCase().trim()
  const trollRole = String(profile.troll_role || '').toLowerCase().trim()

  if (PROTECTED_ROLE_TYPES.has(role)) return `Protected platform role: ${profile.role}`
  if (PROTECTED_ROLE_TYPES.has(trollRole)) return `Protected platform role: ${profile.troll_role}`

  if (profile.is_admin) return 'Protected platform role: admin'
  if (profile.is_superadmin) return 'Protected platform role: superadmin'
  if (profile.is_ceo) return 'Protected platform role: ceo'

  return null
}
