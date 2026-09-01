import { Crown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FeaturedLiveOverlayProps {
  active?: boolean
  className?: string
}

export function FeaturedLiveOverlay({ active = false, className }: FeaturedLiveOverlayProps) {
  if (!active) return null

  return (
    <div className={cn('pointer-events-none absolute left-3 top-3 z-20', className)}>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-slate-950/80 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.2)] backdrop-blur-md">
        <Crown className="h-3 w-3 text-cyan-300" />
        Featured
      </div>
    </div>
  )
}
