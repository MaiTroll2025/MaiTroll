import React, { useCallback } from 'react'
import { Heart, MessageSquare, Gift, Pin, Star, Play } from 'lucide-react'
import { WallPost } from '@/types/trollWall'

interface FeaturedPostCardProps {
  post: WallPost
  onClick: (post: WallPost) => void
  variant?: 'large' | 'medium'
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString()
}

export default function FeaturedPostCard({ post, onClick, variant = 'large' }: FeaturedPostCardProps) {
  const avatarUrl =
    post.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(post.username || 'TC')}`

  const hasImage = !!post.metadata?.image_url
  const thumbnailUrl = post.metadata?.thumbnail_url || post.metadata?.image_url

  const commentCount = post.replies?.length || 0
  const giftCount = post.gifts
    ? Object.values(post.gifts).reduce((sum, g) => sum + (g.count || 0), 0)
    : 0

  const handleClick = useCallback(() => onClick(post), [onClick, post])

  const isLarge = variant === 'large'
  const borderClasses = post.is_pinned
    ? 'border-yellow-400/80 shadow-[0_0_24px_rgba(250,204,21,0.24)] hover:border-yellow-400/90 hover:shadow-[0_0_30px_rgba(250,204,21,0.32)]'
    : 'border-white/[0.08] hover:border-cyan-400/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]'

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-[#080c1a]/95 text-left transition-all duration-200 ${isLarge ? 'h-[280px] md:h-[320px]' : 'h-[220px] md:h-[260px]'} ${borderClasses}`}
    >
      {post.is_pinned && (
        <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent" />
      )}

      {/* Featured badge */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-yellow-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-lg">
        <Star className="h-2.5 w-2.5" />
        Featured
      </div>

      {/* Image area — takes up 60% of card */}
{hasImage && thumbnailUrl ? (
         <div className={`relative w-full shrink-0 overflow-hidden ${isLarge ? 'h-[65%]' : 'h-[58%]'}`}>
           <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#080c1a]/95" />
          {/* Play overlay for video content */}
          {post.metadata?.video_url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition group-hover:scale-110">
                <Play className="h-5 w-5 text-white" fill="white" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`relative w-full shrink-0 ${isLarge ? 'h-[55%]' : 'h-[48%]'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-[#080c1a] to-cyan-900/30" />
          <div className="flex h-full items-center justify-center p-4">
            <p className={`text-center font-bold text-white/70 ${isLarge ? 'text-sm' : 'text-xs'}`}>
              {post.content}
            </p>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 pt-2">
        {/* Author row */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
            {post.is_system_generated ? (
              <div className="flex h-full w-full items-center justify-center bg-cyan-500/20 text-[9px] text-cyan-400">
                ⚡
              </div>
            ) : (
              <img src={avatarUrl} alt={post.username || ''} loading="lazy" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-white/90 group-hover:text-white">
              {post.is_system_generated ? 'MaiTroll System' : post.username || 'Unknown'}
            </span>
            <span className="text-[10px] text-white/30">{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {/* Post preview — only on large */}
        {isLarge && (
          <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-white/50 group-hover:text-white/70">
            {post.is_system_generated && <span className="text-cyan-400/80">⚡ </span>}
            {post.content}
          </p>
        )}

        {/* Bottom meta row */}
        <div className="mt-auto flex items-center gap-3 text-[10px] text-white/35">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {post.likes || 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {commentCount}
          </span>
          {giftCount > 0 && (
            <span className="flex items-center gap-1">
              <Gift className="h-3 w-3" />
              {giftCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
