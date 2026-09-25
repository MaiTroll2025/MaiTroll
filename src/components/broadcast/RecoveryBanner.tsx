import React from 'react'
import { RefreshCw } from 'lucide-react'

export default function RecoveryBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-xs font-semibold text-white/90 shadow-lg backdrop-blur-xl">
      <span className="text-white/60">Page stuck?</span>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-cyan-300 hover:bg-white/20"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh
      </button>
    </div>
  )
}
