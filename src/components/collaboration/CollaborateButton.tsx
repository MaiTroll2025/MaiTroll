import React from 'react'
import { Users } from 'lucide-react'
import { cn } from '../../lib/utils'

interface CollaborateButtonProps {
  onClick: () => void
  disabled?: boolean
  label?: string
  compact?: boolean
}

export default function CollaborateButton({ onClick, disabled = false, label = 'Collaborate', compact = false }: CollaborateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/35 bg-cyan-500/15 px-3 py-2 text-sm font-black text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.16)] transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60',
        compact ? 'px-2.5 py-2 text-xs' : 'px-3.5 py-2.5 text-sm',
      )}
    >
      <Users className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {label}
    </button>
  )
}
