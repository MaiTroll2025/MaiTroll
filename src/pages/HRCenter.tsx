import React, { useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { UserRole } from '@/lib/supabase'
import useSEO from '@/hooks/useSEO'
import {
  LayoutGrid,
  FileText,
  User,
  Clock,
  DollarSign,
  CalendarOff,
  BookOpen,
  HelpCircle,
  Shield,
} from 'lucide-react'

import ApplicationsPanel from '@/components/hr/ApplicationsPanel'
import EmployeeProfilePanel from '@/components/hr/EmployeeProfilePanel'
import ClockInPanel from '@/components/hr/ClockInPanel'
import PayrollPanel from '@/components/hr/PayrollPanel'
import TimeOffPanel from '@/components/hr/TimeOffPanel'
import HandbookPanel from '@/components/hr/HandbookPanel'
import HRResourcesPanel from '@/components/hr/HRResourcesPanel'
import RoleManagementPanel from '@/components/hr/RoleManagementPanel'

type TabId =
  | 'overview'
  | 'applications'
  | 'my-role'
  | 'clock-in'
  | 'payroll'
  | 'time-off'
  | 'handbook'
  | 'resources'
  | 'hr-admin'

const TAB_DEFINITIONS: Array<{ id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'applications', label: 'Applications', icon: FileText },
  { id: 'my-role', label: 'My Role', icon: User },
  { id: 'clock-in', label: 'Clock In', icon: Clock },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'time-off', label: 'Time Off', icon: CalendarOff },
  { id: 'handbook', label: 'Handbook', icon: BookOpen },
  { id: 'resources', label: 'Resources', icon: HelpCircle },
  { id: 'hr-admin', label: 'HR Admin', icon: Shield, adminOnly: true },
]

export default function HRCenter() {
  const { user, profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  useSEO({
    title: 'HR Center | Mai Troll',
    description: 'MaiTroll HR Center — applications, time tracking, payroll, time off, handbook, and role management.',
    keywords: ['HR Center', 'MaiTroll HR', 'applications', 'payroll', 'time clock', 'time off'],
  })

  const role = String(profile?.role || '')
  const trollRole = String(profile?.troll_role || '')

  const isAdmin =
    profile?.is_admin === true ||
    role === UserRole.ADMIN ||
    role === 'superadmin' ||
    role === 'ceo' ||
    trollRole === UserRole.ADMIN ||
    trollRole === 'superadmin' ||
    trollRole === 'ceo' ||
    (profile as any)?.is_superadmin === true

  const isHRAdmin =
    isAdmin ||
    role === UserRole.HR_ADMIN ||
    role === UserRole.HR_MANAGER ||
    role === UserRole.AGENCY_HR_MANAGER ||
    trollRole === UserRole.HR_ADMIN ||
    trollRole === UserRole.HR_MANAGER ||
    trollRole === UserRole.AGENCY_HR_MANAGER ||
    (profile as any)?.is_hr_admin === true ||
    (profile as any)?.is_agency_hr_manager === true

  const hasApprovedRole = useMemo(() => {
    const approvedRoles = [
      'troll_officer', 'lead_troll_officer', 'pastor', 'agency_hr', 'agency_hr_manager',
      'agency_leader', 'secretary', 'attorney', 'prosecutor', 'journalist', 'tcnn_news_caster',
      'tcnn_chief_news_caster', 'auctioneer', 'troller', 'ceo_assistant', 'noah_assistant',
      'hr_manager', 'hr_admin',
    ]
    if (approvedRoles.includes(role) || approvedRoles.includes(trollRole)) return true

    const p = profile as any
    const booleanFlags: boolean[] = [
      p?.is_troll_officer,
      p?.is_lead_officer,
      p?.is_pastor,
      p?.is_agency_hr,
      p?.is_agency_hr_manager,
      p?.is_agency_leader,
      p?.is_secretary,
      p?.is_attorney,
      p?.is_prosecutor,
      p?.is_journalist,
      p?.is_news_caster,
      p?.is_chief_news_caster,
      p?.is_auctioneer,
      p?.is_troller,
      p?.is_ceo_assistant,
      p?.is_noah_assistant,
      p?.is_hr_admin,
    ].filter(Boolean)

    return booleanFlags.length > 0
  }, [role, trollRole, profile])

  const visibleTabs = useMemo(() => {
    return TAB_DEFINITIONS.filter(tab => {
      if (tab.adminOnly && !isHRAdmin) return false
      return true
    })
  }, [isHRAdmin])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-white">Welcome to HR Center</h3>
              <p className="text-xs text-slate-400">
                Mai Troll's central hub for employment, roles, payroll, time tracking, and HR resources.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Your Role</p>
                <p className="mt-2 text-xl font-black text-white">
                  {hasApprovedRole ? (role || trollRole || 'Approved') : 'No Active Role'}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Status</p>
                <p className={`mt-2 text-xl font-black ${hasApprovedRole ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {hasApprovedRole ? 'Active' : 'Pending'}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">HR Access</p>
                <p className={`mt-2 text-xl font-black ${isHRAdmin ? 'text-cyan-300' : 'text-slate-300'}`}>
                  {isHRAdmin ? 'Authorized' : 'Standard User'}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Platform</p>
                <p className="mt-2 text-xl font-black text-purple-300">Mai Troll</p>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-300/10 bg-cyan-500/5 p-5">
              <h4 className="text-sm font-bold text-cyan-100">About Mai Troll HR Center</h4>
              <p className="mt-2 text-xs text-slate-300">
                Mai Troll uses its own proprietary internal HR and payroll management system for approved platform roles,
                applications, time tracking, payroll records, and HR resources. All employment logic — including role
                applications, clock-in/out, payroll, time off, handbook, and HR resources — is centralized here in HR Center.
              </p>
            </div>

            {!hasApprovedRole && (
              <div className="rounded-3xl border border-amber-300/20 bg-amber-500/5 p-5">
                <h4 className="text-sm font-bold text-amber-100">Get Started</h4>
                <p className="mt-1 text-xs text-amber-200/80">
                  Apply for a role through the Jobs page or the Applications tab. Once approved, you will gain access
                  to clock-in, payroll, time off, and other HR features.
                </p>
              </div>
            )}
          </div>
        )
      case 'applications':
        return <ApplicationsPanel isHRAdmin={isHRAdmin} currentUserId={user?.id} />
      case 'my-role':
        return <EmployeeProfilePanel isHRAdmin={isHRAdmin} currentUserId={user?.id} />
      case 'clock-in':
        return <ClockInPanel isHRAdmin={isHRAdmin} currentUserId={user?.id} hasApprovedRole={hasApprovedRole} />
      case 'payroll':
        return <PayrollPanel isHRAdmin={isHRAdmin} currentUserId={user?.id} />
      case 'time-off':
        return <TimeOffPanel isHRAdmin={isHRAdmin} currentUserId={user?.id} hasApprovedRole={hasApprovedRole} />
      case 'handbook':
        return <HandbookPanel />
      case 'resources':
        return <HRResourcesPanel />
      case 'hr-admin':
        return isHRAdmin ? <RoleManagementPanel isHRAdmin={isHRAdmin} currentUserId={user?.id} /> : null
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-y-auto overflow-x-hidden md:overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-500/10">
              <Shield className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">HR Center</h1>
              <p className="text-xs text-slate-400">Mai Troll Employment · Roles · Payroll · Resources</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                  isActive
                    ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-50'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl sm:p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}
