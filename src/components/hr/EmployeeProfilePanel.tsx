import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Search, RefreshCw, Shield, Clock } from 'lucide-react';

interface EmployeeRow {
  id: string
  username: string | null
  avatar_url: string | null
  role: string | null
  troll_role: string | null
  created_at: string | null
  updated_at: string | null
  is_troll_officer?: boolean
  is_lead_officer?: boolean
  is_pastor?: boolean
  is_agency_hr?: boolean
  is_agency_hr_manager?: boolean
  is_agency_leader?: boolean
  is_secretary?: boolean
  is_attorney?: boolean
  is_prosecutor?: boolean
  is_journalist?: boolean
  is_news_caster?: boolean
  is_chief_news_caster?: boolean
  is_troller?: boolean
  is_ceo_assistant?: boolean
  is_noah_assistant?: boolean
  is_hr_admin?: boolean
  is_officer_active?: boolean
}

interface EmployeeProfilePanelProps {
  isHRAdmin: boolean
  currentUserId: string | undefined
}

const STAFF_ROLES = [
  'troll_officer', 'lead_troll_officer', 'pastor', 'agency_hr', 'agency_hr_manager',
  'agency_leader', 'secretary', 'attorney', 'prosecutor', 'journalist', 'tcnn_news_caster',
  'tcnn_chief_news_caster', 'auctioneer', 'troller', 'ceo_assistant', 'noah_assistant',
  'hr_manager', 'hr_admin',
]

const ROLE_LABELS: Record<string, string> = {
  troll_officer: 'Troll Officer',
  lead_troll_officer: 'Lead Troll Officer',
  pastor: 'Pastor',
  agency_hr: 'Agency HR',
  agency_hr_manager: 'Agency HR Manager',
  agency_leader: 'Agency Leader',
  secretary: 'Secretary',
  attorney: 'Attorney',
  prosecutor: 'Prosecutor',
  journalist: 'Journalist',
  tcnn_news_caster: 'TCNN News Caster',
  tcnn_chief_news_caster: 'TCNN Chief News Caster',
  auctioneer: 'Auctioneer',
  troller: 'Troller',
  ceo_assistant: 'CEO Assistant',
  noah_assistant: 'Noah Assistant',
  hr_manager: 'HR Manager',
  hr_admin: 'HR Admin',
}

const resolveRole = (row: EmployeeRow): string | null => {
  const directRole = row.troll_role || row.role
  if (directRole && STAFF_ROLES.includes(directRole)) return directRole

  const booleanMap: [string, boolean | undefined][] = [
    ['troll_officer', row.is_troll_officer],
    ['lead_troll_officer', row.is_lead_officer],
    ['pastor', row.is_pastor],
    ['agency_hr', row.is_agency_hr],
    ['agency_hr_manager', row.is_agency_hr_manager],
    ['agency_leader', row.is_agency_leader],
    ['secretary', row.is_secretary],
    ['attorney', row.is_attorney],
    ['prosecutor', row.is_prosecutor],
    ['journalist', row.is_journalist],
    ['tcnn_news_caster', row.is_news_caster],
    ['tcnn_chief_news_caster', row.is_chief_news_caster],
    ['troller', row.is_troller],
    ['ceo_assistant', row.is_ceo_assistant],
    ['noah_assistant', row.is_noah_assistant],
    ['hr_admin', row.is_hr_admin],
  ]

  const match = booleanMap.find(([, flag]) => flag)
  return match ? match[0] : null
}

const isActiveRole = (row: EmployeeRow): boolean => {
  if (row.is_officer_active === true) return true
  return resolveRole(row) !== null
}

export default function EmployeeProfilePanel({ isHRAdmin, currentUserId: _currentUserId }: EmployeeProfilePanelProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clockStatusById, setClockStatusById] = useState<Record<string, boolean>>({})

  const loadEmployees = async () => {
    setLoading(true)
    try {
      const orFilter = STAFF_ROLES.map(r => `role.eq.${r}`).concat(STAFF_ROLES.map(r => `troll_role.eq.${r}`)).join(',')

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, troll_role, created_at, updated_at, is_troll_officer, is_lead_officer, is_pastor, is_agency_hr, is_agency_hr_manager, is_agency_leader, is_secretary, is_attorney, is_prosecutor, is_journalist, is_news_caster, is_chief_news_caster, is_troller, is_ceo_assistant, is_noah_assistant, is_hr_admin, is_officer_active')
        .or(orFilter)
        .order('updated_at', { ascending: false })
        .limit(500)

      if (error) throw error

      const rows: EmployeeRow[] = (data as any) || []
      const filtered = rows.filter(row => {
        if (row.role && STAFF_ROLES.includes(row.role)) return true
        if (row.troll_role && STAFF_ROLES.includes(row.troll_role)) return true
        return isActiveRole(row)
      })

      setEmployees(filtered)

      const ids = filtered.map(e => e.id)
      if (ids.length > 0) {
        const { data: activeSessions } = await supabase
          .from('officer_work_sessions')
          .select('officer_id')
          .in('officer_id', ids)
          .is('clock_out', null)
          .limit(500)

        const statusMap: Record<string, boolean> = {}
        ;(activeSessions || []).forEach((s: any) => {
          statusMap[s.officer_id] = true
        })
        setClockStatusById(statusMap)
      }
    } catch (err: any) {
      console.error('[HR] Employee load error:', err)
      toast.error(err?.message || 'Failed to load employee profiles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isHRAdmin) loadEmployees()
  }, [isHRAdmin])

  const visibleEmployees = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.trim().toLowerCase()
    return employees.filter(e =>
      (e.username || '').toLowerCase().includes(q) ||
      (resolveRole(e) || '').toLowerCase().includes(q)
    )
  }, [employees, search])

  if (!isHRAdmin) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
        You do not have permission to view the employee directory.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Employee & Role Profiles</h3>
          <p className="text-xs text-slate-400">
            {visibleEmployees.length} active role holder{visibleEmployees.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadEmployees}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by username or role..."
          className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
        />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          Loading employee profiles...
        </div>
      ) : visibleEmployees.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          No employees found.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleEmployees.map(emp => {
            const roleLabel = ROLE_LABELS[resolveRole(emp) || ''] || resolveRole(emp) || 'Unknown'
            const isClockedIn = clockStatusById[emp.id]

            return (
              <div
                key={emp.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-cyan-300/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black text-white">
                      {(emp.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{emp.username || 'Unknown'}</p>
                      <p className="truncate text-xs text-slate-400">{emp.id}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                      <Shield className="h-3 w-3" />
                      {roleLabel}
                    </span>
                    {isClockedIn ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
                        <Clock className="h-3 w-3" />
                        Clocked In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                        <Clock className="h-3 w-3" />
                        Off Duty
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400 sm:grid-cols-4">
                  <div>
                    <span className="block text-slate-500">Joined</span>
                    <span className="text-slate-200">{emp.created_at ? new Date(emp.created_at).toLocaleDateString() : '—'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Updated</span>
                    <span className="text-slate-200">{emp.updated_at ? new Date(emp.updated_at).toLocaleDateString() : '—'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Payroll Eligible</span>
                    <span className="text-slate-200">Yes</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Status</span>
                    <span className="text-slate-200">{emp.is_officer_active === false ? 'Inactive' : 'Active'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
