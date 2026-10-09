import React from 'react'
import { Gamepad2, Users, Play, Flame } from 'lucide-react'
import HorizontalScrollRow from './HorizontalScrollRow'
import { useLiveContent } from '@/contexts/LiveContentContext'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { useIsMobile } from '@/hooks/useIsMobile'

interface HyTroGamingRowProps {
  onItemClick: (id: string) => void
}

function GamingStreamItem({ item, onItemClick, isMobile }: { item: any; onItemClick: (id: string) => void; isMobile: boolean }) {
  const frame = useUserFrame(item.broadcasterId)
  const avatarUrl =
    item.streamerAvatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.streamerName)}`

  return (
    <button
      key={item.id}
      onClick={() => onItemClick(item.id)}
      className={`group relative flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-orange-400/30 hover:shadow-[0_0_24px_rgba(251,146,60,0.12)] ${isMobile ? 'h-[120px] w-full' : 'h-[180px] w-[150px]'}`}
    >
      {/* Thumbnail */}
      <div className={`relative w-full shrink-0 overflow-hidden ${isMobile ? 'h-[62px]' : 'h-[100px]'}`}>
        {item.streamerAvatar ? (
          <img
            src={item.streamerAvatar}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-orange-900/40 via-[#080c1a] to-red-900/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#080c1a]/95" />
        
        {/* Live badge */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          LIVE
        </div>

        {/* Viewer count */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          <Users className="h-2.5 w-2.5" />
          {item.viewerCount}
        </div>

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-600/90 shadow-[0_0_20px_rgba(251,146,60,0.4)] backdrop-blur-sm">
            <Play className="h-5 w-5 text-white" fill="white" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className={`flex min-w-0 flex-1 flex-col gap-0.5 ${isMobile ? 'p-1.5' : 'p-2.5'}`}>
        <div className="flex items-center gap-1.5">
          <Gamepad2 className="h-3 w-3 text-orange-400" />
          <span className="text-[9px] font-bold text-orange-300/70">Gaming</span>
          <Flame className="ml-auto h-3 w-3 text-orange-400/50" />
        </div>
        <p className="line-clamp-2 flex-1 text-[8px] font-black text-white">{item.title}</p>
        <div className="flex items-center gap-1.5">
          <div className={`shrink-0 overflow-visible rounded-full ring-1 ring-white/15 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`}>
            <ProfileFrame frame={frame} avatarUrl={avatarUrl} username={item.streamerName || 'User'} size="xs" fillParent />
          </div>
          <span className="truncate text-[8px] font-bold text-white/40">{item.streamerName}</span>
        </div>
      </div>
    </button>
  )
}

export default function HyTroGamingRow({ onItemClick }: HyTroGamingRowProps) {
  const { liveItems } = useLiveContent()
  const { isMobileWidth } = useIsMobile()
  const gamingStreams = liveItems.filter(item => item.category === 'gaming').slice(0, isMobileWidth ? 6 : 12)

  const hasData = gamingStreams.length > 0

  return (
    <HorizontalScrollRow
      title="HyTro Gaming Streams"
      icon={<Gamepad2 className="h-3.5 w-3.5 text-orange-400" />}
    >
      {hasData ? (
        <div className={isMobileWidth ? 'grid w-full grid-cols-2 gap-3' : 'flex gap-3'}>
          {gamingStreams.map((item) => (
            <GamingStreamItem key={item.id} item={item} onItemClick={onItemClick} isMobile={isMobileWidth} />
          ))}
        </div>
      ) : (
        <div className={`flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-[#080c1a]/60 p-4 text-center ${isMobileWidth ? 'h-[120px] w-full' : 'h-[180px] w-[150px]'}`}>
          <Gamepad2 className="h-8 w-8 text-orange-400/40" />
          <p className="text-xs font-bold text-white/30">Start a HyTro Stream Now</p>
          <p className="text-[10px] text-white/15">Be the first gaming stream!</p>
        </div>
      )}
    </HorizontalScrollRow>
  )
}
