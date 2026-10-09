import React, { useState } from 'react'
import { HardDrive, AlertTriangle, ChevronDown, ChevronUp, Trash2, Download, RefreshCw, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStorageUsage } from '@/hooks/useStorageUsage'

interface StorageIndicatorProps {
  userId: string | null
  storageType?: 'broadcast' | 'hytro_gaming'
  className?: string
}

function formatGB(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb < 0.01) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${gb.toFixed(1)} GB`
}

export function StorageIndicator({ userId, storageType = 'broadcast', className }: StorageIndicatorProps) {
  const { storage, loading, refresh } = useStorageUsage(userId)
  const [expanded, setExpanded] = useState(false)

  if (!userId || loading || !storage) return null

  const isWarning = storage.status === 'warning' || storage.storage_percentage >= 80
  const isExceeded = storage.storage_percentage >= 100
  const isRestricted = storage.replayStatus === 'restricted'
  const statusColor = isExceeded ? 'text-red-300' : isWarning || isRestricted ? 'text-amber-300' : 'text-cyan-300'
  const borderColor = isExceeded ? 'border-red-400/30' : isWarning || isRestricted ? 'border-amber-400/30' : 'border-cyan-400/30'
  const bgColor = isExceeded ? 'bg-red-500/10' : isWarning || isRestricted ? 'bg-amber-500/10' : 'bg-cyan-500/10'

  const _getCategoryLabel = (category: string) => {
    if (storageType === 'hytro_gaming') {
      if (category === 'Broadcast Recordings') return 'Game Files'
      if (category === 'Screenshots') return 'Screenshots'
      if (category === 'Videos') return 'Videos'
    }
    return category
  }

  return (
    <div className={cn('relative z-[999]', className)}>
      <button type="button" onClick={() => setExpanded(!expanded)}
        className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-all', borderColor, bgColor, statusColor)}>
        {(isWarning || isExceeded || isRestricted) && <AlertTriangle className="h-3.5 w-3.5" />}
        <HardDrive className="h-3.5 w-3.5" />
        <span>{formatGB(storage.totalBytes)}</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl z-[9999] pointer-events-auto">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white">Storage & Replay</h4>
              <button type="button" onClick={refresh} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Plan: {storage.plan?.tierLabel || 'No Plan'} • {storage.monthlyFee} Coins/month
            </p>
          </div>

          {/* Storage */}
          {storage.hasPlan ? (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-slate-400 font-bold">STORAGE</span>
                <span className="text-slate-400">{formatGB(storage.totalBytes)} / {formatGB(storage.totalLimitBytes)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={cn('h-full transition-all', storage.storage_percentage >= 80 ? 'bg-amber-400' : 'bg-cyan-400')}
                  style={{ width: `${Math.min(100, storage.storage_percentage)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                <span>{storage.storage_percentage}% used</span>
                <span>{formatGB(storage.totalAvailableBytes)} available</span>
              </div>
            </div>
          ) : (
            <div className="mb-3 p-2 rounded-lg bg-white/5 text-center">
              <p className="text-xs text-slate-400">No active storage plan</p>
            </div>
          )}

          {/* Replay Balance */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Play className="h-3 w-3" /> REPLAY BALANCE
              </span>
              <span className={cn('font-bold', isRestricted ? 'text-red-400' : 'text-purple-300')}>
                {storage.replayBalance?.toLocaleString()} coins
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded bg-white/5 p-1.5 text-center">
                <div className="text-[9px] text-slate-500">Min Today</div>
                <div className="text-xs font-bold text-white">{storage.replayMinutesToday}</div>
              </div>
              <div className="rounded bg-white/5 p-1.5 text-center">
                <div className="text-[9px] text-slate-500">Min Month</div>
                <div className="text-xs font-bold text-white">{storage.replayMinutesMonth}</div>
              </div>
              <div className="rounded bg-white/5 p-1.5 text-center">
                <div className="text-[9px] text-slate-500">Charged Today</div>
                <div className="text-xs font-bold text-white">{storage.replayCoinsToday?.toLocaleString()}</div>
              </div>
              <div className="rounded bg-white/5 p-1.5 text-center">
                <div className="text-[9px] text-slate-500">Charged Month</div>
                <div className="text-xs font-bold text-white">{storage.replayCoinsMonth?.toLocaleString()}</div>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-1 text-center">{storage.replayCostPerMinute} coins/min watched by viewers</p>
          </div>

          {/* Warnings */}
          {isExceeded && (
            <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-400/20">
              <p className="text-[10px] text-red-300">Storage limit reached. Upgrade your storage plan or purchase additional storage.</p>
            </div>
          )}
          {isRestricted && (
            <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-400/20">
              <p className="text-[10px] text-red-300">Replay playback unavailable. Creator replay balance exhausted.</p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-300 transition hover:bg-white/10">
              <Download className="h-3 w-3" /> Download
            </button>
            <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-red-400/20 bg-red-500/5 px-3 py-2 text-[10px] font-bold text-red-300 transition hover:bg-red-500/10">
              <Trash2 className="h-3 w-3" /> Delete Old
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StorageIndicator
