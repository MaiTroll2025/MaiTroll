import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { useCoins } from '../lib/hooks/useCoins'
import { supabase } from '../lib/supabase'
import { useXPStore } from '../stores/useXPStore'
import { useCreditScore } from '../lib/hooks/useCreditScore'
import CreditScoreBadge from '../components/CreditScoreBadge'
import ConvertHypeCoinsModal from '../components/modals/ConvertHypeCoinsModal'
import { CreatorSeasonalGoals } from '../components/CreatorSeasonalGoals'
import { Sword, Trophy, Coins, Star, Shield, Zap, ShoppingBag, Store, Package, DollarSign, TrendingUp, Loader2, Activity, Calendar, CheckCircle, Lock, ArrowRight, Building2, Briefcase } from 'lucide-react';
import { RoleEarningRule, UserEarningSummary, TreasuryPayoutItem, RoleStatus } from '../types/earnings';

interface UserStats {
  level: number
  xp: number
  totalXp: number
  nextLevelXp: number
   troll_coins: number
   hype_coins: number
  warWins?: number
  warLosses?: number
  warStreak?: string
  warTier?: string
  badges: string[]
}

// Earning types for Stats Page
interface ActiveEarningRole {
  role_key: string
  role_label: string
  status: RoleStatus
  earning_type: string
  amount_coins: number
  percent_rate: number
  source: string
  requirements: string
  next_action?: string
}

interface EarningTimelineEvent {
  id: string
  source: string
  amount: number
  status: string
  created_at: string
  paid_at: string | null
  details: Record<string, any>
}

const pageShell =
  'min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-slate-950 text-white relative'

const cityPanel =
  'rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl'

const cityCard =
  'rounded-3xl border border-white/10 bg-white/[0.035] shadow-[0_0_30px_rgba(45,212,191,0.08)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-300/35 hover:shadow-[0_0_34px_rgba(45,212,191,0.14)]'

const cyanTitle =
  'bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-transparent'

function StatHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_22px_rgba(45,212,191,0.18)]">
        <Icon className="h-5 w-5 text-cyan-200" />
      </div>
      <div>
        <h3 className="text-lg font-black uppercase tracking-wide text-cyan-100">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}

function MetricBox({
  label,
  value,
  tone = 'cyan',
}: {
  label: string
  value: React.ReactNode
  tone?: 'cyan' | 'pink' | 'purple' | 'green' | 'red' | 'yellow' | 'orange'
}) {
  const toneClass = {
    cyan: 'text-cyan-300 border-cyan-400/20 bg-cyan-400/5',
    pink: 'text-pink-300 border-pink-400/20 bg-pink-400/5',
    purple: 'text-purple-300 border-purple-400/20 bg-purple-400/5',
    green: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/5',
    red: 'text-red-300 border-red-400/20 bg-red-400/5',
    yellow: 'text-yellow-300 border-yellow-400/20 bg-yellow-400/5',
    orange: 'text-orange-300 border-orange-400/20 bg-orange-400/5',
  }[tone]

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  )
}

export default function Stats() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { balances, loading: coinsLoading } = useCoins()
  const { xpTotal, level, xpToNext, progress, fetchXP, subscribeToXP, unsubscribe } = useXPStore()
  const { data: creditData, loading: creditLoading, refresh: refreshCredit } = useCreditScore()

  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'earnings'>('overview')
  const [isConvertHypeOpen, setIsConvertHypeOpen] = useState(false)

  // Earning state
  const [earningSummary, setEarningSummary] = useState<UserEarningSummary | null>(null)
  const [activeRoles, setActiveRoles] = useState<ActiveEarningRole[]>([])
  const [_earningEvents, setEarningEvents] = useState<EarningTimelineEvent[]>([])
  const [treasuryPayouts, setTreasuryPayouts] = useState<TreasuryPayoutItem[]>([])
  const [roleRules, setRoleRules] = useState<RoleEarningRule[]>([])
  
  const isInitialized = useRef(false)
  const prevCreditScore = useRef<number | null>(null)
  const xpRef = useRef({ level: 1, xpTotal: 0, xpToNext: 100 })

  useEffect(() => {
    if (profile?.credit_score !== undefined && profile.credit_score !== prevCreditScore.current) {
      prevCreditScore.current = profile.credit_score
      refreshCredit()
    }
  }, [profile?.credit_score, refreshCredit])

  const loadStatsInternal = useCallback(async (showLoading = true) => {
    if (!user?.id) return

    const currentXp = xpRef.current

    try {
      if (showLoading) setLoading(true)

      const { data: battleProfile, error: battleProfileError } = await supabase
        .from('user_profiles')
        .select('total_battle_wins,battle_crown_streak,battle_crowns,total_battle_matches')
        .eq('id', user.id)
        .maybeSingle()

      if (battleProfileError) {
        console.warn('[Stats] Failed to load battle profile stats:', battleProfileError)
      }

      const battleWins = battleProfile?.total_battle_wins ?? (profile as any)?.total_battle_wins ?? 0
      const battleStreak = battleProfile?.battle_crown_streak ?? (profile as any)?.battle_crown_streak ?? 0
      const battleCrowns = battleProfile?.battle_crowns ?? (profile as any)?.battle_crowns ?? 0
      const totalBattleMatches = battleProfile?.total_battle_matches ?? (profile as any)?.total_battle_matches

      const battleLosses =
        typeof totalBattleMatches === 'number'
          ? Math.max(totalBattleMatches - battleWins, 0)
          : 0

      const warTier =
        battleCrowns >= 50
          ? 'Diamond'
          : battleCrowns >= 25
            ? 'Platinum'
            : battleCrowns >= 10
              ? 'Gold'
              : battleCrowns >= 5
                ? 'Silver'
                : 'Bronze'

      const badges = []
      if (profile?.role === 'admin' || profile?.troll_role === 'admin') badges.push('🛡️ Admin')
      if (currentXp.level >= 10) badges.push('👑 Top Rank')
      if (balances.troll_coins > 1000) badges.push('💰 Big Spender')

      setStats({
        level: currentXp.level,
        xp: currentXp.xpTotal,
        totalXp: currentXp.xpTotal,
        nextLevelXp: currentXp.xpToNext + currentXp.xpTotal,
        troll_coins: balances.troll_coins || 0,
        hype_coins: balances.hype_coins || 0,
        warWins: battleWins,
        warLosses: battleLosses,
        warStreak: String(battleStreak),
        warTier,
        badges,
      })
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }, [
    user?.id,
    profile,
    balances.troll_coins,
    balances.hype_coins,
  ])

  // Load earnings data
  const loadEarningsData = useCallback(async () => {
    if (!user?.id) return

    try {
      // Load earning summary
      const { data: summary } = await supabase
        .from('user_earning_summary')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      setEarningSummary(summary as any)

      // Load role earning rules
      const { data: rules } = await supabase
        .from('role_earning_rules')
        .select('*')
        .eq('is_active', true)
      setRoleRules(rules as any || [])

      // Load earning events
      const { data: events } = await supabase
        .from('user_earning_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setEarningEvents(events as any || [])

      // Build active roles based on user's current roles
      const roles: ActiveEarningRole[] = []
      const userRoles = [
        { key: 'user', label: 'User', source: 'platform' },
        ...(profile?.is_broadcaster || profile?.troll_role === 'broadcaster' ? [{ key: 'broadcaster', label: 'Broadcaster', source: 'broadcasts' }] : []),
        ...(profile?.is_troll_officer || profile?.troll_role === 'troll_officer' ? [{ key: 'troll_officer', label: 'Troll Officer', source: 'treasury' }] : []),
        ...(profile?.is_lead_officer || profile?.troll_role === 'lead_troll_officer' ? [{ key: 'lead_troll_officer', label: 'Lead Troll Officer', source: 'treasury' }] : []),
        ...(profile?.role === 'secretary' || profile?.troll_role === 'secretary' ? [{ key: 'secretary', label: 'Secretary', source: 'treasury' }] : []),
        ...(profile?.role === 'president' || profile?.troll_role === 'president' ? [{ key: 'president', label: 'President', source: 'treasury' }] : []),
        ...((profile as any)?.is_journalist ? [{ key: 'journalist', label: 'Journalist', source: 'treasury' }] : []),
        ...((profile as any)?.is_attorney ? [{ key: 'attorney', label: 'Attorney', source: 'court' }] : []),
        ...((profile as any)?.is_prosecutor ? [{ key: 'prosecutor', label: 'Prosecutor', source: 'court' }] : []),
      ]

      for (const ur of userRoles) {
        const rule = rules?.find(r => r.role_key === ur.key) || { role_key: ur.key, role_label: ur.label, earning_type: 'unknown', is_active: true }
        roles.push({
          role_key: ur.key,
          role_label: rule.role_label || ur.label,
          status: 'active',
          earning_type: rule.earning_type || 'unknown',
          amount_coins: summary?.total_earned_coins || 0,
          percent_rate: Number(rule.percent_rate) || 0,
          source: ur.source,
          requirements: rule.requirement_text || '',
          next_action: rule.application_route ? `Apply at ${rule.application_route}` : undefined,
        })
      }

      setActiveRoles(roles)

      // Load treasury payouts
      const { data: payouts } = await supabase
        .from('treasury_payout_items')
        .select(`*, treasury_payout_runs!inner(run_week_start, run_week_end)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setTreasuryPayouts(payouts as any || [])

    } catch (err) {
      console.error('Error loading earnings data:', err)
    }
  }, [user?.id, profile])

  useEffect(() => {
    if (user?.id && isInitialized.current) {
      loadEarningsData()
    }
  }, [user?.id, loadEarningsData])

  useEffect(() => {
    if (!user?.id || isInitialized.current) return

    const initXP = async () => {
      try {
        await fetchXP(user.id)
        subscribeToXP(user.id)
        isInitialized.current = true
        loadStatsInternal(true)
      } catch (err) {
        console.error('Error initializing XP:', err)
        isInitialized.current = true
        loadStatsInternal(true)
      }
    }

    initXP()

    return () => {
      unsubscribe()
      isInitialized.current = false
    }
  }, [fetchXP, loadStatsInternal, subscribeToXP, unsubscribe, user.id])

  useEffect(() => {
    xpRef.current = { level, xpTotal, xpToNext }
    // When XP store data arrives after init, re-read stats once without
    // toggling the loading spinner (just silently update the numbers).
    if (user?.id && isInitialized.current && stats !== null) {
      loadStatsInternal(false)
    }
  }, [level, xpTotal, xpToNext, loadStatsInternal, user?.id, stats])

  const computedProgress =
    progress !== undefined && progress !== null ? (progress > 0 ? progress : 0) : 0

  const levelProgress = Math.min(computedProgress, 99)
  const statsCoinsPerUsd = 300
  const _statsUsdPerCoin = 1 / statsCoinsPerUsd

  const formatStatsUsd = (coins: number) => {
    return `$${(Math.round(coins / statsCoinsPerUsd * 100) / 100).toFixed(2)}`
  }

  return (
    <><div className={pageShell}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className={`${cityPanel} mb-8 overflow-hidden p-6 md:p-8`}>
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Activity className="h-4 w-4" />
                City OS Stats
              </div>

              <h1 className={`text-4xl font-black md:text-5xl ${cyanTitle}`}>
                Player Stats
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                Track your level, coins, battle rank, credit score, and city achievements.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="Level" value={level || 1} tone="cyan" />
              <MetricBox label="Coins" value={(balances.troll_coins || 0).toLocaleString()} tone="green" />
              <MetricBox label="Hype" value={(balances.hype_coins || 0).toLocaleString()} tone="purple" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${activeTab === 'overview'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${activeTab === 'earnings'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}
          >
            Earnings
          </button>
        </div>

        <div className={`${cityPanel} mb-8 p-6`}>
          <StatHeader icon={Zap} title="Quick Shortcuts" subtitle="Jump into your main city actions" />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Coin Store', icon: ShoppingBag, path: '/store', tone: 'yellow' as const },
              { label: 'Shop', icon: Store, path: '/marketplace', tone: 'cyan' as const },
              { label: 'Inventory', icon: Package, path: '/inventory', tone: 'purple' as const },
              { label: 'MAI Pay', icon: DollarSign, path: '/mai-pay', tone: 'green' as const },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`${cityCard} group flex flex-col items-center gap-3 p-5 hover:-translate-y-1`}
              >
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3 transition group-hover:border-cyan-300/40 group-hover:shadow-[0_0_22px_rgba(45,212,191,0.18)]">
                  <item.icon className="h-6 w-6 text-cyan-200" />
                </div>
                <span className="font-bold text-slate-100">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <CreatorSeasonalGoals />
        </div>

        {activeTab === 'overview' && (
          <>
            {stats ? (
              <div className={`grid grid-cols-1 gap-6 lg:grid-cols-2 ${loading || coinsLoading ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className={`${cityCard} p-6`}>
                  <StatHeader icon={Star} title="Level & XP" subtitle="Real-time progression sync" />

                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-white">Level {stats.level}</span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-200">
                      {stats.level} → {stats.level + 1}
                    </span>
                  </div>

                  <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-pink-500 shadow-[0_0_18px_rgba(45,212,191,0.42)] transition-all duration-500"
                      style={{ width: `${levelProgress}%` }} />
                  </div>

                  <div className="mt-3 text-center text-sm text-slate-400">
                    {Math.round(levelProgress)}% to next level
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Current Level</span>
                      <span className="font-bold text-cyan-200">{stats.level} / 2000</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                      <TrendingUp className="h-3 w-3" />
                      Real-time sync enabled
                    </div>
                  </div>
                </div>

                <div className={`${cityCard} p-6`}>
                  <StatHeader icon={Shield} title="Credit Score" subtitle="Reliability, loans, and city behavior" />
                  <CreditScoreBadge
                    score={creditData?.score}
                    tier={creditData?.tier}
                    trend7d={creditData?.trend_7d}
                    loading={creditLoading} />
                </div>

                <div className={`${cityCard} p-6`}>
                  <StatHeader icon={Sword} title="Battle / War Stats" subtitle="Crowns, streaks, wins, and tier" />

                  <div className="grid grid-cols-2 gap-4">
                    <MetricBox label="Wins" value={stats.warWins} tone="green" />
                    <MetricBox label="Losses" value={stats.warLosses} tone="red" />
                    <MetricBox
                      label="Streak"
                      value={<span className="flex items-center gap-2">
                        {stats.warStreak}
                        {Number(stats.warStreak) > 0 && <span>🔥</span>}
                      </span>}
                      tone="orange" />
                    <MetricBox label="Tier" value={stats.warTier} tone="yellow" />
                  </div>
                </div>

                <div className={`${cityCard} p-6`}>
                  <StatHeader icon={Coins} title="Currency & Assets" subtitle="Coins, value, and cashout status" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-cyan-300/10 bg-slate-950/60 p-4">
                      <span className="font-bold text-slate-100">🎫 Troll Coins</span>
                      <span className="text-xl font-black text-cyan-300">
                        {stats.troll_coins.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-emerald-300/10 bg-slate-950/60 p-4">
                      <span className="font-bold text-slate-100">💰 Gifted Coins</span>
                      <span className="text-xl font-black text-emerald-300">
                        {stats.troll_coins.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-amber-300/10 bg-slate-950/60 p-4">
                      <span className="font-bold text-slate-100">👑 Crowns</span>
                      <span className="text-xl font-black text-amber-300">
                        {balances.battle_crowns.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-purple-300/10 bg-slate-950/60 p-4">
                      <span className="font-bold text-slate-100">⚡ Hype Coins</span>
                      <div className="text-right">
                        <span className="text-xl font-black text-purple-300">
                          {stats.hype_coins.toLocaleString()}
                        </span>
                        <button
                          onClick={() => setIsConvertHypeOpen(true)}
                          className="ml-2 text-xs font-bold text-cyan-300 hover:text-cyan-200 underline"
                        >
                          Convert
                        </button>
                      </div>
                    </div>

                     <div className="rounded-2xl border border-purple-300/10 bg-slate-950/60 p-4">
                       <div className="flex items-center justify-between">
                         <span className="text-slate-300">Total Coins Value</span>
                         <span className="text-lg font-black text-purple-300">
                           ${(Math.round((stats.troll_coins) / 400 * 100) / 100).toFixed(2)}
                         </span>
                       </div>
                       <div className="mt-1 text-xs text-slate-500">400 coins = $1.00</div>
                     </div>
                  </div>
                </div>

                <div className={`${cityCard} p-6 lg:col-span-2`}>
                  <StatHeader icon={Trophy} title="Badges & Achievements" subtitle="Unlocked rank markers and city achievements" />

                  <div className="flex flex-wrap gap-3">
                    {stats.badges.length > 0 ? (
                      stats.badges.map((badge, index) => (
                        <span
                          key={index}
                          className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-bold text-cyan-100"
                        >
                          {badge}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">
                        No badges earned yet. Keep playing to unlock achievements.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${cityPanel} p-12 text-center`}>
                <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-cyan-300" />
                <div className="text-xl font-black text-cyan-100">Loading Stats</div>
                <p className="mt-2 text-slate-400">Syncing your Mai Troll data...</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'earnings' && (
          <div className="grid grid-cols-1 gap-6">
            <div className={`${cityCard} p-6`}>
              <StatHeader icon={DollarSign} title="Earnings Summary" subtitle="Lifetime and pending earnings" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricBox
                  label="Total Earned"
                  value={<div>
                    <div>{earningSummary?.total_earned_coins?.toLocaleString() || '0'} coins</div>
                    <div className="text-xs text-purple-300">{formatStatsUsd(earningSummary?.total_earned_coins || 0)}</div>
                  </div>}
                  tone="green" />
                <MetricBox
                  label="Pending"
                  value={<div>
                    <div>{earningSummary?.pending_coins?.toLocaleString() || '0'} coins</div>
                    <div className="text-xs text-yellow-300">{formatStatsUsd(earningSummary?.pending_coins || 0)}</div>
                  </div>}
                  tone="yellow" />
                <MetricBox
                  label="Paid"
                  value={`${earningSummary?.total_earned_coins?.toLocaleString() || '0'} coins`}
                  tone="cyan" />
                <MetricBox
                  label="This Week"
                  value={`${earningSummary?.week_earned_coins?.toLocaleString() || '0'} coins`}
                  tone="purple" />
              </div>
            </div>

            {activeRoles.length > 0 && (
              <div className={`${cityCard} p-6`}>
                <StatHeader icon={Star} title="Active Earning Roles" subtitle="Your current earning opportunities" />
                <div className="space-y-3">
                  {activeRoles.map(role => (
                    <div key={role.role_key} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 p-4">
                      <div>
                        <span className="font-bold text-white">{role.role_label}</span>
                        <p className="text-xs text-slate-400 mt-1">{role.requirements}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${role.status === 'active' ? 'bg-green-500/20 text-green-300' :
                          role.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                            role.status === 'eligible' ? 'bg-cyan-500/20 text-cyan-300' :
                              'bg-slate-500/20 text-slate-400'}`}>
                        {role.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {treasuryPayouts.length > 0 && (
              <div className={`${cityCard} p-6`}>
                <StatHeader icon={Calendar} title="Treasury Payouts" subtitle="Recent treasury distributions" />

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {treasuryPayouts.slice(0, 10).map(payout => (
                    <div key={payout.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/60 p-3">
                      <div>
                        <span className="font-bold text-white capitalize">{payout.role_key.replace('_', ' ')}</span>
                        <p className="text-xs text-slate-400">{payout.created_at ? new Date(payout.created_at).toLocaleDateString() : '—'}</p>
                      </div>
                      <span className="font-bold text-cyan-300">{payout.amount_coins.toLocaleString()} coins</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {roleRules.filter(r => r.is_active).length > 0 && (
              <div className={`${cityCard} p-6 lg:col-span-2`}>
                <StatHeader icon={Briefcase} title="Earning Opportunities" subtitle="All available earning paths" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roleRules.filter(r => r.is_active).map(rule => {
                    const isUnlocked = activeRoles.some(r => r.role_key === rule.role_key)
                    return (
                      <div key={rule.role_key} className={`rounded-xl p-4 border transition-all ${isUnlocked
                          ? 'border-green-400/30 bg-green-400/5'
                          : 'border-white/10 bg-slate-950/60 hover:border-cyan-300/30'}`}>
                        <div className="flex items-start justify-between">
                          <span className="font-bold text-white">{rule.role_label}</span>
                          {isUnlocked && <CheckCircle className="h-4 w-4 text-green-400" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">{rule.requirement_text || 'No requirements'}</p>
                        {rule.application_route && (
                          <button
                            onClick={() => navigate(rule.application_route || '/')}
                            className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200 flex items-center gap-1"
                          >
                            Apply Now <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div><ConvertHypeCoinsModal
        isOpen={isConvertHypeOpen}
        onClose={() => setIsConvertHypeOpen(false)} /></>    )
  }