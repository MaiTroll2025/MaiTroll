// src/pages/admin/AdminDashboard.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import './admin.css'
import { useAuthStore } from '../../lib/store'
import { supabase, isAdminEmail, UserRole } from '../../lib/supabase'
import {
  Shield,
  LogOut,
  RotateCcw,
  RefreshCw,
  DollarSign,
  Coins,
  CreditCard,
  Activity,
  Radio,
  AlertTriangle,
  HeadphonesIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import FinanceEconomyCenter from './components/FinanceEconomyCenter'
import LivePurchasableInventory from './components/LivePurchasableInventory'
import OperationsControlDeck from './components/OperationsControlDeck'
import AdditionalTasksGrid from './components/AdditionalTasksGrid'
import QuickActionsBar from './components/QuickActionsBar'
import ProposalManagementPanel from './components/shared/ProposalManagementPanel'
import TempAdminDashboard from './TempAdminDashboard'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useAdminFinanceRealtime } from '../../hooks/useAdminFinanceRealtime'
import { useAdminDashboardMetrics } from '../../hooks/useAdminDashboardMetrics'
import PresidentialOversightPanel from './components/PresidentialOversightPanel'
import BetaCapacityMonitor from './components/BetaCapacityMonitor'
import MaiPayPlusManager from './components/MaiPayPlusManager'



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
  troll_coins: {
    totalPurchased: number
    totalSpent: number
    outstandingLiability: number
  }
  broadcasters: {
    totalUsdOwed: number
    pendingCashoutsUsd: number
    paidOutUsd: number
  }
  officers: {
    totalUsdPaid: number
  }
  messages?: {
    totalPayments: number
    totalIncome: number
    transactionCount: number
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
  | 'empire_applications'
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

interface TransactionRow {
  id: string
  user_id: string | null
  type?: string | null
  transaction_type?: string | null
  coins_used?: number | null
  amount?: number | null
  description?: string | null
  status?: string | null
  metadata?: {
    coins?: number
    coin_amount?: number
    coins_awarded?: number
    package_id?: string
    paypal_order_id?: string
    paypal_capture_id?: string
    payer_email?: string
    [key: string]: unknown
  } | null
  created_at?: string
}

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
  package_id?: string | null
  paypal_order_id?: string | null
  paypal_capture_id?: string | null
  payer_email?: string | null
  created_at: string
  status?: string | null
}

const pageShell =
  'min-h-screen bg-slate-950 text-white relative overflow-y-auto overflow-x-hidden md:overflow-hidden'

const glassPanel =
  'rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 backdrop-blur-2xl shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]'

const card =
  'rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[0_0_30px_rgba(45,212,191,0.08)]'

function CityBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </>
  )
}

function MoneyMetric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
          <Icon className="h-5 w-5 text-cyan-200" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="text-2xl font-black text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function CoinSalesPanel({
  purchases,
  loading,
  onRefresh,
}: {
  purchases: CoinPurchaseRow[]
  loading: boolean
  onRefresh: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const groupedByUser = useMemo(() => {
    const map = new Map<string, {
      user_id: string
      buyerName: string
      payerEmail?: string
      totalCoins: number
      totalUsd: number
      purchaseCount: number
      lastPurchase: string
      purchases: CoinPurchaseRow[]
    }>()

    for (const p of purchases) {
      const uid = p.user_id || 'unknown'
      const existing = map.get(uid)

      if (existing) {
        existing.totalCoins += p.amount_coins
        existing.totalUsd += p.amount_usd
        existing.purchaseCount += 1
        if (p.created_at && (!existing.lastPurchase || p.created_at > existing.lastPurchase)) {
          existing.lastPurchase = p.created_at
        }
        existing.purchases.push(p)
      } else {
        map.set(uid, {
          user_id: uid,
          buyerName: p.username,
          payerEmail: p.payer_email || undefined,
          totalCoins: p.amount_coins,
          totalUsd: p.amount_usd,
          purchaseCount: 1,
          lastPurchase: p.created_at,
          purchases: [p],
        })
      }
    }

    return Array.from(map.values())
  }, [purchases])

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return groupedByUser
    const q = searchQuery.toLowerCase()
    return groupedByUser.filter((u) => {
      const buf = `${u.buyerName} ${u.user_id} ${u.payerEmail || ''}`
      return buf.toLowerCase().includes(q)
    })
  }, [groupedByUser, searchQuery])

  const selectedUserData = useMemo(() => {
    if (!selectedUser) return null
    return groupedByUser.find((u) => u.user_id === selectedUser) || null
  }, [selectedUser, groupedByUser])

  const grandTotalUsd = purchases.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0)
  const grandTotalCoins = purchases.reduce((sum, p) => sum + Number(p.amount_coins || 0), 0)

  return (
    <section className={glassPanel}>
      <div className="flex flex-col gap-4 border-b border-cyan-400/10 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
              <CreditCard className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Coin Store Sales Ledger</h2>
              <p className="text-sm text-slate-400">
                PayPal / coin-store purchases grouped by user. Search by username, UUID, or payer email.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-bold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-400/15"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Sales
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        <MoneyMetric icon={DollarSign} label="Recent Sales" value={`$${grandTotalUsd.toFixed(2)}`} sub={`${purchases.length} transactions loaded`} />
        <MoneyMetric icon={Coins} label="Coins Sold" value={grandTotalCoins.toLocaleString()} sub="recent purchased coin volume" />
        <MoneyMetric icon={Activity} label="Buyers" value={String(groupedByUser.length)} sub="unique payers" />
      </div>

      <div className="px-5 pb-5">
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username, UUID, or payer email..."
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <div className="grid grid-cols-12 border-b border-white/10 bg-white/[0.035] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            <div className="col-span-4">Buyer</div>
            <div className="col-span-2">Coins</div>
            <div className="col-span-2">USD</div>
            <div className="col-span-2">Buys</div>
            <div className="col-span-2">Last Purchase</div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading coin sales...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {searchQuery.trim() ? 'No buyers match your search.' : 'No coin purchase rows found yet.'}
            </div>
          ) : (
            <div className="max-h-[270px] divide-y divide-white/10 overflow-y-auto">
              {filteredUsers.map((u) => (
                <div
                  key={u.user_id}
                  onClick={() => setSelectedUser(u.user_id)}
                  className="grid grid-cols-12 cursor-pointer items-center px-4 py-3 text-sm hover:bg-cyan-400/5"
                >
                  <div className="col-span-4 min-w-0">
                    <p className="truncate font-bold text-white">{u.buyerName}</p>
                    <p className="truncate font-mono text-xs text-slate-500">{u.user_id}</p>
                    {u.payerEmail && <p className="truncate text-xs text-slate-500">{u.payerEmail}</p>}
                  </div>
                  <div className="col-span-2 font-black text-cyan-200">{u.totalCoins.toLocaleString()}</div>
                  <div className="col-span-2 font-black text-emerald-300">${u.totalUsd.toFixed(2)}</div>
                  <div className="col-span-2 text-xs text-slate-400">{u.purchaseCount}</div>
                  <div className="col-span-2 text-xs text-slate-400">
                    {u.lastPurchase ? new Date(u.lastPurchase).toLocaleDateString() : '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Click a buyer to view all their coin store transactions.
        </p>
      </div>

      {/* Per-User Transaction Detail Modal */}
      {selectedUserData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUser(null)
          }}
        >
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-cyan-400/20 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-cyan-400/10 bg-slate-900/80 backdrop-blur-sm">
              <div>
                <h3 className="text-lg font-black text-white">{selectedUserData.buyerName}</h3>
                <p className="font-mono text-xs text-slate-500">{selectedUserData.user_id}</p>
                {selectedUserData.payerEmail && (
                  <p className="text-xs text-slate-500">{selectedUserData.payerEmail}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`${card} p-3`}>
                  <p className="text-xs text-slate-500">Total Purchases</p>
                  <p className="text-xl font-black text-white">{selectedUserData.purchaseCount}</p>
                </div>
                <div className={`${card} p-3`}>
                  <p className="text-xs text-slate-500">Total Coins</p>
                  <p className="text-xl font-black text-cyan-200">{selectedUserData.totalCoins.toLocaleString()}</p>
                </div>
                <div className={`${card} p-3`}>
                  <p className="text-xs text-slate-500">Total Spent</p>
                  <p className="text-xl font-black text-emerald-300">${selectedUserData.totalUsd.toFixed(2)}</p>
                </div>
                <div className={`${card} p-3`}>
                  <p className="text-xs text-slate-500">Last Purchase</p>
                  <p className="text-sm font-bold text-white">
                    {selectedUserData.lastPurchase ? new Date(selectedUserData.lastPurchase).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">All Transactions</p>

              {selectedUserData.purchases.map((tx) => (
                <div key={tx.id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Date</p>
                      <p className="text-white">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Coins</p>
                      <p className="font-black text-cyan-200">{tx.amount_coins.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">USD</p>
                      <p className="font-black text-emerald-300">${tx.amount_usd.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="text-xs font-bold text-slate-400">{tx.status || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                    <div>
                      <span className="text-slate-600">Transaction ID:</span>{' '}
                      <span className="font-mono text-white">{tx.id}</span>
                    </div>
                    {tx.paypal_order_id && (
                      <div>
                        <span className="text-slate-600">PayPal Order:</span>{' '}
                        <span className="font-mono text-white">{tx.paypal_order_id}</span>
                      </div>
                    )}
                    {tx.paypal_capture_id && (
                      <div>
                        <span className="text-slate-600">Capture ID:</span>{' '}
                        <span className="font-mono text-white">{tx.paypal_capture_id}</span>
                      </div>
                    )}
                    {tx.package_id && (
                      <div>
                        <span className="text-slate-600">Package:</span>{' '}
                        <span className="text-white">{tx.package_id}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-600">Source:</span>{' '}
                      <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-2 py-0.5 font-bold text-purple-200">
                        {tx.source}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default function AdminDashboard() {
  const { profile, user, setProfile, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [adminCheckLoading, setAdminCheckLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const isTempAdmin = profile?.role === UserRole.TEMP_CITY_ADMIN

  const {
    financeSummary,
    isLoading: financeLoading,
    isConnected,
    lastSync,
    refreshFinance,
    reconciliation,
  } = useAdminFinanceRealtime()

  const { metrics: dashboardMetrics, refreshMetrics } = useAdminDashboardMetrics()

   const [coinPurchases, setCoinPurchases] = useState<CoinPurchaseRow[]>([])
   const [coinPurchasesLoading, setCoinPurchasesLoading] = useState(false)
   const [taskCounts, setTaskCounts] = useState({
     taxReviews: 0,
     supportTickets: 0,
     alerts: 0,
   })
   const [careerAppsCount, setCareerAppsCount] = useState(0)
   const [legacyAppsCount, setLegacyAppsCount] = useState(0)

   const stats: StatState = financeSummary
     ? {
         totalUsers: dashboardMetrics.totalUsers || financeSummary.users.totalUsers,
         adminsCount: financeSummary.users.adminsCount,
         pendingApps: careerAppsCount + legacyAppsCount,
         pendingPayouts: financeSummary.users.pendingPayouts,
         trollOfficers: dashboardMetrics.trollOfficers || financeSummary.users.trollOfficers,
         aiFlags: financeSummary.users.aiFlags,
         coinSalesRevenue: dashboardMetrics.coinRevenue || financeSummary.economy.coinSalesRevenue,
         totalPayouts: financeSummary.economy.totalPayouts,
         feesCollected: financeSummary.economy.feesCollected,
         platformProfit: dashboardMetrics.platformProfit || financeSummary.economy.platformProfit,
         purchasedCoins: dashboardMetrics.coinsSold || financeSummary.economy.purchasedCoins,
         earnedCoins: financeSummary.economy.earnedCoins,
         freeCoins: financeSummary.economy.freeCoins,
         totalCoinsInCirculation: dashboardMetrics.coinsInCirculation || financeSummary.economy.totalCoinsInCirculation,
         totalValue: financeSummary.economy.totalValue,
         giftCoins: financeSummary.economy.giftCoins,
         appSponsoredGifts: financeSummary.economy.appSponsoredGifts,
         total_liability_coins: financeSummary.financial.total_liability_coins,
         total_platform_profit_usd: financeSummary.financial.total_platform_profit_usd,
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

   const [activeTab, setActiveTab] = useState<TabId>('connections')
   const [economySummary, setEconomySummary] = useState<EconomySummary | null>(null)
   const [economyLoading, setEconomyLoading] = useState(false)
   const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
   const [streamsLoading, setStreamsLoading] = useState(false)

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
          .eq('status', 'pending')
      ])
      
      const careerCount = careerRes.count || 0
      const legacyCount = legacyRes.count || 0
      
      setCareerAppsCount(careerCount)
      setLegacyAppsCount(legacyCount)
    } catch (err) {
      console.error('Failed to load career apps count:', err)
    }
  }, [])

  useEffect(() => {
    if (['payouts', 'payout_queue', 'purchases', 'stream_monitor', 'send_notifications'].includes(activeTab)) {
      toast.info(`Switched to tab: ${activeTab}`)
    }
  }, [activeTab])

  useEffect(() => {
    const checkAdminAccess = async () => {
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
          setAdminCheckLoading(false)
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
    }

    checkAdminAccess()
  }, [user, isLoading])

  const loadCoinPurchases = useCallback(async () => {
    setCoinPurchasesLoading(true)

    try {
      // Primary source: public.transactions
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select(
          'id,user_id,transaction_type,coins_used,amount,description,status,metadata,created_at'
        )
        .or(
          [
            'transaction_type.eq.purchase',
            'description.ilike.%PayPal purchase%',
            'description.ilike.%coin%',
            'metadata->>paypal_capture_id.not.is.null',
            'metadata->>paypal_order_id.not.is.null',
            'metadata->>package_id.not.is.null',
          ].join(',')
        )
        .order('created_at', { ascending: false })
.limit(2000)

      // Secondary source: legacy coinstore sales ledger (if present)
      const { data: storeData } = await supabase
        .from('coin_store_sales')
        .select('id,user_id,amount_coins,amount_usd,paypal_order_id,paypal_capture_id,payer_email,package_id,created_at,status')
        .order('created_at', { ascending: false })
        .limit(2000)

      // Tertiary source: paypal_transactions (authoritative PayPal data)
      const { data: paypalTxData } = await supabase
        .from('paypal_transactions')
        .select('id,user_id,paypal_order_id,paypal_capture_id,amount,coins,status,created_at')
        .order('created_at', { ascending: false })
        .limit(2000)

      if (txError) throw txError

      const data = (txData || []) as any[]
      const storeRows = (storeData || []) as any[]
      const paypalRows = (paypalTxData || []) as any[]

      // Track sources for each row
      const rowSources = new Map<string, string>()
      const seenPaypalOrderIds = new Set<string>()
      const seenPaypalCaptureIds = new Set<string>()

      // Mark public.transactions rows and collect paypal IDs for dedup
      for (const r of data) {
        rowSources.set(r.id, 'public.transactions')
        const meta = r.metadata || {}
        if (meta.paypal_order_id) seenPaypalOrderIds.add(meta.paypal_order_id)
        if (meta.paypal_capture_id) seenPaypalCaptureIds.add(meta.paypal_capture_id)
      }

      // Merge all sources; prefer public.transactions rows but include store/paypal rows that aren't present
      const combined = [...data]
      const existingIds = new Set(combined.map((r) => r.id))

      // Merge coin_store_sales
      for (const s of storeRows) {
        const sPaypalOrder = (s as any).paypal_order_id
        const sPaypalCapture = (s as any).paypal_capture_id
        const isDuplicateByPaypal =
          (sPaypalOrder && seenPaypalOrderIds.has(sPaypalOrder)) ||
          (sPaypalCapture && seenPaypalCaptureIds.has(sPaypalCapture))

        if (isDuplicateByPaypal || existingIds.has(s.id)) continue

        combined.push({
          id: s.id,
          user_id: s.user_id,
          type: 'purchase',
          transaction_type: 'purchase',
          coins_used: s.amount_coins,
          amount: s.amount_usd,
          description: 'Coin Store purchase',
          status: s.status,
          metadata: {
            package_id: s.package_id,
            paypal_order_id: s.paypal_order_id,
            paypal_capture_id: s.paypal_capture_id,
            payer_email: s.payer_email,
          },
          created_at: s.created_at,
        })
        rowSources.set(s.id, 'coin_store_sales')
        existingIds.add(s.id)
        if (sPaypalOrder) seenPaypalOrderIds.add(sPaypalOrder)
        if (sPaypalCapture) seenPaypalCaptureIds.add(sPaypalCapture)
      }

      // Merge paypal_transactions
      for (const p of paypalRows) {
        const pPaypalOrder = p.paypal_order_id
        const pPaypalCapture = p.paypal_capture_id
        const isDuplicateByPaypal =
          (pPaypalOrder && seenPaypalOrderIds.has(pPaypalOrder)) ||
          (pPaypalCapture && seenPaypalCaptureIds.has(pPaypalCapture))

        if (isDuplicateByPaypal || existingIds.has(p.id)) continue

        combined.push({
          id: p.id,
          user_id: p.user_id,
          type: 'purchase',
          transaction_type: 'purchase',
          coins_used: p.coins,
          amount: p.amount,
          description: 'PayPal transaction',
          status: p.status,
          metadata: {
            paypal_order_id: p.paypal_order_id,
            paypal_capture_id: p.paypal_capture_id,
          },
          created_at: p.created_at,
        })
        rowSources.set(p.id, 'paypal.transactions')
        existingIds.add(p.id)
        if (pPaypalOrder) seenPaypalOrderIds.add(pPaypalOrder)
        if (pPaypalCapture) seenPaypalCaptureIds.add(pPaypalCapture)
      }

      const txRows = (combined || []) as TransactionRow[]
      const userIds = [...new Set(txRows.map((tx) => tx.user_id).filter(Boolean))] as string[]

      const userMap = new Map<string, string>()

      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, email')
          .in('id', userIds)

        if (!usersError) {
          ;(usersData || []).forEach((u: any) => {
            userMap.set(u.id, u.display_name || u.username || u.email || u.id)
          })
        }
      }

      const rows: CoinPurchaseRow[] = txRows.map((tx) => {
        const meta = tx.metadata || {}

        const metadataCoins =
          Number(meta.coins_awarded || 0) ||
          Number(meta.coin_amount || 0) ||
          Number(meta.coins || 0)

        const parsedDescriptionCoins = (() => {
          const match = String(tx.description || '').match(/(\d[\d,]*)\s*coins?/i)
          return match ? Number(match[1].replace(/,/g, '')) : 0
        })()

        const coins =
          metadataCoins ||
          Number(tx.coins_used || 0) ||
          parsedDescriptionCoins ||
          Math.round(Number(tx.amount || 0) * 100)

        const usd = Number(tx.amount || 0)

        // Get username: try profile first, then payer_email, then shorten UUID
        const username = tx.user_id 
          ? (userMap.get(tx.user_id) || meta.payer_email || (tx.user_id.length > 20 ? tx.user_id.slice(0, 20) + '…' : tx.user_id))
          : 'Unknown buyer'

        return {
          id: tx.id,
          user_id: tx.user_id || null,
          username: username,
          amount_coins: Math.abs(coins),
          amount_usd: Math.abs(usd),
          type: tx.transaction_type || tx.type || 'purchase',
          source: rowSources.get(tx.id) || 'public.transactions',
          package_id: typeof meta.package_id === 'string' ? meta.package_id : null,
          paypal_order_id: typeof meta.paypal_order_id === 'string' ? meta.paypal_order_id : null,
          paypal_capture_id: typeof meta.paypal_capture_id === 'string' ? meta.paypal_capture_id : null,
          payer_email: typeof meta.payer_email === 'string' ? meta.payer_email : null,
          created_at: tx.created_at || '',
          status: tx.status || null,
        }
      })

      setCoinPurchases(rows)
    } catch (error) {
      console.error('Error loading coin purchases from public.transactions:', error)
      toast.error('Failed to load coin purchases from public.transactions')
    } finally {
      setCoinPurchasesLoading(false)
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

  const loadEconomySummary = useCallback(async () => {
    try {
      setEconomyLoading(true)

      const { error: summaryError } = await supabase
        .from('economy_summary')
        .select('*')
        .maybeSingle()

      if (summaryError) console.warn('Failed to load economy_summary view:', summaryError)

      const json = await (await import('../../lib/api')).default.get('/admin/economy/summary')
      if (!json.success) throw new Error(json?.error || 'Failed to load economy summary')

      setEconomySummary(json.data)
    } catch (err: unknown) {
      console.error('Failed to load economy summary:', err)

      try {
        // Use public.transactions for purchase data (real money purchases)
        const { data: purchaseTx } = await supabase
          .from('transactions')
          .select('user_id, amount, coins_used, metadata')
          .or('transaction_type.eq.purchase,description.ilike.%coin%')

        // Also check paypal_transactions for authoritative PayPal purchase data
        const { data: paypalTx } = await supabase
          .from('paypal_transactions')
          .select('user_id, amount, coins, status, created_at')

        const purchaseMap: Record<string, { purchased: number }> = {}

        // Process transactions
        ;(purchaseTx || []).forEach((tx: any) => {
          const userId = tx.user_id || 'unknown'
          const existing = purchaseMap[userId] || { purchased: 0 }
          const coins = Number(tx.coins_used || tx.metadata?.coins || tx.metadata?.coins_awarded || 0)
          existing.purchased += Math.abs(coins)
          purchaseMap[userId] = existing
        })

        // Process paypal_transactions
        ;(paypalTx || []).forEach((p: any) => {
          const userId = p.user_id || 'unknown'
          const existing = purchaseMap[userId] || { purchased: 0 }
          const coins = Number(p.coins || 0)
          existing.purchased += Math.abs(coins)
          purchaseMap[userId] = existing
        })

        let totalPurchased = 0
        Object.values(purchaseMap).forEach((v) => {
          totalPurchased += v.purchased
        })

        const { data: broadcasterEarnings } = await supabase
          .from('earnings_payouts')
          .select('amount, status')

        let totalUsdOwed = 0
        let paidOutUsd = 0

        ;(broadcasterEarnings || []).forEach((e: { amount: number | null; status: string }) => {
          const amt = Number(e.amount || 0)
          if (e.status === 'paid') paidOutUsd += amt
          totalUsdOwed += amt
        })

        const { data: officerPayments } = await supabase
          .from('coin_transactions')
          .select('amount')
          .eq('type', 'officer_payment')

        const totalUsdPaid = (officerPayments || []).reduce(
          (sum: number, p: { amount: number | null }) => sum + Number(p.amount || 0),
          0
        )

        setEconomySummary({
          troll_coins: {
            totalPurchased,
            totalSpent: 0,
            outstandingLiability: totalPurchased,
          },
          broadcasters: {
            totalUsdOwed,
            pendingCashoutsUsd: totalUsdOwed - paidOutUsd,
            paidOutUsd,
          },
          officers: { totalUsdPaid },
          messages: {
            totalPayments: 0,
            totalIncome: 0,
            transactionCount: 0,
          },
        })
      } catch (e) {
        console.error('Economy fallback failed:', e)
      }
    } finally {
      setEconomyLoading(false)
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

  useEffect(() => {
    if (!isAuthorized) return

    loadLiveStreams()
    loadTaskCounts()
    loadCoinPurchases()
    loadCareerAppsCount()

    // SAFETY: removed 30s auto-refresh for money tables (transactions, coin_store_sales,
    // paypal_transactions). Admins can use the manual "Refresh Sales" button instead.
    // Only refresh lightweight task counts periodically.
    const interval = setInterval(() => {
      loadTaskCounts()
      loadCareerAppsCount()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthorized, loadLiveStreams, loadTaskCounts, loadCoinPurchases, loadCareerAppsCount])

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
        const errorText = await response.text()
        let errorMessage = 'Failed to end stream'

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()
      if (!result.success && result.error) throw new Error(result.error)

      toast.success('Stream ended successfully')
      await loadLiveStreams()
    } catch (error: unknown) {
      console.error('Error ending stream:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to end stream')
    }
  }

  const deleteStreamById = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stream? This action cannot be undone.')) return

    try {
      const { error: endError } = await supabase
        .from('streams')
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (endError) throw endError

      const deleteRelatedData = async (table: string, column: string = 'stream_id') => {
        const { error } = await supabase.from(table).delete().eq(column, id)

        if (error && error.code !== 'PGRST205' && error.code !== '42P01' && error.code !== '42501') {
          console.warn(`Could not delete from ${table}:`, error)
        }
      }

      const cleanupStreamParticipants = async () => {
        const { error } = await supabase.functions.invoke('streams-maintenance', {
          body: {
            action: 'delete_stream',
            stream_id: id,
          },
        })

        if (error) console.warn('Failed to clean up stream participants via service function', error)
      }

      await Promise.allSettled([
        deleteRelatedData('messages'),
        deleteRelatedData('stream_reports'),
        cleanupStreamParticipants(),
        deleteRelatedData('gifts'),
        deleteRelatedData('chat_messages'),
      ])

      const { error: deleteError } = await supabase.from('streams').delete().eq('id', id)
      if (deleteError) throw deleteError

      toast.success('Stream deleted successfully')
      await loadLiveStreams()
    } catch (error: any) {
      console.error('Error deleting stream:', error)
      toast.error(error?.message || 'Failed to delete stream')
    }
  }

  const viewStream = (id: string) => navigate(`/watch/${id}?admin=1`)

  const handleEmergencyStop = async () => {
    if (!window.confirm('EMERGENCY STOP: This will immediately END ALL active broadcasts. Continue?')) return

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
    } catch {}
    navigate('/auth?reset=1', { replace: true })
  }

  const handleBroadcastMessage = () => navigate('/admin/send-notifications')
  const handleSendNotifications = () => navigate('/admin/send-notifications')
  const handleSystemMaintenance = () => navigate('/admin/reset-maintenance')
  const handleViewAnalytics = () => navigate('/admin/reports-queue')
  const handleExportData = () => navigate('/admin/export-data')
  const _handleSelectTab = (tabId: string) => setActiveTab(tabId as TabId)

  const handleNavigateToEconomy = () => navigate('/admin/economy')
  const handleNavigateToTaxReviews = () => navigate('/admin/tax-reviews')
  const handleOpenTestDiagnostics = () => navigate('/admin/test-diagnostics')
  const handleOpenControlPanel = () => navigate('/admin/control-panel')
  const handleOpenGrantCoins = () => navigate('/admin/grant-coins')
  const handleOpenFinanceDashboard = () => navigate('/admin/finance')
  const handleOpenCreateSchedule = () => navigate('/admin/create-schedule')
  const handleOpenResetPanel = () => navigate('/admin/reset-maintenance')
  const handleOpenEmpireApplications = () => navigate('/admin/empire-applications')
  const handleOpenReferralBonuses = () => navigate('/admin/referral-bonuses')
  const handleOpenApplications = () => navigate('/admin/applications')
  const handleOpenAdminPool = () => navigate('/admin/pool')
  const handleOpenTrollmersTournament = () => navigate('/admin/trollmers-tournament')
  const handleOpenManualOrders = () => navigate('/admin/manual-orders')

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
         empire_applications: '/admin/empire-applications',
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
     []
   )

  useEffect(() => {
    const target = redirectRoutes[activeTab]
    if (target) navigate(target)
  }, [activeTab, navigate, redirectRoutes])

  React.useEffect(() => {
    const ensureProfile = async () => {
      if (profile || !user?.id) return

      try {
        const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle()

        if (data) {
          const isAdmin = isAdminEmail(user?.email)
          let nextProfile = data

          if (isAdmin && data.role !== 'admin') {
            const { error: updateError } = await supabase.rpc('admin_update_user_role', {
              p_target_user_id: user.id,
              p_new_role: 'admin',
            })

            if (!updateError) nextProfile = { ...data, role: 'admin' }
          }

          setProfile(nextProfile as any)
          return
        }
      } catch {}

      const isAdmin2 = isAdminEmail(user?.email)
      setProfile({
        id: user.id,
        username: (user?.email || '').split('@')[0] || '',
        role: isAdmin2 ? 'admin' : 'user',
        troll_coins: 0,
      } as any)
    }

    ensureProfile()
  }, [profile, user, setProfile])

  if (adminCheckLoading || !profile) {
    return (
      <div className={`${pageShell} flex items-center justify-center`}>
        <CityBackground />
        <div className={`${glassPanel} relative z-10 px-8 py-5 text-center`}>
          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-cyan-300" />
          <p className="font-black text-cyan-100">Loading Admin Command Center</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className={`${pageShell} flex items-center justify-center`}>
        <CityBackground />
        <div className={`${glassPanel} relative z-10 max-w-md p-8 text-center`}>
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-300" />
          <p className="mb-1 text-xl font-black text-white">Access Restricted</p>
          <p className="text-sm text-slate-400">This dashboard is limited to administrators only.</p>
        </div>
      </div>
    )
  }

  if (isTempAdmin) return <TempAdminDashboard />

  return (
    <div className={pageShell}>
      <CityBackground />

      <div className="relative z-10">
        <QuickActionsBar
          onEmergencyStop={handleEmergencyStop}
          onBroadcastMessage={handleBroadcastMessage}
          onSendNotifications={handleSendNotifications}
          onSystemMaintenance={handleSystemMaintenance}
          onViewAnalytics={handleViewAnalytics}
  onManualOrders={handleOpenManualOrders}
  onExportData={handleExportData}
/>

        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          <ErrorBoundary>
            <BetaCapacityMonitor />
          </ErrorBoundary>

          <ErrorBoundary>
            <MaiPayPlusManager />
          </ErrorBoundary>

          <CoinSalesPanel purchases={coinPurchases} loading={coinPurchasesLoading} onRefresh={loadCoinPurchases} />

           <ErrorBoundary>
             <FinanceEconomyCenter
               stats={stats}
               economySummary={economySummary}
               economyLoading={economyLoading}
               onLoadEconomySummary={loadEconomySummary}
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

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
              onOpenEmpireApplications={handleOpenEmpireApplications}
              onOpenReferralBonuses={handleOpenReferralBonuses}
              onOpenApplications={handleOpenApplications}
              onSelectTab={_handleSelectTab}
              counts={{
                empire_apps: stats.pendingApps,
                cashouts: stats.pendingPayouts,
                reports: stats.aiFlags,
                alerts: taskCounts.alerts,
                tax_reviews: taskCounts.taxReviews,
                support: taskCounts.supportTickets,
                applications: stats.pendingApps,
              }}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
