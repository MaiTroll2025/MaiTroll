import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Flag, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'action_taken' | 'rejected'
type ReportDecision = 'reviewing' | 'resolved' | 'rejected' | 'remove'
type RestrictionType = 'maipiks' | 'chat' | 'broadcast' | 'podcast' | 'hytrogames'

interface MaiPiksReport {
  report_id: string
  reporter_id: string
  reporter_username: string | null
  target_user_id: string | null
  target_username: string | null
  story_id: string | null
  story_item_id: string | null
  report_category: string
  report_details: string | null
  evidence_path: string
  status: ReportStatus
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
}

const categoryLabels: Record<string, string> = {
  minor_harmful: 'Minor in prohibited or harmful content',
  harmful_dangerous: 'Harmful or dangerous content',
  weapons: 'Weapons',
  other_safety_violation: 'Other Mai Piks safety violation',
}

export default function MaiPiksReportsPanel() {
  const [reports, setReports] = useState<MaiPiksReport[]>([])
  const [statusFilter, setStatusFilter] = useState<'open' | 'reviewing' | 'resolved' | 'all'>('open')
  const [signedEvidence, setSignedEvidence] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyReportId, setBusyReportId] = useState<string | null>(null)
  const [restrictionType, setRestrictionType] = useState<RestrictionType>('maipiks')
  const [restrictionDuration, setRestrictionDuration] = useState('1440')
  const [customDurationHours, setCustomDurationHours] = useState('24')
  const [restrictionReason, setRestrictionReason] = useState('')

  const loadReports = useCallback(async () => {
    setLoading(true)
    const pStatus = statusFilter === 'open' ? 'pending' : statusFilter === 'all' ? null : statusFilter
    const { data, error } = await supabase.rpc('maipiks_list_reports', { p_status: pStatus })
    if (error) {
      toast.error(error.message || 'Could not load Mai Piks reports')
      setReports([])
    } else {
      setReports((data || []) as MaiPiksReport[])
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const openEvidence = async (report: MaiPiksReport) => {
    const { data, error } = await supabase.storage
      .from('maipiks')
      .createSignedUrl(report.evidence_path, 60)
    if (error || !data?.signedUrl) {
      toast.error(error?.message || 'Evidence is unavailable')
      return
    }
    setSignedEvidence((previous) => ({ ...previous, [report.report_id]: data.signedUrl }))
  }

  const resolveReport = async (report: MaiPiksReport, decision: ReportDecision) => {
    if (decision === 'remove' && !window.confirm('Remove this story item from Mai Piks?')) return
    setBusyReportId(report.report_id)
    const { error } = await supabase.rpc('maipiks_resolve_report', {
      p_report_id: report.report_id,
      p_decision: decision,
      p_reason: decision === 'remove' ? 'Removed after Mai Piks safety review' : 'Reviewed in RTC Admin Monitor',
    })
    if (error) {
      toast.error(error.message || 'Could not update the report')
    } else {
      toast.success(decision === 'remove' ? 'Content removed' : 'Report updated')
      await loadReports()
    }
    setBusyReportId(null)
  }

  const applyRestriction = async (report: MaiPiksReport) => {
    if (!report.target_user_id) return
    const durationMinutes = restrictionDuration === 'indefinite'
      ? 0
      : restrictionDuration === 'custom'
        ? Math.floor(Number(customDurationHours) * 60)
        : Number(restrictionDuration)
    if (!Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 525600) {
      toast.error('Enter a valid restriction duration of up to 365 days')
      return
    }

    setBusyReportId(report.report_id)
    const { data, error } = await supabase.rpc('set_user_restriction', {
      p_target_user_id: report.target_user_id,
      p_restriction_type: restrictionType,
      p_reason: restrictionReason.trim() || report.report_details || categoryLabels[report.report_category] || 'Mai Piks safety report',
      p_duration_minutes: durationMinutes,
      p_source_report_id: report.report_id,
      p_source_page: 'RTCAdminMonitor/MaiPiksReports',
      p_details: { story_id: report.story_id, story_item_id: report.story_item_id },
    })
    if (error || !(data as any)?.success) {
      toast.error(error?.message || (data as any)?.error || 'Could not apply restriction')
    } else {
      toast.success(`${restrictionType} restriction applied`)
    }
    setBusyReportId(null)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Flag className="h-4 w-4 text-orange-300" />
          <h2 className="text-sm font-bold text-white">Mai Piks Reports</h2>
          <span className="text-xs text-slate-400">{reports.length}</span>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          aria-label="Filter Mai Piks reports"
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
        >
          <option value="open">Open</option>
          <option value="reviewing">Under review</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <button
          type="button"
          onClick={() => void loadReports()}
          disabled={loading}
          aria-label="Refresh reports"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-8 text-center text-xs text-slate-500">No Mai Piks reports in this view.</div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <article key={report.report_id} className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-orange-200">{categoryLabels[report.report_category] || report.report_category}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    @{report.reporter_username || 'unknown'} reported @{report.target_username || 'unknown'}
                  </p>
                  <p className="mt-1 break-all font-mono text-[9px] text-slate-500">
                    Report {report.report_id.slice(0, 8)} · Story {report.story_id?.slice(0, 8) || 'removed'} · Item {report.story_item_id?.slice(0, 8) || 'removed'}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[9px] uppercase text-slate-300">{report.status.replace('_', ' ')}</span>
              </div>
              {report.report_details && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{report.report_details}</p>}
              <p className="mt-2 text-[9px] text-slate-500">{new Date(report.created_at).toLocaleString()}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void openEvidence(report)} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-2 text-[10px] font-bold text-cyan-200">
                  <ExternalLink className="h-3 w-3" />
                  View evidence
                </button>
                {signedEvidence[report.report_id] && (
                  <a href={signedEvidence[report.report_id]} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-cyan-300 underline">Open evidence</a>
                )}
                {report.status === 'pending' && (
                  <button type="button" disabled={busyReportId === report.report_id} onClick={() => void resolveReport(report, 'reviewing')} className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-2 text-[10px] font-bold text-yellow-200 disabled:opacity-50">Review</button>
                )}
                {['pending', 'reviewing'].includes(report.status) && (
                  <>
                    <button type="button" disabled={busyReportId === report.report_id} onClick={() => void resolveReport(report, 'resolved')} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[10px] font-bold text-emerald-200 disabled:opacity-50"><ShieldCheck className="h-3 w-3" />Resolve</button>
                    <button type="button" disabled={busyReportId === report.report_id} onClick={() => void resolveReport(report, 'remove')} className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] font-bold text-red-200 disabled:opacity-50"><Trash2 className="h-3 w-3" />Remove content</button>
                    <button type="button" disabled={busyReportId === report.report_id} onClick={() => void resolveReport(report, 'rejected')} className="rounded-md border border-white/10 px-2.5 py-2 text-[10px] font-bold text-slate-300 disabled:opacity-50">Reject</button>
                  </>
                )}
              </div>
              {['pending', 'reviewing'].includes(report.status) && report.target_user_id && (
                <div className="mt-3 grid gap-2 border-t border-white/5 pt-3 sm:grid-cols-2">
                  <label className="space-y-1 text-[9px] font-bold uppercase text-slate-500">
                    <span>Restriction type</span>
                    <select value={restrictionType} onChange={(event) => setRestrictionType(event.target.value as RestrictionType)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs normal-case text-white">
                      <option value="maipiks">Mai Piks</option>
                      <option value="chat">Chat</option>
                      <option value="broadcast">Broadcast</option>
                      <option value="podcast">Podcast</option>
                      <option value="hytrogames">HytroGames</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-[9px] font-bold uppercase text-slate-500">
                    <span>Duration</span>
                    <select value={restrictionDuration} onChange={(event) => setRestrictionDuration(event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs normal-case text-white">
                      <option value="60">1 hour</option>
                      <option value="360">6 hours</option>
                      <option value="720">12 hours</option>
                      <option value="1440">1 day</option>
                      <option value="4320">3 days</option>
                      <option value="10080">1 week</option>
                      <option value="20160">2 weeks</option>
                      <option value="43200">30 days</option>
                      <option value="custom">Custom</option>
                      <option value="indefinite">Indefinite</option>
                    </select>
                  </label>
                  {restrictionDuration === 'custom' && (
                    <label className="space-y-1 text-[9px] font-bold uppercase text-slate-500">
                      <span>Custom duration in hours</span>
                      <input type="number" min={1} max={8760} step={1} value={customDurationHours} onChange={(event) => setCustomDurationHours(event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs normal-case text-white" />
                    </label>
                  )}
                  <label className="space-y-1 text-[9px] font-bold uppercase text-slate-500">
                    <span>Reason override</span>
                    <input value={restrictionReason} onChange={(event) => setRestrictionReason(event.target.value)} maxLength={2000} placeholder={categoryLabels[report.report_category]} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs normal-case text-white placeholder:text-slate-600" />
                  </label>
                  <button type="button" disabled={busyReportId === report.report_id} onClick={() => void applyRestriction(report)} className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-black text-red-200 disabled:opacity-50 sm:col-span-2">
                    Apply {restrictionType} restriction
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}