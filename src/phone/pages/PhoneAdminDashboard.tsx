// src/pages/admin/PhoneAdminDashboard.tsx
//
// Phone-native admin command center.
// This intentionally uses the real AdminDashboard authorization + data logic.
// TempAdminDashboard is NOT used here.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronRight,
  Coins,
  Database,
  DollarSign,
  FileText,
  HeadphonesIcon,
  LogOut,
  Menu,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Siren,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../../lib/store'
import { supabase, isAdminEmail } from '../../lib/supabase'
import { useAdminFinanceRealtime } from '../../hooks/useAdminFinanceRealtime'
import { useAdminDashboardMetrics } from '../../hooks/useAdminDashboardMetrics'

import ErrorBoundary from '../../components/ErrorBoundary'
import FinanceEconomyCenter from '../../pages/admin/components/FinanceEconomyCenter'
import LivePurchasableInventory from '../../pages/admin/components/LivePurchasableInventory'
import OperationsControlDeck from '../../pages/admin/components/OperationsControlDeck'
import AdditionalTasksGrid from '../../pages/admin/components/AdditionalTasksGrid'
import ProposalManagementPanel from '../../pages/admin/components/shared/ProposalManagementPanel'
import PresidentialOversightPanel from '../../pages/admin/components/PresidentialOversightPanel'
import BetaCapacityMonitor from '../../pages/admin/components/BetaCapacityMonitor'
import MaiPayPlusManager from '../../pages/admin/components/MaiPayPlusManager'
import FirstCashoutMatch from '../../pages/admin/FirstCashoutMatch'

type StatState = {
  totalUsers: number
  adminsCount: number
  pendingApps: number
  pendingPayouts: number
  trollOfficers: number
  aiFlags: number
  coinSalesRevenue: number
  totalPayouts: number
  feesCollected: number
  platformProfit: number
  purchasedCoins: number
  earnedCoins: number
  freeCoins: number
  totalCoinsInCirculation: number
  totalValue: number
  giftCoins: number
  appSponsoredGifts: number
  total_liability_coins: number
  total_platform_profit_usd: number
  kick_ban_revenue: number
}

interface EconomySummary {
  trollCoins: {
    totalPurchased: number
    outstandingLiability: number
  }
  broadcasters: {
    totalUsdOwed: number
  }
}

type TabId =
  | 'hr'
  | 'all_hr'
  | 'database_backup'
  | 'system_health'
  | 'cache_clear'
  | 'system_config'
  | 'user_search'
  | 'reports_queue'
  | 'role_management'
  | 'stream_monitor'
  | 'media_library'
  | 'chat_moderation'
  | 'announcements'
  | 'economy_dashboard'
  | 'finance_dashboard'
  | 'cost_dashboard'
  | 'grant_coins'
  | 'tax_reviews'
  | 'payment_logs'
  | 'create_schedule'
  | 'officer_shifts'
  | 'shift_requests_approval'
  | 'referral_bonuses'
  | 'control_panel'
  | 'test_diagnostics'
  | 'reset_maintenance'
  | 'export_data'
  | 'connections'
  | 'payouts'
  | 'payout_queue'
  | 'voting'
  | 'cashouts'
  | 'purchases'
  | 'declined'
  | 'verification'
  | 'users'
  | 'broadcasters'
  | 'families'
  | 'support'
  | 'support_tickets'
  | 'customer_service'
  | 'agreements'
  | 'reports'
  | 'send_notifications'
  | 'applications'

interface LiveStream {
  id: string
  title: string
  category: string
  status: string
  created_at: string
  broadcaster_id: string
}

interface CoinPurchaseRow {
  id: string
  user_id: string | null
  username: string
  amount_coins: number
  amount_usd: number
  type: string
  source: string
  package_id: string | null
  paypal_order_id: string | null
  paypal_capture_id: string | null
  payer_email: string | null
  created_at: string
  status: string | null
}

const shell =
  'min-h-screen bg-[#050711] text-white selection:bg-cyan-400/30 selection:text-white'
const panel =
  'rounded-2xl border border-white/10 bg-slate-950/75 shadow-2xl shadow-black/30 backdrop-blur-xl'

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className={`${panel} min-w-0 p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="truncate text-xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      {detail && <div className="mt-1 truncate text-[10px] text-slate-500">{detail}</div>}
    </div>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 p-2 text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-black">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

function LiveMonitor({
  streams,
  loading,
  onRefresh,
  onView,
  onEnd,
  onDelete,
}: {
  streams: LiveStream[]
  loading: boolean
  onRefresh: () => void
  onView: (id: string) => void
  onEnd: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return streams
    return streams.filter(
      stream =>
        stream.title?.toLowerCase().includes(q) ||
        stream.category?.toLowerCase().includes(q) ||
        stream.id.toLowerCase().includes(q),
    )
  }, [query, streams])

  return (
    <section id="phone-live-monitor" className={`${panel} p-4`}>
      <SectionTitle
        icon={Radio}
        title="Live Monitor"
        subtitle={`${streams.length} active broadcast${streams.length === 1 ? '' : 's'}`}
        action={
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 active:scale-95"
            aria-label="Refresh live broadcasts"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search live broadcasts..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        )}
      </div>

      {loading && streams.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading broadcasts...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
          <Radio className="mx-auto mb-2 h-8 w-8 text-slate-700" />
          <p className="text-sm font-bold text-slate-400">
            {query ? 'No matching broadcasts' : 'No active broadcasts'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(stream => (
            <article
              key={stream.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => onView(stream.id)}
                className="block w-full p-4 text-left active:bg-white/5"
                aria-label={`Enter ${stream.title || 'broadcast'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                    LIVE
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>

                <h3 className="line-clamp-2 text-sm font-black">
                  {stream.title || 'Untitled broadcast'}
                </h3>

                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500">
                  <span className="rounded-lg bg-white/5 px-2 py-1">
                    {stream.category || 'General'}
                  </span>
                  <span className="rounded-lg bg-white/5 px-2 py-1">
                    {stream.status || 'live'}
                  </span>
                </div>
              </button>

              <div className="grid grid-cols-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => onEnd(stream.id)}
                  className="border-r border-white/10 px-3 py-3 text-xs font-black text-amber-300 active:bg-amber-400/10"
                >
                  End
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(stream.id)}
                  className="px-3 py-3 text-xs font-black text-red-300 active:bg-red-400/10"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default function PhoneAdminDashboard() {
  const { profile, user, setProfile, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const [adminCheckLoading, setAdminCheckLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [_activeTab, setActiveTab] = useState<TabId>('connections')

  const {
    financeSummary,
    isLoading: financeLoading,
    isConnected,
    lastSync,
    refreshFinance,
  } = useAdminFinanceRealtime()

  const { metrics: dashboardMetrics, refreshMetrics } = useAdminDashboardMetrics()

  const [_coinPurchases, setCoinPurchases] = useState<CoinPurchaseRow[]>([])
  const [_coinPurchasesLoading, setCoinPurchasesLoading] = useState(false)
  const [taskCounts, setTaskCounts] = useState({
    taxReviews: 0,
    supportTickets: 0,
    alerts: 0,
  })
  const [careerAppsCount, setCareerAppsCount] = useState(0)
  const [legacyAppsCount, setLegacyAppsCount] = useState(0)
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [streamsLoading, setStreamsLoading] = useState(false)

  const stats: StatState = financeSummary
    ? {
        totalUsers: dashboardMetrics.totalUsers || financeSummary.users.totalUsers,
        adminsCount: financeSummary.users.adminsCount,
        pendingApps: careerAppsCount + legacyAppsCount,
        pendingPayouts: financeSummary.users.pendingPayouts,
        trollOfficers:
          dashboardMetrics.trollOfficers || financeSummary.users.trollOfficers,
        aiFlags: financeSummary.users.aiFlags,
        coinSalesRevenue:
          dashboardMetrics.coinRevenue || financeSummary.economy.coinSalesRevenue,
        totalPayouts: financeSummary.economy.totalPayouts,
        feesCollected: financeSummary.economy.feesCollected,
        platformProfit:
          dashboardMetrics.platformProfit || financeSummary.economy.platformProfit,
        purchasedCoins:
          dashboardMetrics.coinsSold || financeSummary.economy.purchasedCoins,
        earnedCoins: financeSummary.economy.earnedCoins,
        freeCoins: financeSummary.economy.freeCoins,
        totalCoinsInCirculation:
          dashboardMetrics.coinsInCirculation ||
          financeSummary.economy.totalCoinsInCirculation,
        totalValue: financeSummary.economy.totalValue,
        giftCoins: financeSummary.economy.giftCoins,
        appSponsoredGifts: financeSummary.economy.appSponsoredGifts,
        total_liability_coins: financeSummary.financial.total_liability_coins,
        total_platform_profit_usd:
          financeSummary.financial.total_platform_profit_usd,
        kick_ban_revenue: financeSummary.financial.kick_ban_revenue,
      }
    : {
        totalUsers: dashboardMetrics.totalUsers,
        adminsCount: 0,
        pendingApps: careerAppsCount + legacyAppsCount,
        pendingPayouts: 0,
        trollOfficers: dashboardMetrics.trollOfficers,
        aiFlags: 0,
        coinSalesRevenue: dashboardMetrics.coinRevenue,
        totalPayouts: 0,
        feesCollected: 0,
        platformProfit: dashboardMetrics.platformProfit,
        totalCoinsInCirculation: dashboardMetrics.coinsInCirculation,
        totalValue: 0,
        purchasedCoins: dashboardMetrics.coinsSold,
        earnedCoins: 0,
        freeCoins: 0,
        giftCoins: 0,
        appSponsoredGifts: 0,
        total_liability_coins: 0,
        total_platform_profit_usd: 0,
        kick_ban_revenue: 0,
      }

  const economySummary = useMemo<EconomySummary | null>(() => {
      if (!financeSummary) return null
      return {
        trollCoins: {
          totalPurchased: financeSummary.economy.purchasedCoins,
          outstandingLiability: financeSummary.financial.total_liability_coins / 100,
        },
        broadcasters: {
          totalUsdOwed: financeSummary.economy.totalPayouts,
        },
      }
  }, [financeSummary])
  const economyLoading = financeLoading
  const loadCareerAppsCount = useCallback(async () => {
    try {
      const [careerRes, legacyRes] = await Promise.all([
        supabase
          .from('career_applications')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'applied']),
        supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'deleted')
          .eq('status', 'pending'),
      ])

      setCareerAppsCount(careerRes.count || 0)
      setLegacyAppsCount(legacyRes.count || 0)
    } catch (error) {
      console.error('Failed to load career apps count:', error)
    }
  }, [])

  const loadTaskCounts = useCallback(async () => {
    try {
      const [taxReviewsRes, supportRes, alertsRes] = await Promise.all([
        supabase.from('user_tax_info').select('id').eq('status', 'pending'),
        supabase.from('support_tickets').select('id').eq('status', 'open'),
        supabase.from('system_alerts').select('id').eq('status', 'unread'),
      ])

      setTaskCounts({
        taxReviews: taxReviewsRes.data?.length || 0,
        supportTickets: supportRes.data?.length || 0,
        alerts: alertsRes.data?.length || 0,
      })
    } catch (error) {
      console.error('Error loading task counts:', error)
    }
  }, [])

  const loadLiveStreams = useCallback(async () => {
    setStreamsLoading(true)

    try {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, category, status, created_at, broadcaster_id')
        .eq('is_live', true)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setLiveStreams(data || [])
    } catch (error) {
      console.error('Error loading live streams:', error)
    } finally {
      setStreamsLoading(false)
    }
  }, [])

  const loadCoinPurchases = useCallback(async () => {
    setCoinPurchasesLoading(true)

    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select(
          'id,user_id,transaction_type,coins_used,amount,description,status,metadata,created_at',
        )
        .or(
          [
            'transaction_type.eq.purchase',
            'description.ilike.%PayPal purchase%',
            'description.ilike.%coin%',
            'metadata->>paypal_capture_id.not.is.null',
            'metadata->>paypal_order_id.not.is.null',
            'metadata->>package_id.not.is.null',
          ].join(','),
        )
        .order('created_at', { ascending: false })
        .limit(2000)

      const { data: storeData } = await supabase
        .from('coin_store_sales')
        .select(
          'id,user_id,amount_coins,amount_usd,paypal_order_id,paypal_capture_id,payer_email,package_id,created_at,status',
        )
        .order('created_at', { ascending: false })
        .limit(2000)

      const { data: paypalTxData } = await supabase
        .from('paypal_transactions')
        .select(
          'id,user_id,paypal_order_id,paypal_capture_id,amount,coins,status,created_at',
        )
        .order('created_at', { ascending: false })
        .limit(2000)

      if (txError) throw txError

      const data = (txData || []) as any[]
      const storeRows = (storeData || []) as any[]
      const paypalRows = (paypalTxData || []) as any[]

      const rowSources = new Map<string, string>()
      const seenPaypalOrderIds = new Set<string>()
      const seenPaypalCaptureIds = new Set<string>()

      for (const row of data) {
        rowSources.set(row.id, 'public.transactions')
        const meta = row.metadata || {}
        if (meta.paypal_order_id) seenPaypalOrderIds.add(meta.paypal_order_id)
        if (meta.paypal_capture_id) seenPaypalCaptureIds.add(meta.paypal_capture_id)
      }

      const combined = [...data]
      const existingIds = new Set(combined.map(row => row.id))

      for (const row of storeRows) {
        const orderId = row.paypal_order_id
        const captureId = row.paypal_capture_id
        const duplicate =
          (orderId && seenPaypalOrderIds.has(orderId)) ||
          (captureId && seenPaypalCaptureIds.has(captureId))

        if (duplicate || existingIds.has(row.id)) continue

        combined.push({
          id: row.id,
          user_id: row.user_id,
          type: 'purchase',
          transaction_type: 'purchase',
          coins_used: row.amount_coins,
          amount: row.amount_usd,
          description: 'Coin Store purchase',
          status: row.status,
          metadata: {
            package_id: row.package_id,
            paypal_order_id: row.paypal_order_id,
            paypal_capture_id: row.paypal_capture_id,
            payer_email: row.payer_email,
          },
          created_at: row.created_at,
        })

        rowSources.set(row.id, 'coin_store_sales')
        existingIds.add(row.id)
        if (orderId) seenPaypalOrderIds.add(orderId)
        if (captureId) seenPaypalCaptureIds.add(captureId)
      }

      for (const row of paypalRows) {
        const orderId = row.paypal_order_id
        const captureId = row.paypal_capture_id
        const duplicate =
          (orderId && seenPaypalOrderIds.has(orderId)) ||
          (captureId && seenPaypalCaptureIds.has(captureId))

        if (duplicate || existingIds.has(row.id)) continue

        combined.push({
          id: row.id,
          user_id: row.user_id,
          type: 'purchase',
          transaction_type: 'purchase',
          coins_used: row.coins,
          amount: row.amount,
          description: 'PayPal transaction',
          status: row.status,
          metadata: {
            paypal_order_id: row.paypal_order_id,
            paypal_capture_id: row.paypal_capture_id,
          },
          created_at: row.created_at,
        })

        rowSources.set(row.id, 'paypal_transactions')
        existingIds.add(row.id)
        if (orderId) seenPaypalOrderIds.add(orderId)
        if (captureId) seenPaypalCaptureIds.add(captureId)
      }

      const txRows = combined as any[]
      const userIds = [
        ...new Set(txRows.map(tx => tx.user_id).filter(Boolean)),
      ] as string[]

      const userMap = new Map<string, string>()

      if (userIds.length) {
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, email')
          .in('id', userIds)

        if (!usersError) {
          ;(usersData || []).forEach((row: any) => {
            userMap.set(
              row.id,
              row.display_name || row.username || row.email || row.id,
            )
          })
        }
      }

      const rows: CoinPurchaseRow[] = txRows.map(tx => {
        const meta = tx.metadata || {}

        const metadataCoins =
          Number(meta.coins_awarded || 0) ||
          Number(meta.coin_amount || 0) ||
          Number(meta.coins || 0)

        const descriptionCoins = (() => {
          const match = String(tx.description || '').match(/(\d[\d,]*)\s*coins?/i)
          return match ? Number(match[1].replace(/,/g, '')) : 0
        })()

        const coins =
          metadataCoins ||
          Number(tx.coins_used || 0) ||
          descriptionCoins ||
          Math.round(Number(tx.amount || 0) * 100)

        const userName = tx.user_id
          ? userMap.get(tx.user_id) ||
            meta.payer_email ||
            (tx.user_id.length > 20
              ? `${tx.user_id.slice(0, 20)}…`
              : tx.user_id)
          : 'Unknown buyer'

        return {
          id: tx.id,
          user_id: tx.user_id || null,
          username: userName,
          amount_coins: Math.abs(coins),
          amount_usd: Math.abs(Number(tx.amount || 0)),
          type: tx.transaction_type || tx.type || 'purchase',
          source: rowSources.get(tx.id) || 'public.transactions',
          package_id: typeof meta.package_id === 'string' ? meta.package_id : null,
          paypal_order_id:
            typeof meta.paypal_order_id === 'string'
              ? meta.paypal_order_id
              : null,
          paypal_capture_id:
            typeof meta.paypal_capture_id === 'string'
              ? meta.paypal_capture_id
              : null,
          payer_email:
            typeof meta.payer_email === 'string' ? meta.payer_email : null,
          created_at: tx.created_at || '',
          status: tx.status || null,
        }
      })

      setCoinPurchases(rows)
    } catch (error) {
      console.error('Error loading coin purchases:', error)
      toast.error('Failed to load coin purchases')
    } finally {
      setCoinPurchasesLoading(false)
    }
  }, [])

  const checkAdminAccess = useCallback(async () => {
    if (!user) {
      setAdminCheckLoading(false)
      setIsAuthorized(false)
      return
    }

    try {
      const { data: session } = await supabase.auth.getUser()

      if (!session.user) {
        setAdminCheckLoading(false)
        setIsAuthorized(false)
        return
      }

      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error || !profileData) {
        setIsAuthorized(false)
        return
      }

      const email = session.user.email || ''
      const isAdmin =
        profileData.role === 'admin' ||
        profileData.role === 'superadmin' ||
        profileData.role === 'ceo' ||
        profileData.is_admin === true ||
        (profileData as any).is_superadmin === true ||
        isAdminEmail(email)

      const isOfficerRole =
        profileData.role === 'troll_officer' ||
        profileData.role === 'lead_troll_officer'

      if (isOfficerRole) {
        setIsAuthorized(false)
        return
      }

      setIsAuthorized(isAdmin)
    } catch (error) {
      console.error('Error in admin check:', error)
      setIsAuthorized(false)
    } finally {
      setAdminCheckLoading(false)
    }
  }, [user])

  useEffect(() => {
    checkAdminAccess()
  }, [checkAdminAccess, isLoading])

  useEffect(() => {
    if (!isAuthorized) return

    loadLiveStreams()
    loadTaskCounts()
    loadCoinPurchases()
    loadCareerAppsCount()

    const interval = window.setInterval(() => {
      loadTaskCounts()
      loadCareerAppsCount()
    }, 5 * 60 * 1000)

    return () => window.clearInterval(interval)
  }, [
    isAuthorized,
    loadLiveStreams,
    loadTaskCounts,
    loadCoinPurchases,
    loadCareerAppsCount,
  ])

  const endStreamById = async (id: string) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

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

      if (!response.ok) {
        const textResponse = await response.text()
        let message = 'Failed to end stream'

        try {
          const json = JSON.parse(textResponse)
          message = json.error || message
        } catch {
          message = textResponse || message
        }

        throw new Error(message)
      }

      const result = await response.json()
      if (!result.success && result.error) throw new Error(result.error)

      toast.success('Stream ended successfully')
      await loadLiveStreams()
    } catch (error) {
      console.error('Error ending stream:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to end stream')
    }
  }

  const deleteStreamById = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this stream? This action cannot be undone.')) {
      return
    }

    try {
      const { error: endError } = await supabase
        .from('streams')
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (endError) throw endError

      const deleteRelatedData = async (
        table: string,
        column = 'stream_id',
      ) => {
        const { error } = await supabase.from(table).delete().eq(column, id)

        if (
          error &&
          error.code !== 'PGRST205' &&
          error.code !== '42P01' &&
          error.code !== '42501'
        ) {
          console.warn(`Could not delete from ${table}:`, error)
        }
      }

      const cleanupStreamParticipants = async () => {
        const { error } = await supabase.functions.invoke(
          'streams-maintenance',
          {
            body: {
              action: 'delete_stream',
              stream_id: id,
            },
          },
        )

        if (error) {
          console.warn(
            'Failed to clean up stream participants via service function',
            error,
          )
        }
      }

      await Promise.allSettled([
        deleteRelatedData('messages'),
        deleteRelatedData('stream_reports'),
        cleanupStreamParticipants(),
        deleteRelatedData('gifts'),
        deleteRelatedData('chat_messages'),
      ])

      const { error: deleteError } = await supabase
        .from('streams')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      toast.success('Stream deleted successfully')
      await loadLiveStreams()
    } catch (error: any) {
      console.error('Error deleting stream:', error)
      toast.error(error?.message || 'Failed to delete stream')
    }
  }

  const viewStream = (id: string) => {
    navigate(`/watch/${id}?admin=1&phone=1`)
  }

  const handleEmergencyStop = async () => {
    if (
      !window.confirm(
        'EMERGENCY STOP: This will immediately END ALL active broadcasts. Continue?',
      )
    ) {
      return
    }

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
      loadLiveStreams()
    } catch (error) {
      console.error('Error executing emergency stop:', error)
      toast.error('Failed to stop streams')
    }
  }

  const handleLogout = async () => {
    try {
      localStorage.clear()

      const introSeen = sessionStorage.getItem('trollIntroSeen')
      sessionStorage.clear()
      if (introSeen) sessionStorage.setItem('trollIntroSeen', introSeen)

      const { logout } = useAuthStore.getState()
      if (logout) logout()

      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session) await supabase.auth.signOut()

      toast.success('Logged out')
      navigate('/auth', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
      localStorage.clear()
      sessionStorage.clear()
      navigate('/auth', { replace: true })
    }
  }

  const handleResetApp = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      toast.success('App reset')
    } catch {
      // no-op
    }
    navigate('/auth?reset=1', { replace: true })
  }

  const _handleBroadcastMessage = () => navigate('/admin/send-notifications')
  const _handleSendNotifications = () => navigate('/admin/send-notifications')
  const _handleSystemMaintenance = () => navigate('/admin/reset-maintenance')
  const _handleViewAnalytics = () => navigate('/admin/reports-queue')
  const _handleExportData = () => navigate('/admin/export-data')

  const handleNavigateToEconomy = () => navigate('/admin/economy')
  const handleNavigateToTaxReviews = () => navigate('/admin/tax-reviews')
  const handleOpenTestDiagnostics = () => navigate('/admin/test-diagnostics')
  const handleOpenControlPanel = () => navigate('/admin/control-panel')
  const handleOpenGrantCoins = () => navigate('/admin/grant-coins')
  const handleOpenFinanceDashboard = () => navigate('/admin/finance')
  const handleOpenCreateSchedule = () => navigate('/admin/create-schedule')
  const handleOpenResetPanel = () => navigate('/admin/reset-maintenance')
  const handleOpenReferralBonuses = () => navigate('/admin/referral-bonuses')
  const handleOpenApplications = () => navigate('/admin/applications')
  const handleOpenAdminPool = () => navigate('/admin/pool')
  const handleOpenTrollmersTournament = () =>
    navigate('/admin/trollmers-tournament')
  const _handleOpenManualOrders = () => navigate('/admin/manual-orders')

  const redirectRoutes = useMemo(
    () =>
      ({
        hr: '/admin/hr',
        all_hr: '/admin/hr',
        database_backup: '/admin/system/backup',
        cache_clear: '/admin/system/cache',
        system_config: '/admin/system/config',
        user_search: '/admin/user-search',
        users: '/admin/user-search',
        reports_queue: '/admin/reports-queue',
        role_management: '/admin/role-management',
        stream_monitor: '/admin/stream-monitor',
        voting: '/admin/voting',
        media_library: '/admin/media-library',
        chat_moderation: '/admin/chat-moderation',
        announcements: '/admin/announcements',
        reports: '/admin/reports-queue',
        finance_dashboard: '/admin/finance',
        economy_dashboard: '/admin/economy',
        grant_coins: '/admin/grant-coins',
        tax_reviews: '/admin/tax-reviews',
        payment_logs: '/admin/payment-logs',
        create_schedule: '/admin/create-schedule',
        officer_shifts: '/admin/officer-shifts',
        shift_requests_approval: '/admin/officer-shifts',
        applications: '/admin/applications',
        referral_bonuses: '/admin/referral-bonuses',
        control_panel: '/admin/control-panel',
        test_diagnostics: '/admin/test-diagnostics',
        reset_maintenance: '/admin/reset-maintenance',
        export_data: '/admin/export-data',
        support_tickets: '/admin/support-tickets',
        customer_service: '/admin/customer-service',
        send_notifications: '/admin/send-notifications',
      }) as Partial<Record<TabId, string>>,
    [],
  )

  const openTab = (tab: TabId) => {
    setActiveTab(tab)
    const target = redirectRoutes[tab]
    if (target) navigate(target)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!profile && !user?.id) return

    const ensureProfile = async () => {
      if (profile || !user?.id) return

      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (data) {
          setProfile(data as any)
          return
        }
      } catch {
        // fall through to local profile
      }

      setProfile({
        id: user.id,
        username: (user.email || '').split('@')[0] || '',
        role: isAdminEmail(user.email) ? 'admin' : 'user',
        troll_coins: 0,
      } as any)
    }

    ensureProfile()
  }, [profile, user, setProfile])

  if (adminCheckLoading || !profile) {
    return (
      <div className={`${shell} flex min-h-screen items-center justify-center p-5`}>
        <div className={`${panel} w-full max-w-sm p-6 text-center`}>
          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-cyan-300" />
          <p className="font-black text-cyan-100">Loading Admin Command Center</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className={`${shell} flex min-h-screen items-center justify-center p-5`}>
        <div className={`${panel} w-full max-w-sm p-7 text-center`}>
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-300" />
          <p className="mb-1 text-xl font-black">Access Restricted</p>
          <p className="text-sm text-slate-400">
            This dashboard is limited to administrators only.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#050711]/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-cyan-400/20 via-purple-500/20 to-green-400/20 p-2 text-cyan-300">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black">Mai Troll Admin</div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                {isConnected ? 'Systems Connected' : 'Checking Systems'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 active:scale-95"
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl space-y-4 p-3 pb-28 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Users}
            label="Users"
            value={formatNumber(stats.totalUsers)}
          />
          <MetricCard
            icon={Radio}
            label="Live Now"
            value={formatNumber(liveStreams.length)}
          />
          <MetricCard
            icon={Coins}
            label="Coins Sold"
            value={formatNumber(stats.purchasedCoins)}
          />
          <MetricCard
            icon={DollarSign}
            label="Platform Profit"
            value={formatMoney(stats.platformProfit)}
          />
        </div>

        <LiveMonitor
          streams={liveStreams}
          loading={streamsLoading}
          onRefresh={loadLiveStreams}
          onView={viewStream}
          onEnd={endStreamById}
          onDelete={deleteStreamById}
        />

        <section className={`${panel} p-4`}>
          <SectionTitle
            icon={Zap}
            title="Admin Controls"
            subtitle="The same operational controls used by the main AdminDashboard"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openTab('user_search')}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
            >
              <Users className="mb-2 h-4 w-4 text-cyan-300" />
              <div className="text-xs font-black">Users</div>
              <div className="mt-1 text-[10px] text-slate-500">Search & manage</div>
            </button>

            <button
              type="button"
              onClick={() => openTab('chat_moderation')}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
            >
              <Shield className="mb-2 h-4 w-4 text-purple-300" />
              <div className="text-xs font-black">Moderation</div>
              <div className="mt-1 text-[10px] text-slate-500">Chat & reports</div>
            </button>

            <button
              type="button"
              onClick={() => openTab('finance_dashboard')}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
            >
              <DollarSign className="mb-2 h-4 w-4 text-emerald-300" />
              <div className="text-xs font-black">Finance</div>
              <div className="mt-1 text-[10px] text-slate-500">Money controls</div>
            </button>

            <button
              type="button"
              onClick={() => openTab('reports_queue')}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
            >
              <FileText className="mb-2 h-4 w-4 text-amber-300" />
              <div className="text-xs font-black">Reports</div>
              <div className="mt-1 text-[10px] text-slate-500">Review queue</div>
            </button>

            <button
              type="button"
              onClick={() => openTab('send_notifications')}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
            >
              <Bell className="mb-2 h-4 w-4 text-pink-300" />
              <div className="text-xs font-black">Notify</div>
              <div className="mt-1 text-[10px] text-slate-500">Broadcast messages</div>
            </button>

            <button
              type="button"
              onClick={() => openTab('system_config')}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
            >
              <Settings className="mb-2 h-4 w-4 text-slate-300" />
              <div className="text-xs font-black">System</div>
              <div className="mt-1 text-[10px] text-slate-500">Configuration</div>
            </button>
          </div>
        </section>

        <ErrorBoundary>
          <BetaCapacityMonitor />
        </ErrorBoundary>

        <ErrorBoundary>
          <MaiPayPlusManager />
        </ErrorBoundary>

        <ErrorBoundary>
          <FirstCashoutMatch />
        </ErrorBoundary>

        <ErrorBoundary>
          <FinanceEconomyCenter
            stats={stats}
            economySummary={economySummary}
            economyLoading={economyLoading}
            onLoadEconomySummary={refreshFinance}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <LivePurchasableInventory />
        </ErrorBoundary>

        <ErrorBoundary>
          <OperationsControlDeck
            liveStreams={liveStreams}
            streamsLoading={streamsLoading}
            onLoadLiveStreams={loadLiveStreams}
            onEndStreamById={endStreamById}
            onDeleteStreamById={deleteStreamById}
            onViewStream={viewStream}
            stats={stats}
          />
        </ErrorBoundary>

        <div className="grid gap-4">
          <ErrorBoundary>
            <PresidentialOversightPanel />
          </ErrorBoundary>

          <ErrorBoundary>
            <ProposalManagementPanel viewMode="admin" />
          </ErrorBoundary>
        </div>

        <ErrorBoundary>
          <AdditionalTasksGrid
            onNavigateToEconomy={handleNavigateToEconomy}
            onNavigateToTaxReviews={handleNavigateToTaxReviews}
            onOpenTestDiagnostics={handleOpenTestDiagnostics}
            onOpenControlPanel={handleOpenControlPanel}
            onOpenGrantCoins={handleOpenGrantCoins}
            onOpenAdminPool={handleOpenAdminPool}
            onOpenTrollmersTournament={handleOpenTrollmersTournament}
            onOpenFinanceDashboard={handleOpenFinanceDashboard}
            onOpenCreateSchedule={handleOpenCreateSchedule}
            onOpenResetPanel={handleOpenResetPanel}
            onOpenReferralBonuses={handleOpenReferralBonuses}
            onOpenApplications={handleOpenApplications}
            onSelectTab={tab => openTab(tab as TabId)}
            counts={{
              cashouts: stats.pendingPayouts,
              reports: stats.aiFlags,
              alerts: taskCounts.alerts,
              tax_reviews: taskCounts.taxReviews,
              support: taskCounts.supportTickets,
              applications: stats.pendingApps,
            }}
          />
        </ErrorBoundary>

        <div className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <div className="text-sm font-black">System Status</div>
              <div className="text-[10px] text-slate-500">
                Finance sync and dashboard metrics
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                refreshFinance()
                refreshMetrics()
                loadTaskCounts()
                loadCareerAppsCount()
                loadLiveStreams()
              }}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 active:scale-95"
              aria-label="Refresh admin data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-px bg-white/10">
            <div className="bg-slate-950/80 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Finance
              </div>
              <div className="mt-1 text-xs font-black">
                {financeLoading ? 'Syncing...' : isConnected ? 'Connected' : 'Offline'}
              </div>
            </div>
            <div className="bg-slate-950/80 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Last Sync
              </div>
              <div className="mt-1 text-xs font-black">
                {lastSync ? new Date(lastSync).toLocaleTimeString() : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleEmergencyStop}
            className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-left text-red-200 active:bg-red-400/20"
          >
            <Siren className="mb-2 h-5 w-5" />
            <div className="text-xs font-black">Emergency Stop</div>
            <div className="mt-1 text-[10px] text-red-300/60">End all active broadcasts</div>
          </button>

          <button
            type="button"
            onClick={handleResetApp}
            className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-left text-amber-200 active:bg-amber-400/20"
          >
            <RotateCcw className="mb-2 h-5 w-5" />
            <div className="text-xs font-black">Reset App</div>
            <div className="mt-1 text-[10px] text-amber-300/60">Clear local app state</div>
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#050711]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById('phone-live-monitor')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-cyan-300"
          >
            <Radio className="h-5 w-5" />
            <span className="text-[9px] font-black">LIVE</span>
          </button>

          <button
            type="button"
            onClick={() => openTab('user_search')}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-400 active:bg-white/5"
          >
            <Users className="h-5 w-5" />
            <span className="text-[9px] font-black">USERS</span>
          </button>

          <button
            type="button"
            onClick={() => openTab('reports_queue')}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-400 active:bg-white/5"
          >
            <FileText className="h-5 w-5" />
            <span className="text-[9px] font-black">REPORTS</span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-400 active:bg-white/5"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[9px] font-black">MORE</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />

          <aside className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#080a14] p-4 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-black">Admin Tools</div>
                <div className="text-xs text-slate-500">
                  Full AdminDashboard toolset
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2"
                aria-label="Close admin tools"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                ['user_search', 'Users', Users],
                ['role_management', 'Roles', Shield],
                ['chat_moderation', 'Chat', HeadphonesIcon],
                ['reports_queue', 'Reports', FileText],
                ['stream_monitor', 'Streams', Radio],
                ['media_library', 'Media', Activity],
                ['announcements', 'Announcements', Bell],
                ['economy_dashboard', 'Economy', Coins],
                ['finance_dashboard', 'Finance', DollarSign],
                ['payment_logs', 'Payments', BarChart3],
                ['grant_coins', 'Grant Coins', Coins],
                ['tax_reviews', 'Tax Reviews', FileText],
                ['payouts', 'Payouts', DollarSign],
                ['cashouts', 'Cashouts', DollarSign],
                ['verification', 'Verification', Shield],
                ['applications', 'Applications', FileText],
                ['referral_bonuses', 'Referrals', Users],
                ['voting', 'Voting', FileText],
                ['support_tickets', 'Support', HeadphonesIcon],
                ['customer_service', 'Customer Service', HeadphonesIcon],
                ['send_notifications', 'Notifications', Bell],
                ['database_backup', 'DB Backup', Database],
                ['system_health', 'System Health', Activity],
                ['cache_clear', 'Clear Cache', RotateCcw],
                ['system_config', 'System Config', Settings],
                ['control_panel', 'Control Panel', Settings],
                ['test_diagnostics', 'Diagnostics', Activity],
                ['reset_maintenance', 'Maintenance', RotateCcw],
                ['export_data', 'Export Data', Database],
              ] as Array<[TabId, string, React.ElementType]>).map(([tab, label, Icon]) => (
                <button
                  key={String(tab)}
                  type="button"
                  onClick={() => openTab(tab as TabId)}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left active:bg-white/10"
                >
                  <Icon className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span className="min-w-0 flex-1 text-xs font-black">{String(label)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-700" />
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  handleLogout()
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs font-black text-red-300"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  loadLiveStreams()
                  loadTaskCounts()
                  loadCareerAppsCount()
                  refreshFinance()
                  refreshMetrics()
                  toast.success('Admin data refreshed')
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs font-black text-cyan-300"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh All
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
