import React, { useEffect, useState } from 'react';
import { supabase, UserRole } from '@/lib/supabase'
import { toast } from 'sonner'
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ProfileRow {
  id: string
  username: string | null
  role: string | null
  troll_role: string | null
  is_troll_officer?: boolean
  is_lead_officer?: boolean
  is_pastor?: boolean
  is_hr_admin?: boolean
}

interface RoleManagementPanelProps {
  isHRAdmin: boolean
  currentUserId: string | undefined
}

export default function RoleManagementPanel({ isHRAdmin, currentUserId: _currentUserId }: RoleManagementPanelProps) {
  const [managers, setManagers] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [_acting, _setActing] = useState(false)

  const loadManagers = async () => {
    setLoading(true)
    try {
      const roles = [
        UserRole.HR_MANAGER,
        UserRole.HR_ADMIN,
        UserRole.AGENCY_HR_MANAGER,
        UserRole.ADMIN,
      ]

      const orConditions = [
        ...roles.map(r => `role.eq.${r}`),
        ...roles.map(r => `troll_role.eq.${r}`),
        'is_hr_admin.eq.true',
        'is_agency_hr_manager.eq.true',
        'is_admin.eq.true',
      ].join(',')

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, troll_role, is_troll_officer, is_lead_officer, is_pastor, is_hr_admin')
        .or(orConditions)
        .order('role', { ascending: true })
        .limit(100)

      if (error) throw error
      setManagers((data as ProfileRow[]) || [])
    } catch (err: any) {
      console.error('[HR] Role management load error:', err)
      toast.error(err?.message || 'Failed to load role managers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isHRAdmin) loadManagers()
  }, [isHRAdmin])

  if (!isHRAdmin) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
        You do not have permission to view role management.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Role Management</h3>
          <p className="text-xs text-slate-400">Currently restricted to view. Contact admin for role assignments.</p>
        </div>
        <button
          type="button"
          onClick={loadManagers}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="rounded-3xl border border-amber-300/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs text-amber-200">
            Only authorized admins can modify HR Manager assignments. Contact a system admin to request changes.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          Loading...
        </div>
      ) : managers.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          No HR managers found.
        </div>
      ) : (
        <div className="grid gap-3">
          {managers.map(row => (
            <div key={row.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black text-white">
                  {(row.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{row.username || 'Unknown'}</p>
                  <p className="text-xs text-slate-400">
                    Role: {row.role || row.troll_role || '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
