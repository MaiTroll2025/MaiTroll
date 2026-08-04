import React, { useCallback } from 'react'
import { Zap, Shield, Crown, Vote, Gavel, Star, Bell, ChevronRight } from 'lucide-react'

interface SystemPostCardProps {
  post: {
    id: string
    title: string
    content: string
    icon?: 'zap' | 'shield' | 'crown' | 'vote' | 'gavel' | 'star' | 'bell'
    priority?: 'high' | 'normal' | 'low'
    action_label?: string
    action_link?: string
    created_at: string
  }
  onClick: () => void
}

const ICON_MAP = {
  zap: Zap,
  shield: Shield,
  crown: Crown,
  vote: Vote,
  gavel: Gavel,
  star: Star,
  bell: Bell,
}

const PRIORITY_STYLES = {
  high: 'border-yellow-400/30 bg-gradient-to-br from-yellow-900/20 via-[#080c1a] to-[#080c1a]',
  normal: 'border-cyan-400/20 bg-gradient-to-br from-cyan-900/15 via-[#080c1a] to-[#080c1a]',
  low: 'border-white/[0.08] bg-[#080c1a]/95',
}

export default function SystemPostCard({ post, onClick }: SystemPostCardProps) {
  const IconComponent = ICON_MAP[post.icon || 'zap']
  const priority = post.priority || 'normal'

  const handleClick = useCallback(() => onClick(), [onClick])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex h-[180px] w-full flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] ${PRIORITY_STYLES[priority]}`}
    >
      {/* Priority indicator */}
      {priority === 'high' && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent" />
      )}

      {/* Icon header */}
      <div className="flex items-center gap-2.5 p-3 pb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15">
          <IconComponent className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-400/70">
            Mai Troll System
          </p>
        </div>
        <Zap className="h-3 w-3 text-cyan-400/40" />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3">
        <h4 className="text-sm font-black text-white group-hover:text-cyan-100 transition-colors">
          {post.title}
        </h4>
        <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-white/45 group-hover:text-white/65">
          {post.content}
        </p>
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-between p-3 pt-2">
        <span className="text-[10px] text-white/25">
          {new Date(post.created_at).toLocaleDateString()}
        </span>
        {post.action_label && (
          <span className="flex items-center gap-1 rounded-lg bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold text-cyan-300 transition group-hover:bg-cyan-500/20">
            {post.action_label}
            <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  )
}
