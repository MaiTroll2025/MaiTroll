import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  Crown,
  Loader2,
  Mic2,
  Play,
  Radio,
  Sparkles,
  Ticket,
  Tv,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { getActiveShows } from '../services/singoffService'
import { useSingOffActions } from '../hooks/useSingOffActions'
import type { ScheduledShow } from '../types'

interface ActiveShow {
  id: string
  room_name: string
  host_id: string | null
  started_at: string | null
  title?: string | null
  scheduled_at?: string | null
}

export function ShowsLobby() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const actions = useSingOffActions()

  const canStartShow = !!profile && (profile.is_ceo || profile.is_admin || profile.role === 'ceo' || profile.role === 'admin')

  const [activeShows, setActiveShows] = useState<ActiveShow[]>([])
  const [scheduled, setScheduled] = useState<ScheduledShow[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    const [active, sched] = await Promise.all([getActiveShows(20), actions.listScheduledShows()])
    setActiveShows(active)
    setScheduled(sched)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStartLive = async () => {
    const id = await actions.startShow({ title: title || 'Mai Sing Off' })
    if (id) navigate(`/mai-sing-off/live/${id}`)
  }

  const handleSchedule = async () => {
    if (!title.trim() || !when) {
      toast.error('Give the show a title and a date/time.')
      return
    }
    setSubmitting(true)
    const res = await actions.scheduleShow(title.trim(), new Date(when).toISOString())
    setSubmitting(false)
    if (res.success) {
      toast.success('Show scheduled — it will appear in the EPaper events feed!')
      setScheduleOpen(false)
      setTitle('')
      setWhen('')
      void load()
    } else {
      toast.error(res.error || 'Could not schedule.')
    }
  }

  const handleCancel = async (id: string) => {
    const res = await actions.cancelScheduledShow(id)
    if (res.success) {
      toast.success('Scheduled show cancelled.')
      void load()
    }
  }

  const now = Date.now()

  const countdownText = useMemo(
    () => (target: string) => {
      const diff = new Date(target).getTime() - now
      if (diff <= 0) return 'starting soon'
      const mins = Math.floor(diff / 60000)
      if (mins < 60) return `${mins}m from now`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `${hrs}h ${mins % 60}m from now`
      const days = Math.floor(hrs / 24)
      return `${days}d ${hrs % 24}h from now`
    },
    [now],
  )

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-r from-purple-950/60 via-black to-pink-950/40 p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(236,72,153,.45), transparent 35%), radial-gradient(circle at 85% 30%, rgba(147,51,234,.4), transparent 35%), radial-gradient(circle at 50% 90%, rgba(34,211,238,.2), transparent 40%)',
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-pink-300">
              <Sparkles className="h-3 w-3" />
              Virtual Talent Show
            </div>
            <h2 className="text-2xl font-black sm:text-3xl">
              MAI SING OFF <span className="text-pink-500">STAGE</span>
            </h2>
            <p className="mt-1 max-w-xl text-sm text-white/55">
              Catch tonight&apos;s performances, step into the queue, or schedule the next big event.
            </p>
          </div>

          {canStartShow && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartLive}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-pink-600/30 transition hover:brightness-110"
              >
                <Radio className="h-4 w-4" />
                Go Live Now
              </button>
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-300 transition hover:bg-cyan-500/20"
              >
                <CalendarClock className="h-4 w-4" />
                Schedule Show
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading stages…
        </div>
      ) : (
        <>
          {/* Live now */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Tv className="h-4 w-4 text-red-400" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Live Now</h3>
              {activeShows.length > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                  {activeShows.length}
                </span>
              )}
            </div>

            {activeShows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <Tv className="mx-auto h-8 w-8 text-white/15" />
                <p className="mt-3 text-sm text-white/40">No live show right now.</p>
                {canStartShow && <p className="mt-1 text-xs text-white/25">Go live or schedule one above.</p>}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeShows.map((show) => (
                  <button
                    key={show.id}
                    type="button"
                    onClick={() => navigate(`/mai-sing-off/live/${show.id}`)}
                    className="group relative overflow-hidden rounded-2xl border border-pink-500/25 bg-gradient-to-br from-zinc-950 via-purple-950/30 to-zinc-950 p-4 text-left transition hover:border-pink-400/50"
                  >
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Live
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/15">
                      <Mic2 className="h-5 w-5 text-pink-400" />
                    </div>
                    <div className="mt-3 text-sm font-black text-white">
                      {show.title || show.room_name || 'Mai Sing Off'}
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      {new Date(show.started_at ?? Date.now()).toLocaleTimeString()}
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-pink-400 group-hover:text-pink-300">
                      <Play className="h-3 w-3" />
                      Join the stage
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Scheduled */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Upcoming Shows</h3>
            </div>

            {scheduled.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <Ticket className="mx-auto h-8 w-8 text-white/15" />
                <p className="mt-3 text-sm text-white/40">No scheduled shows yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scheduled.map((show) => (
                  <div
                    key={show.id}
                    className="flex flex-col gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                        <CalendarClock className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{show.title || 'Mai Sing Off'}</div>
                        <div className="mt-0.5 text-xs text-cyan-300/80">
                          {show.scheduled_at ? new Date(show.scheduled_at).toLocaleString() : ''} · {countdownText(show.scheduled_at ?? '')}
                        </div>
                      </div>
                    </div>
                    {canStartShow && (
                      <button
                        type="button"
                        onClick={() => handleCancel(show.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/10"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Schedule modal */}
      {scheduleOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setScheduleOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-cyan-400/20 bg-zinc-950 p-6 shadow-[0_0_60px_rgba(34,211,238,.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-black text-white">Schedule a Show</h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 block text-xs font-bold text-white/60">Show Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mai Sing Off — Season Opener"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/40"
            />

            <label className="mt-4 block text-xs font-bold text-white/60">Date &amp; Time</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            />

            <button
              type="button"
              onClick={handleSchedule}
              disabled={submitting || !title.trim() || !when}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:brightness-110 disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              {submitting ? 'Scheduling…' : 'Schedule Show'}
            </button>

            <p className="mt-3 text-center text-[10px] text-white/30">
              Scheduled shows automatically appear in the EPaper upcoming events feed.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

