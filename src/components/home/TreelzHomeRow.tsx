import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Play, Eye, Gift, MessageCircle } from 'lucide-react'
import { fetchTrendingTreelz } from '@/services/treelzService'
import type { TreelzPost } from '@/types/treelz'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function TreelzThumb({ post }: { post: TreelzPost }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      to={`/treelz?post=${post.id}`}
      className="group relative flex-shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-all duration-300 hover:border-cyan-400/30 hover:bg-white/[0.08]"
      style={{ width: 180 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-black/40">
        {post.thumbnail_url ? (
          <img
            src={post.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900/60 to-cyan-900/60">
            <Play className="h-8 w-8 text-white/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Play className="h-5 w-5 text-white" fill="white" />
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2">
          <p className="line-clamp-2 text-[10px] font-bold leading-tight text-white drop-shadow-lg">
            {post.caption || 'Untitled'}
          </p>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          <Eye className="h-2.5 w-2.5" />
          {formatCount(post.views_count || 0)}
        </div>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        {post.author?.avatar_url ? (
          <img src={post.author.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
        ) : (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-[7px] font-black text-white">
            {post.author?.username?.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <span className="truncate text-[9px] font-bold text-slate-300">@{post.author?.username || 'unknown'}</span>
      </div>
      <div className="flex items-center gap-3 px-2 pb-1.5 text-[9px] font-bold text-slate-400">
        <span className="flex items-center gap-0.5">
          <span className="text-[10px]">🤡</span>
          {formatCount(post.likes_count || 0)}
        </span>
        <span className="flex items-center gap-0.5">
          <Gift className="h-2.5 w-2.5 text-yellow-400" />
          {formatCount(post.gifts_received || 0)}
        </span>
      </div>
    </Link>
  )
}

export default function TreelzHomeRow({ title, icon, sortBy }: { title: string; icon: React.ReactNode; sortBy?: string }) {
  const [posts, setPosts] = useState<TreelzPost[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTrendingTreelz(8)
      .then((data) => {
        if (!cancelled) {
          let sorted = [...data]
          if (sortBy === 'gifts') {
            sorted.sort((a, b) => (b.gifts_received || 0) - (a.gifts_received || 0))
          } else if (sortBy === 'trolls') {
            sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
          }
          setPosts(sorted.slice(0, 8))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [sortBy])

  const scroll = useCallback((dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 380
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }, [])

  if (loading) {
    return (
      <section className="relative">
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-black text-white">{title}</h3>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" style={{ width: 180 }}>
              <div className="aspect-[9/16] w-full rounded-t-xl bg-white/[0.06]" />
              <div className="p-2">
                <div className="h-3 w-20 rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (posts.length === 0) return null

  return (
    <section className="relative group/row">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-black text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => scroll('right')}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
            aria-label="Scroll right"
          >
            ›
          </button>
          <Link
            to="/treelz"
            className="ml-2 text-[10px] font-bold text-cyan-400 transition hover:text-cyan-300"
          >
            View All →
          </Link>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {posts.map((post) => (
          <TreelzThumb key={post.id} post={post} />
        ))}
      </div>
    </section>
  )
}
