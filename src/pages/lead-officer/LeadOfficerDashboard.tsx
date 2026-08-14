import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  Calendar,
  CheckCircle,
  Clock,
  Crown,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Shield,
  User,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

import UserNameWithAge from '../../components/UserNameWithAge'
import ClickableUsername from '../../components/ClickableUsername'
import WeeklyReportForm from '../../components/WeeklyReportForm'
import WeeklyReportsList from '../../components/WeeklyReportsList'
import OfficerStreamGrid from '../../components/officer/OfficerStreamGrid'
import OfficerShiftCalendar from '../../components/officer/OfficerShiftCalendar'
import TimeOffRequestsList from './TimeOffRequestsList'

type Applicant = {
  id: string
  applicationId: string
  username: string
  email?: string
  role?: string
  created_at?: string
}

type Officer = {
  id: string
  username: string
  email?: string
  is_lead_officer: boolean
  is_troll_officer: boolean
  is_officer_active: boolean
  created_at?: string
}

type ActionLog = {
  id: string
  officer_id: string
  officer_username: string
  action_type: string
  acted_by: string
  acted_by_username: string
  reason: string | null
  created_at: string
}

type AutoClockoutSession = {
  id: string
  officer_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number
  auto_clocked_out: boolean
  username?: string
  created_at?: string
}

type ActiveTab = 'dashboard' | 'hr' | 'empire' | 'reports'

export default function LeadOfficerDashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [officers, setOfficers] = useState<Officer[]>([])
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [empireApplications, setEmpireApplications] = useState<any[]>([])
  const [autoClockoutSessions, setAutoClockoutSessions] = useState<AutoClockoutSession[]>([])
  const [weeklyReports, setWeeklyReports] = useState<any[]>([])
  const [pendingCareerApps, setPendingCareerApps] = useState(0)

  const [reason, setReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [loading, setLoading] = useState(false)

  const [showReportForm, setShowReportForm] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)

  const leadOfficerCount = useMemo(
    () => officers.filter((officer) => officer.is_lead_officer).length,
    [officers]
  )

  const regularOfficerCount = useMemo(
    () => officers.filter((officer) => !officer.is_lead_officer).length,
    [officers]
  )

  const pendingTotal = applicants.length + empireApplications.length

  const loadWeeklyReports = async () => {
    if (!currentUserId) return

    try {
      const { data, error } = await supabase
        .from('weekly_officer_reports')
        .select('*')
        .eq('lead_officer_id', currentUserId)
        .order('week_start', { ascending: false })
        .limit(10)

      if (error) throw error
      setWeeklyReports(data || [])
    } catch (error) {
      console.error('Error loading weekly reports:', error)
    }
  }

  const loadAutoClockouts = async () => {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: sessions, error } = await supabase
        .from('officer_work_sessions')
        .select('id, officer_id, clock_in, clock_out, hours_worked, auto_clocked_out')
        .eq('auto_clocked_out', true)
        .gte('clock_in', since)
        .order('clock_out', { ascending: false })
        .limit(50)

      if (error) throw error

      const rows = sessions || []

      if (rows.length === 0) {
        setAutoClockoutSessions([])
        return
      }

      const officerIds = Array.from(new Set(rows.map((s: any) => s.officer_id).filter(Boolean)))

      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, username, created_at')
        .in('id', officerIds)

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]))

      const hydrated = rows.map((s: any) => ({
        ...s,
        username: profileMap.get(s.officer_id)?.username || s.officer_id,
        created_at: profileMap.get(s.officer_id)?.created_at,
      })) as AutoClockoutSession[]

      setAutoClockoutSessions(hydrated)
    } catch (error) {
      console.error('Error loading auto clock-out sessions:', error)
    }
  }

  const loadApplicants = async () => {
    try {
      const { data, error } = await supabase
        .from('career_applications')
        .select(`
          id,
          user_id,
          position_id,
          status,
          created_at,
          user_profiles!user_id (
            username,
            email,
            role,
            is_troll_officer,
            is_officer_active
          )
        `)
        .is('lead_officer_approved', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const applicantsData = (data || []).map((app: any) => {
        const userProfile = Array.isArray(app.user_profiles) ? app.user_profiles[0] : app.user_profiles

        return {
          id: app.user_id,
          applicationId: app.id,
          username: userProfile?.username || 'Unknown',
          email: userProfile?.email || '',
          role: userProfile?.role || 'user',
          created_at: app.created_at,
        }
      })

      setApplicants(applicantsData)
    } catch (error) {
      console.error('Error loading applicants:', error)
      toast.error('Failed to load applicants')
    }
  }

  const loadOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, is_lead_officer, is_troll_officer, is_officer_active, created_at')
        .or('is_troll_officer.eq.true,is_lead_officer.eq.true')
        .neq('role', 'admin')

      if (error) throw error

      setOfficers(
        (data || []).map((officer: any) => ({
          id: officer.id,
          username: officer.username,
          email: officer.email,
          created_at: officer.created_at,
          is_lead_officer: officer.is_lead_officer || false,
          is_troll_officer: officer.is_troll_officer || false,
          is_officer_active: officer.is_officer_active || false,
        }))
      )
    } catch (error) {
      console.error('Error loading officers:', error)
      toast.error('Failed to load officers')
    }
  }

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('officer_actions')
        .select(`
          id,
          officer_id,
          target_user_id,
          action_type,
          reason,
          created_at,
          officer:user_profiles!officer_actions_officer_id_fkey(username)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        setLogs([])
        return
      }

      const logsData = (data || []).map((log: any) => ({
        id: log.id,
        officer_id: log.officer_id,
        officer_username: log.officer?.username || 'Unknown',
        action_type: log.action_type,
        acted_by: log.officer_id,
        acted_by_username: log.officer?.username || 'Unknown',
        reason: log.reason,
        created_at: log.created_at,
      }))

      setLogs(logsData)
    } catch (error) {
      console.error('Error loading logs:', error)
      setLogs([])
    }
  }

  const loadEmpireApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('empire_applications')
        .select(`
          *,
          user:user_profiles!user_id (
            username,
            avatar_url,
            created_at
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      setEmpireApplications(
        (data || []).map((app: any) => ({
          ...app,
          user: Array.isArray(app.user) ? app.user[0] : app.user,
        }))
      )
    } catch (error) {
      console.error('Error loading empire applications:', error)
      toast.error('Failed to load empire applications')
    }
  }

  const loadPendingCareerApps = async () => {
    try {
      const { count, error } = await supabase
        .from('career_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'applied'])
        .is('lead_officer_approved', null)

      if (error) throw error
      setPendingCareerApps(count || 0)
    } catch (error) {
      console.error('Error loading pending career apps:', error)
    }
  }

  const refreshAll = async () => {
    await Promise.all([
      loadApplicants(),
      loadOfficers(),
      loadLogs(),
      loadEmpireApplications(),
      loadAutoClockouts(),
      loadPendingCareerApps(),
    ])
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setCurrentUserId(user?.id ?? null)
      await refreshAll()
    }

    init()
     
  }, [])

  useEffect(() => {
    if (currentUserId) {
      loadWeeklyReports()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  const approveApplication = async (applicationId: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'approve_lead_application', applicationId },
      })

      if (error) throw error

      toast.success('Application approved for admin review')
      await loadApplicants()
    } catch (error) {
      console.error('Error approving application:', error)
      toast.error('Failed to approve application')
    } finally {
      setLoading(false)
    }
  }

  const rejectApplication = async (applicationId: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'reject_lead_application', applicationId },
      })

      if (error) throw error

      toast.success('Application rejected')
      await loadApplicants()
    } catch (error) {
      console.error('Error rejecting application:', error)
      toast.error('Failed to reject application')
    } finally {
      setLoading(false)
    }
  }

  const bypassHireJobApplication = async (app: any) => {
    if (!profile?.id) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from('job_applications')
        .update({
          status: 'hired',
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          interview_notes: 'Application bypassed by lead troll officer.',
        })
        .eq('id', app.id)

      if (error) throw error

      await supabase
        .from('user_profiles')
        .update({ job_title: app.position_id })
        .eq('id', app.user_id)

      toast.success('Applicant bypass-hired')
    } catch (error: any) {
      toast.error(error.message || 'Failed to bypass hire applicant')
    } finally {
      setLoading(false)
    }
  }

  const approveEmpireApplication = async (appId: string) => {
    if (!profile?.id) return

    setLoading(true)

    try {
      const { error } = await supabase.rpc('approve_empire_partner', {
        p_application_id: appId,
        p_reviewer_id: profile.id,
      })

      if (error) throw error

      toast.success('Empire Partner application approved')
      await loadEmpireApplications()
    } catch (error: any) {
      console.error('Error approving empire application:', error)
      toast.error(error.message || 'Failed to approve application')
    } finally {
      setLoading(false)
    }
  }

  const rejectEmpireApplication = async (appId: string) => {
    if (!confirm('Reject this Empire Partner application?')) return

    setLoading(true)

    try {
      const { error } = await supabase.rpc('reject_empire_partner', {
        p_application_id: appId,
        p_reviewer_id: profile?.id,
      })

      if (error) throw error

      toast.success('Empire Partner application rejected')
      await loadEmpireApplications()
    } catch (error: any) {
      console.error('Error rejecting empire application:', error)
      toast.error(error.message || 'Failed to reject application')
    } finally {
      setLoading(false)
    }
  }

  const banOfficer = async (id: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.rpc('ban_officer', {
        p_user_id: id,
        p_reason: banReason || 'No reason provided',
        p_expires_at: null,
      })

      if (error) throw error

      toast.success('Officer banned')
      setBanReason('')
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs()])
    } catch (error: any) {
      console.error('Error banning officer:', error)
      toast.error(error.message || 'Failed to ban officer')
    } finally {
      setLoading(false)
    }
  }

  const unbanOfficer = async (id: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.rpc('unban_officer', {
        p_user_id: id,
      })

      if (error) throw error

      toast.success('Officer unbanned')
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs()])
    } catch (error: any) {
      console.error('Error unbanning officer:', error)
      toast.error(error.message || 'Failed to unban officer')
    } finally {
      setLoading(false)
    }
  }

  const act = async (
    actionType: 'hire_officer' | 'fire_officer' | 'promote_to_lead' | 'revoke_lead',
    userId: string
  ) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)

    try {
      let error: any = null

      switch (actionType) {
        case 'hire_officer': {
          const { data: hireError, error: hireRpcError } = await supabase.rpc('approve_officer_application', {
            p_user_id: userId,
          })

          error = hireRpcError || hireError

            if (hireRpcError) {
             toast.error(hireRpcError.message || 'Failed to hire officer')
             return
            } else if (hireError && !hireError?.success) {
              error = { message: hireError?.error || 'Failed to approve officer application' }
          } else {
            const { error: activateError } = await supabase
              .from('user_profiles')
              .update({
                is_officer_active: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId)

            error = activateError
          }

          break
        }

        case 'fire_officer': {
          const { error: fireError } = await supabase
            .from('user_profiles')
            .update({
              is_officer_active: false,
              is_troll_officer: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

          error = fireError
          break
        }

        case 'promote_to_lead':
        case 'revoke_lead': {
          const { error: setStatusError } = await supabase.rpc('set_lead_officer_status', {
            p_user_id: userId,
            p_make_lead: actionType === 'promote_to_lead',
          })

          error = setStatusError
          break
        }
      }

      if (error) throw error

      toast.success('Officer action completed')
      setReason('')
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs()])
    } catch (error: any) {
      console.error('Error performing action:', error)
      toast.error(error.message || 'Failed to perform action')
    } finally {
      setLoading(false)
    }
  }

  const submitWeeklyReport = async (reportData: any) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setSubmittingReport(true)

    try {
      const result = await supabase.rpc('submit_weekly_report', {
        p_lead_officer_id: currentUserId,
        p_week_start: reportData.weekStart,
        p_week_end: reportData.weekEnd,
        p_title: `Weekly Report - ${reportData.weekStart} to ${reportData.weekEnd}`,
        p_body: JSON.stringify({
          work_summary: reportData.workSummary,
          challenges_faced: reportData.challenges,
          achievements: reportData.achievements,
          streams_moderated: reportData.streamsModerated,
          actions_taken: reportData.actionsTaken,
          recommendations: reportData.recommendations,
        }),
        p_incidents: [],
      })

      if (result.error) throw result.error

      if (!result.data?.success) {
        throw new Error(result.data?.error || 'Failed to submit report')
      }

      toast.success('Weekly report submitted')
      setShowReportForm(false)
      await loadWeeklyReports()
    } catch (error) {
      console.error('Error submitting weekly report:', error)
      toast.error('Failed to submit weekly report')
    } finally {
      setSubmittingReport(false)
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-8">
        <header className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Shield className="h-4 w-4" />
                Mai Troll Officer Division
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Lead Officer
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                  Command Center
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                Review applicants, manage officers, monitor shifts, approve Empire Partners, and submit weekly reports.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={Users} label="Officers" value={officers.length} />
              <StatCard icon={Award} label="Leads" value={leadOfficerCount} />
              <StatCard icon={User} label="Regular" value={regularOfficerCount} />
              <StatCard icon={Zap} label="Pending" value={pendingTotal} accent="pink" />
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/70 p-3 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              <TabButton active={activeTab === 'dashboard'} icon={LayoutDashboard} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
              <TabButton active={activeTab === 'hr'} icon={User} label="HR & Personnel" onClick={() => setActiveTab('hr')} badge={pendingCareerApps > 0 ? pendingCareerApps : undefined} />
              <TabButton active={activeTab === 'empire'} icon={Crown} label="Empire" onClick={() => setActiveTab('empire')} />
              <TabButton active={activeTab === 'reports'} icon={FileText} label="Reports" onClick={() => setActiveTab('reports')} />
            </div>

            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Command
            </button>
          </div>
        </section>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <Panel title="Live Officer Stream Grid" icon={Shield}>
              <OfficerStreamGrid />
            </Panel>

            <Panel title="All Officer Shifts" icon={Calendar}>
              <OfficerShiftCalendar title="All Officer Shifts" />
            </Panel>
          </div>
        )}

        {activeTab === 'hr' && (
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2">
              <MiniMetric title="Officer Applicants" value={applicants.length} description="Pending troll officer applications." />
              <MiniMetric title="Auto Clock-outs" value={autoClockoutSessions.length} description="Recent auto clock-outs in 7 days." danger />
            </div>

            <Panel title="Lead Officer Application Queue" icon={FileText}>
               <PendingApplicationsList
                 onApprove={async (appId, userId) => {
                   await approveApplication(appId)
                 }}
                 onReject={rejectApplication}
               />
            </Panel>

            <Panel title="Time Off Requests" icon={Clock}>
              <TimeOffRequestsList />
            </Panel>

            <Panel title="HR Alerts — Auto Clock-outs" icon={Clock} danger>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-400">
                  Auto clock-out sessions from the last 7 days.
                </p>

                <div className="flex gap-2">
                  <button type="button" onClick={loadAutoClockouts} className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20">
                    Refresh
                  </button>
                  <button type="button" onClick={() => navigate('/officer/scheduling')} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-500/20">
                    Open Scheduling
                  </button>
                </div>
              </div>

              {autoClockoutSessions.length === 0 ? (
                <EmptyText>No recent auto clock-outs.</EmptyText>
              ) : (
                <DataTable
                  headers={['Officer', 'Clock In', 'Clock Out', 'Hours']}
                  rows={autoClockoutSessions.map((session) => [
                    <UserNameWithAge key="user" user={{ username: session.username || session.officer_id, id: session.officer_id, created_at: session.created_at }} />,
                    new Date(session.clock_in).toLocaleString(),
                    session.clock_out ? new Date(session.clock_out).toLocaleString() : 'Active',
                    `${Number(session.hours_worked || 0).toFixed(2)} hrs`,
                  ])}
                />
              )}
            </Panel>

            <Panel title="Active Officers" icon={Award}>
              {officers.length === 0 ? (
                <EmptyText>No active officers yet.</EmptyText>
              ) : (
                <DataTable
                  headers={['User', 'Role', 'Status', 'Actions']}
                  rows={officers.map((officer) => [
                    <UserNameWithAge key="user" user={{ username: officer.username, id: officer.id, created_at: officer.created_at }} />,
                    <span key="role" className={`rounded-full border px-3 py-1 text-xs font-black ${officer.is_lead_officer ? 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200' : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'}`}>
                      {officer.is_lead_officer ? 'Lead Officer' : 'Officer'}
                    </span>,
                    <span key="status" className={`rounded-full border px-3 py-1 text-xs font-black ${officer.is_officer_active ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/20 bg-amber-500/10 text-amber-200'}`}>
                      {officer.is_officer_active ? 'Active' : 'Pending'}
                    </span>,
                    <div key="actions" className="flex flex-wrap justify-end gap-2">
                      <ActionButton label="Fire" color="red" disabled={loading} onClick={() => act('fire_officer', officer.id)} />
                      <ActionButton label="Ban" color="red" disabled={loading} onClick={() => banOfficer(officer.id)} />
                      <ActionButton label="Unban" color="green" disabled={loading} onClick={() => unbanOfficer(officer.id)} />
                      {!officer.is_lead_officer ? (
                        <ActionButton label="Promote" color="cyan" disabled={loading} onClick={() => act('promote_to_lead', officer.id)} />
                      ) : (
                        <ActionButton label="Revoke Lead" color="yellow" disabled={loading} onClick={() => act('revoke_lead', officer.id)} />
                      )}
                    </div>,
                  ])}
                />
              )}
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Action Reason" icon={FileText}>
                <textarea
                  className="min-h-[110px] w-full rounded-2xl border border-cyan-400/20 bg-black/40 p-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="Reason for hiring, firing, promotion, etc."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Panel>

              <Panel title="Ban Reason" icon={FileText} danger>
                <textarea
                  className="min-h-[110px] w-full rounded-2xl border border-red-400/20 bg-black/40 p-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-red-300/60 focus:ring-2 focus:ring-red-400/20"
                  placeholder="Reason for banning officer..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </Panel>
            </div>

            <Panel title="Action History" icon={Clock}>
              {logs.length === 0 ? (
                <EmptyText>No HR events yet.</EmptyText>
              ) : (
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-cyan-400/10 bg-black/30 p-4">
                      <p className="font-black text-white">
                        {log.officer_username} · {log.action_type}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        by {log.acted_by_username} · {new Date(log.created_at).toLocaleString()}
                      </p>
                      {log.reason && <p className="mt-2 text-sm text-cyan-200">Reason: {log.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === 'empire' && (
          <Panel title="Empire Partner Applications" icon={Crown}>
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={loadEmpireApplications} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-500/20">
                Refresh
              </button>
            </div>

            {empireApplications.length === 0 ? (
              <EmptyText>No pending Empire Partner applications.</EmptyText>
            ) : (
              <div className="space-y-4">
                {empireApplications.map((app) => (
                  <div key={app.id} className="rounded-2xl border border-cyan-400/15 bg-black/30 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={app.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user?.username}`}
                          alt={app.user?.username || 'Applicant'}
                          className="h-12 w-12 rounded-2xl border border-cyan-300/20 object-cover"
                        />
                        <div>
                          <ClickableUsername userId={app.user_id} username={app.user?.username || 'Unknown'} />
                          <p className="mt-1 text-xs text-slate-400">
                            Applied: {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => approveEmpireApplication(app.id)} disabled={loading} className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">
                          <CheckCircle className="h-3 w-3" />
                          Approve
                        </button>
                        <button type="button" onClick={() => rejectEmpireApplication(app.id)} disabled={loading} className="inline-flex items-center gap-1 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/20 disabled:opacity-50">
                          <XCircle className="h-3 w-3" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {activeTab === 'reports' && (
          <Panel title="Weekly Reports" icon={Calendar}>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReportForm(!showReportForm)}
                className="rounded-2xl border border-emerald-300/20 bg-emerald-500 px-4 py-2 text-sm font-black text-white hover:bg-emerald-400"
              >
                {showReportForm ? 'Cancel' : 'Submit Report'}
              </button>
            </div>

            {showReportForm && (
              <WeeklyReportForm
                onSubmit={submitWeeklyReport}
                onCancel={() => setShowReportForm(false)}
                loading={submittingReport}
              />
            )}

            <WeeklyReportsList reports={weeklyReports} />
            </Panel>
          )}
        </main>
        </div>
  )
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  active: boolean
  icon: any
  label: string
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? 'bg-cyan-400 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.28)]'
          : 'border border-cyan-400/10 bg-white/[0.03] text-slate-400 hover:border-cyan-400/30 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = 'cyan',
}: {
  icon: any
  label: string
  value: string | number
  accent?: 'cyan' | 'pink'
}) {
  return (
    <div className={`rounded-3xl border p-4 ${accent === 'pink' ? 'border-pink-400/20 bg-pink-500/5' : 'border-cyan-400/20 bg-cyan-500/5'}`}>
      <Icon className={`mb-3 h-5 w-5 ${accent === 'pink' ? 'text-pink-300' : 'text-cyan-300'}`} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
  danger,
}: {
  title: string
  icon: any
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <section className={`rounded-[2rem] border bg-slate-950/75 p-5 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl md:p-6 ${danger ? 'border-red-400/20' : 'border-cyan-400/15'}`}>
      <div className="mb-5 flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${danger ? 'border-red-400/20 bg-red-500/10 text-red-300' : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-black text-white">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function MiniMetric({
  title,
  value,
  description,
  danger,
}: {
  title: string
  value: number
  description: string
  danger?: boolean
}) {
  return (
    <div className={`rounded-[2rem] border bg-slate-950/75 p-5 ${danger ? 'border-red-400/20' : 'border-cyan-400/15'}`}>
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${danger ? 'text-red-300' : 'text-cyan-300'}`}>{title}</p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-cyan-400/10 bg-black/25 p-4 text-sm text-slate-400">{children}</p>
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-cyan-400/10">
      <table className="w-full text-sm">
        <thead className="bg-cyan-400/5 text-cyan-200">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-cyan-400/10 bg-black/20 hover:bg-cyan-400/5">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-middle text-slate-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActionButton({
  label,
  color,
  disabled,
  onClick,
}: {
  label: string
  color: 'red' | 'green' | 'cyan' | 'yellow'
  disabled?: boolean
  onClick: () => void
}) {
  const styles = {
    red: 'border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    green: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
    cyan: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20',
    yellow: 'border-yellow-400/20 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20',
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[color]}`}
    >
      {label}
    </button>
  )
}

function PendingApplicationsList({
  onApprove,
  onReject,
  onSchedule,
}: {
  onApprove: (applicationId: string, userId: string) => void
  onReject: (applicationId: string) => void
  onSchedule: (applicant: Applicant) => void
}) {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadApplications = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email,
            created_at
          )
        `)
        .is('lead_officer_approved', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [])

  if (loading) return <EmptyText>Loading applications...</EmptyText>
  if (applications.length === 0) return <EmptyText>No applications pending review.</EmptyText>

  return (
    <div className="space-y-3">
      {applications.map((app) => {
        const userProfile = Array.isArray(app.user_profiles) ? app.user_profiles[0] : app.user_profiles

        return (
          <div key={app.id} className="rounded-2xl border border-cyan-400/15 bg-black/30 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <UserNameWithAge
                    user={{
                      username: userProfile?.username || 'Unknown User',
                      id: app.user_id,
                      created_at: userProfile?.created_at,
                    }}
                  />

                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">
                    {String(app.type || 'Application').replace('_', ' ')}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Applied: {new Date(app.created_at).toLocaleDateString()}
                </p>
              </div>

               <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onApprove(app.id, app.user_id)}
                    className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-500/20"
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => onReject(app.id)}
                    className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/20"
                  >
                    Reject
                  </button>
                </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}