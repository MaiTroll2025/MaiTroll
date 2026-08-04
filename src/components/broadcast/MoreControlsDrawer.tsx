import React, { useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  Shield,
  LogOut,
  Gift,
  Share2,
  ShieldAlert,
  Ban,
  UserMinus,
  UserCheck,
  Radio,
  Sparkles,
  X,
  Megaphone,
  MessageSquareOff,
  MessageSquare,
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface MoreControlsDrawerProps {
  isOpen: boolean
  onClose: () => void
  isMuted: boolean
  isCameraOff: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onFlipCamera: () => void
  onSettings?: () => void
  onLeave?: () => void
  isHost?: boolean

  onGift?: () => void
  onShare?: () => void
  onEndStream?: () => void
  onToggleSeatsLock?: () => void
  areSeatsLocked?: boolean
  onManageStagePass?: () => void
  openStagePassCount?: number

  onAssignBroadofficer?: () => void
  onPayBroadOfficers?: () => void

  onToggleRGB?: () => void;
  hasRgbEffect?: boolean;
  onTextPopup?: () => void;

  isOfficer?: boolean;
  onMuteUser?: (userId: string) => void
  onDisableChat?: (userId: string) => void
  onBanUser?: (userId: string) => void
  onRemoveFromStage?: () => void
  onModGift?: (userId: string) => void
  userActionUserId?: string
  onPaidChat?: () => void
}

export default function MoreControlsDrawer({
  isOpen,
  onClose,
  isMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onLeave,
  onGift,
  onShare,
  onEndStream,
  onToggleSeatsLock,
  areSeatsLocked = false,
  onManageStagePass,
  openStagePassCount = 0,
  onToggleRGB,
  hasRgbEffect = false,
  onTextPopup,
  onAssignBroadofficer,
  onPayBroadOfficers,
  isHost = false,
  isOfficer = false,
  onMuteUser,
  onDisableChat,
  onBanUser,
  onRemoveFromStage,
  onModGift,
  userActionUserId,
  onPaidChat,
}: MoreControlsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    let startY = 0

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY
      const diff = currentY - startY

      if (diff > 90) {
        onClose()
      }
    }

    const node = drawerRef.current
    node?.addEventListener('touchstart', handleTouchStart, { passive: true })
    node?.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      node?.removeEventListener('touchstart', handleTouchStart)
      node?.removeEventListener('touchmove', handleTouchMove)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        className={cn(
          'fixed z-[90] overflow-hidden border border-cyan-300/15 bg-slate-950/95 text-white shadow-[0_0_40px_rgba(34,211,238,0.20)] backdrop-blur-xl',
          'bottom-0 left-0 right-0 rounded-t-[26px]',
          'mx-auto max-h-[78vh] w-full max-w-[520px]',
          'md:bottom-5 md:right-5 md:left-auto md:w-[360px] md:rounded-[26px]'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_100%_20%,rgba(168,85,247,0.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]" />

        <div className="relative flex max-h-[78vh] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Mai Troll Controls
              </p>
              <h3 className="mt-1 text-base font-black text-white">
                More Options
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close more controls"
            >
              <X size={18} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent">
            <SectionTitle label="Camera & Audio" />

            <div className="grid grid-cols-3 gap-2">
              <ControlButton
                icon={isMuted ? MicOff : Mic}
                label={isMuted ? 'Unmute' : 'Mute'}
                active={!isMuted}
                onClick={onToggleMic}
              />

              <ControlButton
                icon={isCameraOff ? VideoOff : Video}
                label={isCameraOff ? 'Start Video' : 'Stop Video'}
                active={!isCameraOff}
                onClick={onToggleCamera}
              />

              <ControlButton
                icon={Camera}
                label="Flip"
                onClick={onFlipCamera}
              />
            </div>

            {(isHost || isOfficer) && (
              <>
                <SectionTitle label="Stream Controls" className="mt-5" />

                <div className="grid grid-cols-3 gap-2">
                  {onGift && (
                    <ControlButton
                      icon={Gift}
                      label="Gift"
                      onClick={onGift}
                    />
                  )}

                  {onShare && (
                    <ControlButton
                      icon={Share2}
                      label="Share"
                      onClick={onShare}
                    />
                  )}

                  {isHost && onEndStream && (
                    <ControlButton
                      icon={Radio}
                      label="End"
                      onClick={onEndStream}
                      danger
                    />
                  )}

                  {isHost && onToggleSeatsLock && (
                    <ControlButton
                      icon={ShieldAlert}
                      label={areSeatsLocked ? 'Unlock' : 'Lock Seats'}
                      onClick={onToggleSeatsLock}
                      active={areSeatsLocked}
                    />
                  )}

                  {(isHost || isOfficer) && onManageStagePass && (
                    <ControlButton
                      icon={UserCheck}
                      label={`Seats${openStagePassCount ? ` ${openStagePassCount}` : ''}`}
                      onClick={onManageStagePass}
                    />
                  )}

                  {isHost && onAssignBroadofficer && (
                    <ControlButton
                      icon={Shield}
                      label="Officer"
                      onClick={onAssignBroadofficer}
                    />
                  )}

                  {isHost && onPayBroadOfficers && (
                    <ControlButton
                      icon={Gift}
                      label="Pay Officers"
                      onClick={onPayBroadOfficers}
                    />
                  )}

                  {isHost && onToggleRGB && (
                    <ControlButton
                      icon={Sparkles}
                      label={hasRgbEffect ? 'RGB On' : 'RGB Off'}
                      onClick={onToggleRGB}
                      active={hasRgbEffect}
                    />
                  )}

                  {isHost && onTextPopup && (
                    <ControlButton
                      icon={Megaphone}
                      label="Text Popup"
                      onClick={onTextPopup}
                    />
                  )}

                  {isHost && onPaidChat && (
                    <ControlButton
                      icon={MessageSquare}
                      label="Paid Chat"
                      onClick={onPaidChat}
                    />
                  )}
                </div>
              </>
            )}

            {isOfficer && (
              <>
                <SectionTitle label="Officer Actions" className="mt-5" danger />

                <div className="grid grid-cols-3 gap-2">
                  {onMuteUser && userActionUserId && (
                    <ControlButton
                      icon={MicOff}
                      label="Mute User"
                      onClick={() => {
                        onMuteUser(userActionUserId)
                        onClose()
                      }}
                      danger
                    />
                  )}

                  {onDisableChat && userActionUserId && (
                    <ControlButton
                      icon={MessageSquareOff}
                      label="Disable Chat"
                      onClick={() => {
                        onDisableChat(userActionUserId)
                        onClose()
                      }}
                      danger
                    />
                  )}

                  {onBanUser && userActionUserId && (
                    <ControlButton
                      icon={Ban}
                      label="Jail/Ban"
                      onClick={() => {
                        onBanUser(userActionUserId)
                        onClose()
                      }}
                      danger
                    />
                  )}

                  {onRemoveFromStage && (
                    <ControlButton
                      icon={UserMinus}
                      label="Remove"
                      onClick={onRemoveFromStage}
                      danger
                    />
                  )}

                  {onModGift && (
                    <ControlButton
                      icon={Gift}
                      label="Broadofficer Pay"
                      onClick={() => {}}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 bg-black/25 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            <button
              type="button"
              onClick={onLeave}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 text-sm font-black uppercase tracking-[0.12em] text-red-200 shadow-[0_0_22px_rgba(239,68,68,0.12)] transition hover:bg-red-500/15 active:scale-[0.98]"
            >
              <LogOut size={18} />
              {isHost ? 'End Broadcast' : 'Leave Broadcast'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function SectionTitle({
  label,
  className = '',
  danger = false,
}: {
  label: string
  className?: string
  danger?: boolean
}) {
  return (
    <p
      className={cn(
        'mb-2 text-[10px] font-black uppercase tracking-[0.2em]',
        danger ? 'text-red-300/80' : 'text-cyan-300/80',
        className
      )}
    >
      {label}
    </p>
  )
}

function ControlButton({
  icon: Icon,
  label,
  active,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  active?: boolean
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2 text-center transition active:scale-[0.97]',
        danger
          ? 'border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/15'
          : active
            ? 'border-cyan-300/30 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)]'
            : 'border-white/10 bg-white/[0.055] text-white/70 hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-cyan-100'
      )}
    >
      <div
        className={cn(
          'grid h-8 w-8 place-items-center rounded-xl transition',
          danger
            ? 'bg-red-400/10 text-red-300'
            : active
              ? 'bg-cyan-300/15 text-cyan-200'
              : 'bg-white/5 text-white/70 group-hover:text-cyan-200'
        )}
      >
        <Icon size={17} />
      </div>

      <span className="line-clamp-2 text-[10px] font-black leading-tight">
        {label}
      </span>
    </button>
  )
}