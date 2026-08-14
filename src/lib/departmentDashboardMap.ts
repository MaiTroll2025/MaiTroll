import React from 'react'

import OfficerDashboard from '@/pages/officer/OfficerDashboard'
import OfficerOWCDashboard from '@/pages/OfficerOWCDashboard'
import OfficerVote from '@/pages/OfficerVote'
import LeadOfficerDashboard from '@/pages/lead-officer/LeadOfficerDashboard'
import CEOAssistantDashboard from '@/pages/ceo-assistant-dashboard'
import SecretaryConsole from '@/pages/secretary/SecretaryConsole'
import PastorDashboard from '@/pages/church/PastorDashboard'
import AttorneyDashboard from '@/pages/attorney/AttorneyDashboard'
import ProsecutorDashboard from '@/pages/prosecutor/ProsecutorDashboard'
import OfficerModeration from '@/pages/OfficerModeration'
import TrollOfficerLounge from '@/pages/TrollOfficerLounge'
import OfficerScheduling from '@/pages/OfficerScheduling'
import PresidentDashboard from '@/pages/president/PresidentDashboard'
import SecretaryDashboard from '@/pages/president/SecretaryDashboard'
import TreasuryDashboard from '@/pages/TreasuryDashboard'
import AgencyHRDashboard from '@/pages/agency-hr-dashboard'
import HRCenter from '@/pages/HRCenter'
import TCNNInternalDashboard from '@/pages/tcnn/TCNNInternalDashboard'
import AuctionStudio from '@/pages/auction/AuctionStudio'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import NotaryDashboard from '@/pages/NotaryDashboard'

export interface RoleDashboardEntry {
  role: string
  label: string
  component: React.ComponentType<any>
  requiresDepartment?: boolean
}

export const DEPARTMENT_DASHBOARD_MAP: RoleDashboardEntry[] = [
  {
    role: 'troll_officer',
    label: 'Troll Officer',
    component: OfficerDashboard,
  },
  {
    role: 'lead_troll_officer',
    label: 'Lead Officer',
    component: LeadOfficerDashboard,
  },
  {
    role: 'secretary',
    label: 'Secretary',
    component: SecretaryConsole,
  },
  {
    role: 'ceo',
    label: 'CEO',
    component: CEOAssistantDashboard,
  },
  {
    role: 'ceo_assistant',
    label: 'CEO Assistant',
    component: CEOAssistantDashboard,
  },
  {
    role: 'noah_assistant',
    label: 'Noah Assistant',
    component: CEOAssistantDashboard,
  },
  {
    role: 'pastor',
    label: 'Pastor',
    component: PastorDashboard,
  },
  {
    role: 'attorney',
    label: 'Attorney',
    component: AttorneyDashboard,
  },
  {
    role: 'notary',
    label: 'Notary',
    component: NotaryDashboard,
  },
  {
    role: 'prosecutor',
    label: 'Prosecutor',
    component: ProsecutorDashboard,
  },
  {
    role: 'president',
    label: 'President',
    component: PresidentDashboard,
  },
  {
    role: 'vice_president',
    label: 'Vice President',
    component: SecretaryDashboard,
  },
  {
    role: 'troll_city_secretary',
    label: 'City Secretary',
    component: SecretaryConsole,
  },
  {
    role: 'troll_city_treasurer',
    label: 'Treasurer',
    component: TreasuryDashboard,
  },
  {
    role: 'executive_secretary',
    label: 'Executive Secretary',
    component: SecretaryConsole,
  },
  {
    role: 'moderator',
    label: 'Moderator',
    component: OfficerModeration,
  },
  {
    role: 'agency_hr_manager',
    label: 'Agency HR',
    component: AgencyHRDashboard,
  },
  {
    role: 'hr_admin',
    label: 'HR Admin',
    component: HRCenter,
  },
  {
    role: 'hr_manager',
    label: 'HR Manager',
    component: HRCenter,
  },
  {
    role: 'agency_hr',
    label: 'Agency HR',
    component: AgencyHRDashboard,
  },
  {
    role: 'journalist',
    label: 'Journalist',
    component: TCNNInternalDashboard,
  },
  {
    role: 'tcnn_news_caster',
    label: 'News Caster',
    component: TCNNInternalDashboard,
  },
  {
    role: 'tcnn_chief_news_caster',
    label: 'Chief News Caster',
    component: TCNNInternalDashboard,
  },
  {
    role: 'auctioneer',
    label: 'Auctioneer',
    component: AuctionStudio,
  },
  {
    role: 'broadcaster',
    label: 'Broadcaster',
    component: null,
    requiresDepartment: true,
  },
  {
    role: 'admin',
    label: 'Admin',
    component: AdminDashboard,
  },
  {
    role: 'superadmin',
    label: 'Super Admin',
    component: AdminDashboard,
  },
  {
    role: 'owner',
    label: 'Owner',
    component: AdminDashboard,
  },
]

export function getRoleDashboardEntry(role: string | null | undefined): RoleDashboardEntry | undefined {
  if (!role) return undefined
  const normalized = role.toLowerCase().trim()
  return DEPARTMENT_DASHBOARD_MAP.find((entry) => entry.role === normalized)
}

export function resolveDashboardComponent(role: string | null | undefined): React.ComponentType<any> | null {
  const entry = getRoleDashboardEntry(role)
  if (!entry) return null
  if (entry.requiresDepartment) return null
  return entry.component
}

export function getRoleLabel(role: string | null | undefined): string {
  const entry = getRoleDashboardEntry(role)
  return entry?.label || role || 'Unknown Role'
}

export function getAvailableDashboardRoles(userRoles: string[]): string[] {
  const uniqueRoles = new Set(userRoles.map((r) => r.toLowerCase().trim()))
  return DEPARTMENT_DASHBOARD_MAP.filter((entry) => uniqueRoles.has(entry.role)).map((entry) => entry.role)
}
