import React, { Suspense, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/store'
import { hasRole } from '@/lib/supabase'
import AttorneyDashboard from '@/pages/attorney/AttorneyDashboard'
import ProsecutorDashboard from '@/pages/prosecutor/ProsecutorDashboard'
import OfficerDashboard from '@/pages/officer/OfficerDashboard'
import LeadOfficerDashboard from '@/pages/lead-officer/LeadOfficerDashboard'
import SecretaryConsole from '@/pages/secretary/SecretaryConsole'
import PastorDashboard from '@/pages/church/PastorDashboard'
import AuctioneerDashboard from '@/pages/auction/AuctioneerDashboard'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import CeoAssistantDashboard from '@/pages/ceo-assistant-dashboard'

const ROLE_SWITCHER_ROLES = [
  'troll_officer',
  'lead_troll_officer',
  'secretary',
  'ceo_assistant',
  'noah_assistant',
  'pastor',
  'attorney',
  'prosecutor',
  'moderator',
  'hr_admin',
  'journalist',
  'auctioneer',
  'admin',
]

const DASHBOARD_COMPONENTS: Record<string, React.ComponentType<any>> = {
  attorney: AttorneyDashboard,
  prosecutor: ProsecutorDashboard,
  'troll-officer': OfficerDashboard,
  'lead-troll-officer': LeadOfficerDashboard,
  secretary: SecretaryConsole,
  'ceo-assistant': CeoAssistantDashboard,
  'noah-assistant': CeoAssistantDashboard,
  pastor: PastorDashboard,
  'hr-admin': CeoAssistantDashboard,
  journalist: CeoAssistantDashboard,
  auctioneer: AuctioneerDashboard,
  admin: AdminDashboard,
}

const ROLE_LABELS: Record<string, string> = {
  attorney: 'Attorney',
  prosecutor: 'Prosecutor',
  'troll-officer': 'Troll Officer',
  'lead-troll-officer': 'Lead Troll Officer',
  secretary: 'Secretary',
  'ceo-assistant': 'CEO Assistant',
  'noah-assistant': 'Noah Assistant',
  pastor: 'Pastor',
  'hr-admin': 'HR Admin',
  journalist: 'Journalist',
  auctioneer: 'Auctioneer',
  admin: 'Admin',
}

function getAvailableDashboardRoles(userRoles: string[]): string[] {
  return userRoles.filter((r) => r in DASHBOARD_COMPONENTS)
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

function resolveDashboardComponent(role: string) {
  return DASHBOARD_COMPONENTS[role] || null
}

function RoleSwitcher({ currentRole, availableRoles, onSwitch }: { currentRole: string; availableRoles: string[]; onSwitch: (role: string) => void }) {
  const validOptions = availableRoles.filter((r) => ROLE_SWITCHER_ROLES.includes(r))
  if (validOptions.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Active Role:</label>
      <select
        value={currentRole}
        onChange={(e) => onSwitch(e.target.value)}
        className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-white outline-none transition focus:border-cyan-300/45"
      >
        {validOptions.map((role) => (
          <option key={role} value={role}>
            {getRoleLabel(role)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function DepartmentToolsPage() {
  const _navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile } = useAuthStore()

  const queryRole = searchParams.get('role')?.toLowerCase().trim() || undefined
  const [activeRole, setActiveRole] = useState<string | undefined>(queryRole)

  const userRoles = useMemo(() => {
    if (!profile) return []
    const roles: string[] = []
    if (profile.role) roles.push(profile.role)
    if (profile.troll_role) roles.push(profile.troll_role)
    if (profile.is_troll_officer) roles.push('troll_officer')
    if (profile.is_lead_officer) roles.push('lead_troll_officer')
    if (profile.is_secretary) roles.push('secretary')
    if (profile.is_ceo_assistant) roles.push('ceo_assistant')
    if (profile.is_noah_assistant) roles.push('noah_assistant')
    if (profile.is_pastor) roles.push('pastor')
    if (profile.is_attorney) roles.push('attorney')
    if (profile.is_prosecutor) roles.push('prosecutor')
    if (profile.is_judge) roles.push('judge')
    if (profile.is_broadcaster) roles.push('broadcaster')
    if (profile.is_journalist) roles.push('journalist')
    if (profile.is_news_caster) roles.push('tcnn_news_caster')
    if (profile.is_chief_news_caster) roles.push('tcnn_chief_news_caster')
    if (profile.is_hr_admin) roles.push('hr_admin')
    if (profile.is_admin) roles.push('admin')
    if (profile.is_superadmin) roles.push('superadmin')
    if (profile.is_ceo) roles.push('ceo')
    if (profile.is_owner) roles.push('owner')

    const isGodMode =
      profile.is_admin === true ||
      profile.is_superadmin === true ||
      profile.is_owner === true ||
      profile.is_ceo === true ||
      profile.role === 'admin' ||
      profile.role === 'superadmin' ||
      profile.role === 'owner' ||
      profile.role === 'ceo'
    if (isGodMode) {
      const executiveRoles = ['secretary', 'ceo_assistant', 'noah_assistant']
      executiveRoles.forEach((r) => {
        if (!roles.includes(r)) roles.push(r)
      })
    }
    return roles
  }, [profile])

  const availableRoles = useMemo(() => getAvailableDashboardRoles(userRoles), [userRoles])

  const resolvedRole = useMemo(() => {
    if (activeRole && availableRoles.includes(activeRole)) {
      return activeRole
    }
    if (availableRoles.length > 0) {
      return availableRoles[0]
    }
    return undefined
  }, [activeRole, availableRoles])

  const ActiveDashboard = useMemo(() => {
    if (!resolvedRole) return null
    return resolveDashboardComponent(resolvedRole)
  }, [resolvedRole])

  const handleRoleSwitch = (role: string) => {
    if (!availableRoles.includes(role)) {
      toast.error('You do not have access to this role.')
      return
    }
    setActiveRole(role)
    setSearchParams((prev) => {
      prev.set('role', role)
      return prev
    }, { replace: true })
  }

  const canAccessResolvedRole = useMemo(() => {
    if (!resolvedRole || !profile) return false
    return hasRole(profile, resolvedRole as any)
  }, [resolvedRole, profile])

  if (!user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
          <h1 className="text-2xl font-bold">Department Tools</h1>
          <p className="mt-2 text-sm text-slate-400">Please sign in to access department tools.</p>
        </div>
      </div>
    )
  }

  if (!canAccessResolvedRole && availableRoles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
          <h1 className="text-2xl font-bold">Department Tools</h1>
          <p className="mt-2 text-sm text-slate-400">You do not currently have an assigned department role.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto max-w-[1500px] flex flex-col gap-4 p-3 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white md:text-3xl">Department Tools</h1>
            <p className="mt-1 text-sm text-slate-400">
              {resolvedRole ? getRoleLabel(resolvedRole) : 'No active role'} — Role-specific dashboard and tools.
            </p>
          </div>
          <RoleSwitcher currentRole={resolvedRole || ''} availableRoles={availableRoles} onSwitch={handleRoleSwitch} />
        </div>

        <div className="min-w-0 flex-1">
          {ActiveDashboard ? (
            <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-slate-400">Loading dashboard...</div>}>
              <ActiveDashboard profile={profile} realProfile={profile} />
            </Suspense>
          ) : (
            <div className="flex min-h-[380px] items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-center">
              <div>
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_28px_rgba(45,212,191,0.16)]">
                  <span className="text-3xl">🏢</span>
                </div>
                <h3 className="text-2xl font-black text-white">No Department Dashboard</h3>
                <p className="mt-2 text-sm text-slate-400">
                  You do not currently have an assigned department role. Contact leadership to be assigned to a department.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
