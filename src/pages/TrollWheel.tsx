// TrollWheel.tsx - Main Troll Wheel Page
import React, { useEffect, useMemo, useState } from 'react'
import TrollWheelGame from '@/components/games/TrollWheelGame'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'
import { toast } from 'sonner'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import useSEO from '@/hooks/useSEO';
import {
  Coins,
  Trophy,
  Crown,
  Gift,
  Zap,
  Gem,
  X,
  Minus,
  RefreshCw,
  Sparkles,
  Target,
  ShieldCheck,
  Clock,
  Flame,
  Info,
} from 'lucide-react'

interface TopSpinner {
  username: string
  total_winnings: number
  spins: number
}

interface BigWinner {
  username: string
  reward_value: number
  coins_awarded: number
  created_at: string
}

const TROLLMOND_TIERS = [
  { trollmonds: 0, discount: 0, label: 'No discount' },
  { trollmonds: 50, discount: 0.5, label: '0.5% off gifts' },
  { trollmonds: 100, discount: 1, label: 'MAX 1% off gifts' },
]

const DAILY_MISSIONS = [
  { icon: Zap, label: 'Spin the wheel', target: '1 spin', status: 'Active' },
  { icon: Gift, label: 'Win any prize', target: '1 win', status: 'Active' },
  { icon: Gem, label: 'Reach next Trollmond tier', target: 'Progress', status: 'Bonus' },
]

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function ArcadePanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx(MaiTrollTheme.backgrounds.card, MaiTrollTheme.borders.glass, 'rounded-3xl shadow-[0_0_34px_rgba(147,51,234,0.12)]', className)}>
      {children}
    </div>
  )
}

export default function TrollWheel() {
  const { profile } = useAuthStore()
  const profileAny = profile as any
  const { refreshCoins } = useCoins()
  const [topSpinners, setTopSpinners] = useState<TopSpinner[]>([])
  const [bigWinners, setBigWinners] = useState<BigWinner[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [trollmondBalance, setTrollmondBalance] = useState(profileAny?.trollmonds ?? 0)
  const [showMobileInfo, setShowMobileInfo] = useState(true)

  useSEO({
    title: 'Troll Wheel | Spin & Win Rewards | Mai Troll',
    description: 'Spin the Troll Wheel on Mai Troll for a chance to win rewards, Trollmonds, and special abilities. Play online games, earn prizes, and join the fun with our social gaming community.',
    keywords: [
      'online games', 'spin wheel game', 'social games', 'multiplayer games',
      'chance games', 'rewards game', 'Troll Wheel', 'MaiTroll games',
      'win prizes', 'virtual rewards', 'community games', 'spin to win'
    ]
  });

  const userBalance = trollmondBalance

  useEffect(() => {
    if (profileAny?.trollmonds !== undefined) {
      setTrollmondBalance(profileAny.trollmonds)
    }
  }, [profileAny?.trollmonds])

  const getDiscountTier = () => {
    for (let i = TROLLMOND_TIERS.length - 1; i >= 0; i--) {
      if (trollmondBalance >= TROLLMOND_TIERS[i].trollmonds) return TROLLMOND_TIERS[i]
    }
    return TROLLMOND_TIERS[0]
  }

  const discountTier = getDiscountTier()

  const nextTier = useMemo(() => {
    return TROLLMOND_TIERS.find((tier) => tier.trollmonds > trollmondBalance) || null
  }, [trollmondBalance])

  const tierProgress = useMemo(() => {
    if (!nextTier) return 100
    const previousTier = [...TROLLMOND_TIERS].reverse().find((tier) => tier.trollmonds <= trollmondBalance) || TROLLMOND_TIERS[0]
    const range = Math.max(1, nextTier.trollmonds - previousTier.trollmonds)
    const progress = ((trollmondBalance - previousTier.trollmonds) / range) * 100
    return Math.max(0, Math.min(100, Math.round(progress)))
  }, [nextTier, trollmondBalance])

  const trollmondsToNextTier = nextTier ? Math.max(0, nextTier.trollmonds - trollmondBalance) : 0

  const fetchData = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const { data: spinners, error } = await supabase
        .from('troll_wheel_wins')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      if (!spinners || spinners.length === 0) {
        setTopSpinners([])
        setBigWinners([])
        return
      }

      const userIds = [...new Set(spinners.map((s: any) => s.user_id).filter(Boolean))]
      if (userIds.length === 0) return

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', userIds)

      const profileMap: Record<string, string> = {}
      profiles?.forEach((p: any) => {
        profileMap[p.id] = p.username
      })

      const aggregated: Record<string, TopSpinner> = {}
      spinners.forEach((spin: any) => {
        if (!spin.user_id) return
        if (!aggregated[spin.user_id]) {
          aggregated[spin.user_id] = {
            username: profileMap[spin.user_id] || 'Unknown',
            total_winnings: 0,
            spins: 0,
          }
        }
        aggregated[spin.user_id].total_winnings += spin.reward_amount || 0
        aggregated[spin.user_id].spins += 1
      })

      setTopSpinners(
        Object.values(aggregated)
          .sort((a, b) => b.total_winnings - a.total_winnings)
          .slice(0, 10),
      )

      setBigWinners(
        spinners
          .filter((s: any) => Number(s.reward_amount || 0) >= 10)
          .slice(0, 10)
          .map((w: any) => ({
            username: profileMap[w.user_id] || 'Unknown',
            reward_value: w.reward_amount,
            coins_awarded: w.reward_amount,
            created_at: w.created_at,
          })),
      )
    } catch (err) {
      console.warn('[TrollWheel] No data yet:', err)
      if (silent) toast.error('Failed to refresh Troll Wheel stats')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = window.setInterval(() => fetchData(true), 10000)
    return () => window.clearInterval(interval)
  }, [])

  const handleBalanceChange = async (newBalance: number) => {
    setTrollmondBalance(newBalance)
    if (profile) {
      useAuthStore.getState().setProfile({ ...profileAny, trollmonds: newBalance })
    }
    await refreshCoins?.()
  }

  const IS_UNDER_CONSTRUCTION = false

  if (IS_UNDER_CONSTRUCTION) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
        <div className="relative z-10 p-8 text-center">
          <div className="mb-4 text-6xl">🚧</div>
          <h1 className="mb-4 text-4xl font-black md:text-5xl">UNDER CONSTRUCTION</h1>
          <p className="mb-2 text-xl text-yellow-400">The Troll Wheel is being rebuilt!</p>
          <p className="text-gray-400">Check back soon for an exciting new experience.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative flex flex-col overflow-x-hidden ${MaiTrollTheme.backgrounds.primary} text-white`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(147,51,234,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.14),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_90%,rgba(236,72,153,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.08)_0%,rgba(14,165,233,0.06)_40%,rgba(236,72,153,0.08)_100%)]" />
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 md:pt-6">
          <ArcadePanel className="overflow-hidden p-4 md:p-5">
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 shadow-[0_0_34px_rgba(147,51,234,0.25)] md:h-16 md:w-16">
                  <Zap className="h-8 w-8 text-white drop-shadow" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-black shadow-[0_0_12px_rgba(52,211,153,0.7)]">ON</span>
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    <Sparkles className="h-3 w-3" /> Mai Troll Arcade
                  </div>
                  <h1 className="mt-2 bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-300 bg-clip-text text-3xl font-black uppercase tracking-tight text-transparent md:text-5xl">
                    Troll Wheel
                  </h1>
                  <p className="mt-1 text-xs text-slate-300 md:text-sm">Spin to win. 10 Trollmonds per spin. Build tiers, unlock gift discounts, chase the leaderboard.</p>
                </div>
              </div>

              <div className="hidden md:grid grid-cols-3 gap-2 md:min-w-[360px]">
                <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 p-3 text-center">
                  <div className="text-[10px] uppercase text-purple-200/70">Trollmonds</div>
                  <div className="text-xl font-black text-white md:text-2xl">{trollmondBalance.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-center">
                  <div className="text-[10px] uppercase text-yellow-200/70">Discount</div>
                  <div className="text-xl font-black text-yellow-200 md:text-2xl">{discountTier.discount}%</div>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-center">
                  <div className="text-[10px] uppercase text-emerald-200/70">Big Wins</div>
                  <div className="text-xl font-black text-white md:text-2xl">{bigWinners.length}</div>
                </div>
              </div>
            </div>
          </ArcadePanel>
        </header>

        <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 gap-4 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="lg:hidden">
              <ArcadePanel className={cx('transition-all duration-300', showMobileInfo ? 'p-3' : 'p-2')}>
                <button type="button" onClick={() => setShowMobileInfo(!showMobileInfo)} className="flex w-full items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Gem className="h-5 w-5 text-purple-300" />
                    <span className="font-black">{trollmondBalance.toLocaleString()}</span>
                    <span className="text-sm text-purple-200">Trollmonds</span>
                  </div>
                  {showMobileInfo ? <X size={16} /> : <Minus size={16} />}
                </button>
                {showMobileInfo && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                      <span>{discountTier.label}</span>
                      <span>{nextTier ? `${trollmondsToNextTier} to next tier` : 'Max tier reached'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-yellow-400" style={{ width: `${tierProgress}%` }} />
                    </div>
                  </div>
                )}
              </ArcadePanel>
            </div>

            <ArcadePanel className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 md:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(234,179,8,0.18),transparent_34%),radial-gradient(circle_at_50%_45%,rgba(147,51,234,0.22),transparent_46%)]" />
              <div className="pointer-events-none absolute left-6 top-6 hidden rounded-full border border-yellow-300/20 bg-yellow-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-200 md:block">
                Jackpot Stage
              </div>
              <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-2 md:p-4">
                <TrollWheelGame
                  userBalance={userBalance}
                  trollmondBalance={trollmondBalance}
                  onBalanceChange={handleBalanceChange}
                  onTrollmondChange={handleBalanceChange}
                />
              </div>
            </ArcadePanel>
          </section>

          <aside className="min-h-0 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
            <ArcadePanel className="overflow-hidden">
              <div className="border-b border-white/10 bg-gradient-to-r from-purple-600/35 to-pink-600/25 p-4">
                <div className="flex items-center gap-2">
                  <Gem className="h-5 w-5 text-purple-200" />
                  <span className="font-black text-white">Trollmond Tier</span>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-3 text-center">
                  <div className="text-4xl font-black text-white">{trollmondBalance.toLocaleString()}</div>
                  <div className="text-xs uppercase tracking-[0.16em] text-purple-200">Current Balance 💎</div>
                </div>
                <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                  <span>{discountTier.label}</span>
                  <span>{nextTier ? `${trollmondsToNextTier} to next` : 'Max tier'}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 shadow-[0_0_12px_rgba(236,72,153,0.55)]" style={{ width: `${tierProgress}%` }} />
                </div>
                <p className="mt-3 text-center text-xs text-slate-400">Earn 1 Trollmond per 100 coins spent on gifts. Max discount is 10%.</p>
              </div>
            </ArcadePanel>

            <ArcadePanel className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-300" />
                  <span className="font-black text-white">Daily Missions</span>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase text-emerald-300">Arcade</span>
              </div>
              <div className="space-y-2">
                {DAILY_MISSIONS.map((mission) => {
                  const Icon = mission.icon
                  return (
                    <div key={mission.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/35 text-yellow-200">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{mission.label}</div>
                          <div className="text-[11px] text-slate-400">{mission.target}</div>
                        </div>
                      </div>
                      <span className="rounded bg-purple-500/20 px-2 py-1 text-[10px] font-black text-purple-200">{mission.status}</span>
                    </div>
                  )
                })}
              </div>
            </ArcadePanel>

            <ArcadePanel className="overflow-hidden">
              <div className="border-b border-white/10 bg-gradient-to-r from-yellow-500/25 to-pink-500/20 p-4">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-yellow-200" />
                  <span className="font-black text-white">Big Winners</span>
                </div>
              </div>
              <div className="max-h-[220px] space-y-2 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                  <p className="text-sm text-slate-400">Loading...</p>
                ) : bigWinners.length > 0 ? (
                  bigWinners.map((winner, index) => (
                    <div key={`${winner.username}-${winner.created_at}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className={cx('flex h-8 w-8 items-center justify-center rounded-xl font-black', index === 0 ? 'bg-yellow-400 text-black' : 'bg-purple-500/20 text-purple-200')}>
                          {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                        </div>
                        <span className="truncate text-sm font-semibold text-white">@{winner.username}</span>
                      </div>
                      <span className="ml-2 shrink-0 text-sm font-black text-yellow-200">${winner.reward_value}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No big winners yet.</p>
                )}
              </div>
            </ArcadePanel>

            <ArcadePanel className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-300" />
                  <span className="font-black text-white">Top Spinners</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="rounded-xl border border-white/10 bg-white/[0.035] p-2 text-slate-300 hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
                  title="Refresh stats"
                >
                  <RefreshCw className={cx('h-4 w-4', refreshing && 'animate-spin')} />
                </button>
              </div>
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-slate-400">Loading...</p>
                ) : topSpinners.length > 0 ? (
                  topSpinners.map((spinner, index) => (
                    <div key={`${spinner.username}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className={cx('flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black', index === 0 ? 'bg-yellow-400 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-orange-500 text-black' : 'bg-slate-800 text-slate-300')}>
                          {index === 0 ? <Crown className="h-4 w-4" /> : `#${index + 1}`}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">@{spinner.username}</div>
                          <div className="text-[11px] text-slate-500">{spinner.spins} spins</div>
                        </div>
                      </div>
                      <div className="ml-2 flex items-center gap-1 text-yellow-300">
                        <Coins className="h-3 w-3" />
                        <span className="text-sm font-black">{spinner.total_winnings.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No spins yet.</p>
                )}
              </div>
            </ArcadePanel>

            <ArcadePanel className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-5 w-5 text-cyan-300" />
                <span className="font-black text-white">Wheel Rules</span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />10 Trollmonds per spin.</div>
                <div className="flex items-start gap-2"><Gem className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />Trollmonds unlock gift discount tiers.</div>
                <div className="flex items-start gap-2"><Flame className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />Top wins are based on real wheel results.</div>
                <div className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />Stats auto-refresh every 10 seconds.</div>
              </div>
            </ArcadePanel>
          </aside>
        </main>
      </div>
    </div>
  )
}
