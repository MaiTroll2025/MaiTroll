import React from 'react'
import { KeyRound } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface MKeyGiftCardProps {
  onSelect: () => void
  available?: number
  held?: number
  selected?: boolean
  disabled?: boolean
  /** Compact variant for the dense bottom-sheet gift grid. */
  compact?: boolean
  className?: string
}

/**
 * The MKey tile as it appears inside the Gift Tray.
 *
 *   ┌─────────────────────┐
 *   │         🔑          │
 *   │       MKEY          │
 *   │                     │
 *   │ Invite a live user  │
 *   │ to this broadcast   │
 *   └─────────────────────┘
 *
 * Rule 25: an MKey must never read like an ordinary gift. A gift says "I'm
 * supporting this broadcaster". An MKey says "I'm bringing another person into
 * this room" — so it gets its own premium neon treatment and its own copy.
 */
export default function MKeyGiftCard({
  onSelect,
  available = 0,
  held = 0,
  selected = false,
  disabled = false,
  compact = false,
  className,
}: MKeyGiftCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label="MKey — invite a live user to this broadcast"
      className={cn(
        'group relative overflow-hidden text-left transition-all',
        'rounded-3xl border-2',
        compact ? 'p-2 min-h-[120px]' : 'p-3 min-h-[150px]',
        'flex flex-col items-center justify-center gap-2',
        selected
          ? 'border-cyan-300/80 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.35)]'
          : 'border-purple-400/40 bg-slate-950/70 hover:border-cyan-300/60 hover:bg-slate-900/90 shadow-[0_0_22px_rgba(168,85,247,0.25)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={{
        backgroundImage:
          'linear-gradient(150deg, rgba(109,40,217,0.35) 0%, rgba(14,165,233,0.18) 52%, rgba(236,72,153,0.20) 100%)',
      }}
    >
      {/* Premium sheen */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.22),_transparent_58%)] opacity-20" />
      <div className="pointer-events-none absolute -inset-x-8 -top-10 h-16 rotate-12 bg-white/10 blur-xl transition-transform duration-700 group-hover:translate-y-24" />

      <div className="relative z-10 flex w-full flex-col items-center gap-1.5">
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl border border-cyan-300/30 bg-slate-950/60',
            'shadow-[inset_0_0_18px_rgba(34,211,238,0.25)]',
            compact ? 'h-12 w-12 text-2xl' : 'h-14 w-14 text-3xl'
          )}
        >
          <span aria-hidden="true">🔑</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
          <KeyRound size={11} />
          MKEY
        </div>

        <p
          className={cn(
            'text-center font-semibold leading-tight text-white/90',
            compact ? 'text-[9px]' : 'text-[10px]'
          )}
        >
          Invite a live user
          <br />
          to this broadcast
        </p>

        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
          <span className="rounded-full border border-cyan-300/25 bg-black/30 px-2 py-0.5 font-mono text-[9px] text-cyan-100">
            {available.toLocaleString()} available
          </span>
          {held > 0 && (
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] text-amber-200">
              {held.toLocaleString()} pending
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
