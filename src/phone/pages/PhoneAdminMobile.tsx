import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Database,
  DollarSign,
  FileCheck2,
  Flag,
  Headphones,
  Megaphone,
  MonitorCog,
  Radio,
  RefreshCw,
  Settings2,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  TicketCheck,
  UserCog,
  Users,
  WalletCards,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { supabase, isAdminEmail } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { neonCard, neonTextGradient } from '../phoneTheme'
import { useAdminDashboardMetrics } from '@/hooks/useAdminDashboardMetrics'
import { cn } from '@/lib/utils'

type Accent =
  | 'blue'
  | 'purple'
  | 'pink'
  | 'green'
  | 'amber'
  | 'red'

type AdminAction = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  accent: Accent
  badge?: number
  tab?: string
  path?: string
}

type AdminStats = {
  liveStreams: number
  pendingPayouts: number
  pendingApplications: number
  reports: number
  supportTickets: number
  totalUsers: number
  revenue: number
  activeToday: number
  openCases: number
}

interface RecentActivity {
  id: string
  type: 'purchase' | 'payout' | 'report' | 'application' | 'stream'
  text: string
  time: string
  amount?: string
}

const INITIAL_STATS: AdminStats = {
  liveStreams: 0,
  pendingPayouts: 0,
  pendingApplications: 0,
  reports: 0,
  supportTickets: 0,
  totalUsers: 0,
  revenue: 0,
  activeToday: 0,
  openCases: 0,
}

const accentClasses: Record<
  Accent,
  {
    border: string
    icon: string
    glow: string
    badge: string
  }
> = {
  blue: {
    border: 'border-cyan-400/20',
    icon: 'text-cyan-300',
    glow: 'bg-cyan-400/10',
    badge: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  },
  purple: {
    border: 'border-violet-400/20',
    icon: 'text-violet-300',
    glow: 'bg-violet-400/10',
    badge: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
  },
  pink: {
    border: 'border-fuchsia-400/20',
    icon: 'text-fuchsia-300',
    glow: 'bg-fuchsia-400/10',
    badge: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
  },
  green: {
    border: 'border-emerald-400/20',
    icon: 'text-emerald-300',
    glow: 'bg-emerald-400/10',
    badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  },
  amber: {
    border: 'border-amber-400/20',
    icon: 'text-amber-300',
    glow: 'bg-amber-400/10',
    badge: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  },
  red: {
    border: 'border-red-400/20',
    icon: 'text-red-300',
    glow: 'bg-red-400/10',
    badge: 'border-red-400/20 bg-red-400/10 text-red-200',
  },
}

/* -------------------------------------------------------------------------- */
/* Admin Action Card                                                          */
/* -------------------------------------------------------------------------- */

function AdminCard({
  action,
  onClick,
}: {
  action: AdminAction
  onClick: () => void
}) {
  const colors = accentClasses[action.accent]
  const Icon = action.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative min-h-[142px] overflow-hidden rounded-[1.35rem]',
        'border bg-white/[0.035] p-4 text-left',
        'backdrop-blur-xl',
        'transition-all duration-200',
        'active:scale-[0.97]',
        colors.border,
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-none absolute -right-8 -top-8',
          'h-24 w-24 rounded-full blur-3xl',
          colors.glow,
        ].join(' ')}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div
            className={[
              'flex h-11 w-11 items-center justify-center rounded-xl',
              'border bg-black/20',
              colors.border,
              colors.glow,
            ].join(' ')}
          >
            <Icon size={21} className={colors.icon} />
          </div>

          {typeof action.badge === 'number' && action.badge > 0 && (
            <span
              className={[
                'rounded-full border px-2 py-1',
                'text-[10px] font-black',
                colors.badge,
              ].join(' ')}
            >
              {action.badge > 99 ? '99+' : action.badge}
            </span>
          )}
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-white">
              {action.title}
            </p>

            <ChevronRight
              size={15}
              className={[
                'shrink-0 text-white/30',
                'transition-all duration-200',
                'group-hover:translate-x-0.5',
                'group-hover:text-white/70',
              ].join(' ')}
            />
          </div>

          <p className="mt-1 text-[10px] leading-4 text-zinc-500">
            {action.description}
          </p>
        </div>
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Metric Card                                                                */
/* -------------------------------------------------------------------------- */

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  accent: 'blue' | 'purple' | 'green' | 'amber' | 'red'
}) {
  const colors = accentClasses[accent]

  return (
    <div
      className={[
        'rounded-2xl border bg-white/[0.035] p-3',
        'backdrop-blur-xl',
        colors.border,
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <Icon size={16} className={colors.icon} />

        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
      </div>

      <p className="mt-3 text-xl font-black text-white">
        {value}
      </p>

      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Section Header                                                             */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  eyebrow,
  title,
  tone = 'blue',
  trailing,
}: {
  eyebrow: string
  title: string
  tone?: 'blue' | 'purple' | 'pink'
  trailing?: string
}) {
  const eyebrowClass =
    tone === 'purple'
      ? 'text-violet-300/70'
      : tone === 'pink'
        ? 'text-fuchsia-300/70'
        : 'text-cyan-300/70'

  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <p
          className={[
            'text-[9px] font-black uppercase tracking-[0.2em]',
            eyebrowClass,
          ].join(' ')}
        >
          {eyebrow}
        </p>

        <h2 className="mt-1 text-lg font-black text-white">
          {title}
        </h2>
      </div>

      {trailing && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
          {trailing}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function PhoneAdminMobile() {
  const navigate = useNavigate()
  const { user, profile, isLoading } = useAuthStore()
  const { metrics: dashboardMetrics, refreshMetrics, loading: metricsLoading } = useAdminDashboardMetrics()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<AdminStats>(INITIAL_STATS)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [activeTab, setActiveTab] = useState<string>('daily')

  const isAuthorized = useMemo(() => {
    if (!user) return false
    if (profile?.role === 'admin') return true
    return isAdminEmail(user.email || '')
  }, [profile?.role, user])

  const fetchAdminData = useCallback(async () => {
    if (!isAuthorized) {
      setLoading(false)
      return
    }

    setRefreshing(true)
    try {
      const results = await Promise.allSettled([
        supabase
          .from('streams')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'live'),

        supabase
          .from('payout_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),

        supabase
          .from('career_applications')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'applied']),

        supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'deleted')
          .eq('status', 'pending'),

        supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'pending']),

        supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'pending']),

        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('transactions')
          .select('amount, coins_used, transaction_type, description, created_at')
          .or('transaction_type.eq.purchase,description.ilike.%coin%')
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('user_profiles')
          .select('id, last_active')
          .gte('last_active', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ])

      const [
        streamsRes,
        payoutsRes,
        careerAppsRes,
        legacyAppsRes,
        reportsRes,
        supportRes,
        usersRes,
        transactionsRes,
        activeTodayRes,
      ] = results.map(r => (r.status === 'fulfilled' ? r.value : { count: 0, data: null, error: r.reason })) as any[]

      const liveStreams = streamsRes.count || 0
      const pendingPayouts = payoutsRes.count || 0
      const pendingApplications = (careerAppsRes.count || 0) + (legacyAppsRes.count || 0)
      const reports = reportsRes.count || 0
      const supportTickets = supportRes.count || 0
      const totalUsers = usersRes.count || 0
      const activeToday = (activeTodayRes.data?.length || 0)

      const txRows = (transactionsRes.data || []) as any[]
      const revenue = txRows.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
      const openCases = pendingPayouts + reports + supportTickets

      setStats({
        liveStreams,
        pendingPayouts,
        pendingApplications,
        reports,
        supportTickets,
        totalUsers,
        revenue,
        activeToday,
        openCases,
      })

      const activity: RecentActivity[] = []

      txRows.slice(0, 5).forEach((tx) => {
        activity.push({
          id: `tx-${tx.id || tx.created_at}`,
          type: 'purchase',
          text: tx.description || 'Coin purchase',
          time: new Date(tx.created_at).toLocaleString(),
          amount: tx.amount ? `$${Number(tx.amount).toFixed(2)}` : undefined,
        })
      })

      const reportsResult = await supabase
        .from('reports')
        .select('id, reason, status, created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      reportsResult.data?.forEach((r: any) => {
        activity.push({
          id: `report-${r.id}`,
          type: 'report',
          text: `Report: ${r.reason || 'User report'}`,
          time: new Date(r.created_at).toLocaleString(),
        })
      })

      const payoutsResult = await supabase
        .from('payout_requests')
        .select('id, net_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      payoutsResult.data?.forEach((p: any) => {
        activity.push({
          id: `payout-${p.id}`,
          type: 'payout',
          text: `Payout request ${p.status}`,
          time: new Date(p.created_at).toLocaleString(),
          amount: p.net_amount ? `$${Number(p.net_amount).toFixed(2)}` : undefined,
        })
      })

      activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setRecentActivity(activity.slice(0, 8))
    } catch (error) {
      console.error('[PhoneAdminMobile] Failed to load admin data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isAuthorized])

  useEffect(() => {
    if (!isLoading) {
      void fetchAdminData()
    } else {
      setLoading(false)
    }
  }, [isLoading, isAuthorized, fetchAdminData])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(false)
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [])

  /* ------------------------------------------------------------------------ */
  /* Navigation                                                               */
  /* ------------------------------------------------------------------------ */

  const TAB_TO_PHONE_ROUTE: Record<string, string> = {
    users: '/admin/users',
    payout_queue: '/admin/payouts',
    payouts: '/admin/payouts',
    reports_queue: '/admin/reports',
    reports: '/admin/reports',
    chat_moderation: '/admin/moderation',
    applications: '/admin',
    broadcasters: '/admin',
    stream_monitor: '/admin',
    role_management: '/admin/settings',
    support_tickets: '/admin',
    finance_dashboard: '/admin',
    economy_dashboard: '/admin',
    purchases: '/admin',
    cashouts: '/admin/payouts',
    verification: '/admin/settings',
    announcements: '/admin/settings',
    send_notifications: '/admin/settings',
    grant_coins: '/admin',
    media_library: '/admin',
    system_health: '/admin',
    database_backup: '/admin',
    connections: '/admin',
    system_config: '/admin/settings',
    reset_maintenance: '/admin/settings',
    export_data: '/admin',
    officer_shifts: '/admin',
    shift_requests_approval: '/admin',
    tax_reviews: '/admin',
    payment_logs: '/admin',
    voting: '/admin',
    families: '/admin',
    customer_service: '/admin',
    agreements: '/admin',
    test_diagnostics: '/admin',
    cache_clear: '/admin/settings',
  }

  const openAdmin = useCallback(
    (tab: string) => {
      const route = TAB_TO_PHONE_ROUTE[tab]
      if (route) {
        navigate(route)
      } else {
        navigate('/admin')
      }
    },
    [navigate],
  )

  const handleAction = useCallback(
    (action: AdminAction) => {
      if (action.path) {
        navigate(action.path)
        return
      }

      if (action.tab) {
        openAdmin(action.tab)
      }
    },
    [navigate, openAdmin],
  )

  /* ------------------------------------------------------------------------ */
  /* Admin Actions                                                            */
  /* ------------------------------------------------------------------------ */

  const priorityActions: AdminAction[] = [
    {
      id: 'broadcast',
      title: 'Broadcast Control',
      description: 'Monitor live streams and take broadcast actions.',
      icon: Radio,
      accent: 'blue',
      badge: stats.liveStreams,
      tab: 'stream_monitor',
    },
    {
      id: 'payouts',
      title: 'Payout Requests',
      description: 'Review, approve, decline, and manage payouts.',
      icon: WalletCards,
      accent: 'green',
      badge: stats.pendingPayouts,
      tab: 'payout_queue',
    },
    {
      id: 'applications',
      title: 'Applications',
      description: 'Approve or reject incoming platform applications.',
      icon: FileCheck2,
      accent: 'purple',
      badge: stats.pendingApplications,
      tab: 'applications',
    },
    {
      id: 'broadcasters',
      title: 'Broadcasters',
      description: 'Manage broadcasters, status, and broadcast access.',
      icon: Radio,
      accent: 'purple',
      tab: 'broadcasters',
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Search users and manage account-level controls.',
      icon: Users,
      accent: 'blue',
      badge: stats.totalUsers,
      tab: 'users',
    },
    {
      id: 'roles',
      title: 'Roles & Permissions',
      description: 'Change roles and administrative access.',
      icon: UserCog,
      accent: 'pink',
      tab: 'role_management',
    },
    {
      id: 'moderation',
      title: 'Chat Moderation',
      description: 'Handle chat abuse, moderation, and enforcement.',
      icon: ShieldAlert,
      accent: 'red',
      tab: 'chat_moderation',
    },
    {
      id: 'reports',
      title: 'Reports Queue',
      description: 'Review user, stream, and content reports.',
      icon: Flag,
      accent: 'red',
      badge: stats.reports,
      tab: 'reports_queue',
    },
  ]

  const financeActions: AdminAction[] = [
    {
      id: 'support',
      title: 'Support',
      description: 'Open tickets and customer-service operations.',
      icon: Headphones,
      accent: 'amber',
      badge: stats.supportTickets,
      tab: 'support_tickets',
    },
    {
      id: 'finance',
      title: 'Finance Center',
      description: 'Revenue, payouts, fees, and financial controls.',
      icon: CircleDollarSign,
      accent: 'green',
      tab: 'finance_dashboard',
    },
    {
      id: 'economy',
      title: 'Coin Economy',
      description: 'Monitor coins, liabilities, grants, and economy.',
      icon: Coins,
      accent: 'purple',
      tab: 'economy_dashboard',
    },
    {
      id: 'purchases',
      title: 'Purchases',
      description: 'Review coin purchases and payment activity.',
      icon: Banknote,
      accent: 'green',
      tab: 'purchases',
    },
    {
      id: 'cashouts',
      title: 'Cashouts',
      description: 'Inspect broadcaster cashout activity.',
      icon: WalletCards,
      accent: 'green',
      tab: 'cashouts',
    },
    {
      id: 'verification',
      title: 'Verification',
      description: 'Review verification-related workflows.',
      icon: CheckCircle2,
      accent: 'blue',
      tab: 'verification',
    },
    {
      id: 'announcements',
      title: 'Announcements',
      description: 'Publish platform-wide admin announcements.',
      icon: Megaphone,
      accent: 'pink',
      tab: 'announcements',
    },
    {
      id: 'notifications',
      title: 'Send Notifications',
      description: 'Send targeted platform notifications.',
      icon: Bell,
      accent: 'purple',
      tab: 'send_notifications',
    },
    {
      id: 'grant-coins',
      title: 'Grant Coins',
      description: 'Issue administrative coin adjustments.',
      icon: Coins,
      accent: 'amber',
      tab: 'grant_coins',
    },
  ]

  const platformActions: AdminAction[] = [
    {
      id: 'media',
      title: 'Media Library',
      description: 'Manage platform media and broadcast assets.',
      icon: Smartphone,
      accent: 'blue',
      tab: 'media_library',
    },
    {
      id: 'system-health',
      title: 'System Health',
      description: 'Inspect platform health and operational status.',
      icon: Activity,
      accent: 'green',
      tab: 'system_health',
    },
    {
      id: 'database',
      title: 'Database Backup',
      description: 'Database and backup administration tools.',
      icon: Database,
      accent: 'blue',
      tab: 'database_backup',
    },
    {
      id: 'connections',
      title: 'Connections',
      description: 'Review connected platform services.',
      icon: Zap,
      accent: 'purple',
      tab: 'connections',
    },
    {
      id: 'system-config',
      title: 'System Config',
      description: 'Platform configuration and operational settings.',
      icon: Settings2,
      accent: 'amber',
      tab: 'system_config',
    },
    {
      id: 'maintenance',
      title: 'Maintenance',
      description: 'Reset and maintenance operations.',
      icon: Wrench,
      accent: 'red',
      tab: 'reset_maintenance',
    },
    {
      id: 'export',
      title: 'Export Data',
      description: 'Export administrative and operational data.',
      icon: BarChart3,
      accent: 'blue',
      tab: 'export_data',
    },
  ]

  const advancedActions: AdminAction[] = [
    {
      id: 'officers',
      title: 'Officer Shifts',
      description: 'Manage officer schedules and shift requests.',
      icon: BriefcaseBusiness,
      accent: 'purple',
      tab: 'officer_shifts',
    },
    {
      id: 'shift-requests',
      title: 'Shift Approvals',
      description: 'Approve or reject officer shift requests.',
      icon: TicketCheck,
      accent: 'green',
      tab: 'shift_requests_approval',
    },
    {
      id: 'tax',
      title: 'Tax Reviews',
      description: 'Review financial tax-related workflows.',
      icon: CircleDollarSign,
      accent: 'amber',
      tab: 'tax_reviews',
    },
    {
      id: 'payment-logs',
      title: 'Payment Logs',
      description: 'Inspect payment and transaction history.',
      icon: BarChart3,
      accent: 'blue',
      tab: 'payment_logs',
    },
    {
      id: 'proposals',
      title: 'Proposals',
      description: 'Review platform proposals and decisions.',
      icon: SlidersHorizontal,
      accent: 'purple',
      tab: 'voting',
    },
    {
      id: 'families',
      title: 'Families',
      description: 'Manage family and account relationship tools.',
      icon: Users,
      accent: 'pink',
      tab: 'families',
    },
    {
      id: 'customer-service',
      title: 'Customer Service',
      description: 'Customer service operations and escalations.',
      icon: Headphones,
      accent: 'amber',
      tab: 'customer_service',
    },
    {
      id: 'agreements',
      title: 'Agreements',
      description: 'Review and manage platform agreements.',
      icon: FileCheck2,
      accent: 'purple',
      tab: 'agreements',
    },
    {
      id: 'diagnostics',
      title: 'Diagnostics',
      description: 'Run platform tests and diagnostics.',
      icon: MonitorCog,
      accent: 'blue',
      tab: 'test_diagnostics',
    },
    {
      id: 'cache',
      title: 'Clear Cache',
      description: 'Administrative cache and refresh controls.',
      icon: RefreshCw,
      accent: 'blue',
      tab: 'cache_clear',
    },
  ]

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05010f] px-6 text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
            <RefreshCw
              className="animate-spin text-cyan-300"
              size={24}
            />
          </div>

          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-white/70">
            Loading Admin
          </p>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------------ */
  /* Unauthorized                                                             */
  /* ------------------------------------------------------------------------ */

  if (!isAuthorized) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05010f] px-6 text-white">
        <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute -right-20 bottom-20 h-64 w-64 rounded-full bg-violet-600/10 blur-[100px]" />

        <section
          className={[
            neonCard,
            'relative w-full max-w-sm p-6 text-center',
          ].join(' ')}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
            <ShieldAlert
              className="text-red-300"
              size={28}
            />
          </div>

          <h1 className="mt-5 text-xl font-black text-white">
            Access Restricted
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            This control center is restricted to authorized
            administrators.
          </p>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className={[
              'mt-6 flex h-12 w-full items-center justify-center',
              'gap-2 rounded-xl border border-white/10',
              'bg-white/5 text-sm font-black text-white',
              'active:scale-[0.98]',
            ].join(' ')}
          >
            <ArrowLeft size={17} />
            Go Back
          </button>
        </section>
      </div>
    )
  }

  /* ------------------------------------------------------------------------ */
  /* Main UI                                                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      {/* Ambient Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-[110px]" />

        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />

        <div className="absolute bottom-0 left-1/2 h-80 w-[120%] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/5 via-violet-600/10 to-fuchsia-500/5 blur-[120px]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.35)_100%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#05010f]/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className={[
              'flex h-10 w-10 items-center justify-center',
              'rounded-xl border border-white/10',
              'bg-white/[0.04] text-white/80',
              'active:scale-95',
            ].join(' ')}
          >
            <ArrowLeft size={18} />
          </button>

          <div className="text-center">
            <div
              className={[
                'text-sm font-black uppercase tracking-[0.2em]',
                neonTextGradient,
              ].join(' ')}
            >
              MaiTroll Admin
            </div>

            <div className="mt-0.5 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />

              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Command Center
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchAdminData}
            disabled={refreshing || metricsLoading}
            aria-label="Refresh admin metrics"
            className={[
              'flex h-10 w-10 items-center justify-center',
              'rounded-xl border border-white/10',
              'bg-white/[0.04] text-white/70',
              'active:scale-95 disabled:opacity-40',
            ].join(' ')}
          >
            <RefreshCw
              size={17}
              className={refreshing || metricsLoading ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 pb-10 pt-4">
        {/* Command Banner */}
        <section
          className={[
            neonCard,
            'relative overflow-hidden p-5',
          ].join(' ')}
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-500/15 blur-[70px]" />

          <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-[60px]" />

          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-violet-500/10">
              <Shield
                className="text-cyan-300"
                size={25}
              />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300/70">
                Administrator
              </p>

              <h1 className="mt-1 truncate text-xl font-black text-white">
                Control Center
              </h1>

              <p className="mt-1 text-[10px] text-zinc-500">
                Manage MaiTroll from one mobile command deck.
              </p>
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section className="mt-4 grid grid-cols-2 gap-2.5">
          <MetricCard
            label="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            accent="blue"
          />

          <MetricCard
            label="Active Today"
            value={stats.activeToday.toLocaleString()}
            icon={Activity}
            accent="green"
          />

          <MetricCard
            label="Revenue"
            value={`$${stats.revenue.toLocaleString()}`}
            icon={DollarSign}
            accent="amber"
          />

          <MetricCard
            label="Open Cases"
            value={stats.openCases.toLocaleString()}
            icon={AlertTriangle}
            accent="red"
          />
        </section>

        {/* Recent Activity */}
        <section className="mt-6">
          <SectionHeader
            eyebrow="Live"
            title="Recent Activity"
            tone="blue"
          />

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 backdrop-blur-xl">
            {recentActivity.length === 0 ? (
              <p className="text-[10px] text-zinc-500 text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-white truncate">{item.text}</p>
                      <p className="text-[8px] text-zinc-500 mt-0.5">{item.time}</p>
                    </div>
                    {item.amount && (
                      <span className="text-[10px] font-black text-emerald-300 ml-2">{item.amount}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <section className="mt-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {[
              { id: 'daily', label: 'Daily Operations', icon: Radio },
              { id: 'finance', label: 'Finance', icon: DollarSign },
              { id: 'platform', label: 'Operations', icon: Activity },
              { id: 'advanced', label: 'More Controls', icon: Settings2 },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-wider transition-all',
                  activeTab === tab.id
                    ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20'
                )}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {activeTab === 'daily' && (
              <div className="grid grid-cols-2 gap-2.5">
                {priorityActions.map((action) => (
                  <AdminCard
                    key={action.id}
                    action={action}
                    onClick={() => handleAction(action)}
                  />
                ))}
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="grid grid-cols-2 gap-2.5">
                {financeActions.map((action) => (
                  <AdminCard
                    key={action.id}
                    action={action}
                    onClick={() => handleAction(action)}
                  />
                ))}
              </div>
            )}

            {activeTab === 'platform' && (
              <div className="grid grid-cols-2 gap-2.5">
                {platformActions.map((action) => (
                  <AdminCard
                    key={action.id}
                    action={action}
                    onClick={() => handleAction(action)}
                  />
                ))}
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="grid grid-cols-2 gap-2.5">
                {advancedActions.map((action) => (
                  <AdminCard
                    key={action.id}
                    action={action}
                    onClick={() => handleAction(action)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Safety */}
        <section className="mt-7 rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10">
              <ShieldAlert
                size={18}
                className="text-red-300"
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-red-200">
                Admin Safety
              </p>

              <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                Destructive actions should be performed from their
                dedicated admin controls so confirmations and audit
                logging remain in place.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}