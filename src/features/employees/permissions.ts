import type { ComponentType } from 'react'
import {
  LayoutDashboard, MessagesSquare, ListTodo, FileText,
  Megaphone, Palette, Wrench, Shield, UserPlus, Users, BadgeCheck, AlertTriangle, ShieldAlert,
} from 'lucide-react'

export type EmployeeAction =
  | 'publish_frontend'
  | 'hire'
  | 'fire'
  | 'manage_reports'
  | 'manage_announcements'
  | 'view_management'
  | 'admin_preview'
  | 'view_records'
  | 'assign_tasks'

export type EmployeeTabId =
  | 'home' | 'chat' | 'tasks' | 'reports'
  | 'announcements' | 'frontend_studio'
  | 'department_tools' | 'moderation' | 'mod_actions' | 'management' | 'hiring'
  | 'employment_verification' | 'documents'

export interface EmployeeTab {
  id: EmployeeTabId
  label: string
  icon: ComponentType<{ className?: string }>
  /** Returns true if this tab should be visible for the given profile. */
  show: (p: EmployeeProfileLike) => boolean
}

export interface EmployeeProfileLike {
  role?: string | null
  troll_role?: string | null
  is_admin?: boolean | null
  is_lead_officer?: boolean | null
  is_troll_officer?: boolean | null
  is_secretary?: boolean | null
  is_ceo_assistant?: boolean | null
  is_noah_assistant?: boolean | null
  username?: string | null
}

const ADMIN_ROLES = ['admin', 'superadmin']

export function isAdmin(p?: EmployeeProfileLike | null): boolean {
  if (!p) return false
  return Boolean(p.is_admin) || ADMIN_ROLES.includes(p.role ?? '') || p.troll_role === 'admin'
}

export function isLead(p?: EmployeeProfileLike | null): boolean {
  if (!p) return false
  return Boolean(p.is_lead_officer) || p.role === 'lead_troll_officer'
}

export function isTrollOfficer(p?: EmployeeProfileLike | null): boolean {
  if (!p) return false
  return Boolean(p.is_troll_officer) || p.role === 'troll_officer'
}

export function isAssistant(p?: EmployeeProfileLike | null): boolean {
  if (!p) return false
  return (
    Boolean(p.is_secretary) || p.role === 'secretary' ||
    Boolean(p.is_ceo_assistant) || p.role === 'ceo_assistant' ||
    Boolean(p.is_noah_assistant) || p.role === 'noah_assistant'
  )
}

export function isSecretary(p?: EmployeeProfileLike | null): boolean {
  return Boolean(p?.is_secretary) || p?.role === 'secretary'
}

// Approved employee roles allowed into /Employees (mirrors HRCenter hasApprovedRole).
const APPROVED_ROLES = new Set([
  'troll_officer', 'lead_troll_officer', 'secretary', 'ceo_assistant', 'noah_assistant',
  'hr_admin', 'hr_manager', 'agency_hr_manager', 'pastor', 'agency_leader', 'attorney',
  'prosecutor', 'journalist', 'auctioneer', 'troller', 'agency_hr', 'president',
  'vice_president', 'troll_city_secretary', 'troll_city_treasurer', 'executive_secretary',
  'academy_teacher', 'admissions_officer',
])

export function isEmployeeProfile(p?: EmployeeProfileLike | null): boolean {
  if (!p) return false
  if (isAdmin(p)) return true
  if (isLead(p) || isTrollOfficer(p) || isAssistant(p)) return true
  if (APPROVED_ROLES.has(p.role ?? '')) return true
  return false
}

/** Client-side permission mirror. Server RLS/RPC is the real enforcement. */
export function canEmployee(p: EmployeeProfileLike | null | undefined, action: EmployeeAction): boolean {
  if (!p) return false
  if (isAdmin(p)) return true
  switch (action) {
    case 'publish_frontend':
      return p.role === 'secretary' || /dev|design|developer/i.test(p.role ?? '')
    case 'hire':
    case 'fire':
      return isLead(p)
    case 'manage_reports':
      return isLead(p) || isAssistant(p)
    case 'manage_announcements':
      return isLead(p) || isSecretary(p) || p.role === 'ceo'
    case 'view_management':
      return isLead(p) || isAssistant(p) || p.role === 'ceo'
    case 'admin_preview':
      return isAdmin(p)
    case 'view_records':
      return isLead(p) || isSecretary(p) || p.role === 'ceo'
    case 'assign_tasks':
      return isLead(p) || isAssistant(p) || p.role === 'ceo'
    default:
      return false
  }
}

const all = () => true
const officerTools = (p: EmployeeProfileLike) =>
  isTrollOfficer(p) || isLead(p) || isAdmin(p)

const canSeeModeration = (p: EmployeeProfileLike) => {
  if (isAdmin(p)) return true
  if (isTrollOfficer(p)) return true
  if (isLead(p)) return true
  if (p.role === 'moderator') return true
  if (p.troll_role === 'moderator') return true
  return false
}

export const EMPLOYEE_TABS: EmployeeTab[] = [
  { id: 'home', label: 'Staff Home', icon: LayoutDashboard, show: all },
  { id: 'chat', label: 'Chat', icon: MessagesSquare, show: all },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, show: all },
  { id: 'reports', label: 'Reports', icon: FileText, show: all },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, show: all },
  {
    id: 'frontend_studio', label: 'Frontend Studio', icon: Palette,
    show: (p) => canEmployee(p, 'publish_frontend') || isAdmin(p),
  },
  { id: 'department_tools', label: 'Department Tools', icon: Wrench, show: officerTools },
  {
    id: 'moderation', label: 'Moderation', icon: AlertTriangle,
    show: canSeeModeration,
  },
  {
    id: 'mod_actions', label: 'Mod Actions', icon: ShieldAlert,
    show: canSeeModeration,
  },
  {
    id: 'management', label: 'Management', icon: Shield,
    show: (p) => canEmployee(p, 'view_management') || isLead(p) || isAssistant(p),
  },
  {
    id: 'hiring', label: 'Hiring', icon: UserPlus,
    show: (p) => isLead(p) || isAssistant(p) || isAdmin(p),
  },
  {
    id: 'employment_verification', label: 'Verification', icon: BadgeCheck,
    show: all,
  },
  {
    id: 'documents', label: 'Documents', icon: FileText,
    show: all,
  },
]

export function getEmployeeTabs(p?: EmployeeProfileLike | null): EmployeeTab[] {
  if (!p) return EMPLOYEE_TABS.filter((t) => t.show({} as EmployeeProfileLike))
  return EMPLOYEE_TABS.filter((t) => t.show(p))
}

export const EMPLOYEE_CORP = 'MAI CORP'
export const EMPLOYEE_BUSINESS = 'MaiMaiTroll'
