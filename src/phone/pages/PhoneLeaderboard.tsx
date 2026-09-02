import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Loader2, Trophy } from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import {
  getCurrentUserSummary,
  getWeekDates,
  getWeeklyLeaderboard,
  type WeeklyLeaderboardRow,
  type WeeklyUserSummary,
} from '@/lib/weeklyPointsService'

export default function PhoneLeaderboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [rows, setRows] = useState<WeeklyLeaderboardRow[]>([])
  const [summary, setSummary] = useState<WeeklyUserSummary | null>(null)
  const [weekDates, setWeekDates] = useState<{ week_id: string; week_start: string; week_end: string; is_current: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dates, leaderboard, userSummary] = await Promise.all([
        getWeekDates(),
        getWeeklyLeaderboard(undefined, 20),
        getCurrentUserSummary(),
      ])
      setWeekDates(dates)
      setRows(leaderboard)
      setSummary(userSummary ?? null)
    } catch (err: any) {
      console.warn('[PhoneLeaderboard] load failed:', err?.message || err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = window.setInterval(load, 30_000)
    return () => window.clearInterval(interval)
  }, [load])

  const currentUserRow =
    user &&
    rows.find((r) => r.user_id === user.id)

  const ownRow: WeeklyLeaderboardRow | null =
    currentUserRow ??
    (user && summary
      ? {
          rank: summary.rank ?? 0,
          user_id: user.id,
          username: (profile?.username as string | null) ?? null,
          avatar_url: profile?.avatar_url ?? null,
          display_name: profile?.display_name ?? null,
          total_points: summary.total_points,
          base_points: summary.base_points,
          multiplier: summary.multiplier,
          sent_troll_coin_gift: summary.sent_troll_coin_gift,
        }
      : null)

  const displayName = (row: WeeklyLeaderboardRow): string => {
    return row.display_name || row.username || 'Anonymous'
  }

  const renderRow = (row: WeeklyLeaderboardRow, isOwn: boolean) => {
    const medal =
      row.rank === 1
        ? 'from-yellow-300 to-amber-500'
        : row.rank === 2
          ? 'from-slate-200 to-slate-500'
          : row.rank === 3
            ? 'from-orange-300 to-orange-700'
            : 'from-fuchsia-400/20 to-fuchsia-400/5'
    const rankLabel = row.rank > 0 ? `#${row.rank}` : '—'

    return (
      <div
        key={row.user_id}
        className={`flex items-center gap-3 px-4 py-3 ${
          isOwn
            ? 'rounded-2xl border border-fuchsia-400/30 bg-fuchsia-900/30'
            : 'border-b border-white/5 last:border-0'
        }`}
      >
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${medal} text-xs font-black text-slate-950`}
        >
          {rankLabel}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-white">{displayName(row)}</span>
            {isOwn && (
              <span className="shrink-0 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/20 px-1 py-0.5 text-[9px] font-black uppercase text-fuchsia-200">
                YOU
              </span>
            )}
            {row.sent_troll_coin_gift && (
              <span className="shrink-0 text-xs" title="2x multiplier">
                ⚡
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            base {row.base_points} × {row.multiplier}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-300">Points</p>
          <p className="text-lg font-black text-white">{row.total_points}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#0A0814]/90 px-4 py-3 backdrop-blur-xl">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
          aria-label="Back"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-white/80">Weekly Leaderboard</h1>
        <div className="w-9" />
      </header>

      {weekDates ? (
        <div className="px-4 py-2 text-xs text-slate-400">
          Week ending {weekDates.week_end} · {new Date(weekDates.week_end).toLocaleDateString(undefined, { weekday: 'short' })}
        </div>
      ) : (
        <div className="px-4 py-2 text-xs text-slate-500">Loading week info…</div>
      )}

      {summary && (
        <div className="mx-4 my-4 rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-500 text-sm font-black text-slate-950">
                #{summary.rank ?? '—'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-fuchsia-200">Your rank this week</p>
                <p className="truncate text-base font-black text-white">
                  {profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'You'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-2xl font-black text-white">
                <Trophy className="h-5 w-5 text-fuchsia-300" />
                {summary.total_points}
              </p>
              <p className="text-xs text-slate-400">
                base {summary.base_points} × {summary.multiplier}
                {summary.sent_troll_coin_gift && ' ⚡ gift'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 font-black text-cyan-200">
              +5 Share
            </span>
            <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 font-black text-cyan-200">
              +1 Follow
            </span>
            <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 font-black text-cyan-200">
              +1 Invite
            </span>
            <span className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 font-black text-yellow-200">
              ⚡ 2× Gift multiplier
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          <p className="text-sm font-bold text-slate-400">Loading weekly leaderboard…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
          <CalendarDays className="h-12 w-12 text-slate-600" />
          <h3 className="text-lg font-black text-white">No Weekly Points Yet</h3>
          <p className="text-xs text-slate-400">
            Share streams, follow broadcasters and send gifts to earn points. Your rank will appear here once you earn
            your first point.
          </p>
        </div>
      ) : (
        <div className="mb-20">
          {rows.map((row) => renderRow(row, row.user_id === user?.id))}
          {ownRow && !rows.some((r) => r.user_id === user?.id) && (
            <div className="mt-4 mx-4">
              <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Your activity</p>
              {renderRow(ownRow, true)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
