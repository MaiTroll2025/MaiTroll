import React from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageSquare, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WallPost } from '@/types/trollWall'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'

interface TrollWallCardProps {
  post: WallPost
  onClick?: (post: WallPost) => void
  className?: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TrollWallCard({ post, onClick, className }: TrollWallCardProps) {
  const userFrame = useUserFrame(post.user_id)
  const preview = post.content
    ? post.content.split(/\s+/).slice(0, 10).join(' ') + (post.content.split(/\s+/).length > 10 ? '…' : '')
    : ''

  const handleClick = () => {
    onClick?.(post)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'snap-start flex-shrink-0 w-[200px] rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden cursor-pointer transition-all hover:border-purple-400/30 hover:bg-white/[0.07] group/card',
        className
      )}
    >
      {/* Thumbnail area */}
      {post.metadata?.thumbnail_url || post.metadata?.image_url ? (
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={post.metadata.thumbnail_url || post.metadata.image_url}
            alt=""
            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      ) : (
        <div className="h-20 bg-gradient-to-br from-purple-900/30 to-cyan-900/20 flex items-center justify-center px-3">
           <p className="text-[10px] text-white/50 line-clamp-3 leading-tight italic">&quot;{preview}&quot;</p>
        </div>
      )}

      {/* Content */}
      <div className="p-2.5">
        {/* User row */}
        <div className="flex items-center gap-2 mb-1.5">
          <Link
            to={`/profile/${post.username}`}
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 rounded-full flex-shrink-0 overflow-visible ring-1 ring-white/10 hover:ring-purple-400/50 transition-all"
          >
            {post.avatar_url ? (
              <ProfileFrame frame={userFrame} avatarUrl={post.avatar_url} username={post.username || 'User'} size="xs" fillParent />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">
                  {(post.username || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to={`/profile/${post.username}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] font-bold text-white truncate block hover:text-cyan-300 transition-colors"
            >
              {post.username}
            </Link>
          </div>
        </div>

        {/* Preview text */}
        <p className="text-[10px] text-slate-300 line-clamp-2 leading-tight mb-2">{preview}</p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span className="flex items-center gap-0.5">
            <Heart className="w-2.5 h-2.5" />
            {post.likes || 0}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageSquare className="w-2.5 h-2.5" />
            {post.replies?.length || 0}
          </span>
          <span className="flex items-center gap-0.5 ml-auto">
            <Clock className="w-2.5 h-2.5" />
            {timeAgo(post.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}
