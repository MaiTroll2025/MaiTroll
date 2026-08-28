import React, { useCallback, useState } from 'react'
import { ArrowLeft, Gift, Heart, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import MobileAudienceTicker from '@/components/broadcast/MobileAudienceTicker'
import { useCityStatusOrb } from '@/lib/hooks/useCityStatusOrb'
import { useAuthStore } from '@/lib/store'
import type { Stream } from '@/types/broadcast'
import MaiBag from '@/components/mai-bag/MaiBag'
import CityStatusOrb from '@/components/city/CityStatusOrb'

interface PhoneViewerHeaderProps {
  stream: Stream | null
  streamId: string
  hostId: string
  viewerCount: number
  likes: number
  activeAudience: any[]
  onLeave: () => void
  onGift: () => void
  onShare: () => void
  onLike: () => void
  liked: boolean
  onHouseClick?: () => void
  onRaid?: () => void
}

export default function PhoneViewerHeader({
  stream,
  streamId,
  hostId,
  viewerCount,
  likes,
  activeAudience,
  onLeave,
  onGift,
  onShare,
  onLike,
  liked,
  onHouseClick,
  onRaid,
}: PhoneViewerHeaderProps) {
  const { user } = useAuthStore()
  const [showAudience, setShowAudience] = useState(false)

  const broadcasterCityStatus = useCityStatusOrb({
    userId: stream?.user_id || '',
    broadcasterId: user?.id,
    isBroadcaster: false,
    isBroadOfficer: false,
  })

  const handleAudienceClick = useCallback(() => {
    setShowAudience(true)
  }, [])

  const handleAudienceClose = useCallback(() => {
    setShowAudience(false)
  }, [])

  return (
    <>
      {/* ================================================================
          TOP HEADER
      ================================================================= */}
      <div
        className="absolute inset-x-0 top-0 z-30 flex flex-col items-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pointer-events-none"
        onClick={(e) => {
          e.stopPropagation()

          if (e.target === e.currentTarget) {
            setShowAudience(true)
          }
        }}
      >
        <div className="pointer-events-auto w-full">
          {/* HEADER ROW */}
          <div className="flex items-center gap-2">
            {/* LEFT CONTROLS */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onLeave}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-black/55 text-white shadow-[0_6px_25px_rgba(0,0,0,0.45)] backdrop-blur-xl transition active:scale-90"
              >
                <ArrowLeft size={18} />
              </button>

              {streamId && (
                <div className="shrink-0">
                  <MaiBag
                    streamId={streamId}
                    compact
                  />
                </div>
              )}
            </div>

            {/* AUDIENCE TICKER */}
            <div className="min-w-0 flex-1">
              <MobileAudienceTicker
                audience={activeAudience}
                currentUserId={user?.id}
                hostUserId={hostId}
                viewerCount={viewerCount}
                likes={likes}
                maxVisible={5}
                onViewerCountClick={handleAudienceClick}
              />
            </div>

            {/* RIGHT CONTROLS */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* LIKE */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onLike()
                }}
                className={cn(
                  'flex h-8 w-8 flex-col items-center justify-center rounded-full',
                  'border border-white/10 bg-black/55',
                  'shadow-[0_5px_20px_rgba(0,0,0,0.35)]',
                  'backdrop-blur-xl transition active:scale-90',
                )}
              >
                <Heart
                  size={12}
                  className={cn(
                    liked
                      ? 'fill-pink-300 text-pink-300'
                      : 'text-white/90',
                  )}
                />

                <span className="text-[7px] font-black leading-none text-white/85">
                  {Math.max(
                    0,
                    likes,
                  ).toLocaleString()}
                </span>
              </button>

              {/* GIFT */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onGift()
                }}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/55 shadow-[0_5px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-90"
              >
                <Gift
                  size={13}
                  className="text-violet-300 drop-shadow-[0_0_8px_rgba(167,139,250,0.45)]"
                />
              </button>

              {/* SHARE */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onShare()
                }}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/55 shadow-[0_5px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-90"
              >
                <Share2
                  size={13}
                  className="text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.45)]"
                />
              </button>
            </div>
          </div>

            {/* ==============================================================
                BROADCASTER CITY STATUS
                Directly underneath the audience/header row.
                No green live indicator.
            =============================================================== */}
            {broadcasterCityStatus.data && (
              <div className="mt-1.5 flex justify-center">
                <div className="relative">
                  <div className="rounded-full bg-black/45 p-1 shadow-[0_6px_25px_rgba(0,0,0,0.4)] backdrop-blur-xl pointer-events-none">
                    <CityStatusOrb
                      data={broadcasterCityStatus.data}
                      permissions={{
                        isSelf: false,
                        canCheckLicense: false,
                        canRaid: true,
                        canRepair: true,
                        canEnforce: false,
                        canRemoveFromSeat: false,
                        canAccessAll: false,
                      }}
                      compact
                      onHouseClick={onHouseClick}
                      onRaid={onRaid}
                    />
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* ================================================================
          FULL AUDIENCE PANEL
      ================================================================= */}
      {showAudience && (
        <div
          className="absolute inset-x-0 top-0 z-40 flex items-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pointer-events-none"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <div className="pointer-events-auto w-full rounded-2xl border border-cyan-400/10 bg-gradient-to-r from-slate-950/90 via-black/70 to-slate-950/90 px-3 py-2.5 backdrop-blur-xl shadow-[0_2px_24px_rgba(34,211,238,0.10)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                Audience
              </span>

              <button
                type="button"
                onClick={handleAudienceClose}
                className="text-[10px] font-black uppercase text-white/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <MobileAudienceTicker
              audience={activeAudience}
              currentUserId={user?.id}
              hostUserId={hostId}
              viewerCount={viewerCount}
              likes={likes}
              maxVisible={7}
            />
          </div>
        </div>
      )}
    </>
  )
}

