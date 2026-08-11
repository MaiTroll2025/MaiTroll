import React from 'react'
import { Play, Users, Gamepad2, Flame, Radio } from 'lucide-react'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'

interface HyTroGamingCardProps {
  stream: {
    id: string
    title: string
    game_title?: string | null
    thumbnail_url?: string | null
    streamer_id?: string | null
    streamer_name: string
    streamer_avatar?: string | null
    viewer_count: number
    is_live: boolean
    tags?: string[]
  }
  onClick: () => void
}

export default function HyTroGamingCard({ stream, onClick }: HyTroGamingCardProps) {
  const avatarUrl =
    stream.streamer_avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(stream.streamer_name)}`

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-[200px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-orange-400/30 hover:shadow-[0_0_30px_rgba(251,146,60,0.15)]"
    >
      {/* Thumbnail */}
      {stream.thumbnail_url ? (
        <div className="absolute inset-0">
          <img
            src={stream.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#080c1a]/30 via-[#080c1a]/60 to-[#080c1a]/95" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/30 via-[#080c1a] to-red-900/20" />
      )}

      {/* Live badge */}
      {stream.is_live && (
        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-lg">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          LIVE
        </div>
      )}

      {/* Viewer count */}
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
        <Users className="h-3 w-3" />
        {stream.viewer_count.toLocaleString()}
      </div>

      {/* Play overlay */}
      <div className="absolute inset-0 z-[5] flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-600/90 shadow-[0_0_30px_rgba(251,146,60,0.4)] backdrop-blur-sm">
          <Play className="h-6 w-6 text-white" fill="white" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mt-auto flex flex-col gap-2 p-3">
        {/* Game title */}
        <div className="flex items-center gap-1.5">
          <Gamepad2 className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-[10px] font-bold text-orange-300/80">
            {stream.game_title || 'Gaming'}
          </span>
        </div>

        {/* Stream title */}
        <p className="line-clamp-2 text-sm font-black text-white group-hover:text-orange-100 transition-colors">
          {stream.title}
        </p>

        {/* Streamer row */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 shrink-0 overflow-visible rounded-full ring-1 ring-white/20">
            <ProfileFrame frame={useUserFrame(stream.streamer_id)} avatarUrl={avatarUrl} username={stream.streamer_name || 'User'} size="xs" fillParent />
          </div>
          <span className="truncate text-[11px] font-bold text-white/50">{stream.streamer_name}</span>
          <Flame className="ml-auto h-3 w-3 text-orange-400/60" />
        </div>
      </div>
    </button>
  )
}
