import React from 'react'
import { Radio, Users } from 'lucide-react';

interface FeaturedBroadcasterCardProps {
  broadcaster: {
    id: string
    name: string
    avatar_url?: string | null
    category?: string
    viewer_count: number
    is_live: boolean
    thumbnail_url?: string | null
    tags?: string[]
  }
  onClick: () => void
}

export default function FeaturedBroadcasterCard({ broadcaster, onClick }: FeaturedBroadcasterCardProps) {
  const avatarUrl =
    broadcaster.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(broadcaster.name)}`

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-[200px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-red-400/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]"
    >
      {/* Thumbnail background */}
      {broadcaster.thumbnail_url ? (
        <div className="absolute inset-0">
          <img
            src={broadcaster.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#080c1a]/40 via-[#080c1a]/70 to-[#080c1a]/95" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/30 via-[#080c1a] to-purple-900/20" />
      )}

      {/* Live badge */}
      {broadcaster.is_live && (
        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-lg">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          LIVE
        </div>
      )}

      {/* Viewer count */}
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
        <Users className="h-3 w-3" />
        {broadcaster.viewer_count.toLocaleString()}
      </div>

      {/* Content overlay */}
      <div className="relative z-10 mt-auto flex flex-col gap-2 p-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-2.5">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 group-hover:ring-red-400/50 transition-all">
            <img src={avatarUrl} alt={broadcaster.name} loading="lazy" className="h-full w-full object-cover" />
            {broadcaster.is_live && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#080c1a] bg-red-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white group-hover:text-red-200 transition-colors">
              {broadcaster.name}
            </p>
            <p className="truncate text-[10px] font-bold text-white/40">
              {broadcaster.category || 'Streaming'}
            </p>
          </div>
        </div>

        {/* Tags */}
        {broadcaster.tags && broadcaster.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {broadcaster.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-white/50"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Watch button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-red-600/90 px-3 py-1.5 text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Radio className="h-3 w-3" />
            Watch Now
          </div>
        </div>
      </div>
    </button>
  )
}
