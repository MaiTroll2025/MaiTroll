import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { setSleepAsleep, setSleepUnlocked, resetSleepState, getSleepState } from '@/lib/appSleep'
import { useAuthStore } from '@/lib/store'
import { PowerOff, RotateCcw, Loader2, Lock, UserPlus } from 'lucide-react'

type Question = {
  prompt: string
  answer: string
}

function generateQuestion(): Question {
  const a = Math.floor(Math.random() * 10) + 1
  const b = Math.floor(Math.random() * 10) + 1
  const ops: Array<{ label: string; calc: () => number }> = [
    { label: '+', calc: () => a + b },
    { label: '-', calc: () => a - b },
    { label: '×', calc: () => a * b },
  ]
  const op = ops[Math.floor(Math.random() * ops.length)]
  const answer = String(op.calc())
  return { prompt: `${a} ${op.label} ${b} = ?`, answer }
}

function getNextWakeTime(): Date {
  const now = new Date()
  const wake = new Date(now)
  wake.setHours(10, 0, 0, 0)
  if (now.getHours() >= 10) {
    wake.setDate(wake.getDate() + 1)
  }
  return wake
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const diff = Math.max(0, target.getTime() - now.getTime())
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    isPast: diff === 0,
  }
}

export default function SleepPuzzlePage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [question, setQuestion] = useState<Question>(() => generateQuestion())
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [adminLoading, setAdminLoading] = useState<string | null>(null)
  const [debugState, setDebugState] = useState<any>(null)

  const wakeTime = useMemo(() => getNextWakeTime(), [])
  const countdown = useCountdown(wakeTime)
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

  useEffect(() => {
    document.body.style.setProperty('background-color', '#0A0814')
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const updateDebug = () => {
      const state = getSleepState()
      const debug = {
        isAsleep: state.isAsleep,
        puzzleAnswer: state.puzzleAnswer,
        unlockedAt: state.unlockedAt ? new Date(state.unlockedAt).toISOString() : null,
        location: typeof window !== 'undefined' ? window.location.pathname : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        now: new Date().toISOString(),
        wakeTime: wakeTime.toISOString(),
        countdown: `${countdown.hours}:${countdown.minutes}:${countdown.seconds}`,
      }
      setDebugState(debug)
      console.log('[SleepPuzzlePage][DEV]', debug)
    }

    updateDebug()
    const id = window.setInterval(updateDebug, 1000)
    return () => window.clearInterval(id)
  }, [wakeTime, countdown])

  const handleSubmit = useMemo(
    () =>
      async (event: React.FormEvent) => {
        event.preventDefault()

        if (busy) return
        setBusy(true)

        const normalized = answer.trim()
        const solved = normalized === question.answer

        if (!solved) {
          toast.error('Not quite — try again!')
          setQuestion(generateQuestion())
          setAnswer('')
          setBusy(false)
          return
        }

        setSleepUnlocked(question.answer)

        toast.success('Unlocked!')
        navigate('/', { replace: true })
      },
    [answer, busy, navigate, question.answer],
  )

  const handleSleep = async () => {
    if (adminLoading) return
    setAdminLoading('sleep')
    try {
      setSleepAsleep()
      toast.success('App is now sleeping.')
    } catch {
      toast.error('Failed to set sleep mode')
    } finally {
      setAdminLoading(null)
    }
  }

  const handleWake = async () => {
    if (adminLoading) return
    setAdminLoading('wake')
    try {
      resetSleepState()
      toast.success('App is awake.')
      navigate('/', { replace: true })
    } catch {
      toast.error('Failed to wake app')
    } finally {
      setAdminLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0814] px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <p className="text-5xl">🧌</p>
          <h1 className="mt-3 text-2xl font-black text-white">Zzz</h1>
          <p className="mt-2 text-sm font-semibold text-white/60">MaiTroll is Sleeping...</p>
          <p className="mt-1 text-xs text-white/40">The trolls need their beauty sleep.</p>
          <p className="mt-3 text-xs text-white/50">
            MaiTroll wakes up at 10:00 AM America/Chicago.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Opening In
          </p>
          <p className="mt-2 text-4xl font-black tracking-widest text-white">
            {countdown.hours}:{countdown.minutes}:{countdown.seconds}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white shadow-[0_0_40px_rgba(34,211,238,0.08)]"
        >
          <p className="text-center text-sm font-semibold text-white/70">
            Solve this to enter
          </p>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-3xl font-black tracking-wide text-white">
              {question.prompt}
            </p>
          </div>

          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            inputMode="numeric"
            pattern="[0-9\-]*"
            autoFocus
            className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center text-lg font-semibold text-white outline-none focus:border-cyan-400/80"
            placeholder="Your answer"
          />

          <button
            type="submit"
            disabled={busy || !answer.trim()}
            className="mt-4 w-full rounded-xl bg-cyan-500 py-3 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-cyan-400 disabled:opacity-40"
          >
            {busy ? 'Checking...' : 'Unlock'}
          </button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-xs font-semibold text-white/50">Create Account While You Wait</p>
          <button
            type="button"
            onClick={() => navigate('/auth?mode=signup')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/[0.08]"
          >
            <UserPlus className="h-4 w-4" />
            Sign Up
          </button>
          <p className="text-[11px] text-white/35">
            Don't wake the troll... 😴
          </p>
          <p className="text-[11px] text-white/35">
            Come back soon for 16 hours of pure chaos.
          </p>
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              <Lock className="h-3.5 w-3.5" />
              Admin controls
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSleep}
                disabled={adminLoading !== null}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                {adminLoading === 'sleep' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sleeping
                  </>
                ) : (
                  <>
                    <PowerOff className="h-4 w-4" />
                    Sleep
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleWake}
                disabled={adminLoading !== null}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-green-500 disabled:opacity-40"
              >
                {adminLoading === 'wake' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waking
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Wake
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {import.meta.env.DEV && (
          <div className="rounded-xl border border-white/10 bg-black/60 p-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Dev Debug
            </p>
            <pre className="mt-2 text-[11px] leading-relaxed text-green-300/90">
{JSON.stringify(debugState, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
