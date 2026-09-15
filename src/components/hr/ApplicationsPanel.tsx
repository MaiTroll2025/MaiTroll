import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Clock3, Archive, RefreshCw, User, Send } from 'lucide-react'

interface Application {
  id: string
  user_id: string
  position_id: string | null
  status: string | null
  message?: string | null
  created_at: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  user?: { id: string; username: string; avatar_url: string | null } | null
  career_positions?: { id: string; title: string; department: string } | null
}

interface ApplicationsPanelProps {
  isHRAdmin: boolean
  currentUserId: string | undefined
}

const POSITION_OPTIONS = [
  { id: 'auctioneer', label: 'Auctioneer' },
  { id: 'prosecutor', label: 'Prosecutor' },
  { id: 'attorney', label: 'Attorney' },
  { id: 'tcnn_news_caster', label: 'TCNN News Caster' },
  { id: 'secretary', label: 'Secretary' },
  { id: 'tcnn_chief_news_caster', label: 'TCNN Chief News Caster' },
  { id: 'troll_officer', label: 'Troll Officer' },
  { id: 'journalist', label: 'Journalist' },
  { id: 'lead_troll_officer', label: 'Lead Troll Officer' },
  { id: 'troller', label: 'Troller' },
  { id: 'agency_hr_manager', label: 'Agency HR Manager' },
  { id: 'agency_hr', label: 'Agency HR' },
  { id: 'agency_leader', label: 'Agency Leader' },
  { id: 'ceo_assistant', label: 'CEO Assistant' },
  { id: 'noah_assistant', label: 'Noah Assistant' },
  { id: 'pastor', label: 'Pastor' },
  { id: 'hr_manager', label: 'HR Manager' },
]

const ROLE_BOOLEAN_FIELD: Record<string, string> = {
  prosecutor: 'is_prosecutor',
  attorney: 'is_attorney',
  tcnn_news_caster: 'is_news_caster',
  secretary: 'is_secretary',
  tcnn_chief_news_caster: 'is_chief_news_caster',
  troll_officer: 'is_troll_officer',
  journalist: 'is_journalist',
  lead_troll_officer: 'is_lead_officer',
  troller: 'is_troller',
  pastor: 'is_pastor',
  agency_hr: 'is_agency_hr',
  agency_hr_manager: 'is_agency_hr_manager',
  agency_leader: 'is_agency_leader',
  ceo_assistant: 'is_ceo_assistant',
  noah_assistant: 'is_noah_assistant',
}

const statusTone = (status?: string | null) => {
  const s = (status || '').toLowerCase()
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-100 border-emerald-300/20'
  if (s === 'rejected') return 'bg-red-500/10 text-red-100 border-red-300/20'
  if (s === 'archived') return 'bg-slate-500/10 text-slate-100 border-slate-300/20'
  return 'bg-amber-500/10 text-amber-100 border-amber-300/20'
}

const statusIcon = (status?: string | null) => {
  const s = (status || '').toLowerCase()
  if (s === 'approved') return <CheckCircle2 className="h-3.5 w-3.5" />
  if (s === 'rejected') return <XCircle className="h-3.5 w-3.5" />
  if (s === 'archived') return <Archive className="h-3.5 w-3.5" />
  return <Clock3 className="h-3.5 w-3.5" />
}

export default function ApplicationsPanel({ isHRAdmin, currentUserId }: ApplicationsPanelProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'archived'>('pending')
  const [actingId, setActingId] = useState<string | null>(null)

  const loadApplications = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('job_applications')
        .select(`
          id, user_id, position_id, status, message, created_at, reviewed_by, reviewed_at,
          user:user_profiles!job_applications_user_id_fkey_to_user_profiles(id, username, avatar_url),
          career_positions(id, title, department)
        `)
        .order('created_at', { ascending: false })

      if (!isHRAdmin) {
        query = query.eq('user_id', currentUserId ?? '')
      }

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query.limit(200)
      if (error) throw error
      setApplications((data as any) || [])
    } catch (err: any) {
      console.error('[HR] Applications load error:', err)
      toast.error(err?.message || 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [filter, isHRAdmin, currentUserId])

  const visibleApplications = useMemo(() => {
    if (filter === 'all') return applications
    return applications.filter(a => (a.status || 'pending').toLowerCase() === filter)
  }, [applications, filter])

  const updateApplicationStatus = async (app: Application, newStatus: 'approved' | 'rejected' | 'archived') => {
    if (!app.user_id || !app.position_id) {
      toast.error('Missing application details')
      return
    }

    if (app.user_id === currentUserId) {
      toast.error('You cannot review your own application')
      return
    }

    setActingId(app.id)
    try {
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        reviewed_by: currentUserId ?? null,
        reviewed_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('job_applications')
        .update(updatePayload)
        .eq('id', app.id)

      if (updateError) throw updateError

      if (newStatus === 'approved') {
        const booleanField = ROLE_BOOLEAN_FIELD[app.position_id]

        // Assign the role via the SECURITY DEFINER RPC. Direct writes to the
        // protected `role` column are blocked by the protect_sensitive_columns trigger.
        const { error: roleError } = await supabase.rpc('set_user_role', {
          target_user: app.user_id,
          new_role: app.position_id,
          reason: `Approved application ${app.id}`,
          acting_admin_id: currentUserId ?? null,
        })

        if (roleError) {
          console.warn('[HR] set_user_role warning:', roleError)
          toast.warning('Application approved, but role assignment had an issue. Check manually.')
        } else {
          // set_user_role handles the officer booleans. Apply the role-specific
          // boolean flag and troll_role separately (these columns are not restricted).
          const extra: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (booleanField) extra[booleanField] = true
          extra.troll_role = app.position_id
          await supabase.from('user_profiles').update(extra).eq('id', app.user_id)
        }
      }

      toast.success(`Application ${newStatus}`)
      loadApplications()
    } catch (err: any) {
      console.error('[HR] Application action error:', err)
      toast.error(err?.message || `Failed to ${newStatus} application`)
    } finally {
      setActingId(null)
    }
  }

  const filterCounts = useMemo(() => {
    return {
      all: applications.length,
      pending: applications.filter(a => (a.status || 'pending').toLowerCase() === 'pending').length,
      approved: applications.filter(a => (a.status || '').toLowerCase() === 'approved').length,
      rejected: applications.filter(a => (a.status || '').toLowerCase() === 'rejected').length,
      archived: applications.filter(a => (a.status || '').toLowerCase() === 'archived').length,
    }
  }, [applications])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Role Applications</h3>
          <p className="text-xs text-slate-400">
            {isHRAdmin ? 'Review and manage all role applications.' : 'Track your submitted applications.'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadApplications}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'rejected', 'archived'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-2xl border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              filter === f
                ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-50'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {f} ({filterCounts[f]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          Loading applications...
        </div>
      ) : visibleApplications.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          No {filter === 'all' ? '' : filter} applications found.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleApplications.map(app => {
            const positionLabel = app.career_positions?.title || POSITION_OPTIONS.find(p => p.id === app.position_id)?.label || app.position_id || 'Unknown'
            const applicantName = app.user?.username || app.user_id || 'Unknown'
            const tone = statusTone(app.status)

            return (
              <div
                key={app.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-cyan-300/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
                        {statusIcon(app.status)}
                        {app.status || 'pending'}
                      </span>
                      <span className="text-sm font-bold text-white">{positionLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <User className="h-3.5 w-3.5" />
                      <span className="truncate">{applicantName}</span>
                      {app.created_at && (
                        <span className="text-slate-500">· {new Date(app.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    {app.message && (
                      <p className="text-xs text-slate-300 border-l-2 border-cyan-300/20 pl-2">{app.message}</p>
                    )}
                    {app.reviewed_at && (
                      <p className="text-[10px] text-slate-500">
                        Reviewed {new Date(app.reviewed_at).toLocaleString()}
                        {app.reviewed_by ? ` by ${app.reviewed_by}` : ''}
                      </p>
                    )}
                  </div>

                  {isHRAdmin && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {app.user_id !== currentUserId && (app.status || 'pending').toLowerCase() !== 'approved' && (
                        <button
                          type="button"
                          disabled={actingId === app.id}
                          onClick={() => updateApplicationStatus(app, 'approved')}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-50 transition hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      )}
                      {app.user_id !== currentUserId && (app.status || 'pending').toLowerCase() !== 'rejected' && (
                        <button
                          type="button"
                          disabled={actingId === app.id}
                          onClick={() => updateApplicationStatus(app, 'rejected')}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-red-300/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-50 transition hover:bg-red-500/25 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      )}
                      {(app.status || 'pending').toLowerCase() !== 'archived' && (
                        <button
                          type="button"
                          disabled={actingId === app.id}
                          onClick={() => updateApplicationStatus(app, 'archived')}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
