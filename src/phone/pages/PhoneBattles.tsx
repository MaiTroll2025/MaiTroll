import { Clock3, Eye, Loader2, Radio, RefreshCw, Swords, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useActiveBattles } from '@/hooks/useActiveBattles'

function getTimeLeft(endsAt: string | null, startedAt: string | null): string {
  const endTime = endsAt
    ? new Date(endsAt).getTime()
    : startedAt
      ? new Date(startedAt).getTime() + 180_000
      : Number.NaN
  if (!Number.isFinite(endTime)) return 'Live now'
  const seconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} left`
}

export default function PhoneBattles() {
  const navigate = useNavigate()
  const { battles, loading, error, reload } = useActiveBattles()
  const randomBattles = battles.filter((battle) =>
    battle.challenger?.battle_mode === 'random_queue' ||
    battle.opponent?.battle_mode === 'random_queue',
  )

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#070510] px-4 py-5 text-white">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-black">
            <Swords size={19} className="text-fuchsia-300" />
            Random Battles
          </p>
          <p className="mt-1 text-xs text-white/50">Watch active battles happening now.</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          aria-label="Refresh active battles"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 disabled:opacity-40"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {loading && randomBattles.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-white/60">
          <Loader2 size={18} className="animate-spin text-cyan-300" />
          Finding active battles…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300/15 bg-red-400/5 p-4 text-center">
          <p className="text-sm font-bold text-red-100">Couldn’t load battles</p>
          <p className="mt-1 text-xs text-white/50">{error}</p>
          <button type="button" onClick={() => void reload()} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold">
            Try again
          </button>
        </div>
      ) : randomBattles.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-10 text-center">
          <Radio size={26} className="mx-auto text-white/30" />
          <p className="mt-3 text-sm font-bold">No random battles live right now</p>
          <p className="mt-1 text-xs text-white/45">Check back soon for the next match.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {randomBattles.map((battle) => {
            const viewers = (battle.challenger?.viewer_count || 0) +
              (battle.opponent?.viewer_count || 0)
            return (
              <button
                key={battle.id}
                type="button"
                onClick={() => navigate(`/watch/${battle.challenger_stream_id}`)}
                className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-[#171026] to-[#0d0a17] p-4 text-left shadow-lg transition active:scale-[0.99] hover:border-fuchsia-300/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">
                      {battle.challenger?.title || 'Challenger'}
                      <span className="mx-2 text-white/35">vs</span>
                      {battle.opponent?.title || 'Opponent'}
                    </p>
                    <p className="mt-2 text-xs text-white/50">
                      <span className="text-cyan-200">{battle.score_challenger || 0}</span>
                      <span className="mx-2 text-white/30">—</span>
                      <span className="text-pink-200">{battle.score_opponent || 0}</span>
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-400/10 px-2 py-1 text-[10px] font-black uppercase text-red-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-300" />
                    Live
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[11px] text-white/55">
                  <span className="inline-flex items-center gap-1.5"><Users size={13} />{viewers.toLocaleString()} watching</span>
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{getTimeLeft(battle.ends_at, battle.started_at)}</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-fuchsia-200"><Eye size={13} />Watch</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}
