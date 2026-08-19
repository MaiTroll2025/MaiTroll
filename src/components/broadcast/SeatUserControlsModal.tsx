import React from 'react'
import { X, Mic, MicOff, Video, VideoOff, Users, Gift, Share2, Mail, LogOut, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

interface SeatUserControlsModalProps {
  isOpen: boolean
  onClose: () => void
  isMicOn: boolean
  isCamOn: boolean
  isLive: boolean
  liveViewerCount?: number
  onToggleMic: () => void
  onToggleCam: () => void
  onGift: () => void
  onShare: () => void
  onOpenMessage: () => void
  onLeaveSeat: () => void
}

export default function SeatUserControlsModal({
  isOpen,
  onClose,
  isMicOn,
  isCamOn,
  isLive,
  liveViewerCount = 0,
  onToggleMic,
  onToggleCam,
  onGift,
  onShare,
  onOpenMessage,
  onLeaveSeat,
}: SeatUserControlsModalProps) {
  const ActionButton = ({
    icon: Icon,
    label,
    onClick,
    variant = 'default',
    disabled,
  }: {
    icon: React.ElementType
    label: string
    onClick?: (e?: React.MouseEvent) => void
    variant?: 'default' | 'danger'
    disabled?: boolean
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all',
        variant === 'default'
          ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_18px_rgba(45,212,191,0.18)]'
          : 'border-red-400/25 bg-red-500/10 text-red-300 hover:bg-red-500/20',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-4 backdrop-blur-xl" onClick={onClose}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_42%),rgba(2,6,23,0.96)] shadow-[0_0_55px_rgba(34,211,238,0.22)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/18 px-3 py-1.5 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(45,212,191,0.25)] backdrop-blur-xl">
              <Sparkles className="h-4 w-4" />
              Seat Controls
            </div>
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-black text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-rose-300/35 hover:bg-rose-500/15 hover:text-white"
            aria-label="Close controls"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white/80">
              <Users className="h-4 w-4 text-cyan-300" />
              {liveViewerCount >= 1000 ? `${(liveViewerCount / 1000).toFixed(1) || '0'}K` : liveViewerCount} watching
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <ActionButton
              icon={isMicOn ? Mic : MicOff}
              label={isMicOn ? 'Mute' : 'Unmute'}
              onClick={onToggleMic}
            />
            <ActionButton
              icon={isCamOn ? Video : VideoOff}
              label={isCamOn ? 'Turn Off' : 'Camera'}
              onClick={onToggleCam}
            />
            <ActionButton
              icon={Mail}
              label="Messages"
              onClick={onOpenMessage}
            />
            <ActionButton
              icon={Gift}
              label="Gifts"
              onClick={onGift}
            />
            <ActionButton
              icon={Share2}
              label="Share"
              onClick={onShare}
            />
            <ActionButton
              icon={LogOut}
              label="Leave Seat"
              onClick={onLeaveSeat}
              variant="danger"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
