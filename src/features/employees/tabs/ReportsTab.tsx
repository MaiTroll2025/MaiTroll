import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

const STATUSES = ['submitted', 'received', 'under_review', 'more_info_needed', 'action_taken', 'closed', 'escalated']

export default function ReportsTab({ profile: _profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [reports, setReports] = useState<any[]>([])
  const [subject, setSubject] = useState('')
  const [desc, setDesc] = useState('')
  const [type, setType] = useState('incident')
  const [priority, setPriority] = useState('normal')
  const [confidential, setConfidential] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const isMgmt = canEmployee(realProfile, 'manage_reports')
    let query = supabase.from('employee_reports').select('*').order('created_at', { ascending: false }).limit(80)
    if (!isMgmt) {
      query = query.eq('submitted_by', user.id)
    }
    const { data } = await query
    let reports = (data as any[]) || []
    const ids = [...new Set(reports.map(r => r.supervisor_id).filter(Boolean))]
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, username').in('id', ids)
      const map = new Map((profiles || []).map((p: any) => [p.id, p]))
      reports = reports.map(r => ({ ...r, supervisor: map.get(r.supervisor_id) || null }))
    }
    setReports(reports)
  }, [realProfile, user])
  useEffect(() => { load() }, [user, realProfile, load])

  const submit = async () => {
    if (!subject || !user) return
    setBusy(true)
    try {
      // Auto-route to a Lead Troll Officer supervisor.
      const { data: lead } = await supabase
        .from('user_profiles')
        .select('id')
        .or('is_lead_officer.eq.true,role.eq.lead_troll_officer')
        .neq('id', user.id)
        .limit(1)
        .maybeSingle()
      const { error } = await supabase.from('employee_reports').insert({
        report_type: type, subject, description: desc, priority, confidential,
        submitted_by: user.id, supervisor_id: lead?.id ?? null, status: 'submitted',
      })
      if (error) throw error
      setSubject(''); setDesc(''); load()
      import('sonner').then((s) => s.toast.success('Report submitted to your Lead'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  const setStatus = async (id: string, status: string) => {
    await supabase.from('employee_reports').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.rpc('log_employee_audit', {
      p_actor: user?.id, p_action: 'report_status', p_target: id, p_new: { status }, p_department: 'reports',
    })
    load()
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {reports.length === 0 && <p className="text-sm text-slate-400">No reports.</p>}
        {reports.map((r) => (
          <div key={r.id} className={`rounded-2xl border bg-black/30 p-5 ${r.confidential ? 'border-red-400/30' : 'border-white/10'}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{r.subject}</h2>
              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-bold uppercase text-slate-300">{r.status}</span>
            </div>
            {r.description && <p className="mt-2 text-sm text-slate-300">{r.description}</p>}
            <p className="mt-2 text-xs text-slate-500">
              {r.report_type} · {r.priority} {r.confidential && '· 🔒 confidential'} · supervisor: {r.supervisor?.username ?? 'unassigned'}
            </p>
            <PermissionGate profile={realProfile} action="manage_reports">
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <button key={s} onClick={() => setStatus(r.id, s)}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-bold capitalize text-slate-300">{s.replace(/_/g, ' ')}</button>
                ))}
              </div>
            </PermissionGate>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h2 className="mb-3 text-lg font-bold">Submit Report</h2>
        <div className="space-y-2">
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
            <option value="incident">Incident</option>
            <option value="user">User Report</option>
            <option value="broadcast">Broadcast</option>
            <option value="safety">Safety Concern</option>
            <option value="other">Other</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
            {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description"
            className="min-h-[90px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none" />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} /> Confidential
          </label>
          <button disabled={busy || !subject} onClick={submit}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">Submit</button>
        </div>
      </div>
    </div>
  )
}
