import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CalendarOff, Plus, CheckCircle2, XCircle, Clock3, RefreshCw } from 'lucide-react'

interface TimeOffRequest {
  id: string
  officer_id: string
  date: string
  end_date?: string | null
  reason: string | null
  notes?: string | null
  status: string
  created_at: string
  reviewed_by?: string | null
  reviewed_at?: string | null
  officer?: { id: string; username: string; avatar_url: string | null } | null
}

interface TimeOffPanelProps {
  isHRAdmin: boolean
  currentUserId: string | undefined
  hasApprovedRole: boolean
}

const statusTone = (status: string) => {
  const s = status.toLowerCase()
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-100 border-emerald-300/20'
  if (s === 'rejected') return 'bg-red-500/10 text-red-100 border-red-300/20'
  return 'bg-amber-500/10 text-amber-100 border-amber-300/20'
}

const statusIcon = (status: string) => {
  const s = status.toLowerCase()
  if (s === 'approved') return <CheckCircle2 className="h-3.5 w-3.5" />
  if (s === 'rejected') return <XCircle className="h-3.5 w-3.5" />
  return <Clock3 className="h-3.5 w-3.5" />
}

export default function TimeOffPanel({ isHRAdmin, currentUserId, hasApprovedRole }: TimeOffPanelProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ date: '', end_date: '', reason: '' })
  const [actingId, setActingId] = useState<string | null>(null)

  const loadRequests = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('officer_time_off_requests')
        .select(`
          id, officer_id, date, end_date, reason, status, created_at, reviewed_by, reviewed_at,
          officer:user_profiles!officer_time_off_requests_officer_id_fkey(id, username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (!isHRAdmin) {
        query = query.eq('officer_id', currentUserId ?? '')
      }

      const { data, error } = await query
      if (error) throw error
      setRequests((data as any) || [])
    } catch (err: any) {
      console.error('[HR] Time off load error:', err)
      toast.error(err?.message || 'Failed to load time off requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [isHRAdmin, currentUserId])

  const handleSubmitRequest = async () => {
    if (!currentUserId || !formData.date) {
      toast.error('Start date is required')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('officer_time_off_requests').insert({
        officer_id: currentUserId,
        date: formData.date,
        end_date: formData.end_date || null,
        reason: formData.reason || null,
        status: 'pending',
      })
      if (error) throw error
      toast.success('Time off request submitted')
      setFormData({ date: '', end_date: '', reason: '' })
      setShowForm(false)
      loadRequests()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAction = async (request: TimeOffRequest, action: 'approve' | 'reject') => {
    if (request.officer_id === currentUserId) {
      toast.error('You cannot review your own request')
      return
    }
    setActingId(request.id)
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      const { error } = await supabase
        .from('officer_time_off_requests')
        .update({
          status: newStatus,
          reviewed_by: currentUserId ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (error) throw error

      if (action === 'approve') {
        await supabase
          .from('officer_shift_slots')
          .delete()
          .eq('officer_id', request.officer_id)
          .eq('shift_date', request.date)
          .eq('status', 'scheduled')
      }

      toast.success(`Request ${action}d`)
      loadRequests()
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} request`)
    } finally {
      setActingId(null)
    }
  }

  const filterCounts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
    }
  }, [requests])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Time Off</h3>
          <p className="text-xs text-slate-400">
            {isHRAdmin ? 'Review and manage time off requests.' : 'Request time off for scheduled shifts.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasApprovedRole && !isHRAdmin && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-50 transition hover:bg-cyan-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              New Request
            </button>
          )}
          <button
            type="button"
            onClick={loadRequests}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/5 p-5 space-y-3">
          <h4 className="text-sm font-bold text-cyan-100">New Time Off Request</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">End Date (optional)</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Reason</label>
            <textarea
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60"
              placeholder="Optional reason for time off..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-50 transition hover:bg-cyan-500/25 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <span key={f} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase text-slate-400">
            {f}: {filterCounts[f]}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          Loading time off requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          No time off requests found.
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map(req => {
            const officerName = req.officer?.username || req.officer_id || 'Unknown'
            return (
              <div key={req.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(req.status)}`}>
                        {statusIcon(req.status)}
                        {req.status}
                      </span>
                      <span className="text-sm font-bold text-white">{officerName}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      <CalendarOff className="mr-1 inline h-3 w-3" />
                      {req.date}
                      {req.end_date && req.end_date !== req.date && ` → ${req.end_date}`}
                    </p>
                    {req.reason && <p className="text-xs text-slate-300 border-l-2 border-cyan-300/20 pl-2">{req.reason}</p>}
                    {req.notes && <p className="text-[10px] text-slate-500">Notes: {req.notes}</p>}
                    <p className="text-[10px] text-slate-500">Submitted: {new Date(req.created_at).toLocaleString()}</p>
                  </div>

                  {isHRAdmin && req.status === 'pending' && req.officer_id !== currentUserId && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={actingId === req.id}
                        onClick={() => handleAction(req, 'approve')}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-50 transition hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingId === req.id}
                        onClick={() => handleAction(req, 'reject')}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-red-300/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-50 transition hover:bg-red-500/25 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
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
