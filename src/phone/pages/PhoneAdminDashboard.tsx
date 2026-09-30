import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Coins,
  Database,
  Download,
  Gavel,
  Headphones,
  Landmark,
  LogOut,
  Megaphone,
  Monitor,
  Package,
  RefreshCw,
  RotateCcw,
  Scale,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'
import { useAuthStore } from '../../lib/store'
import { isAdminEmail, supabase } from '../../lib/supabase'
import { toast } from 'sonner'

type AdminRoute = {
  id: string
  label: string
  description: string
  path: string
  icon: React.ReactNode
  tone: string
  badge?: number
}

type LiveStream = {
  id: string
  title: string
  category?: string | null
  status?: string | null
  created_at?: string | null
  broadcaster_id?: string | null
}

type Counts = {
  totalUsers: number
  admins: number
  liveStreams: number
  activeSessions: number
  totalMinutes: number
  pendingPayouts: number
  pendingApplications: number
  openSupport: number
  unreadAlerts: number
  pendingTaxReviews: number
  reports: number
  coinRevenue: number
  coinsInCirculation: number
}

const emptyCounts: Counts = {
  totalUsers: 0,
  admins: 0,
  liveStreams: 0,
  activeSessions: 0,
  totalMinutes: 0,
  pendingPayouts: 0,
  pendingApplications: 0,
  openSupport: 0,
  unreadAlerts: 0,
  pendingTaxReviews: 0,
  reports: 0,
  coinRevenue: 0,
  coinsInCirculation: 0,
}

const toneMap: Record<string, string> = {
  cyan: 'border-[#00BFFF]/25 bg-[#00BFFF]/10 text-[#00BFFF]',
  purple: 'border-[#BF00FF]/25 bg-[#BF00FF]/10 text-[#BF00FF]',
  green: 'border-green-400/25 bg-green-400/10 text-green-300',
  amber: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  red: 'border-red-400/25 bg-red-400/10 text-red-300',
  blue: 'border-blue-400/25 bg-blue-400/10 text-blue-300',
  white: 'border-white/15 bg-white/[0.06] text-white',
}

function ActionButton({
  action,
  onClick,
}: {
  action: AdminRoute
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${toneMap[action.tone] || toneMap.white}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20">
        {action.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-wider">{action.label}</p>
        <p className="mt-0.5 truncate text-[10px] text-white/45">{action.description}</p>
      </div>
      {typeof action.badge === 'number' && action.badge > 0 && (
        <span className="min-w-6 rounded-full bg-red-500 px-2 py-1 text-center text-[9px] font-black text-white">
          {action.badge > 99 ? '99+' : action.badge}
        </span>
      )}
      <ChevronRight size={16} className="shrink-0 opacity-50" />
    </button>
  )
}

function Metric({
  label,
  value,
  icon,
  tone = 'cyan',
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: string
}) {
  return (
    <div className={`rounded-2xl border p-3 ${toneMap[tone] || toneMap.white}`}>
      <div className="mb-2 opacity-90">{icon}</div>
      <p className="text-[8px] font-black uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

export default function PhoneAdminDashboard() {
  const navigate = useNavigate()
  const { profile, user, logout } = useAuthStore()

  const isAdmin =
    profile?.is_admin === true ||
    ['admin', 'ceo', 'superadmin'].includes(profile?.role || '') ||
    isAdminEmail(user?.email || '')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [counts, setCounts] = useState<Counts>(emptyCounts)
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [showAllTools, setShowAllTools] = useState(false)
  const [showStreams, setShowStreams] = useState(true)
  const [search, setSearch] = useState('')

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!isAdmin) return

    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const [
        usersRes,
        adminsRes,
        streamsRes,
        sessionsRes,
        supportRes,
        alertsRes,
        taxRes,
        careerRes,
        legacyAppsRes,
        payoutsRes,
        txRes,
        minuteRes,
      ] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'ceo', 'superadmin']),
        supabase.from('streams').select('id,title,category,status,created_at,broadcaster_id').or('is_live.eq.true,status.eq.live').order('created_at', { ascending: false }).limit(100),
        supabase.from('rtc_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('system_alerts').select('id', { count: 'exact', head: true }).eq('status', 'unread'),
        supabase.from('user_tax_info').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('career_applications').select('id', { count: 'exact', head: true }).in('status', ['pending', 'applied']),
        supabase.from('applications').select('id', { count: 'exact', head: true }).neq('status', 'deleted').eq('status', 'pending'),
        supabase.from('earnings_payouts').select('id', { count: 'exact', head: true }).in('status', ['pending', 'requested', 'processing']),
        supabase.from('transactions').select('amount,coins_used,transaction_type,description,metadata'),
        supabase.from('rtc_minute_totals').select('total_minutes').eq('id', 'global').maybeSingle(),
      ])

      const txRows = (txRes.data || []) as any[]
      const coinRevenue = txRows
        .filter((tx) =>
          tx.transaction_type === 'purchase' ||
          String(tx.description || '').toLowerCase().includes('coin') ||
          tx.metadata?.paypal_order_id ||
          tx.metadata?.paypal_capture_id
        )
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0)

      const coinsInCirculation = txRows.reduce((sum, tx) => {
        const coins =
          Number(tx.coins_used || 0) ||
          Number(tx.metadata?.coins_awarded || 0) ||
          Number(tx.metadata?.coin_amount || 0) ||
          Number(tx.metadata?.coins || 0)
        return sum + Math.abs(coins)
      }, 0)

      setLiveStreams((streamsRes.data || []) as LiveStream[])
      setCounts({
        totalUsers: usersRes.count || 0,
        admins: adminsRes.count || 0,
        liveStreams: streamsRes.data?.length || 0,
        activeSessions: sessionsRes.count || 0,
        totalMinutes: Number(minuteRes.data?.total_minutes || 0),
        pendingPayouts: payoutsRes.count || 0,
        pendingApplications: (careerRes.count || 0) + (legacyAppsRes.count || 0),
        openSupport: supportRes.count || 0,
        unreadAlerts: alertsRes.count || 0,
        pendingTaxReviews: taxRes.count || 0,
        reports: 0,
        coinRevenue,
        coinsInCirculation,
      })
    } catch (error) {
      console.error('[PhoneAdminDashboard] dashboard fetch error:', error)
      toast.error('Failed to refresh admin data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isAdmin])

  useEffect(() => {
    fetchDashboard()

    if (!isAdmin) return

    const interval = window.setInterval(() => {
      fetchDashboard(true)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [fetchDashboard, isAdmin])

  const navigateAdmin = (path: string) => navigate(path)

  const endStream = async (id: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast.error('Authentication required')
        return
      }

      const functionsUrl =
        import.meta.env.VITE_EDGE_FUNCTIONS_URL ||
        'https://gejtbllazzighxwxudyu.supabase.co/functions/v1'

      const response = await fetch(`${functionsUrl}/streams-maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'end_stream',
          stream_id: id,
        }),
      })

      const raw = await response.text()
      let result: any = {}
      try {
        result = JSON.parse(raw)
      } catch {}

      if (!response.ok || (result.success === false && result.error)) {
        throw new Error(result.error || raw || 'Failed to end stream')
      }

      toast.success('Stream ended')
      await fetchDashboard(true)
    } catch (error) {
      console.error('[PhoneAdminDashboard] end stream error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to end stream')
    }
  }

  const deleteStream = async (id: string) => {
    if (!window.confirm('Delete this stream and its related stream data? This cannot be undone.')) return

    try {
      const { error: endError } = await supabase
        .from('streams')
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (endError) throw endError

      const deleteRelated = async (table: string) => {
        const { error } = await supabase.from(table).delete().eq('stream_id', id)
        if (error && !['PGRST205', '42P01', '42501'].includes(error.code || '')) {
          console.warn(`[PhoneAdminDashboard] ${table} cleanup failed`, error)
        }
      }

      await Promise.allSettled([
        deleteRelated('messages'),
        deleteRelated('stream_reports'),
        deleteRelated('gifts'),
        deleteRelated('chat_messages'),
      ])

      const { error: deleteError } = await supabase.from('streams').delete().eq('id', id)
      if (deleteError) throw deleteError

      toast.success('Stream deleted')
      await fetchDashboard(true)
    } catch (error) {
      console.error('[PhoneAdminDashboard] delete stream error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete stream')
    }
  }

  const emergencyStop = async () => {
    if (!window.confirm('EMERGENCY STOP: immediately end ALL active broadcasts?')) return

    try {
      const { error } = await supabase
        .from('streams')
        .update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .or('is_live.eq.true,status.eq.live')

      if (error) throw error

      toast.success('Emergency stop executed')
      await fetchDashboard(true)
    } catch (error) {
      console.error('[PhoneAdminDashboard] emergency stop error:', error)
      toast.error('Failed to stop active broadcasts')
    }
  }

  const handleLogout = async () => {
    try {
      if (logout) logout()
      await supabase.auth.signOut()
      localStorage.clear()
      sessionStorage.clear()
      navigate('/auth', { replace: true })
    } catch (error) {
      console.error('[PhoneAdminDashboard] logout error:', error)
      navigate('/auth', { replace: true })
    }
  }

  const handleResetApp = () => {
    if (!window.confirm('Reset this device session and return to login?')) return
    localStorage.clear()
    sessionStorage.clear()
    navigate('/auth?reset=1', { replace: true })
  }

  const allTools: AdminRoute[] = useMemo(() => [
    { id: 'hr', label: 'HR', description: 'Employees, access and HR management', path: '/admin/hr', icon: <BriefcaseBusiness size={18} />, tone: 'purple' },
    { id: 'backup', label: 'Database Backup', description: 'System backup tools', path: '/admin/system/backup', icon: <Database size={18} />, tone: 'blue' },
    { id: 'cache', label: 'Cache Control', description: 'Clear system cache', path: '/admin/system/cache', icon: <RotateCcw size={18} />, tone: 'amber' },
    { id: 'config', label: 'System Config', description: 'Platform configuration', path: '/admin/system/config', icon: <SlidersHorizontal size={18} />, tone: 'white' },
    { id: 'users', label: 'User Search', description: 'Find and manage users', path: '/admin/user-search', icon: <Users size={18} />, tone: 'cyan' },
    { id: 'reports', label: 'Reports Queue', description: 'Review platform reports', path: '/admin/reports-queue', icon: <BarChart3 size={18} />, tone: 'red', badge: counts.reports },
    { id: 'roles', label: 'Role Management', description: 'Manage admin/user roles', path: '/admin/role-management', icon: <UserCog size={18} />, tone: 'purple' },
    { id: 'streams', label: 'Stream Monitor', description: 'Monitor active broadcasts', path: '/admin/stream-monitor', icon: <Monitor size={18} />, tone: 'red', badge: counts.liveStreams },
    { id: 'voting', label: 'Voting', description: 'Voting administration', path: '/admin/voting', icon: <Scale size={18} />, tone: 'purple' },
    { id: 'media', label: 'Media Library', description: 'Manage platform media', path: '/admin/media-library', icon: <Package size={18} />, tone: 'cyan' },
    { id: 'chat', label: 'Chat Moderation', description: 'Review and manage chat', path: '/admin/chat-moderation', icon: <Shield size={18} />, tone: 'red' },
    { id: 'announcements', label: 'Announcements', description: 'Platform announcements', path: '/admin/announcements', icon: <Megaphone size={18} />, tone: 'purple' },
    { id: 'finance', label: 'Finance Dashboard', description: 'Financial controls and metrics', path: '/admin/finance', icon: <CircleDollarSign size={18} />, tone: 'green' },
    { id: 'economy', label: 'Economy Dashboard', description: 'Coins and platform economy', path: '/admin/economy', icon: <Coins size={18} />, tone: 'amber' },
    { id: 'grant', label: 'Grant Coins', description: 'Admin coin grants', path: '/admin/grant-coins', icon: <Sparkles size={18} />, tone: 'cyan' },
    { id: 'tax', label: 'Tax Reviews', description: 'Pending tax information', path: '/admin/tax-reviews', icon: <Landmark size={18} />, tone: 'amber', badge: counts.pendingTaxReviews },
    { id: 'payments', label: 'Payment Logs', description: 'Payment transaction logs', path: '/admin/payment-logs', icon: <Wallet size={18} />, tone: 'green' },
    { id: 'schedule', label: 'Create Schedule', description: 'Create staff schedules', path: '/admin/create-schedule', icon: <CalendarDays size={18} />, tone: 'blue' },
    { id: 'shifts', label: 'Officer Shifts', description: 'Officer shifts and approvals', path: '/admin/officer-shifts', icon: <ClipboardList size={18} />, tone: 'purple' },
    { id: 'empire', label: 'Empire Applications', description: 'Review empire applications', path: '/admin/empire-applications', icon: <BriefcaseBusiness size={18} />, tone: 'purple', badge: counts.pendingApplications },
    { id: 'applications', label: 'Applications', description: 'Review pending applications', path: '/admin/applications', icon: <ClipboardList size={18} />, tone: 'cyan', badge: counts.pendingApplications },
    { id: 'referrals', label: 'Referral Bonuses', description: 'Referral management', path: '/admin/referral-bonuses', icon: <TrendingUp size={18} />, tone: 'green' },
    { id: 'control', label: 'Control Panel', description: 'Platform control center', path: '/admin/control-panel', icon: <Settings size={18} />, tone: 'white' },
    { id: 'diagnostics', label: 'Test Diagnostics', description: 'Run platform diagnostics', path: '/admin/test-diagnostics', icon: <Wrench size={18} />, tone: 'amber' },
    { id: 'maintenance', label: 'Reset / Maintenance', description: 'Maintenance operations', path: '/admin/reset-maintenance', icon: <RotateCcw size={18} />, tone: 'red' },
    { id: 'export', label: 'Export Data', description: 'Export administrative data', path: '/admin/export-data', icon: <Download size={18} />, tone: 'blue' },
    { id: 'support', label: 'Support Tickets', description: 'Open customer tickets', path: '/admin/support-tickets', icon: <Headphones size={18} />, tone: 'cyan', badge: counts.openSupport },
    { id: 'customer', label: 'Customer Service', description: 'Customer service center', path: '/admin/customer-service', icon: <Headphones size={18} />, tone: 'cyan' },
    { id: 'notifications', label: 'Send Notifications', description: 'Broadcast admin notifications', path: '/admin/send-notifications', icon: <Bell size={18} />, tone: 'purple', badge: counts.unreadAlerts },
    { id: 'cashouts', label: 'Payouts', description: 'Manage broadcaster payouts', path: '/admin/payouts', icon: <Wallet size={18} />, tone: 'green', badge: counts.pendingPayouts },
    { id: 'payoutqueue', label: 'Payout Queue', description: 'Review pending payout queue', path: '/admin/payout-queue', icon: <Wallet size={18} />, tone: 'green', badge: counts.pendingPayouts },
    { id: 'purchases', label: 'Purchases', description: 'Review coin purchases', path: '/admin/purchases', icon: <Coins size={18} />, tone: 'amber' },
    { id: 'verification', label: 'Verification', description: 'User verification controls', path: '/admin/verification', icon: <Shield size={18} />, tone: 'cyan' },
  ], [counts])

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allTools
    return allTools.filter((tool) =>
      `${tool.label} ${tool.description}`.toLowerCase().includes(q)
    )
  }, [allTools, search])

  const priorityTools = useMemo(() => [
    allTools.find((x) => x.id === 'users'),
    allTools.find((x) => x.id === 'payouts'),
    allTools.find((x) => x.id === 'streams'),
    allTools.find((x) => x.id === 'reports'),
    allTools.find((x) => x.id === 'support'),
    allTools.find((x) => x.id === 'notifications'),
  ].filter(Boolean) as AdminRoute[], [allTools])

  if (!isAdmin) {
    return (
      <div className="min-h-screen w-full bg-[#05010f] text-white">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className={`w-full max-w-md rounded-3xl p-6 text-center ${neonCard}`}>
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-xl font-black">Access Restricted</h1>
            <p className="mt-2 text-sm text-white/50">This control center is limited to administrators.</p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-xs font-black uppercase"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#05010f] pb-10 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-[110px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#05010f]/95 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-3 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={23} />
          </button>

          <div className="text-center">
            <h1 className={`text-sm font-black uppercase tracking-[0.18em] ${neonTextGradient}`}>
              Admin Control
            </h1>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              MAiTROLL • Mobile Command Center
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchDashboard(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] active:scale-95"
              aria-label="Refresh"
            >
              <RefreshCw size={19} className={refreshing ? 'animate-spin text-cyan-300' : ''} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-300 active:scale-95"
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 space-y-4 px-3 py-4">
        <section className={`relative overflow-hidden rounded-3xl p-5 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/10 via-transparent to-[#BF00FF]/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_25px_rgba(0,191,255,0.35)]">
              <Zap size={27} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Remote Administration
              </p>
              <h2 className={`text-xl font-black ${neonTextGradient}`}>
                Full Admin Access
              </h2>
              <p className="mt-1 text-[10px] text-white/45">
                Manage MAiTROLL from your phone without losing the desktop command surface.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Metric label="Users" value={loading ? '…' : counts.totalUsers.toLocaleString()} icon={<Users size={17} />} />
          <Metric label="Live" value={loading ? '…' : counts.liveStreams.toLocaleString()} icon={<Monitor size={17} />} tone="red" />
          <Metric label="Sessions" value={loading ? '…' : counts.activeSessions.toLocaleString()} icon={<TrendingUp size={17} />} tone="blue" />
          <Metric label="RTC Minutes" value={loading ? '…' : counts.totalMinutes.toLocaleString()} icon={<CircleDollarSign size={17} />} tone="amber" />
          <Metric label="Payouts" value={loading ? '…' : counts.pendingPayouts.toLocaleString()} icon={<Wallet size={17} />} tone="green" />
          <Metric label="Applications" value={loading ? '…' : counts.pendingApplications.toLocaleString()} icon={<ClipboardList size={17} />} tone="purple" />
          <Metric label="Support" value={loading ? '…' : counts.openSupport.toLocaleString()} icon={<Headphones size={17} />} />
          <Metric label="Coin Revenue" value={loading ? '…' : `$${counts.coinRevenue.toFixed(2)}`} icon={<Coins size={17} />} tone="green" />
        </section>

        <section className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={emergencyStop}
            className="flex items-center justify-center gap-2 rounded-2xl border border-red-400/35 bg-red-500/15 p-3 text-[10px] font-black uppercase tracking-wider text-red-300 active:scale-95"
          >
            <Zap size={16} />
            Emergency Stop
          </button>
          <button
            type="button"
            onClick={() => navigateAdmin('/admin/send-notifications')}
            className="flex items-center justify-center gap-2 rounded-2xl border border-purple-400/25 bg-purple-500/10 p-3 text-[10px] font-black uppercase tracking-wider text-purple-300 active:scale-95"
          >
            <Megaphone size={16} />
            Broadcast Message
          </button>
          <button
            type="button"
            onClick={() => navigateAdmin('/admin/reports-queue')}
            className="flex items-center justify-center gap-2 rounded-2xl border border-blue-400/25 bg-blue-500/10 p-3 text-[10px] font-black uppercase tracking-wider text-blue-300 active:scale-95"
          >
            <BarChart3 size={16} />
            Analytics / Reports
          </button>
          <button
            type="button"
            onClick={() => navigateAdmin('/admin/export-data')}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] p-3 text-[10px] font-black uppercase tracking-wider text-white/80 active:scale-95"
          >
            <Download size={16} />
            Export Data
          </button>
        </section>

        <section className={`rounded-3xl p-4 ${neonCard}`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Active Broadcasts</p>
              <h3 className="text-sm font-black text-white">Live Operations</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowStreams((value) => !value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60"
            >
              {showStreams ? <X size={15} /> : <Monitor size={15} />}
            </button>
          </div>

          {showStreams && (
            <div className="space-y-2">
              {liveStreams.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center text-[10px] text-white/35">
                  No active broadcasts.
                </div>
              ) : (
                liveStreams.slice(0, 12).map((stream) => (
                  <div key={stream.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_9px_rgba(239,68,68,0.8)]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-white">{stream.title || 'Untitled Broadcast'}</p>
                        <p className="mt-0.5 truncate text-[9px] text-white/35">
                          {stream.category || 'No category'} • {stream.broadcaster_id || 'Unknown broadcaster'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/watch/${stream.id}?admin=1`)}
                        className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-300"
                      >
                        View
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => endStream(stream.id)}
                        className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-2 py-2 text-[9px] font-black uppercase text-amber-300 active:scale-95"
                      >
                        End Stream
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStream(stream.id)}
                        className="rounded-xl border border-red-400/20 bg-red-400/10 px-2 py-2 text-[9px] font-black uppercase text-red-300 active:scale-95"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Priority Controls</h3>
              <p className="text-[9px] text-white/30">Same admin destinations available from desktop.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllTools((value) => !value)}
              className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[9px] font-black uppercase text-cyan-300"
            >
              {showAllTools ? 'Priority' : `All Tools (${allTools.length})`}
            </button>
          </div>

          {showAllTools && (
            <div className="mb-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search every admin tool..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-cyan-400/30"
              />
            </div>
          )}

          <div className="space-y-2">
            {(showAllTools ? filteredTools : priorityTools).map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                onClick={() => navigateAdmin(action.path)}
              />
            ))}
          </div>
        </section>

        {!showAllTools && (
          <section className={`rounded-3xl p-4 ${neonCard}`}>
            <div className="mb-3 flex items-center gap-3">
              <Settings size={17} className="text-cyan-300" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">System</p>
                <h3 className="text-sm font-black">Maintenance & Recovery</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigateAdmin('/admin/control-panel')}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left active:scale-95"
              >
                <Settings size={17} className="mb-2 text-white" />
                <p className="text-[10px] font-black uppercase">Control Panel</p>
              </button>
              <button
                type="button"
                onClick={() => navigateAdmin('/admin/test-diagnostics')}
                className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-left active:scale-95"
              >
                <Wrench size={17} className="mb-2 text-amber-300" />
                <p className="text-[10px] font-black uppercase text-amber-200">Diagnostics</p>
              </button>
              <button
                type="button"
                onClick={() => navigateAdmin('/admin/reset-maintenance')}
                className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-left active:scale-95"
              >
                <RotateCcw size={17} className="mb-2 text-red-300" />
                <p className="text-[10px] font-black uppercase text-red-200">Maintenance</p>
              </button>
              <button
                type="button"
                onClick={handleResetApp}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left active:scale-95"
              >
                <RefreshCw size={17} className="mb-2 text-white/70" />
                <p className="text-[10px] font-black uppercase text-white/70">Reset App</p>
              </button>
            </div>
          </section>
        )}

        <p className="px-2 text-center text-[8px] font-bold uppercase tracking-[0.18em] text-white/20">
          MAiTROLL Admin • Remote command access • {counts.admins} admin account{counts.admins === 1 ? '' : 's'}
        </p>
      </main>
    </div>
  )
}
