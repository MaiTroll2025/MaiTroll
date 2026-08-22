import React, { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Activity, AlertTriangle, BriefcaseBusiness, FileText, List, ShieldAlert, Users, ArrowRight, Coins, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import ExecutiveReportsList from '@/pages/admin/components/shared/ExecutiveReportsList'

type DashboardSection = 'overview' | 'staff_reports' | 'user_reports' | 'moderation_actions' | 'applications' | 'audit_logs' | 'payout_review'

const CEOAssistantDashboard = () => {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    pendingPayouts: 0,
    userReports: 0,
    moderationActions: 0,
    applications: 0,
    adminReports: 0,
    auditLogCount: 0,
    officerReports: 0
  })
  const [recentActivity, setRecentActivity] = useState<Array<any>>([])
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')

  const [userReportsList, setUserReportsList] = useState<Array<any>>([])
  const [moderationActionsList, setModerationActionsList] = useState<Array<any>>([])
  const [applicationsList, setApplicationsList] = useState<Array<any>>([])
  const [auditLogsList, setAuditLogsList] = useState<Array<any>>([])
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [expandedModAction, setExpandedModAction] = useState<string | null>(null)
  const [expandedApplication, setExpandedApplication] = useState<string | null>(null)

  // Payout review state
  const [payoutsList, setPayoutsList] = useState<Array<any>>([])
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [selectedPayoutForReview, setSelectedPayoutForReview] = useState<any>(null)
  const [coinReviewData, setCoinReviewData] = useState<any>(null)
  const [coinReviewLoading, setCoinReviewLoading] = useState(false)
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<Set<string>>(new Set())
  const [forwardingBatch, setForwardingBatch] = useState(false)
  const [batchLabel, setBatchLabel] = useState('')

  // Check if user has required role
  const isCEOAssistant =
    String(profile?.role) === 'ceo_assistant' ||
    String(profile?.troll_role) === 'ceo_assistant'
  const isNoahAssistant =
    String(profile?.role) === 'noah_assistant' ||
    String(profile?.troll_role) === 'noah_assistant'
  const isAdmin =
    String(profile?.role) === 'admin' ||
    String(profile?.troll_role) === 'admin' ||
    String(profile?.role) === 'hr_admin' ||
    String(profile?.role) === 'agency_hr_manager' ||
    profile?.is_admin ||
    String(profile?.role) === 'superadmin' ||
    String(profile?.troll_role) === 'ceo' ||
    !!(profile as { is_superadmin?: boolean })?.is_superadmin
  const isCEO = profile?.troll_role === 'ceo'

  const canAccess = isCEOAssistant || isNoahAssistant || isAdmin || isCEO

  const dashboardTitle = isNoahAssistant ? 'Noah Assistant Dashboard' : 'CEO Assistant Dashboard'
  const dashboardRoleName = isNoahAssistant ? 'Noah Assistant' : 'CEO Assistant'
  const assistantUsername = profile?.username || (isNoahAssistant ? 'noah_assistant' : 'ceo_assistant')
  const reportsViewMode = isNoahAssistant ? 'noah_assistant' : 'ceo_assistant'

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#050507] px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 shadow-2xl shadow-red-950/30">
          <div className="flex items-center gap-3 text-red-100">
            <ShieldAlert className="h-6 w-6" />
            <h1 className="text-2xl font-black">{dashboardTitle} access required</h1>
          </div>
          <p className="mt-4 text-sm leading-7 text-red-100/90">
            Your current role is {profile?.role || 'unknown'}. This page is restricted to {dashboardRoleName}, Admin, and CEO roles.
          </p>
          <a href="/" className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">
            Return home
          </a>
        </div>
      </div>
    )
  }

  const loadDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load overview stats
      const [pendingPayouts, userReports, moderationActions, applications, adminReports, auditLogCount, officerReports] = await Promise.all([
        // Pending payouts
        supabase
          .from('payout_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'reviewed', 'submitted']),

        // User reports
        supabase
          .from('user_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),

        // Moderation actions
        supabase
          .from('moderation_actions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),

        // Applications (career applications)
        supabase
          .from('career_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),

        // Admin reports (from lead_troll_officer, troll_officer, secretary)
        supabase
          .from('admin_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),

        // Audit log count (my actions)
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('actor_id', profile?.id),

        // Executive reports from lead_troll_officer, troll_officer, secretary
        supabase
          .from('executive_reports')
          .select('id', { count: 'exact', head: true })
          .eq('reviewed_by_admin', false),
      ])

      setStats({
        pendingPayouts: pendingPayouts.count || 0,
        userReports: userReports.count || 0,
        moderationActions: moderationActions.count || 0,
        applications: applications.count || 0,
        adminReports: adminReports.count || 0,
        auditLogCount: auditLogCount.count || 0,
        officerReports: officerReports.count || 0
      })

      // Load user reports data
      const { data: userReportsData } = await supabase
        .from('user_reports')
        .select('*, reporter:user_profiles!user_reports_reporter_id_fkey(username, display_name), reported_user:user_profiles!user_reports_reported_user_id_fkey(username, display_name)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50)
      setUserReportsList(userReportsData || [])

      // Load moderation actions data
      const { data: modActionsData } = await supabase
        .from('moderation_actions')
        .select('*, actor:user_profiles!moderation_actions_actor_id_fkey(username, display_name), target_user:user_profiles!moderation_actions_target_user_id_fkey(username, display_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)
      setModerationActionsList(modActionsData || [])

      // Load applications data
      const { data: applicationsData } = await supabase
        .from('career_applications')
        .select('*, user_profiles!user_id(username, display_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)
      setApplicationsList(applicationsData || [])

      // Load audit logs data
      const { data: auditData } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user_profiles:user_profiles!audit_logs_user_id_fkey(
            username,
            display_name
          )
        `)
        .eq('actor_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setAuditLogsList(auditData || [])

      // Load recent activity (audit logs)
      const { data: activityData, error: activityError } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user_profiles:user_profiles!audit_logs_user_id_fkey(
            username,
            display_name
          )
        `)
        .eq('actor_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activityError) throw activityError
      setRecentActivity(activityData || [])
    } catch (err: any) {
      console.error('Failed to load dashboard stats:', err)
      setError('Failed to load dashboard data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardStats()
  }, [])

  // Load pending payouts for review
  const loadPendingPayouts = async () => {
    setPayoutsLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_pending_payouts_for_review')
      if (error) throw error
      if (data?.payouts) {
        setPayoutsList(data.payouts)
      }
    } catch (err: any) {
      console.error('Failed to load pending payouts:', err)
    } finally {
      setPayoutsLoading(false)
    }
  }

  // Load coin history for fraud review
  const loadCoinReview = async (userId: string) => {
    setCoinReviewLoading(true)
    try {
      const { data, error } = await supabase.rpc('assistant_review_user_coins', {
        p_user_id: userId
      })
      if (error) throw error
      setCoinReviewData(data)
    } catch (err: any) {
      console.error('Failed to load coin review:', err)
    } finally {
      setCoinReviewLoading(false)
    }
  }

  // Toggle payout selection for batch
  const togglePayoutSelection = (id: string) => {
    setSelectedPayoutIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Forward selected payouts as batch to admin
  const forwardBatchToAdmin = async () => {
    if (selectedPayoutIds.size === 0) return
    setForwardingBatch(true)
    try {
      const { data, error } = await supabase.rpc('assistant_forward_payout_batch', {
        p_payout_ids: Array.from(selectedPayoutIds),
        p_assistant_id: user?.id,
        p_assistant_username: assistantUsername,
        p_batch_label: batchLabel || undefined
      })
      if (error) throw error
      if (data?.success) {
        setSelectedPayoutIds(new Set())
        setBatchLabel('')
        await loadPendingPayouts()
      }
    } catch (err: any) {
      console.error('Failed to forward batch:', err)
    } finally {
      setForwardingBatch(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="mt-4 text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header Gradient Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.15),transparent_28%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_32%)]" />
      </div>

      <main className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
              <LayoutDashboard className="h-4 w-4" />
              {dashboardTitle}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Operational Overview & Management Console
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              {profile?.role || 'unknown'} access for operational oversight and support.
            </p>
          </div>

           <div className="flex gap-3">
             <button
               onClick={loadDashboardStats}
               className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition-all hover:bg-white/20"
             >
               <Activity className="h-4 w-4 mr-2" /> Refresh
             </button>
             <a
               href="/"
               className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition-all hover:bg-white/20"
             >
               <Users className="h-4 w-4 mr-2" /> Home
             </a>
           </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-6 py-4 text-sm">
            <AlertTriangle className="h-4 w-4 mr-2 text-red-400" /> {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Pending Payouts */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.04] p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => { setActiveSection('payout_review'); loadPendingPayouts(); }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Pending Payouts</p>
                <p className="text-2xl font-black text-white">{stats.pendingPayouts}</p>
              </div>
              <div className="rounded-full bg-cyan-500/20 p-3">
                <Coins className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Click to review & fraud check
            </p>
          </div>

          {/* User Reports */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.04] p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setActiveSection(activeSection === 'user_reports' ? 'overview' : 'user_reports')}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">User Reports</p>
                <p className="text-2xl font-black text-white">{stats.userReports}</p>
              </div>
              <div className="rounded-full bg-amber-500/20 p-3">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Open reports requiring review
            </p>
          </div>

          {/* Moderation Actions */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.04] p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setActiveSection(activeSection === 'moderation_actions' ? 'overview' : 'moderation_actions')}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Moderation Actions</p>
                <p className="text-2xl font-black text-white">{stats.moderationActions}</p>
              </div>
              <div className="rounded-full bg-red-500/20 p-3">
                <ShieldAlert className="h-5 w-5 text-red-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Awaiting moderation actions and pending responses
            </p>
          </div>

          {/* Applications */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.04] p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setActiveSection(activeSection === 'applications' ? 'overview' : 'applications')}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Applications</p>
                <p className="text-2xl font-black text-white">{stats.applications}</p>
              </div>
              <div className="rounded-full bg-purple-500/20 p-3">
                <BriefcaseBusiness className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Role requests pending review
            </p>
          </div>

          {/* Admin Reports */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.04] p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setActiveSection('staff_reports')}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Admin Reports</p>
                <p className="text-2xl font-black text-white">{stats.adminReports}</p>
              </div>
              <div className="rounded-full bg-blue-500/20 p-3">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Reports from staff
            </p>
          </div>

          {/* My Actions / Audit Logs */}
          <div
            className="rounded-xl border border-white/10 bg-white/[0.04] p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setActiveSection(activeSection === 'audit_logs' ? 'overview' : 'audit_logs')}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">My Actions</p>
                <p className="text-2xl font-black text-white">{stats.auditLogCount}</p>
              </div>
              <div className="rounded-full bg-green-500/20 p-3">
                <List className="h-5 w-5 text-green-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Your audit log entries
            </p>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white">Recent Activity</h2>
            <button
              onClick={() => setActiveSection('audit_logs')}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white hover:bg-white/20"
            >
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No recent activity found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-cyan-500/20 p-2">
                        <Activity className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-black text-white">{activity.action}</p>
                        <p className="text-xs text-slate-400">
                          {activity.user_profiles?.display_name || 'Unknown User'} • 
                          {new Date(activity.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs font-black text-slate-400">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {activity.details && (
                    <div className="mt-2 p-3 rounded bg-white/5 text-xs text-slate-400">
                      {typeof activity.details === 'string' ? activity.details : JSON.stringify(activity.details, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Payout Review */}
          <button
            onClick={() => { setActiveSection('payout_review'); loadPendingPayouts(); }}
            className="group block rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/5 hover:border-white/10 text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-cyan-500/20 p-4">
                <Coins className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-black text-white">Payout Review</h3>
                <p className="text-sm text-slate-400">
                  Fraud check & forward verified batches to admin
                </p>
              </div>
            </div>
          </button>

          {/* User Reports */}
          <button
            onClick={() => setActiveSection(activeSection === 'user_reports' ? 'overview' : 'user_reports')}
            className="group block rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/5 hover:border-white/10 text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-amber-500/20 p-4">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-black text-white">Review Reports</h3>
                <p className="text-sm text-slate-400">
                  Examine and act on user reports
                </p>
              </div>
            </div>
          </button>

          {/* Moderation Queue */}
          <button
            onClick={() => setActiveSection(activeSection === 'moderation_actions' ? 'overview' : 'moderation_actions')}
            className="group block rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/5 hover:border-white/10 text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-red-500/20 p-4">
                <ShieldAlert className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-black text-white">Moderation Queue</h3>
                <p className="text-sm text-slate-400">
                  Process pending moderation actions
                </p>
              </div>
            </div>
          </button>

          {/* Application Review */}
          <button
            onClick={() => setActiveSection(activeSection === 'applications' ? 'overview' : 'applications')}
            className="group block rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/5 hover:border-white/10 text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-500/20 p-4">
                <BriefcaseBusiness className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-black text-white">Application Review</h3>
                <p className="text-sm text-slate-400">
                  Review pending role requests
                </p>
              </div>
            </div>
          </button>

          {/* Staff Reports */}
          <button
            onClick={() => setActiveSection(activeSection === 'staff_reports' ? 'overview' : 'staff_reports')}
            className="group block rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/5 hover:border-white/10 text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-500/20 p-4">
                <FileText className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-black text-white">Staff Reports</h3>
                <p className="text-sm text-slate-400">
                  View and manage reports from lead officers and secretary
                </p>
              </div>
            </div>
          </button>

          {/* Audit Logs */}
          <button
            onClick={() => setActiveSection(activeSection === 'audit_logs' ? 'overview' : 'audit_logs')}
            className="group block rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/5 hover:border-white/10 text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-500/20 p-4">
                <List className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-black text-white">Audit Logs</h3>
                <p className="text-sm text-slate-400">
                  Review your action history
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* ========== INLINE SECTIONS ========== */}

        {/* User Reports Inline Section */}
        {activeSection === 'user_reports' && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">User Reports</h2>
              <button
                onClick={() => setActiveSection('overview')}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> Back
              </button>
            </div>
            {userReportsList.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No open user reports.</p>
            ) : (
              <div className="space-y-3">
                {userReportsList.map((report) => (
                  <div key={report.id} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                    <div
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/5"
                      onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                    >
                      <div>
                        <p className="font-black text-white text-sm">{report.reason || 'User Report'}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Reporter: {report.reporter?.display_name || report.reporter?.username || 'Unknown'} → Reported: {report.reported_user?.display_name || report.reported_user?.username || 'Unknown'} • {new Date(report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-300/20 px-2 py-0.5 rounded">{report.status}</span>
                        {expandedReport === report.id ? <ChevronUp className="text-slate-400 h-5 w-5" /> : <ChevronDown className="text-slate-400 h-5 w-5" />}
                      </div>
                    </div>
                    {expandedReport === report.id && (
                      <div className="p-4 border-t border-white/10 bg-black/30">
                        {report.description && <p className="text-sm text-slate-300 whitespace-pre-wrap mb-3">{report.description}</p>}
                        <div className="flex gap-2 justify-end">
                          <button onClick={(e) => { e.stopPropagation(); supabase.from('user_reports').update({ status: 'resolved' }).eq('id', report.id).then(() => { setExpandedReport(null); loadDashboardStats(); }); }} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded text-xs font-bold hover:bg-emerald-500/20">Resolve</button>
                          <button onClick={(e) => { e.stopPropagation(); supabase.from('user_reports').update({ status: 'rejected' }).eq('id', report.id).then(() => { setExpandedReport(null); loadDashboardStats(); }); }} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-xs font-bold hover:bg-red-500/20">Reject</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Moderation Actions Inline Section */}
        {activeSection === 'moderation_actions' && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">Moderation Actions</h2>
              <button
                onClick={() => setActiveSection('overview')}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> Back
              </button>
            </div>
            {moderationActionsList.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No pending moderation actions.</p>
            ) : (
              <div className="space-y-3">
                {moderationActionsList.map((action) => (
                  <div key={action.id} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                    <div
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/5"
                      onClick={() => setExpandedModAction(expandedModAction === action.id ? null : action.id)}
                    >
                      <div>
                        <p className="font-black text-white text-sm">{action.action_type || 'Moderation Action'}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Actor: {action.actor?.display_name || action.actor?.username || 'Unknown'} → Target: {action.target_user?.display_name || action.target_user?.username || 'Unknown'} • {new Date(action.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase bg-red-500/10 text-red-300 border border-red-300/20 px-2 py-0.5 rounded">{action.status}</span>
                        {expandedModAction === action.id ? <ChevronUp className="text-slate-400 h-5 w-5" /> : <ChevronDown className="text-slate-400 h-5 w-5" />}
                      </div>
                    </div>
                    {expandedModAction === action.id && (
                      <div className="p-4 border-t border-white/10 bg-black/30">
                        {action.reason && <p className="text-sm text-slate-300 whitespace-pre-wrap mb-3">{action.reason}</p>}
                        <div className="flex gap-2 justify-end">
                          <button onClick={(e) => { e.stopPropagation(); supabase.from('moderation_actions').update({ status: 'revoked' }).eq('id', action.id).then(() => { setExpandedModAction(null); loadDashboardStats(); }); }} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded text-xs font-bold hover:bg-emerald-500/20">Complete</button>
                          <button onClick={(e) => { e.stopPropagation(); supabase.from('moderation_actions').update({ status: 'rejected' }).eq('id', action.id).then(() => { setExpandedModAction(null); loadDashboardStats(); }); }} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-xs font-bold hover:bg-red-500/20">Reject</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Applications Inline Section */}
        {activeSection === 'applications' && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">Role Request Applications</h2>
              <button
                onClick={() => setActiveSection('overview')}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> Back
              </button>
            </div>
            {applicationsList.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No pending career applications.</p>
            ) : (
              <div className="space-y-3">
                {applicationsList.map((app) => (
                  <div key={app.id} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                    <div
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/5"
                      onClick={() => setExpandedApplication(expandedApplication === app.id ? null : app.id)}
                    >
                      <div>
                         <p className="font-black text-white text-sm">Role: {app.position_id ? app.position_id.replace(/_/g, ' ').toUpperCase() : 'Career Application'}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Applicant: {app.user_profiles?.display_name || app.user_profiles?.username || 'Unknown'} • {new Date(app.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-300/20 px-2 py-0.5 rounded">{app.status}</span>
                        {expandedApplication === app.id ? <ChevronUp className="text-slate-400 h-5 w-5" /> : <ChevronDown className="text-slate-400 h-5 w-5" />}
                      </div>
                    </div>
                      {expandedApplication === app.id && (
                        <div className="p-4 border-t border-white/10 bg-black/30">
                          <div className="flex gap-2 justify-end">
                           <button onClick={(e) => { e.stopPropagation(); supabase.from('career_applications').update({ status: 'approved' }).eq('id', app.id).then(() => { setExpandedApplication(null); loadDashboardStats(); }); }} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded text-xs font-bold hover:bg-emerald-500/20">Approve</button>
                           <button onClick={(e) => { e.stopPropagation(); supabase.from('career_applications').update({ status: 'rejected' }).eq('id', app.id).then(() => { setExpandedApplication(null); loadDashboardStats(); }); }} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-xs font-bold hover:bg-red-500/20">Reject</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Logs Inline Section */}
        {activeSection === 'audit_logs' && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">Audit Logs</h2>
              <button
                onClick={() => setActiveSection('overview')}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> Back
              </button>
            </div>
            {auditLogsList.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No audit log entries found.</p>
            ) : (
              <div className="space-y-2">
                {auditLogsList.map((log) => (
                  <div key={log.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-cyan-500/20 p-2">
                          <Activity className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-black text-white text-sm">{log.action}</p>
                          <p className="text-xs text-slate-400">
                            {log.user_profiles?.display_name || 'Unknown User'} • {new Date(log.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs font-black text-slate-400">
                        {new Date(log.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {log.details && (
                      <div className="mt-2 p-3 rounded bg-white/5 text-xs text-slate-400">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Staff Reports Section */}
        {activeSection === 'staff_reports' && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">Staff Reports</h2>
              <button
                onClick={() => setActiveSection('overview')}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> Back to Overview
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Reports submitted by Lead Troll Officers, Troll Officers, and Secretary.
            </p>
            <ExecutiveReportsList viewMode={reportsViewMode} />
          </div>
        )}

        {/* Payout Review Section */}
        {activeSection === 'payout_review' && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">Payout Review & Fraud Check</h2>
              <div className="flex gap-3">
                <button
                  onClick={loadPendingPayouts}
                  disabled={payoutsLoading}
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" /> Refresh
                </button>
                <button
                  onClick={() => setActiveSection('overview')}
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 flex items-center gap-2"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" /> Back
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-4">
              Review pending payout requests, check coin history for fraud, then forward verified batches to the admin Operations & Control Deck.
            </p>

            {/* Batch Forward Controls */}
            {selectedPayoutIds.size > 0 && (
              <div className="mb-6 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-cyan-300 mb-1">Batch Label (optional)</label>
                    <input
                      type="text"
                      value={batchLabel}
                      onChange={(e) => setBatchLabel(e.target.value)}
                      placeholder="e.g. Week 22 Verified Payouts"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-slate-500"
                    />
                  </div>
                  <button
                    onClick={forwardBatchToAdmin}
                    disabled={forwardingBatch}
                    className="rounded-lg bg-cyan-600 px-6 py-2 text-sm font-black text-white hover:bg-cyan-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {forwardingBatch ? 'Forwarding...' : `Forward ${selectedPayoutIds.size} to Admin`}
                  </button>
                </div>
              </div>
            )}

            {payoutsLoading ? (
              <div className="text-center py-8 text-slate-400">Loading pending payouts...</div>
            ) : payoutsList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No pending payout requests to review.</div>
            ) : (
              <div className="space-y-3">
                {/* Select All */}
                <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                  <input
                    type="checkbox"
                    checked={selectedPayoutIds.size === payoutsList.length}
                    onChange={() => {
                      if (selectedPayoutIds.size === payoutsList.length) {
                        setSelectedPayoutIds(new Set())
                      } else {
                        setSelectedPayoutIds(new Set(payoutsList.map((p: any) => p.id)))
                      }
                    }}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Select All ({payoutsList.length} requests)
                  </span>
                </div>

                {payoutsList.map((payout: any) => (
                  <div key={payout.id} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                    <div className="p-4 flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedPayoutIds.has(payout.id)}
                        onChange={() => togglePayoutSelection(payout.id)}
                        className="mt-1 h-4 w-4 rounded border-white/20"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-black text-white text-sm">{payout.display_name || payout.username}</p>
                          <span className="text-[10px] font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-300/20 px-2 py-0.5 rounded">{payout.role}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400 mt-2">
                          <div>
                            <span className="text-slate-500">Coins:</span>{' '}
                            <span className="text-white font-bold">{payout.coin_amount?.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Cash:</span>{' '}
                            <span className="text-green-400 font-bold">${payout.cash_amount?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Provider:</span>{' '}
                            <span className="text-white">{payout.provider_type} — {payout.provider_username}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Tag:</span>{' '}
                            <span className="text-cyan-300 font-mono">{payout.user_tag || '—'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-400 mt-1">
                          <div>
                            <span className="text-slate-500">Balance:</span>{' '}
                            <span className="text-white">{payout.troll_coins_balance?.toLocaleString()} coins</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Earned Week:</span>{' '}
                            <span className="text-amber-300">{payout.total_earned_this_week?.toLocaleString()} coins</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Requested:</span>{' '}
                            <span className="text-white">{new Date(payout.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPayoutForReview(payout)
                          loadCoinReview(payout.user_id)
                        }}
                        className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
                      >
                        🔍 Fraud Check
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Coin History Review Modal */}
            {selectedPayoutForReview && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-[#1A1A1A] rounded-xl border border-amber-500/30 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-[#1A1A1A] border-b border-amber-500/30 p-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                      🔍 Coin History Review — {selectedPayoutForReview.display_name || selectedPayoutForReview.username}
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedPayoutForReview(null)
                        setCoinReviewData(null)
                      }}
                      className="text-gray-400 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {coinReviewLoading ? (
                      <div className="text-center py-8 text-slate-400">Loading coin history...</div>
                    ) : coinReviewData?.success ? (
                      <>
                        {/* User Summary */}
                        <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-amber-400 mb-3">User Summary</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-gray-400 text-xs">Role</div>
                              <div className="text-white font-bold">{coinReviewData.user?.role}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">Troll Coins</div>
                              <div className="text-white font-bold">{coinReviewData.user?.troll_coins?.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">Available</div>
                              <div className="text-green-400 font-bold">{coinReviewData.user?.current_balance?.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>

                        {/* Week Summary */}
                        <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-amber-400 mb-3">
                            Week Summary ({coinReviewData.week_start} — {coinReviewData.week_end})
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-gray-400 text-xs">Total Earned</div>
                              <div className="text-green-400 font-bold">{coinReviewData.total_earned_this_week?.toLocaleString()} coins</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">Total Cashed Out</div>
                              <div className="text-cyan-300 font-bold">{coinReviewData.total_cashed_out_this_week?.toLocaleString()} coins</div>
                            </div>
                          </div>
                        </div>

                        {/* Working Earnings */}
                        <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-amber-400 mb-3">Working Earnings This Week</h4>
                          {coinReviewData.working_earnings?.length > 0 ? (
                            <div className="space-y-2">
                              {coinReviewData.working_earnings.map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between text-xs bg-black/30 rounded p-3">
                                  <div>
                                    <span className="text-white font-bold">{e.role_label}</span>
                                    <span className="text-slate-400 ml-2">({e.earning_type})</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-green-400 font-bold">+{e.amount_coins?.toLocaleString()}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      e.status === 'converted' ? 'bg-green-500/20 text-green-400' :
                                      e.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                      'bg-slate-500/20 text-slate-400'
                                    }`}>{e.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">No working earnings recorded this week.</p>
                          )}
                        </div>

                        {/* Coin Transactions */}
                        <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-amber-400 mb-3">Coin Transactions This Week</h4>
                          {coinReviewData.coin_transactions?.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {coinReviewData.coin_transactions.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between text-xs bg-black/30 rounded p-3">
                                  <div>
                                    <span className="text-white font-bold">{t.type}</span>
                                    <span className="text-slate-400 ml-2">{t.description}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={Number(t.amount) >= 0 ? 'text-green-400' : 'text-red-400'}>
                                      {Number(t.amount) >= 0 ? '+' : ''}{t.amount}
                                    </span>
                                    <span className="text-slate-500">{new Date(t.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">No coin transactions recorded this week.</p>
                          )}
                        </div>

                        {/* Fraud Indicators */}
                        <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                          <h4 className="text-sm font-semibold text-amber-400 mb-3">⚠️ Fraud Indicators</h4>
                          <div className="space-y-2 text-xs">
                            {selectedPayoutForReview.coin_amount > coinReviewData.user?.current_balance && (
                              <div className="text-red-400 font-bold">⚠️ Request exceeds available balance!</div>
                            )}
                            {selectedPayoutForReview.coin_amount > (coinReviewData.total_earned_this_week || 0) * 1.5 && (
                              <div className="text-amber-400 font-bold">⚠️ Request is significantly higher than weekly earnings.</div>
                            )}
                            {coinReviewData.coin_transactions?.filter((t: any) => t.type === 'cashout_request').length > 2 && (
                              <div className="text-amber-400 font-bold">⚠️ Multiple cashout requests this week.</div>
                            )}
                            {selectedPayoutForReview.coin_amount <= coinReviewData.user?.current_balance &&
                             selectedPayoutForReview.coin_amount <= (coinReviewData.total_earned_this_week || 0) * 1.5 && (
                              <div className="text-green-400 font-bold">✅ No obvious fraud indicators detected.</div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-red-400">
                        {coinReviewData?.error || 'Failed to load coin history'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default CEOAssistantDashboard