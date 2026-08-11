import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  HandHeart,
  Search,
  Shield,
  Users,
  XCircle,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  getEmployeeTabs,
  isAdmin,
  isEmployeeProfile,
  type EmployeeProfileLike,
  type EmployeeTabId,
} from './permissions'

type StaffRole = {
  id: string
  roleKey: string
  title: string
  category: string
  description: string
  responsibilities: string[]
  powers: string[]
  requirements: string[]
  activeCount: number
}

type StaffMember = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string | null
  troll_role: string | null
  is_active: boolean | null
  is_admin: boolean | null
  created_at: string | null
}

const STAFF_ROLES: StaffRole[] = [
  {
    id: 'lead_troll_officer',
    roleKey: 'lead_troll_officer',
    title: 'Lead Troll Officer',
    category: 'Enforcement',
    description: 'Coordinate Troll Officers and support community safety actions across Mai Troll.',
    responsibilities: [
      'Guide Troll Officers',
      'Assist with escalated community safety situations',
      'Follow Mai Troll rules and internal procedures',
    ],
    powers: ['Role-based moderation and officer tools assigned by Mai Troll'],
    requirements: ['Good judgment', 'Responsible use of platform powers', 'Ability to remain fair during disputes'],
    activeCount: 0,
  },
  {
    id: 'troll_officer',
    roleKey: 'troll_officer',
    title: 'Troll Officer',
    category: 'Enforcement',
    description: 'Help with community safety, reports, and role-specific enforcement tools inside Mai Troll.',
    responsibilities: [
      'Help respond to community issues',
      'Use officer powers only for approved purposes',
      'Document or escalate serious situations when required',
    ],
    powers: ['Officer tools and permissions assigned by Mai Troll'],
    requirements: ['Fair judgment', 'Respect for users', 'Responsible use of platform permissions'],
    activeCount: 0,
  },
  {
    id: 'secretary',
    roleKey: 'secretary',
    title: 'Secretary',
    category: 'Administration',
    description: 'Help organize community information, notices, records, and role-related administrative tasks.',
    responsibilities: ['Help organize notices and records', 'Support approved administrative workflows', 'Keep information accurate'],
    powers: ['Secretary tools and permissions assigned by Mai Troll'],
    requirements: ['Organization', 'Attention to detail', 'Good communication'],
    activeCount: 0,
  },
  {
    id: 'ceo_assistant',
    roleKey: 'ceo_assistant',
    title: 'CEO Assistant',
    category: 'Executive Support',
    description: 'Provide assistance with approved Mai Troll executive and platform support tasks.',
    responsibilities: ['Help with approved support tasks', 'Keep assigned information organized', 'Follow platform instructions'],
    powers: ['CEO Assistant permissions assigned by Mai Troll'],
    requirements: ['Reliability', 'Organization', 'Discretion'],
    activeCount: 0,
  },
  {
    id: 'noah_assistant',
    roleKey: 'noah_assistant',
    title: 'Noah Assistant',
    category: 'Executive Support',
    description: 'Provide volunteer assistance with approved Noah-related Mai Troll support tasks.',
    responsibilities: ['Help with approved assigned tasks', 'Keep information organized', 'Use permissions only as intended'],
    powers: ['Noah Assistant permissions assigned by Mai Troll'],
    requirements: ['Reliability', 'Organization', 'Discretion'],
    activeCount: 0,
  },
  {
    id: 'broadofficer',
    roleKey: 'broadofficer',
    title: 'Broadcast Officer',
    category: 'Broadcast Operations',
    description: 'Help manage approved broadcast streams and support broadcaster workflows.',
    responsibilities: ['Support approved broadcast management', 'Follow broadcast rules', 'Use broadcast tools responsibly'],
    powers: ['Broadcast officer permissions assigned by Mai Troll'],
    requirements: ['Reliability', 'Good communication', 'Ability to follow broadcast procedures'],
    activeCount: 0,
  },
  {
    id: 'broadcaster',
    roleKey: 'broadcaster',
    title: 'Broadcaster',
    category: 'Broadcast Operations',
    description: 'Create and manage approved live broadcast content on Mai Troll.',
    responsibilities: ['Follow broadcast guidelines', 'Engage community appropriately', 'Use broadcasting tools responsibly'],
    powers: ['Broadcaster permissions assigned by Mai Troll'],
    requirements: ['Good standing', 'Responsible conduct', 'Ability to follow platform rules'],
    activeCount: 0,
  },
  {
    id: 'prosecutor',
    roleKey: 'prosecutor',
    title: 'Prosecutor',
    category: 'Troll Court',
    description: 'Participate in Mai Troll court features as a prosecutor role.',
    responsibilities: ['Review eligible Troll Court matters', 'Present the prosecution side', 'Follow Troll Court procedures'],
    powers: ['Troll Court prosecutor permissions assigned by Mai Troll'],
    requirements: ['Fairness', 'Clear communication', 'Ability to follow platform court procedures'],
    activeCount: 0,
  },
  {
    id: 'attorney',
    roleKey: 'attorney',
    title: 'Attorney',
    category: 'Troll Court',
    description: 'Participate in Mai Troll court features as an attorney role.',
    responsibilities: ['Help users within Troll Court features', 'Present arguments in eligible cases', 'Follow Troll Court procedures'],
    powers: ['Troll Court attorney permissions assigned by Mai Troll'],
    requirements: ['Clear communication', 'Fairness', 'Ability to understand platform court rules'],
    activeCount: 0,
  },
  {
    id: 'judge',
    roleKey: 'judge',
    title: 'Judge',
    category: 'Troll Court',
    description: 'Help oversee eligible Troll Court proceedings and make platform decisions within the assigned court powers.',
    responsibilities: ['Review eligible cases', 'Remain neutral', 'Apply Mai Troll court rules consistently'],
    powers: ['Judge permissions within Troll Court assigned by Mai Troll'],
    requirements: ['Strong judgment', 'Neutrality', 'Ability to make fair platform decisions'],
    activeCount: 0,
  },
  {
    id: 'pastor',
    roleKey: 'pastor',
    title: 'Pastor',
    category: 'Community',
    description: 'Support the voluntary community and church-style features available inside Mai Troll.',
    responsibilities: ['Support approved community activities', 'Treat users respectfully', 'Follow platform rules'],
    powers: ['Pastor/community permissions assigned by Mai Troll'],
    requirements: ['Respectful communication', 'Community-minded behavior', 'Reliable conduct'],
    activeCount: 0,
  },
  {
    id: 'journalist',
    roleKey: 'journalist',
    title: 'Journalist',
    category: 'News',
    description: 'Help create and report community stories for approved Mai Troll news features.',
    responsibilities: ['Cover approved community stories', 'Verify information before publishing', 'Follow news and platform rules'],
    powers: ['Journalist publishing tools assigned by Mai Troll'],
    requirements: ['Clear writing', 'Accuracy', 'Ability to separate facts from opinion'],
    activeCount: 0,
  },
  {
    id: 'auctioneer',
    roleKey: 'auctioneer',
    title: 'Auctioneer',
    category: 'Marketplace',
    description: 'Help host and manage approved auction activity inside Mai Troll.',
    responsibilities: ['Help run approved auctions', 'Keep auction activity organized', 'Follow marketplace rules'],
    powers: ['Auction tools and permissions assigned by Mai Troll'],
    requirements: ['Clear speaking', 'Organization', 'Understanding of auction rules'],
    activeCount: 0,
  },
]

export default function EmployeesPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const employeeProfile = profile as EmployeeProfileLike | null
  const authorizedTabs = useMemo(() => getEmployeeTabs(employeeProfile), [employeeProfile])

  const [activeTab, setActiveTab] = useState<EmployeeTabId>('home')
  const [previewRole, setPreviewRole] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('all')
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)

  const previewProfile = useMemo<EmployeeProfileLike | null>(() => {
    if (!employeeProfile) return null
    if (!previewRole) return employeeProfile
    return { ...employeeProfile, role: previewRole }
  }, [employeeProfile, previewRole])

  useEffect(() => {
    if (!authorizedTabs.length) return
    const activeTabIsAuthorized = authorizedTabs.some((tab) => tab.id === activeTab)
    if (!activeTabIsAuthorized) {
      const fallbackTab = authorizedTabs.find((tab) => tab.id === 'home') ?? authorizedTabs[0]
      if (fallbackTab) setActiveTab(fallbackTab.id)
    }
  }, [activeTab, authorizedTabs])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [activeTab])

  useEffect(() => {
    if (!isAdmin(employeeProfile)) {
      setPreviewRole(null)
    }
  }, [employeeProfile])

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, role, troll_role, is_active, created_at')
          .neq('role', null)
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) throw error
        if (!alive) return

        const rows = (data as StaffMember[]) || []
        setStaffMembers(rows)

        const counts: Record<string, number> = {}
        rows.forEach((r) => {
          const key = r.role || r.troll_role || ''
          if (key) counts[key] = (counts[key] || 0) + 1
        })
        STAFF_ROLES.forEach((role) => {
          role.activeCount = counts[role.roleKey] || 0
        })
      } catch (e) {
        console.error('Failed to load staff directory:', e)
      } finally {
        if (alive) setLoadingStaff(false)
      }
    })()
    return () => { alive = false }
  }, [user])

   const selectedStaffTab = useMemo(
    () => authorizedTabs.find((tab) => tab.id === activeTab) ?? authorizedTabs[0],
    [activeTab, authorizedTabs],
  )

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(STAFF_ROLES.map((role) => role.category)))],
    [],
  )

  const filteredRoles = useMemo(() => {
    const query = staffSearch.trim().toLowerCase()
    return STAFF_ROLES.filter((role) => {
      const matchesFilter = staffFilter === 'all' || role.category === staffFilter
      const matchesSearch =
        !query ||
        role.title.toLowerCase().includes(query) ||
        role.roleKey.toLowerCase().includes(query) ||
        role.category.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [staffSearch, staffFilter])

  const filteredStaff = useMemo(() => {
    const query = staffSearch.trim().toLowerCase()
    return staffMembers.filter((member) => {
      const roleKey = member.role || member.troll_role || ''
      const role = STAFF_ROLES.find((r) => r.roleKey === roleKey)
      if (!role) return false
      const matchesFilter = staffFilter === 'all' || role.category === staffFilter
      const matchesSearch =
        !query ||
        member.username.toLowerCase().includes(query) ||
        (member.display_name || '').toLowerCase().includes(query) ||
        role.title.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [staffMembers, staffSearch, staffFilter])

  const activeStaffCount = useMemo(() => staffMembers.filter((m) => m.is_active !== false).length, [staffMembers])
  const officerCount = useMemo(() => staffMembers.filter((m) => m.role === 'troll_officer' || m.role === 'lead_troll_officer').length, [staffMembers])
  const adminCount = useMemo(() => staffMembers.filter((m) => m.role === 'secretary' || m.role === 'ceo_assistant' || m.role === 'noah_assistant' || m.is_admin === true).length, [staffMembers])
  const broadcastCount = useMemo(() => staffMembers.filter((m) => m.role === 'broadcaster' || m.role === 'broadofficer').length, [staffMembers])

  if (!user) {
    return <StaffPortalLoading />
  }

  if (!isEmployeeProfile(employeeProfile)) {
    return <StaffAccessDenied />
  }

  if (!authorizedTabs.length) {
    return <NoStaffModules />
  }

  const handleTabChange = (tabId: EmployeeTabId) => {
    const hasAccess = authorizedTabs.some((tab) => tab.id === tabId)
    if (!hasAccess) {
      console.warn(`Blocked unauthorized staff tab navigation: ${tabId}`)
      return
    }
    setActiveTab(tabId)
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-[#180927] via-[#0A1222] to-[#111827] p-8 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-300">Platform Staff</span>
            </div>

            <h1 className="mb-4 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-500 bg-clip-text text-transparent">
                Mai Troll Staff
              </span>
            </h1>

            <p className="mx-auto max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
              Manage platform roles, responsibilities, permissions, and staff assignments.
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <Users className="mb-3 h-6 w-6 text-cyan-400" />
            <div className="text-3xl font-black">{activeStaffCount}</div>
            <div className="mt-1 text-sm text-zinc-500">Active Staff</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <Shield className="mb-3 h-6 w-6 text-amber-400" />
            <div className="text-3xl font-black">{officerCount}</div>
            <div className="mt-1 text-sm text-zinc-500">Platform Officers</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <BadgeCheck className="mb-3 h-6 w-6 text-violet-400" />
            <div className="text-3xl font-black">{adminCount}</div>
            <div className="mt-1 text-sm text-zinc-500">Administrative Staff</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
            <HandHeart className="mb-3 h-6 w-6 text-emerald-400" />
            <div className="text-3xl font-black">{broadcastCount}</div>
            <div className="mt-1 text-sm text-zinc-500">Broadcast Staff</div>
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search staff or roles..."
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#121212] py-3 pl-12 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setStaffFilter(category)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    staffFilter === category
                      ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/10 bg-[#121212] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {category === 'all' ? 'All Roles' : category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {filteredRoles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#121212] py-14 text-center">
              <Search className="mx-auto mb-4 h-10 w-10 text-zinc-700" />
              <p className="text-zinc-500">No staff roles match your search.</p>
            </div>
          ) : (
            filteredRoles.map((role) => (
              <div
                key={role.roleKey}
                className="rounded-3xl border border-white/10 bg-[#121212] p-6 transition hover:border-cyan-500/30 sm:p-7"
              >
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                  <div className="flex-1">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-black text-white">{role.title}</h3>
                      <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                        {role.category}
                      </span>
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300">
                        {role.activeCount} Active
                      </span>
                    </div>

                    <p className="max-w-4xl text-sm leading-6 text-zinc-400 sm:text-base">{role.description}</p>

                    <div className="mt-6 grid gap-5 lg:grid-cols-3">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                          <BadgeCheck className="h-4 w-4 text-cyan-400" />
                          Responsibilities
                        </div>
                        <ul className="space-y-2 text-sm text-zinc-400">
                          {role.responsibilities.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                          <Shield className="h-4 w-4 text-amber-400" />
                          Permissions
                        </div>
                        <ul className="space-y-2 text-sm text-zinc-400">
                          {role.powers.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                          <Users className="h-4 w-4 text-violet-400" />
                          Requirements
                        </div>
                        <ul className="space-y-2 text-sm text-zinc-400">
                          {role.requirements.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
          <h2 className="mb-4 text-2xl font-black text-white">Staff Directory</h2>
          {loadingStaff ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-10 text-center text-zinc-500">No staff members match your search.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStaff.map((member) => {
                const role = STAFF_ROLES.find((r) => r.roleKey === (member.role || member.troll_role))
                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-cyan-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <Users className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {member.display_name || member.username}
                        </p>
                        <p className="truncate text-xs text-zinc-400">@{member.username}</p>
                        <p className="mt-0.5 text-xs font-semibold text-cyan-300">
                          {role?.title || formatRoleName(member.role || member.troll_role)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs font-bold ${member.is_active !== false ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {member.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                      {member.created_at && (
                        <span className="text-xs text-zinc-500">
                          Joined {new Date(member.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatRoleName(role?: string | null): string {
  if (!role) return 'Staff Member'
  return role.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function StaffPortalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080B12] px-4 text-white">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <h1 className="mt-4 text-xl font-black">Staff Operations</h1>
        <p className="mt-1 text-sm text-slate-400">Verifying your staff account.</p>
      </div>
    </div>
  )
}

function StaffAccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080B12] px-4 py-10 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#101520] p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-300 ring-1 ring-white/10">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-black">Staff Access Required</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          This portal is available only to approved Mai Troll staff with an active platform role.
        </p>
        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Interested in joining the team?</p>
          <p className="mt-2 text-sm text-slate-300">
            Review available positions and submit an application through the Careers page.
          </p>
        </div>
        <a
          href="/careers"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        >
          View Roles
        </a>
      </div>
    </div>
  )
}

function NoStaffModules() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080B12] px-4 text-white">
      <div className="max-w-md rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-6 text-center">
        <h1 className="text-xl font-black text-rose-100">Staff Role Configuration Required</h1>
        <p className="mt-2 text-sm leading-6 text-rose-100/70">
          Your staff account is active, but no portal modules have been assigned to your role. Contact an administrator for assistance.
        </p>
      </div>
    </div>
  )
}
