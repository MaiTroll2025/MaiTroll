import React from 'react'

interface MobileViewerLevelCardProps {
  level: number
  xpTotal: number
  xpToNext: number
  progress: number
  isLoading: boolean
}

export default function MobileViewerLevelCard({
  level,
  xpTotal,
  xpToNext,
  progress,
  isLoading,
}: MobileViewerLevelCardProps) {
  return (
    <div className="z-10 px-3 pb-2">
      <div className="rounded-xl border border-purple-500/20 bg-[#0B0F20]/90 p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-400/30 bg-purple-500/15 text-sm font-black text-purple-200">
              {isLoading ? '...' : level}
            </div>
            <div>
              <div className="text-xs font-black text-white">Level {isLoading ? '...' : level}</div>
              <div className="text-[10px] font-bold text-white/60">
                {isLoading ? 'Loading XP...' : `${xpTotal.toLocaleString()} / ${xpToNext.toLocaleString()} XP`}
              </div>
            </div>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
