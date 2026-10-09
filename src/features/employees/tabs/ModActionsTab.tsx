import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { isAdmin, isLead, type EmployeeProfileLike } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

interface ModActionRow {
  id: string
  target_user_id: string | null
  actor_id: string | null
  action: string | null
  action_type: string | null
  reason: string | null
  details: string | null
  status: string | null
  created_at: string
  target?: { username?: string | null; role?: string | null } | null
  actor?: { username?: string | null; role?: string | null } | null
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export default function ModActionsTab({ profile: _profile, realProfile }: { profile?: EmployeeProfileLike | null; realProfile: EmployeeProfileLike }) {
  const [rows, setRows] = useState<ModActionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const canDisable = isAdmin(realProfile) || isLead(realProfile)

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('moderation_actions')
        .select('id, target_user_id, actor_id, action, action_type, reason, details, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      const items = (data || []) as ModActionRow[]
      const ids = Array.from(
        new Set(
          items
            .flatMap((r) => [r.target_user_id, r.actor_id])
            .filter((id): id is string => Boolean(id)),
        ),
      )

      const { data: profiles } = ids.length
        ? await supabase
            .from('user_profiles')
            .select('id, username, role')
            .in('id', ids)
        : { data: [] as any[] }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const enriched = items.map((r) => ({
        ...r,
        target: profileMap.get(r.target_user_id || '') || null,
        actor: profileMap.get(r.actor_id || '') || null,
      }))

      setRows(enriched)
    } catch (e: any) {
      console.error('Failed to load mod actions:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const targetName = (r.target?.username || '').toLowerCase()
      const actorName = (r.actor?.username || '').toLowerCase()
      const action = (r.action || '').toLowerCase()
      const reason = (r.reason || '').toLowerCase()
      return targetName.includes(q) || actorName.includes(q) || action.includes(q) || reason.includes(q)
    })
  }, [rows, search])

  const disableAction = async (row: ModActionRow) => {
    if (!canDisable) return
    const confirmed = window.confirm(`Delete this mod action?\n\nAction: ${row.action || row.action_type || 'unknown'}\nTarget: ${row.target?.username || 'unknown'}\nReason: ${row.reason || '—'}`)
    if (!confirmed) return

    setBusyId(row.id)
    try {
      const { error } = await supabase
        .from('moderation_actions')
        .delete()
        .eq('id', row.id)

      if (error) throw error

      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } catch (e: any) {
      console.error('Failed to delete mod action:', e)
      alert(e?.message || 'Failed to delete mod action')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PermissionGate
      profile={realProfile}
      action="view_management"
      fallback={
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-slate-400">
          Mod Actions are restricted to management.
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Mod Actions</h2>
            <p className="text-xs text-slate-400">View and disable moderation actions per user.</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, or reason..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Date</th>
                {canDisable && <th className="px-3 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={canDisable ? 7 : 6}
                    className="px-3 py-8 text-center text-xs text-slate-500"
                  >
                    {loading ? 'Loading...' : 'No mod actions found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-slate-200">
                      <div className="font-medium">{row.target?.username || 'Unknown'}</div>
                      <div className="text-[10px] text-slate-500">{(row.target?.role || '').replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      <div className="font-medium">{row.actor?.username || 'System'}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                        {row.action_type || row.action || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      <div className="max-w-[220px] truncate" title={row.reason || ''}>
                        {row.reason || '—'}
                      </div>
                      {row.details && (
                        <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-600" title={row.details}>
                          {row.details}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                        {row.status || 'active'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{formatDate(row.created_at)}</td>
                    {canDisable && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => disableAction(row)}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          {busyId === row.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PermissionGate>
  )
}
