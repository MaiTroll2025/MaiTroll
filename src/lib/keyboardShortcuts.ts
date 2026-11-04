import type { UserProfile } from '@/lib/supabase'

export type KeyboardShortcut = {
  key: string
  label: string
  path?: string
  phone?: boolean
  staffOnly?: boolean
  adminOnly?: boolean
}

const shortcuts: KeyboardShortcut[] = [
  { key: 'P', label: 'Open MaiElite Phone', phone: true },
  { key: 'E', label: 'Explore MaiTroll', path: '/explore' },
  { key: 'D', label: 'District Tour', path: '/district/main_plaza' },
  { key: 'C', label: 'City Hall', path: '/city-hall' },
  { key: 'S', label: 'Marketplace', path: '/marketplace' },
  { key: 'G', label: 'Government', path: '/government' },
  { key: 'M', label: 'Utromail', path: '/utromail' },
  { key: 'T', label: 'Department Tools', path: '/department-tools', staffOnly: true },
  { key: 'A', label: 'Admin Dashboard', path: '/admin', adminOnly: true },
  { key: 'R', label: 'RTC Admin Monitor', path: '/rtcadminmonitor', adminOnly: true },
]

export function getKeyboardShortcuts(profile: UserProfile | null | undefined): KeyboardShortcut[] {
  const role = String(profile?.role || '').toLowerCase()
  const trollRole = String(profile?.troll_role || '').toLowerCase()
  const isAdmin = Boolean(
    profile?.is_admin ||
    ['admin', 'superadmin', 'owner', 'ceo'].includes(role) ||
    ['admin', 'superadmin', 'ceo'].includes(trollRole),
  )
  const isStaff = Boolean(
    isAdmin ||
    profile?.is_lead_officer ||
    profile?.is_troll_officer ||
    ['staff', 'moderator', 'secretary'].includes(role),
  )

  return shortcuts.filter((shortcut) =>
    (!shortcut.staffOnly || isStaff) &&
    (!shortcut.adminOnly || isAdmin),
  )
}
