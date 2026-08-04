import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  FileText,
  Loader2,
  Newspaper,
  Radio,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { useTCNNRoles } from '@/hooks/useTCNNRoles'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import ArticlesTab from '@/components/tcnn/dashboard/ArticlesTab'
import PendingApprovalsTab from '@/components/tcnn/dashboard/PendingApprovalsTab'
import TickerQueueTab from '@/components/tcnn/dashboard/TickerQueueTab'
import LiveControlTab from '@/components/tcnn/dashboard/LiveControlTab'
import RoleManagementTab from '@/components/tcnn/dashboard/RoleManagementTab'
import AnalyticsTab from '@/components/tcnn/dashboard/AnalyticsTab'

interface DashboardStats {
  published: number
  pending: number
  viewsToday: number
}

type TabId = 'articles' | 'approvals' | 'ticker' | 'live' | 'roles' | 'analytics'

const page =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07090f] px-4 pb-8 pt-24 text-white md:px-6'

const panel =
  'rounded-[2rem] border border-slate-700/70 bg-slate-950/80 shadow-[0_0_45px_rgba(15,23,42,0.55)] backdrop-blur-2xl'

const card =
  'rounded-2xl border border-slate-700/70 bg-slate-900/70 shadow-[0_0_24px_rgba(15,23,42,0.35)] backdrop-blur-xl'

const pressRed =
  'border-red-500/35 bg-red-600 text-white shadow-[0_0_24px_rgba(220,38,38,0.24)]'

export default function TCNNInternalDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('articles')
  const [stats, setStats] = useState<DashboardStats>({
    published: 0,
    pending: 0,
    viewsToday: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  const { user } = useAuthStore()

  const {
    isJournalist,
    isNewsCaster,
    isChiefNewsCaster,
    hasAnyRole,
    canApproveArticles,
    canManageRoles,
  } = useTCNNRoles(user?.id)

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true)

      try {
        const [{ count: publishedCount }, { count: pendingCount }] = await Promise.all([
          supabase
            .from('tcnn_articles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published'),
          supabase
            .from('tcnn_articles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_review'),
        ])

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data: todayViewsData } = await supabase
          .from('tcnn_articles')
          .select('view_count')
          .gte('updated_at', today.toISOString())

        const viewsToday =
          todayViewsData?.reduce((sum, article) => sum + Number(article.view_count || 0), 0) || 0

        setStats({
          published: publishedCount || 0,
          pending: pendingCount || 0,
          viewsToday,
        })
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }

    void fetchStats()

    const interval = window.setInterval(fetchStats, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const tabs = useMemo(
    () =>
      [
        { id: 'articles' as const, label: 'Articles', icon: FileText, show: true },
        { id: 'approvals' as const, label: 'Approvals', icon: CheckCircle, show: canApproveArticles },
        { id: 'ticker' as const, label: 'Ticker Queue', icon: Newspaper, show: isNewsCaster || isChiefNewsCaster },
        { id: 'live' as const, label: 'Live Control', icon: Radio, show: isNewsCaster || isChiefNewsCaster },
        { id: 'roles' as const, label: 'Role Management', icon: Users, show: canManageRoles },
        { id: 'analytics' as const, label: 'Analytics', icon: BarChart3, show: true },
      ].filter((tab) => tab.show),
    [canApproveArticles, canManageRoles, isChiefNewsCaster, isNewsCaster]
  )

  const roleLabel = useMemo(() => {
    if (isChiefNewsCaster) return 'Chief News Caster'
    if (isNewsCaster) return 'News Caster'
    if (isJournalist) return 'Journalist'
    return 'TCNN Staff'
  }, [isChiefNewsCaster, isNewsCaster, isJournalist])

  if (!hasAnyRole) {
    return (
      <div className={page}>
        <BackgroundFX />

        <div className="relative z-10 flex min-h-[calc(100vh-140px)] items-center justify-center">
          <div className={cn(panel, 'max-w-md p-8 text-center')}>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-300" />
            </div>

            <h1 className="text-2xl font-black text-white">TCNN Access Denied</h1>
            <p className="mt-2 text-sm text-slate-400">
              This newsroom dashboard is restricted to authorized TCNN staff.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'articles':
        return <ArticlesTab />
      case 'approvals':
        return <PendingApprovalsTab />
      case 'ticker':
        return <TickerQueueTab />
      case 'live':
        return <LiveControlTab />
      case 'roles':
        return <RoleManagementTab />
      case 'analytics':
        return <AnalyticsTab />
      default:
        return <ArticlesTab />
    }
  }

  return (
    <div className={page}>
      <BackgroundFX />

      <main className="relative z-10 mx-auto flex h-[calc(100vh-120px)] max-w-7xl flex-col gap-4">
        <header className={cn(panel, 'shrink-0 overflow-hidden')}>
          <div className="border-b border-slate-700/70 bg-gradient-to-r from-red-950/40 via-slate-950 to-slate-950 px-5 py-4">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/35 bg-red-600 shadow-[0_0_24px_rgba(220,38,38,0.28)]">
                  <Radio className="h-8 w-8 text-white" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-red-300">
                    Mai Troll News Network
                  </p>
                  <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                    TCNN Newsroom Command
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Internal publishing, approvals, ticker control, live desk, roles, and analytics.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-600/70 bg-slate-950/70 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200">
                  <ShieldCheck className="h-4 w-4 text-red-300" />
                  {roleLabel}
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Staff Access
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3">
            {statsLoading ? (
              <div className={cn(card, 'col-span-full flex items-center justify-center p-5')}>
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-400" />
                <span className="text-sm font-bold text-slate-400">Loading newsroom stats...</span>
              </div>
            ) : (
              <>
                <StatCard label="Published Articles" value={stats.published} tone="white" />
                <StatCard label="Pending Review" value={stats.pending} tone="amber" />
                <StatCard
                  label="Views Today"
                  value={stats.viewsToday >= 1000 ? `${(stats.viewsToday / 1000).toFixed(1)}k` : stats.viewsToday}
                  tone="green"
                />
              </>
            )}
          </div>

          <nav className="border-t border-slate-700/70 px-4 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition',
                      active
                        ? pressRed
                        : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </nav>
        </header>

        <section className={cn(panel, 'min-h-0 flex-1 overflow-hidden p-4')}>
          <div className="h-full overflow-auto rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
            {renderTabContent()}
          </div>
        </section>
      </main>
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.9),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-red-600/10 to-transparent" />
    </>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'white' | 'amber' | 'green'
}) {
  return (
    <div className={cn(card, 'p-4 text-center')}>
      <p
        className={cn(
          'text-3xl font-black',
          tone === 'white' && 'text-white',
          tone === 'amber' && 'text-amber-300',
          tone === 'green' && 'text-emerald-300'
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
    </div>
  )
}