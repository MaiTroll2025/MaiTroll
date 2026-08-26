import React, { useEffect, useState } from 'react'
import { KeyRound, TrendingUp, Loader2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { fetchMKeyBroadcastStats, type MKeyBroadcastStats } from '../../../lib/mkeys'

interface MKeyTrafficPanelProps {
  broadcastId: string
  /** Poll while the broadcast is live so the host sees traffic land. */
  live?: boolean
  className?: string
}

/**
 * Rule 19: shows the broadcaster how much real traffic MKeys are generating
 * toward their room — not just how many notifications went out.
 */
export default function MKeyTrafficPanel({ broadcastId, live = true, className }: MKeyTrafficPanelProps) {
  const [stats, setStats] = useState<MKeyBroadcastStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!broadcastId) return
    let cancelled = false

    const load = async () => {
      const next = await fetchMKeyBroadcastStats(broadcastId)
      if (cancelled) return
      setStats(next)
      setLoading(false)
    }

    void load()

    if (!live) return () => {
      cancelled = true
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void load()
    }, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [broadcastId, live])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-6', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
      </div>
    )
  }

  const hasTraffic = Boolean(stats && (stats.mkeysSent > 0 || stats.invitesSent > 0))

  return (
    <div
      className={cn(
        'rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-4 shadow-[0_0_24px_rgba(45,212,191,0.14)] backdrop-blur-xl',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden="true">
          🔑
        </span>
        <h4 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">MKey Traffic</h4>
      </div>

      {!hasTraffic || !stats ? (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          No MKeys have been sent toward this broadcast yet. When a viewer sends MKeys, active users watching other
          live broadcasts get invited here — and you&apos;ll see the joins land right on this panel.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="MKeys Sent Toward This Broadcast" value={stats.mkeysSent} tone="cyan" />
            <Metric label="Successful MKey Joins" value={stats.successfulJoins} tone="emerald" />
            <Metric label="MKey Invites" value={stats.invitesSent} tone="purple" />
            <Metric
              label="Conversion"
              value={`${stats.conversionRate.toFixed(1)}%`}
              tone="pink"
              icon={<TrendingUp size={11} />}
            />
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
            <KeyRound size={10} className="text-cyan-500/70" />
            <span>
              {stats.uniqueSenders.toLocaleString()} {stats.uniqueSenders === 1 ? 'viewer has' : 'viewers have'} sent
              MKeys toward this room
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number | string
  tone: 'cyan' | 'emerald' | 'purple' | 'pink'
  icon?: React.ReactNode
}) {
  const tones: Record<typeof tone, string> = {
    cyan: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-300',
    emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
    purple: 'border-purple-400/25 bg-purple-500/10 text-purple-300',
    pink: 'border-pink-400/25 bg-pink-500/10 text-pink-300',
  }

  return (
    <div className={cn('rounded-xl border px-2.5 py-2', tones[tone])}>
      <div className="flex items-center gap-1 font-mono text-lg font-black leading-none text-white">
        {icon}
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-[9px] font-semibold uppercase leading-tight tracking-wider opacity-80">{label}</div>
    </div>
  )
}
