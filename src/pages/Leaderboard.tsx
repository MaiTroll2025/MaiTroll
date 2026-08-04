import React, { useEffect, useMemo, useState } from 'react'
import { Coins, Gift, Loader2, Send, Sparkles, Trophy } from 'lucide-react'

import { supabase } from '../lib/supabase'

type LeaderboardWindow = '30m' | 'hour' | 'day' | 'week' | 'month'
type LeaderboardDirection = 'received' | 'sent'

type GiftLeaderboardRow = {
  user_id: string
  username: string | null
  avatar_url: string | null
  rgb_username_expires_at?: string | null
  glowing_username_color?: string | null
  created_at?: string | null
  total_gift_coins: number
  gift_count: number
}

const windows: Array<{ value: LeaderboardWindow; label: string }> = [
  { value: '30m', label: '30m' },
  { value: 'hour', label: '1h' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const directions: Array<{ value: LeaderboardDirection; label: string; icon: typeof Gift }> = [
  { value: 'received', label: 'Received', icon: Gift },
  { value: 'sent', label: 'Sent', icon: Send },
]

function isRealUser(row: GiftLeaderboardRow) {
  const username = (row.username || '').toLowerCase()
  const blocked = ['test', 'demo', 'mock', 'fake']

  return !blocked.some((pattern) => username.startsWith(pattern)) && username !== 'sample' && username !== 'user'
}

export default function Leaderboard() {
  const [rows, setRows] = useState<GiftLeaderboardRow[]>([])
  const [windowValue, setWindowValue] = useState<LeaderboardWindow>('day')
  const [direction, setDirection] = useState<LeaderboardDirection>('received')
  const [loading, setLoading] = useState(true)

  const totalCoins = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.total_gift_coins || 0), 0)
  }, [rows])

  const totalGifts = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.gift_count || 0), 0)
  }, [rows])

  const activeDirection = directions.find((item) => item.value === direction) || directions[0]
  const ActiveIcon = activeDirection.icon

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)

      try {
        const { data, error } = await supabase.rpc('get_gift_leaderboard', {
          p_window: windowValue,
          p_direction: direction,
          p_limit: 50,
        })

        if (error) throw error

        const realRows = ((data || []) as GiftLeaderboardRow[]).filter(isRealUser).slice(0, 20)

        if (!cancelled) {
          setRows(realRows)
        }
      } catch (error) {
        console.error('Failed to load leaderboard:', error)

        if (!cancelled) {
          setRows([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [windowValue, direction])

  return (
    <main className="min-h-screen bg-[#020617] text-white overflow-y-auto">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.13),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <section className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
        <header className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Trophy className="h-4 w-4" />
                Mai Troll Gift Rankings
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Gift
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">
                  Leaderboard
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                Rolling rankings from real stream gift transactions. Track top gift receivers and top gift senders across live windows.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard icon={UsersIcon} label="Ranked" value={rows.length} />
              <StatCard icon={Gift} label="Gifts" value={totalGifts.toLocaleString()} />
              <StatCard icon={Coins} label="Coins" value={totalCoins.toLocaleString()} gold />
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex rounded-2xl border border-cyan-400/20 bg-black/30 p-1">
              {directions.map((item) => {
                const Icon = item.icon
                const active = direction === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDirection(item.value)}
                    className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${
                      active
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.28)]'
                        : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-5 gap-1 rounded-2xl border border-cyan-400/20 bg-black/30 p-1">
              {windows.map((item) => {
                const active = windowValue === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setWindowValue(item.value)}
                    className={`min-h-10 rounded-xl px-3 text-xs font-black transition ${
                      active
                        ? 'bg-fuchsia-500 text-white shadow-[0_0_24px_rgba(217,70,239,0.24)]'
                        : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 shadow-[0_0_60px_rgba(34,211,238,0.1)] backdrop-blur-xl">
          <div className="border-b border-cyan-400/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-white">
                  <ActiveIcon className="h-5 w-5 text-cyan-300" />
                  Top Gifts {activeDirection.label}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing top 20 real accounts for the selected time window.
                </p>
              </div>

              {loading && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-cyan-300" />
              <p className="text-sm font-bold text-slate-400">Loading leaderboard...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <Sparkles className="mb-4 h-14 w-14 text-slate-600" />
              <h3 className="text-xl font-black text-white">No Gift Activity Yet</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                No qualifying gift activity was found in this window. Once gifts are sent, rankings will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-cyan-400/10">
              {rows.map((row, index) => (
                <LeaderboardRow key={row.user_id} row={row} rank={index + 1} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

function LeaderboardRow({
  row,
  rank,
}: {
  row: GiftLeaderboardRow
  rank: number
}) {
  const medal =
    rank === 1
      ? 'from-yellow-300 to-amber-500'
      : rank === 2
        ? 'from-slate-200 to-slate-500'
        : rank === 3
          ? 'from-orange-300 to-orange-700'
          : 'from-cyan-400/20 to-cyan-400/5'

  const age = useMemo(() => {
    if (!row.created_at) return 0
    const created = new Date(row.created_at)
    return Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
  }, [row.created_at])

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition hover:bg-cyan-400/5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${medal} text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.12)]`}
      >
        #{rank}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-base font-black text-white" title={row.username || 'Unknown'}>
            {row.username || 'Unknown'}
          </span>
          <span className="text-gray-500 text-xs select-none font-mono shrink-0" title={`Account Age: ${age} days`}>
            • {age}d
          </span>
        </div>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {Number(row.gift_count || 0).toLocaleString()} gifts
        </p>
      </div>

      <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-right">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">
          Coins
        </p>
        <p className="mt-1 flex items-center justify-end gap-1 text-lg font-black text-white">
          <Coins className="h-4 w-4 text-yellow-300" />
          {Number(row.total_gift_coins || 0).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  gold,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  gold?: boolean
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        gold
          ? 'border-yellow-400/20 bg-yellow-500/5'
          : 'border-cyan-400/20 bg-cyan-500/5'
      }`}
    >
      <Icon className={`mb-3 h-5 w-5 ${gold ? 'text-yellow-300' : 'text-cyan-300'}`} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return <Trophy className={className} />
}