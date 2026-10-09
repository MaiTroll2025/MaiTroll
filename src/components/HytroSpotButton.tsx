import React from 'react'
import { Mic } from 'lucide-react'

interface HytroSpotButtonProps {
  variant?: 'nav' | 'mobile' | 'drawer' | 'bottom-bar' | 'door'
  size?: 'sm' | 'md' | 'lg'
  onClick: () => void
  className?: string
  'aria-label'?: string
}

export default function HytroSpotButton({
  variant = 'nav',
  size = 'md',
  onClick,
  className = '',
  'aria-label': ariaLabel = 'HytroSpot — Coming Soon',
}: HytroSpotButtonProps) {
  const baseStyles = `
    relative inline-flex items-center justify-center gap-2
    rounded-xl border
    bg-gradient-to-br from-slate-900 via-purple-950/50 to-slate-900
    border-cyan-300/30
    text-white
    shadow-[0_0_20px_rgba(34,211,238,0.25),0_4px_20px_rgba(0,0,0,0.3)]
    transition-all duration-300
    focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-slate-950
    active:scale-[0.97]
    data-[hytrospot-trigger]: true
  `

  const variantStyles = {
    nav: `
      px-4 py-2.5
      hover:border-cyan-300/60 hover:bg-gradient-to-br from-cyan-900/30 via-purple-950/50 to-cyan-900/30
      hover:shadow-[0_0_30px_rgba(34,211,238,0.4),0_4px_20px_rgba(0,0,0,0.3)]
    `,
    mobile: `
      px-3 py-2
      hover:border-cyan-300/60 hover:bg-gradient-to-br from-cyan-900/30 via-purple-950/50 to-cyan-900/30
      hover:shadow-[0_0_30px_rgba(34,211,238,0.4),0_4px_20px_rgba(0,0,0,0.3)]
    `,
    drawer: `
      w-full justify-start px-3 py-3
      hover:border-cyan-300/60 hover:bg-gradient-to-br from-cyan-900/30 via-purple-950/50 to-cyan-900/30
      hover:shadow-[0_0_30px_rgba(34,211,238,0.4),0_4px_20px_rgba(0,0,0,0.3)]
    `,
    'bottom-bar': `
      flex flex-col gap-1 px-2 py-2
      hover:border-cyan-300/60 hover:bg-gradient-to-br from-cyan-900/30 via-purple-950/50 to-cyan-900/30
      hover:shadow-[0_0_30px_rgba(34,211,238,0.4),0_4px_20px_rgba(0,0,0,0.3)]
    `,
    door: `
      flex flex-col items-center gap-1.5 p-3
      hover:border-cyan-300/60 hover:bg-gradient-to-br from-cyan-900/30 via-purple-950/50 to-cyan-900/30
      hover:shadow-[0_0_30px_rgba(34,211,238,0.4),0_4px_20px_rgba(0,0,0,0.3)]
    `,
  }

  const sizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      aria-label={ariaLabel}
      data-hytrospot-trigger="true"
    >
      <span className="relative flex items-center justify-center">
        <Mic className={`${iconSizes[size]} text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]`} aria-hidden="true" />
        <span className="absolute -top-1 -right-1 h-4 w-4 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]" aria-hidden="true" />
      </span>
      {(variant === 'nav' || variant === 'drawer' || variant === 'door') && (
        <span className="font-black tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
          HytroSpot
        </span>
      )}
      {(variant === 'mobile' || variant === 'bottom-bar') && (
        <span className="hidden sm:inline font-black tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
          HytroSpot
        </span>
      )}
      <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-[0_0_10px_rgba(251,191,36,0.5)] animate-pulse">
        SOON
      </span>
    </button>
  )
}