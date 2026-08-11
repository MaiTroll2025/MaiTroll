import React, { useCallback, useMemo, useState } from 'react'
import {
  Camera,
  CameraOff,
  Crown,
  Grip,
  Hand,
  Mic,
  MicOff,
  MoreVertical,
  Plus,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { StagePass } from '../../types/broadcast'

interface GuestMicCamState {
  [userId: string]: { micOn: boolean; camOn: boolean }
}

interface BroadcastStageLayoutProps {
  // Host
  hostName?: string
  hostAvatarUrl?: string | null
  hostIsMicOn: boolean
  hostIsCamOn: boolean
  hostIsScreenSharing: boolean
  hostHasVideo: boolean
  hostVideoNode?: React.ReactNode

  // Stage Guests
  livePasses: StagePass[]
  guestMicCam: GuestMicCamState

  // Coin balance
  coinBalance: number

  // Viewer pass state
  isHost: boolean
  hasOpenPass: boolean
  currentUserPassStatus?: string | null
  onRequestPass: () => void
  onOpenPassModal?: () => void

  // Host actions
  onApproveStagePass?: (id: string) => void
  onDenyStagePass?: (id: string) => void
  onRemoveStageGuest?: (id: string) => void

  // Optional pinned product support.
  // Safe to leave unused if BroadcastPage already renders pinned product elsewhere.
  pinnedProduct?: {
    id?: string
    title?: string
    name?: string
    image_url?: string | null
    imageUrl?: string | null
    price?: number
    price_coins?: number
    coin_price?: number
  } | null
  onViewPinnedProduct?: () => void
  onClearPinnedProduct?: () => void

  // Optional video nodes for stage guests if caller has them.
  guestVideoNodes?: Record<string, React.ReactNode>

  // Layout
  className?: string
}

function getPassUserId(pass: StagePass): string {
  return (
    (pass as any).user_id ||
    (pass as any).userId ||
    (pass as any).profile_id ||
    pass.id
  )
}

function getPassUsername(pass: StagePass): string {
  return (
    (pass as any).user_profile?.username ||
    (pass as any).user_profile?.display_name ||
    (pass as any).profile?.username ||
    (pass as any).profile?.display_name ||
    (pass as any).username ||
    'Stage Guest'
  )
}

function getPassAvatar(pass: StagePass): string | null {
  return (
    (pass as any).user_profile?.avatar_url ||
    (pass as any).user_profile?.profile_image_url ||
    (pass as any).profile?.avatar_url ||
    (pass as any).avatar_url ||
    null
  )
}

function VerifiedBadge() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] text-white shadow-[0_0_12px_rgba(168,85,247,0.8)]">
      ✓
    </span>
  )
}

function MediaPill({
  active,
  type,
}: {
  active: boolean
  type: 'mic' | 'camera'
}) {
  const Icon = type === 'mic' ? (active ? Mic : MicOff) : active ? Camera : CameraOff

  return (
    <span
      className={cn(
        'inline-flex h-8 min-w-10 items-center justify-center rounded-full border px-3 shadow-inner',
        active
          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-emerald-500/10'
          : 'border-red-400/30 bg-red-500/15 text-red-300 shadow-red-500/10',
      )}
      title={`${type} ${active ? 'on' : 'off'}`}
    >
      <Icon size={15} />
    </span>
  )
}

function StageGuestTile({
  pass,
  index,
  micOn,
  camOn,
  videoNode,
  isHost,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onRemove,
}: {
  pass: StagePass
  index: number
  micOn: boolean
  camOn: boolean
  videoNode?: React.ReactNode
  isHost: boolean
  isMenuOpen: boolean
  onToggleMenu: (passId: string, e: React.MouseEvent) => void
  onCloseMenu: () => void
  onRemove?: (id: string) => void
}) {
  const passId = pass.id
  const username = getPassUsername(pass)
  const avatar = getPassAvatar(pass)
  const isWaitingForGuest = pass.status === 'approved' && !videoNode
  const statusText = isWaitingForGuest ? 'Approved — waiting on guest' : 'On Stage'

  return (
     <div
       className="group relative aspect-square overflow-hidden rounded-2xl border border-violet-500/70
      bg-[#090a13]/90 p-3 shadow-[0_0_22px_rgba(124,58,237,0.35)]
      transition-all duration-200 hover:border-cyan-300/80 hover:shadow-[0_0_28px_rgba(34,211,238,0.28)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.22),transparent_45%)]" />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex rounded-md bg-cyan-400/15 px-2 py-0.5 text-[12px] font-black text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
            Stage Guest
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            {statusText}
          </div>
        </div>

        {isHost && (
          <button
            type="button"
            onClick={(e) => onToggleMenu(passId, e)}
            className="relative z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10
            bg-black/45 text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
            aria-label={`Open actions for ${username}`}
          >
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      <div className="relative z-10 mt-3 flex flex-col items-center">
        <div
          className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full
          border border-violet-400/60 bg-black/50 shadow-[0_0_22px_rgba(168,85,247,0.45)]"
        >
          {videoNode ? (
            <div className="h-full w-full overflow-hidden rounded-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
              {videoNode}
            </div>
          ) : avatar ? (
            <img src={avatar} alt={username} className="h-full w-full object-cover" />
          ) : (
            <UserRound className="text-cyan-200" size={34} />
          )}

          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-black/80 p-1 text-[10px]">
            {index === 0 ? '🔥' : '✨'}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-center">
          <span className="max-w-[120px] truncate text-[14px] font-black text-cyan-200">
            {username}
          </span>
          <VerifiedBadge />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <MediaPill active={micOn} type="mic" />
          <MediaPill active={camOn} type="camera" />
        </div>
      </div>

      {isHost && isMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={onCloseMenu}
            aria-label="Close stage guest menu"
          />
          <div
            className="absolute right-3 top-12 z-50 w-44 overflow-hidden rounded-xl border border-white/15
            bg-slate-950/95 p-1 shadow-2xl backdrop-blur-xl"
          >
            <div className="border-b border-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
              {username}
            </div>
            <button
              type="button"
              onClick={() => {
                onCloseMenu()
                onRemove?.(passId)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-bold
              text-red-300 transition hover:bg-red-500/15"
            >
              <X size={14} />
              Remove from Stage
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyStagePassTile({
  isHost,
  viewerCanRequest,
  currentUserPassStatus,
  onOpenPassModal,
  onRequestPass,
}: {
  isHost: boolean
  viewerCanRequest: boolean
  currentUserPassStatus?: string | null
  onOpenPassModal: () => void
  onRequestPass: () => void
}) {
  const disabled = !isHost && !viewerCanRequest
  const label = isHost ? 'Open Stage Pass' : viewerCanRequest ? 'Request Stage Pass' : 'Stage Pass'
  const subLabel =
    currentUserPassStatus === 'requested'
      ? 'Request pending'
      : isHost
        ? 'to fill this slot'
        : viewerCanRequest
          ? 'ask to join stage'
          : 'not available right now'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={isHost ? onOpenPassModal : onRequestPass}
       className={cn(
          'relative aspect-video overflow-hidden rounded-2xl border border-dashed p-4 text-center transition-all',
        'bg-black/25 backdrop-blur-xl',
        disabled
          ? 'cursor-not-allowed border-white/10 text-white/35'
          : 'border-white/18 text-white/75 hover:border-violet-400/70 hover:bg-violet-500/10 hover:text-white hover:shadow-[0_0_25px_rgba(168,85,247,0.25)]',
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.14),transparent_55%)]" />

      <div className="relative z-10 flex h-full min-h-[156px] flex-col items-center justify-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5
          shadow-[0_0_20px_rgba(255,255,255,0.05)]"
        >
          {isHost ? <Plus size={32} /> : <Hand size={28} />}
        </div>

        <div className="mt-4 text-[15px] font-bold">{label}</div>
        <div className="mt-1 max-w-[130px] text-[13px] leading-snug text-white/45">{subLabel}</div>
      </div>
    </button>
  )
}

export default function BroadcastStageLayout({
  hostAvatarUrl,
  hostIsMicOn,
  hostIsCamOn,
  hostIsScreenSharing,
  hostHasVideo,
  hostVideoNode,
  livePasses,
  guestMicCam,
  coinBalance,
  isHost,
  hasOpenPass,
  currentUserPassStatus,
  onRequestPass,
  onOpenPassModal,
  onRemoveStageGuest,
  pinnedProduct,
  onViewPinnedProduct,
  onClearPinnedProduct,
  guestVideoNodes,
  className,
}: BroadcastStageLayoutProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const visiblePasses = useMemo(
    () => [...livePasses].sort((a, b) => (a.stage_index || 0) - (b.stage_index || 0)).slice(0, 5),
    [livePasses],
  )
  const totalOnStage = 1 + livePasses.length
  const viewerCanRequest =
    !isHost &&
    hasOpenPass &&
    currentUserPassStatus !== 'requested' &&
    currentUserPassStatus !== 'approved' &&
    currentUserPassStatus !== 'live'

  const pinnedTitle = pinnedProduct?.title || pinnedProduct?.name || 'Pinned Product'
  const pinnedImage = pinnedProduct?.image_url || pinnedProduct?.imageUrl
  const pinnedPrice =
    pinnedProduct?.price_coins ??
    pinnedProduct?.coin_price ??
    pinnedProduct?.price ??
    0

  const toggleGuestMenu = useCallback((passId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveMenuId((prev) => (prev === passId ? null : passId))
  }, [])

  const closeMenu = useCallback(() => {
    setActiveMenuId(null)
  }, [])

  return (
    <div
      className={cn(
        'relative h-full min-h-[560px] w-full overflow-hidden rounded-[28px]',
        'bg-[#070812]/80 text-white',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_70%_30%,rgba(168,85,247,0.16),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />

      <div className="relative z-10 grid h-full min-h-[560px] grid-cols-1 gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(400px,1.15fr)]">
        {/* LEFT: HOST MAIN VIDEO */}
        <section
          className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-cyan-300/75
          bg-black shadow-[0_0_34px_rgba(34,211,238,0.38)]"
        >
          <div className="absolute inset-0 z-0">
            {hostVideoNode && hostHasVideo ? (
              <div className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
                {hostVideoNode}
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_35%),linear-gradient(135deg,#020617,#090018,#020617)]">
                {hostAvatarUrl ? (
                  <img
                    src={hostAvatarUrl}
                    className="h-36 w-36 rounded-full border border-cyan-300/50 object-cover shadow-[0_0_34px_rgba(34,211,238,0.35)]"
                  />
                ) : (
                  <UserRound size={92} className="text-cyan-200/80" />
                )}
                <div className="mt-1 text-sm text-cyan-200/70">
                  {hostIsScreenSharing ? 'Screen share active' : hostIsCamOn ? 'Camera Off...' : 'Camera off'}
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-transparent to-black/25" />

{/* Host badge */}
<div className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/15 px-4 py-2 text-sm font-black text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.28)] backdrop-blur-xl">
  <Crown size={16} />
</div>

          {/* Host media state */}
          <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
            <MediaPill active={hostIsMicOn} type="mic" />
            <MediaPill active={hostIsCamOn || hostIsScreenSharing} type="camera" />
          </div>



          {/* Pinned product overlay */}
          {pinnedProduct && (
            <div
              className="absolute bottom-16 left-5 z-30 w-[min(330px,calc(100%-40px))] overflow-hidden rounded-2xl
              border border-violet-400/30 bg-[#120d1f]/86 p-4 shadow-[0_0_24px_rgba(168,85,247,0.32)] backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/35 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-100">
                  <Sparkles size={12} />
                  Pinned Product
                </div>
                {isHost && onClearPinnedProduct && (
                  <button
                    type="button"
                    onClick={onClearPinnedProduct}
                    className="rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                    aria-label="Remove pinned product"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/8">
                  {pinnedImage ? (
                    <img src={pinnedImage} alt={pinnedTitle} className="h-full w-full object-cover" />
                  ) : (
                    <Ticket className="text-violet-200" size={30} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-white">{pinnedTitle}</div>
                  <div className="mt-2 flex items-center gap-2 text-base font-black text-white">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/25 text-violet-200">
                      ◆
                    </span>
                    {Number(pinnedPrice || 0).toLocaleString()}
                  </div>

                  <button
                    type="button"
                    onClick={onViewPinnedProduct}
                    className="mt-3 w-full rounded-xl border border-violet-300/30 bg-gradient-to-r from-violet-700 to-purple-600
                    px-4 py-2 text-sm font-black text-white shadow-[0_0_18px_rgba(168,85,247,0.35)]
                    transition hover:brightness-110"
                  >
                    View Product
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* CENTER: STAGE GUEST GRID */}
        <section
          className="relative min-h-[560px] overflow-hidden rounded-[24px] border border-white/10
          bg-black/28 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.14),transparent_42%)]" />

          <div className="relative z-10 mb-3 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold text-white/70 backdrop-blur">
              <Grip size={15} className="text-white/45" />
              Drag to reorder
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/8 px-3 py-2 text-xs font-black text-cyan-200 sm:flex">
              <ShieldCheck size={14} />
              On Stage {totalOnStage}/6
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visiblePasses.map((pass, index) => {
              const userId = getPassUserId(pass)
              const gm = guestMicCam[userId] ?? guestMicCam[pass.id] ?? { micOn: true, camOn: true }
              const videoNode = guestVideoNodes?.[userId] || guestVideoNodes?.[pass.id]

              return (
                <StageGuestTile
                  key={pass.id}
                  pass={pass}
                  index={index}
                  micOn={gm.micOn}
                  camOn={gm.camOn}
                  videoNode={videoNode}
                  isHost={isHost}
                  isMenuOpen={activeMenuId === pass.id}
                  onToggleMenu={toggleGuestMenu}
                  onCloseMenu={closeMenu}
                  onRemove={onRemoveStageGuest}
                />
              )
            })}

            {(hasOpenPass || isHost || viewerCanRequest || visiblePasses.length < 5) && (
              <EmptyStagePassTile
                isHost={isHost}
                viewerCanRequest={viewerCanRequest}
                currentUserPassStatus={currentUserPassStatus}
                onOpenPassModal={onOpenPassModal}
                onRequestPass={onRequestPass}
              />
            )}
          </div>

          {/* Small coin/status footer inside stage column */}
          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-white/60">
            <span className="inline-flex items-center gap-2">
              <Ticket size={14} className="text-violet-300" />
              Stage capacity protected
            </span>
            <span className="inline-flex items-center gap-2 font-bold text-yellow-200">
              <span className="h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
              {Number(coinBalance || 0).toLocaleString()} coins
            </span>
          </div>

          {/* Host/viewer stage pass action for zero guests and mobile/tablet visibility */}
          {livePasses.length === 0 && (
            <div className="relative z-10 mt-4">
              {isHost ? (
                <button
                  type="button"
                  onClick={onOpenPassModal}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-300/30
                  bg-gradient-to-r from-violet-700 to-purple-600 px-5 py-4 text-sm font-black text-white
                  shadow-[0_0_24px_rgba(168,85,247,0.28)] transition hover:brightness-110"
                >
                  <PlusCircle size={18} />
                  Open Stage Pass
                </button>
              ) : viewerCanRequest ? (
                <button
                  type="button"
                  onClick={onRequestPass}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/30
                  bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-4 text-sm font-black text-white
                  shadow-[0_0_24px_rgba(251,146,60,0.28)] transition hover:brightness-110"
                >
                  <Hand size={18} />
                  Request Stage Pass
                </button>
              ) : currentUserPassStatus === 'requested' ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-center text-sm font-black text-emerald-300">
                  Stage pass request pending
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}