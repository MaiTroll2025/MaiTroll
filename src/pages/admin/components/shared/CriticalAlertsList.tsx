import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { CriticalAlert } from '../../../../types/admin'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, Bell } from 'lucide-react'
import { useAuthStore } from '../../../../lib/store'

interface CriticalAlertsListProps {
  viewMode: 'admin' | 'secretary'
}

export default function CriticalAlertsList({ viewMode: _viewMode }: CriticalAlertsListProps) {
  const { user } = useAuthStore()
  const userId = user?.id
  const [alerts, setAlerts] = useState<CriticalAlert[]>([])
  const [reports, setReports] = useState<Record<string, any>[]>([])
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    if (!userId) return;
    setLoading(true)
    setLoadError(null)
    try {
      const [alertResult, reportResult] = await Promise.all([
        supabase
          .from('critical_alerts')
          .select('id, user_id, data, created_at, message, severity, resolved, source, resolved_by, resolved_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.rpc('list_reports', { p_status_filter: null }),
      ])

      if (alertResult.error) throw alertResult.error
      if (reportResult.error) throw reportResult.error

      const result = reportResult.data as {
        success?: boolean
        message?: string
        data?: { reports?: Record<string, any>[] }
      } | null
      if (result?.success === false) {
        throw new Error(result.message || 'The current account is not authorized to load moderation reports.')
      }
      const reportRows = Array.isArray(result?.data?.reports) ? result.data.reports : []
      const alertRows = (alertResult.data || []) as CriticalAlert[]
      const profileIds = [...new Set([
        ...alertRows.map(alert => alert.user_id).filter((id): id is string => Boolean(id)),
        ...reportRows.map(report => report.resolved_by).filter((id): id is string => Boolean(id)),
      ])]
      const { data: profiles, error: profilesError } = profileIds.length
        ? await supabase.from('user_profiles').select('id, username, display_name').in('id', profileIds)
        : { data: [], error: null }
      if (profilesError) throw profilesError

      setAlerts(alertRows)
      setReports(reportRows)
      setUserNames(new Map((profiles || []).map(profile => [
        profile.id,
        profile.display_name || profile.username || profile.id,
      ])))
    } catch (error) {
      console.error('Error fetching alerts:', error)
      setLoadError(error instanceof Error ? error.message : 'Failed to load critical alerts and moderation reports.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    fetchAlerts()
    const interval = setInterval(() => {
      void fetchAlerts()
    }, 30000)
    const channel = supabase
      .channel(`admin-critical-reports-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'moderation_reports',
      }, () => {
        void fetchAlerts()
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [userId, fetchAlerts])

  const handleResolve = async (id: string) => {
    if (!userId) return
    try {
      const { error } = await supabase
        .from('critical_alerts')
        .update({ 
          resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      toast.success('Alert resolved')
      await fetchAlerts()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? `Failed to resolve alert: ${error.message}` : 'Failed to resolve alert')
    }
  }

  const alertMetadata = (alert: CriticalAlert): Record<string, unknown> =>
    alert.data && typeof alert.data === 'object' && !Array.isArray(alert.data)
      ? alert.data as Record<string, unknown>
      : {}
  const unresolvedCritical = alerts.filter(a => !a.resolved && ['critical', 'high'].includes(a.severity))
  const otherAlerts = alerts.filter(a => !unresolvedCritical.includes(a))
  const severityByReportId = new Map(alerts.flatMap(alert => {
    const reportId = alertMetadata(alert).report_id
    return typeof reportId === 'string' ? [[reportId, alert.severity] as const] : []
  }))
  const alertByReportId = new Map(alerts.flatMap(alert => {
    const reportId = alertMetadata(alert).report_id
    return typeof reportId === 'string' ? [[reportId, alert] as const] : []
  }))
  const displayValue = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : Array.isArray(value)
        ? value.map(item => typeof item === 'string' || typeof item === 'number' ? String(item) : null).filter(Boolean).join(', ') || null
        : null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-red-400" />
          Critical Alerts
        </h2>
        <div className="text-xs text-slate-400">
          Live records from critical alerts and authorized moderation reports
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-5 rounded border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          <p>{loadError}</p>
          <button onClick={() => void fetchAlerts()} className="mt-2 underline hover:text-white">
            Retry loading
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-slate-400">Loading alerts and reports...</div>
      ) : (
        <section className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-white">Moderation Reports ({reports.length})</h3>
          {reports.length === 0 ? (
            <p className="rounded border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
              No moderation reports are available.
            </p>
          ) : (
            <div className="max-h-[34rem] space-y-3 overflow-y-auto">
              {reports.map(report => {
                const reportId = String(report.report_id || report.id || '')
                const severity = severityByReportId.get(reportId)
                const relatedAlert = alertByReportId.get(reportId)
                const relatedMetadata = relatedAlert ? alertMetadata(relatedAlert) : {}
                const status = String(report.status || 'unknown')
                const officerId = typeof report.resolved_by === 'string' ? report.resolved_by : null
                return (
                  <article key={reportId} className="rounded border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-white">Report {reportId || 'Unknown ID'}</h4>
                      <span className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200">
                        {severity ? `Severity: ${severity}` : 'Severity: Not recorded'}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <div><dt className="text-slate-400">Violation / reason</dt><dd>{report.report_reason || 'Not provided'}</dd></div>
                      <div><dt className="text-slate-400">Reported user</dt><dd>{report.reported_username || report.target_username || 'Unknown'}{report.reported_user_id ? ` (${report.reported_user_id})` : ''}</dd></div>
                      <div><dt className="text-slate-400">Reporter</dt><dd>{report.reporter_username || 'Unknown'}{report.reporter_id ? ` (${report.reporter_id})` : ''}</dd></div>
                      <div><dt className="text-slate-400">Stream</dt><dd>{report.stream_title || report.stream_id || 'Not linked'}{report.stream_id ? ` (${report.stream_id})` : ''}</dd></div>
                      <div><dt className="text-slate-400">Status / outcome</dt><dd>{status}</dd></div>
                      <div><dt className="text-slate-400">Officer involved</dt><dd>{officerId ? `${userNames.get(officerId) || officerId} (${officerId})` : 'Not resolved'}</dd></div>
                      <div><dt className="text-slate-400">Created</dt><dd>{report.created_at ? new Date(report.created_at).toLocaleString() : 'Not recorded'}</dd></div>
                      <div><dt className="text-slate-400">Resolved</dt><dd>{report.resolved_at ? new Date(report.resolved_at).toLocaleString() : 'Not resolved'}</dd></div>
                      {(['actions_taken', 'action_taken', 'action_status', 'moderation_outcome'] as const).map(key => {
                        const value = displayValue(relatedMetadata[key])
                        return value ? (
                          <div key={key}>
                            <dt className="text-slate-400">{key.replaceAll('_', ' ')}</dt>
                            <dd>{value}</dd>
                          </div>
                        ) : null
                      })}
                    </dl>
                    {report.report_details && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{report.report_details}</p>}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {unresolvedCritical.length > 0 && (
        <div className="mb-6 space-y-2">
          {unresolvedCritical.map(alert => (
            <div key={alert.id} className="bg-red-900/20 border border-red-500 p-4 rounded-lg flex justify-between items-center animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <div>
                  <h3 className="font-bold text-red-400 uppercase">{alert.severity} Alert</h3>
                  <p className="text-white">{alert.message}</p>
                  <p className="mt-1 text-xs text-red-300">
                    {new Date(alert.created_at).toLocaleString()} • {alert.source || 'Unknown source'}
                    {alert.user_id ? ` • ${userNames.get(alert.user_id) || alert.user_id} (${alert.user_id})` : ''}
                  </p>
                  {Object.entries(alertMetadata(alert)).map(([key, value]) => {
                    const text = displayValue(value)
                    return text ? <p key={key} className="mt-1 text-xs text-red-200">{key.replaceAll('_', ' ')}: {text}</p> : null
                  })}
                </div>
              </div>
              <button 
                onClick={() => handleResolve(alert.id)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold"
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {otherAlerts.length === 0 && unresolvedCritical.length === 0 ? (
          <div className="text-center text-slate-400">No alerts</div>
        ) : (
          otherAlerts.map(alert => (
            <div key={alert.id} className={`p-3 rounded border ${
              alert.resolved ? 'bg-slate-900/30 border-slate-800 opacity-50' : 'bg-slate-900/50 border-slate-700'
            } flex justify-between items-center`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-slate-300 text-sm">{alert.message}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 ml-4">
                  {new Date(alert.created_at).toLocaleString()} • {alert.source || 'Unknown source'}
                  {alert.user_id ? ` • ${userNames.get(alert.user_id) || alert.user_id}` : ''}
                  {alert.resolved && ` • Resolved by ${alert.resolved_by ? userNames.get(alert.resolved_by) || alert.resolved_by : 'Unknown'}`}
                  {alert.resolved_at && ` • ${new Date(alert.resolved_at).toLocaleString()}`}
                </div>
              </div>
              {!alert.resolved && (
                <button 
                  onClick={() => handleResolve(alert.id)}
                  className="p-1 text-slate-400 hover:text-green-400 transition-colors"
                  title="Resolve"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
