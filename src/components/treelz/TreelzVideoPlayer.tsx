import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import {
  MessageCircle,
  Share2,
  Bookmark,
  Gift,
  MoreHorizontal,
  Volume2,
  VolumeX,
  Play,
  Shield,
  Ban,
  Eye,
  Trash2,
  UserX,
  Send,
  Download,
  Copy,
  MessageSquare,
  Sparkles,
  Flame,
  X,
  Coins,
  Crown,
  Pin,
  Star,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { TreelzPost, TreelzComment } from '@/types/treelz'
import {
  toggleTreelzTroll,
  toggleTreelzSave,
  fetchTreelzComments,
  addTreelzComment,
  sendTreelzTip,
  recordTreelzShare,
  takeTreelzModAction,
  disableTreelzUploads,
  enableTreelzUploads,
  fetchTreelzReports,
} from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function CreatorAvatar({ post, size = 'md' }: { post: TreelzPost; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
  }

  if (post.author?.avatar_url) {
    return (
      <img
        src={post.author.avatar_url}
        alt=""
        className={`${sizes[size]} rounded-2xl object-cover ring-2 ring-white/25 shadow-[0_0_28px_rgba(34,211,238,0.25)]`}
      />
    )
  }

  return (
    <div className={`${sizes[size]} flex items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-cyan-400 to-emerald-400 font-black text-black ring-2 ring-white/25 shadow-[0_0_28px_rgba(34,211,238,0.25)]`}>
      {post.author?.username?.charAt(0).toUpperCase() || '?'}
    </div>
  )
}

function GlassButton({
  children,
  onClick,
  className = '',
  title,
}: {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
  title?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`group relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black/35 text-white shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-white/10 hover:shadow-[0_0_32px_rgba(34,211,238,0.2)] active:scale-95 ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-cyan-400/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative z-10">{children}</span>
    </button>
  )
}

interface TreelzVideoPlayerProps {
  post: TreelzPost
  isActive: boolean
  autoPlay: boolean
  onView?: (watchSeconds: number, completed: boolean) => void
}

export function TreelzVideoPlayer({ post, isActive, autoPlay, onView }: TreelzVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showHeart, setShowHeart] = useState(false)
  const [duration, setDuration] = useState(0)
  const [scrubLabel, setScrubLabel] = useState('0:00')
  const viewStartRef = useRef<number>(0)
  const viewRecordedRef = useRef(false)
  const rafRef = useRef<number>(0)
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const video = videoRef.current
    const bar = progressBarRef.current
    if (!video) return

    if (video.src !== post.video_url) {
      video.src = post.video_url
      video.load()
    }

    if (bar) bar.style.width = '0%'
    setIsPlaying(false)
    setDuration(0)
    setScrubLabel('0:00')
  }, [post.id, post.video_url])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isActive && autoPlay) {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [isActive, autoPlay])

  useEffect(() => {
    if (isActive) {
      viewStartRef.current = Date.now()
      viewRecordedRef.current = false
    } else if (!viewRecordedRef.current && viewStartRef.current > 0) {
      const watchSeconds = Math.round((Date.now() - viewStartRef.current) / 1000)
      if (watchSeconds > 0) onView?.(watchSeconds, false)
      viewRecordedRef.current = true
    }
  }, [isActive, onView])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
    }
  }, [])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    const bar = progressBarRef.current
    if (!video || !bar || !video.duration) return

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const pct = (video.currentTime / video.duration) * 100
      bar.style.width = `${pct}%`
      setScrubLabel(formatDuration(Math.floor(video.currentTime)))
    })
  }, [])

  const handleEnded = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.duration) onView?.(Math.round(video.currentTime), true)
  }, [onView])

  const handleTap = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [isPlaying])

  const handleDoubleTap = useCallback(async () => {
    setShowHeart(true)
    setTimeout(() => setShowHeart(false), 850)

    const { user } = useAuthStore.getState()
    if (!user) return

    try {
      await toggleTreelzTroll(user.id, post.id)
    } catch { /* ignore */ }
  }, [post.id])

  const handleClick = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 250) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
      lastTapRef.current = 0
      handleDoubleTap()
      return
    }

    lastTapRef.current = now
    tapTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastTapRef.current >= 250) handleTap()
    }, 250)
  }, [handleTap, handleDoubleTap])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || !video.duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    video.currentTime = pct * video.duration
  }, [])

  return (
    <div className="group/player relative h-full w-full overflow-hidden bg-black text-white" onClick={handleClick}>
      <video
        src={post.video_url}
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-3xl"
        autoPlay={isActive && autoPlay}
        loop
        muted
        playsInline
      />

      <video
        ref={videoRef}
        className="relative z-10 h-full w-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration)
        }}
        onEnded={handleEnded}
      />

      <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_15%,transparent_0%,rgba(0,0,0,0.08)_44%,rgba(0,0,0,0.82)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black via-black/10 to-black/35" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-black/70 to-transparent" />

      {showHeart && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="relative">
            <span className="absolute inset-0 animate-ping text-8xl opacity-40 blur-sm">🤡</span>
            <span className="relative animate-[heartPop_0.85s_cubic-bezier(.2,1.6,.4,1)_both] text-8xl drop-shadow-[0_0_44px_rgba(34,211,238,0.85)]">🤡</span>
          </div>
        </div>
      )}

      {!isPlaying && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-black/35 shadow-[0_0_55px_rgba(34,211,238,0.26)] backdrop-blur-2xl">
            <Play className="ml-1 h-9 w-9 text-white" fill="white" />
          </div>
        </div>
      )}

      <div className="absolute left-4 right-4 top-4 z-30 flex items-center justify-between gap-3">
        {post.is_live_promotion ? (
          <div className="flex items-center gap-2 rounded-full border border-red-300/40 bg-red-600/75 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-[0_0_30px_rgba(239,68,68,0.35)] backdrop-blur-xl">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Live promo
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-white/75 backdrop-blur-xl">
            <Sparkles size={12} className="text-cyan-300" /> Reelz mode
          </div>
        )}

        <GlassButton onClick={(e) => { e.stopPropagation(); toggleMute() }} className="h-10 w-10 rounded-full" title="Toggle sound">
          {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </GlassButton>
      </div>

      <div className="absolute bottom-8 left-0 right-[76px] z-30 p-4 md:p-5">
        <div className="max-w-[82%] rounded-3xl border border-white/10 bg-black/25 p-3 shadow-[0_16px_55px_rgba(0,0,0,0.32)] backdrop-blur-xl transition duration-300 group-hover/player:bg-black/35">
          <div className="mb-2 flex items-center gap-3">
            <CreatorAvatar post={post} size="md" />
            <div className="min-w-0 flex-1">
              <Link
                to={`/profile/${post.author?.username || ''}`}
                onClick={(e) => e.stopPropagation()}
                className="block truncate text-sm font-black text-white hover:text-cyan-200"
              >
                @{post.author?.username || 'unknown'}
              </Link>
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/55">
                <span>{post.author?.display_name || 'Creator'}</span>
                {post.video_duration_seconds > 0 && <span>• {formatDuration(post.video_duration_seconds)}</span>}
              </div>
            </div>
          </div>

          {post.caption && (
            <p className="text-[13px] font-medium leading-relaxed text-white/90 drop-shadow line-clamp-3">
              {post.caption}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-black text-white/70">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-cyan-100">#{post.is_live_promotion ? 'livepromo' : 'treelz'}</span>
            <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-1 text-fuchsia-100">for you</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1">{scrubLabel}{duration ? ` / ${formatDuration(Math.floor(duration))}` : ''}</span>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-40 h-2 cursor-pointer bg-white/10"
        onClick={(e) => { e.stopPropagation(); handleProgressClick(e) }}
      >
        <div ref={progressBarRef} className="h-full rounded-r-full bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 shadow-[0_0_24px_rgba(34,211,238,0.55)]" style={{ width: '0%' }} />
      </div>
    </div>
  )
}

interface TreelzActionsProps {
  post: TreelzPost
  onCommentClick: () => void
  onShare: () => void
  onTip: () => void
  onMore: () => void
}

function ActionBubble({
  label,
  count,
  active,
  children,
  onClick,
}: {
  label: string
  count?: number
  active?: boolean
  children: React.ReactNode
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-1 border-none bg-transparent p-0 text-white">
      <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border backdrop-blur-2xl transition duration-300 group-hover:-translate-y-1 group-hover:scale-105 ${active ? 'border-cyan-300/55 bg-cyan-300/18 shadow-[0_0_28px_rgba(34,211,238,0.35)]' : 'border-white/15 bg-black/35 shadow-[0_12px_42px_rgba(0,0,0,0.35)] group-hover:border-white/35 group-hover:bg-white/12'}`}>
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/15 via-transparent to-cyan-300/10 opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="relative z-10">{children}</span>
      </span>
      {typeof count === 'number' ? (
        <span className={`text-[11px] font-black drop-shadow ${active ? 'text-cyan-200' : 'text-white/90'}`}>{formatCount(count)}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </button>
  )
}

export const TreelzActions = memo(function TreelzActions({ post, onCommentClick, onShare, onTip, onMore }: TreelzActionsProps) {
  const { user } = useAuthStore()
  const [trolled, setTrolled] = useState(post.user_interaction?.liked || false)
  const [saved, setSaved] = useState(post.user_interaction?.saved || false)
  const [trollCount, setTrollCount] = useState(post.likes_count || 0)
  const [shareCount, setShareCount] = useState(post.shares_count || 0)

  useEffect(() => {
    setTrolled(post.user_interaction?.liked || false)
    setSaved(post.user_interaction?.saved || false)
    setTrollCount(post.likes_count || 0)
    setShareCount(post.shares_count || 0)
  }, [post.id, post.user_interaction?.liked, post.user_interaction?.saved, post.likes_count, post.shares_count])

  const handleTroll = async () => {
    if (!user) { toast.info('Sign in to troll'); return }
    try {
      const liked = await toggleTreelzTroll(user.id, post.id)
      setTrolled(liked)
      setTrollCount((c) => Math.max(0, liked ? c + 1 : c - 1))
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    if (!user) { toast.info('Sign in to save'); return }
    try {
      const isSaved = await toggleTreelzSave(user.id, post.id)
      setSaved(isSaved)
    } catch { /* ignore */ }
  }

  const handleShareClick = () => {
    setShareCount((c) => c + 1)
    onShare()
  }

  return (
    <div className="absolute bottom-24 right-3 z-30 flex flex-col items-center gap-4 md:right-4">
      <ActionBubble label="Troll" count={trollCount} active={trolled} onClick={(e) => { e.stopPropagation(); handleTroll() }}>
        <span className="text-[26px] drop-shadow">🤡</span>
      </ActionBubble>

      <ActionBubble label="Comments" count={post.comments_count || 0} onClick={(e) => { e.stopPropagation(); onCommentClick() }}>
        <MessageCircle className="h-6 w-6" />
      </ActionBubble>

      <ActionBubble label="Share" count={shareCount} onClick={(e) => { e.stopPropagation(); handleShareClick() }}>
        <Share2 className="h-6 w-6" />
      </ActionBubble>

      <ActionBubble label="Tip" count={post.gifts_received || 0} onClick={(e) => { e.stopPropagation(); onTip() }}>
        <Gift className="h-6 w-6" />
      </ActionBubble>

      <ActionBubble label="Save" count={post.saves_count || 0} active={saved} onClick={(e) => { e.stopPropagation(); handleSave() }}>
        <Bookmark className={`h-6 w-6 ${saved ? 'fill-cyan-200 text-cyan-200' : ''}`} />
      </ActionBubble>

      <ActionBubble label="More" onClick={(e) => { e.stopPropagation(); onMore() }}>
        <MoreHorizontal className="h-6 w-6" />
      </ActionBubble>
    </div>
  )
})

interface CommentSheetProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
}

export function CommentSheet({ post, isOpen, onClose }: CommentSheetProps) {
  const { user, isAdmin } = useAuthStore()
  const [comments, setComments] = useState<TreelzComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    fetchTreelzComments(post.id).then(setComments).catch(() => {}).finally(() => setLoading(false))
  }, [isOpen, post.id])

  const handleSubmit = async () => {
    if (!user) { toast.info('Sign in to comment'); return }
    if (!newComment.trim()) return

    try {
      await addTreelzComment(user.id, post.id, newComment.trim())
      setNewComment('')
      const updated = await fetchTreelzComments(post.id)
      setComments(updated)
    } catch { /* ignore */ }
  }

  const handleDeleteComment = useCallback(async (commentId: string, commentUserId: string) => {
    if (!user) return
    const isAuthor = commentUserId === user.id
    const isOwner = post.user_id === user.id
    if (!isAuthor && !isOwner && !isAdmin) return
    if (!confirm('Delete this comment?')) return
    try {
      const { error } = await supabase.from('treelz_comments').delete().eq('id', commentId)
      if (error) throw error
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      toast.success('Comment deleted')
    } catch {
      toast.error('Failed to delete comment')
    }
  }, [user, post.user_id, isAdmin])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#070918]/95 shadow-[0_-30px_100px_rgba(34,211,238,0.16)] backdrop-blur-2xl sm:rounded-[2rem]"
        style={{ maxHeight: '78vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-cyan-500/15 via-fuchsia-500/10 to-amber-500/10" />
        <div className="relative flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        <div className="relative flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/70">Treelz discussion</p>
            <h3 className="text-xl font-black text-white">Comments</h3>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="relative overflow-y-auto px-5 pb-4" style={{ maxHeight: 'calc(78vh - 160px)' }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
              <MessageCircle className="mx-auto mb-3 h-8 w-8 text-cyan-200/60" />
              <p className="text-sm font-black text-white">No comments yet</p>
              <p className="mt-1 text-xs text-slate-400">Start the conversation on this reel.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 transition hover:bg-white/[0.075]">
                  {c.author?.avatar_url ? (
                    <img src={c.author.avatar_url} alt="" className="h-9 w-9 flex-shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-xs font-black text-black">
                      {c.author?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-black text-cyan-100">@{c.author?.username || 'unknown'}</span>
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      <span className="text-[10px] font-bold text-white/35">now</span>
                      {(user && (c.user_id === user.id || post.user_id === user.id || isAdmin)) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id, c.user_id)}
                          className="rounded p-0.5 text-red-300/70 transition hover:bg-red-500/10 hover:text-red-200"
                          title="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-white/82">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative border-t border-white/10 bg-black/25 px-4 py-4 backdrop-blur-xl">
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={user ? 'Add a comment...' : 'Sign in to comment...'}
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 text-xs font-black text-white shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={14} /> Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TipModalProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
}

export function TipModal({ post, isOpen, onClose }: TipModalProps) {
  const { user } = useAuthStore()
  const amounts = [10, 50, 100, 500]
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)

  const handleTip = async (amount: number) => {
    if (!user) { toast.info('Sign in to tip'); return }
    if (!amount || amount <= 0) return

    setSending(true)
    try {
      await sendTreelzTip(user.id, post.user_id, post.id, amount)
      toast.success(`Tipped ${amount} coins!`)
      onClose()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send tip')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#070918]/95 p-6 text-white shadow-[0_0_100px_rgba(245,158,11,0.14)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-amber-400/20 via-fuchsia-500/10 to-cyan-500/10" />
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>

        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-orange-500 text-black shadow-[0_0_60px_rgba(245,158,11,0.4)]">
            <Gift size={30} />
          </div>
          <h3 className="text-2xl font-black">Send creator love</h3>
          <p className="mt-1 text-sm text-slate-400">Tip @{post.author?.username || 'creator'} with Troll Coins.</p>
        </div>

        <div className="relative mt-6 grid grid-cols-4 gap-2">
          {amounts.map((amt) => (
            <button
              key={amt}
              onClick={() => handleTip(amt)}
              disabled={sending}
              className="group rounded-2xl border border-white/10 bg-white/[0.05] px-2 py-4 text-center transition hover:-translate-y-1 hover:border-amber-300/45 hover:bg-amber-300/10 disabled:opacity-40"
            >
              <Coins className="mx-auto mb-2 h-4 w-4 text-amber-300 transition group-hover:rotate-12" />
              <span className="text-sm font-black text-white">{amt}</span>
            </button>
          ))}
        </div>

        <div className="relative mt-4 flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
            placeholder="Custom amount"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => handleTip(Number(custom))}
            disabled={!custom || sending}
            className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 px-4 text-xs font-black text-black transition hover:scale-[1.02] disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

interface ShareModalProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
}

export function ShareModal({ post, isOpen, onClose }: ShareModalProps) {
  const { user } = useAuthStore()
  const [sharing, setSharing] = useState(false)

  const handleShare = async (platform: string) => {
    if (user) await recordTreelzShare(user.id, post.id, platform).catch(() => {})

    if (platform === 'copy') {
      navigator.clipboard.writeText(`${window.location.origin}/treelz?post=${post.id}`).then(() => {
        toast.success('Link copied!')
      }).catch(() => {})
    } else if (platform === 'download') {
      if (user) {
        const { downloadTreelzVideo } = await import('@/services/treelzService')
        try {
          await downloadTreelzVideo(user.id, post.id, post.video_url)
          toast.success('Download started! (-10 coins)')
        } catch (err: any) {
          toast.error(err?.message || 'Download failed')
        }
      } else {
        window.open(post.video_url, '_blank')
      }
    } else if (platform === 'trollwall') {
      if (!user) { toast.info('Sign in to share to TrollWall'); return }
      setSharing(true)
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        const username = profile?.username || 'unknown'
        const shareText = `🎬 @${username} shared a Treelz: ${post.caption || 'Check out this video!'}`

        const { error } = await supabase
          .from('troll_wall_posts')
          .insert({
            user_id: user.id,
            post_type: 'text',
            content: shareText,
            metadata: {
              video_url: post.video_url,
              thumbnail_url: post.thumbnail_url,
              treelz_post_id: post.id,
              type: 'treelz_share',
            },
          })

        if (error) throw error
        toast.success('Shared to TrollWall!')
      } catch (err: any) {
        toast.error(err?.message || 'Failed to share to TrollWall')
      } finally {
        setSharing(false)
      }
    }

    onClose()
  }

  if (!isOpen) return null

  const shareItems = [
    { key: 'copy', label: 'Copy Link', icon: <Copy size={20} />, tone: 'from-cyan-400 to-blue-500' },
    { key: 'download', label: 'Save', icon: <Download size={20} />, tone: 'from-amber-300 to-orange-500' },
    { key: 'trollwall', label: 'TrollWall', icon: <MessageSquare size={20} />, tone: 'from-fuchsia-400 to-pink-500' },
    { key: 'messages', label: 'Message', icon: <Share2 size={20} />, tone: 'from-emerald-300 to-teal-500' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#070918]/95 p-6 text-white shadow-[0_0_100px_rgba(34,211,238,0.14)] backdrop-blur-2xl sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-cyan-500/15 via-fuchsia-500/10 to-emerald-500/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/70">Share this Treelz</p>
            <h3 className="mt-1 text-2xl font-black">Send it everywhere</h3>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3">
          {shareItems.map((item) => (
            <button
              key={item.key}
              onClick={() => handleShare(item.key)}
              disabled={sharing}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-50"
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-white shadow-lg transition group-hover:scale-105`}>
                {item.icon}
              </div>
              <p className="text-sm font-black text-white">{item.label}</p>
              <p className="mt-1 text-[11px] text-slate-500">{item.key === 'download' ? 'Costs 10 coins' : 'Fast share'}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface MoreModalProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
  onDisableUploads?: () => void
  onReport?: () => void
  onDownload?: () => void
}

export function MoreModal({ isOpen, onClose, onDisableUploads, onReport, onDownload }: MoreModalProps) {
  const { profile } = useAuthStore()
  const isMod = profile?.is_admin || profile?.is_troll_officer

  if (!isOpen) return null

  const userActions = [
    { key: 'download', label: 'Download Video', sub: '10 coins', icon: <Download size={17} />, onClick: onDownload, danger: false },
    { key: 'report', label: 'Report', sub: 'Safety review', icon: <Shield size={17} />, onClick: onReport, danger: false },
  ]

  const modActions = [
    { key: 'disable', label: 'Disable Uploads', icon: <UserX size={17} />, onClick: onDisableUploads, tone: 'text-red-300 hover:bg-red-500/10' },
    { key: 'feature', label: 'Feature Reel', icon: <Star size={17} />, onClick: undefined, tone: 'text-amber-300 hover:bg-amber-500/10' },
    { key: 'pin', label: 'Pin Reel', icon: <Pin size={17} />, onClick: undefined, tone: 'text-cyan-300 hover:bg-cyan-500/10' },
    { key: 'delete', label: 'Delete Reel', icon: <Trash2 size={17} />, onClick: undefined, tone: 'text-red-300 hover:bg-red-500/10' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#070918]/95 p-3 text-white shadow-[0_0_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-2 pt-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>
        <div className="px-2 pb-2 pt-1">
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/40">Treelz options</p>
          <h3 className="text-lg font-black">More actions</h3>
        </div>

        <div className="space-y-1">
          {userActions.map((item) => (
            <button
              key={item.key}
              onClick={() => { item.onClick?.(); onClose() }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/8"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-white">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-white">{item.label}</span>
                <span className="block text-[11px] font-bold text-slate-500">{item.sub}</span>
              </span>
            </button>
          ))}

          {isMod && (
            <>
              <div className="my-2 border-t border-white/10" />
              {modActions.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { item.onClick?.(); onClose() }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${item.tone}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8">{item.icon}</span>
                  <span className="text-sm font-black">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface StaffModModalProps {
  post: TreelzPost
  isOpen: boolean
  onClose: () => void
  onAction?: (action: string) => void
}

export function StaffModModal({ post, isOpen, onClose, onAction }: StaffModModalProps) {
  const { profile } = useAuthStore()
  const [reports, setReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)

  useEffect(() => {
    if (!isOpen || !post.id) return

    setLoadingReports(true)
    fetchTreelzReports(post.id)
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoadingReports(false))
  }, [isOpen, post.id])

  const handleModAction = async (action: string) => {
    if (!profile?.id) {
      toast.error('Moderator profile missing')
      return
    }

    try {
      if (action === 'delete' || action === 'hide' || action === 'remove' || action === 'age_restrict' || action === 'feature' || action === 'pin' || action === 'boost') {
        await takeTreelzModAction(profile.id, post.id, action as any)
        toast.success(`Post ${action}d`)
      } else if (action === 'disable_uploads') {
        await disableTreelzUploads(profile.id, post.user_id, 'Staff moderation via Treelz')
        toast.success('Uploads disabled for user')
      } else if (action === 'enable_uploads') {
        await enableTreelzUploads(profile.id, post.user_id)
        toast.success('Uploads enabled for user')
      }

      onAction?.(action)
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Action failed')
    }
  }

  if (!isOpen) return null

  const moderationActions = [
    { action: 'delete', label: 'Delete', icon: <Trash2 size={13} />, className: 'border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/20' },
    { action: 'hide', label: 'Hide', icon: <Eye size={13} />, className: 'border-white/10 bg-white/5 text-white hover:bg-white/10' },
    { action: 'remove', label: 'Remove', icon: <Ban size={13} />, className: 'border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/20' },
    { action: 'age_restrict', label: 'Age Restrict', icon: <Shield size={13} />, className: 'border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20' },
    { action: 'feature', label: 'Feature', icon: <Star size={13} />, className: 'border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20' },
    { action: 'pin', label: 'Pin', icon: <Pin size={13} />, className: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#070918]/95 p-5 text-white shadow-[0_0_100px_rgba(239,68,68,0.12)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-red-500/15 via-amber-500/10 to-cyan-500/10" />
        <div className="relative mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-200/70">Staff command</p>
            <h3 className="mt-1 text-2xl font-black">Moderate Treelz</h3>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
            <X size={17} />
          </button>
        </div>

        <div className="relative mb-4 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
          <CreatorAvatar post={post} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">@{post.author?.username || 'unknown'}</p>
            <p className="truncate text-xs text-slate-500">{post.author?.display_name || 'Creator profile'}</p>
            <p className="mt-1 line-clamp-1 text-[11px] text-white/45">{post.caption || 'No caption'}</p>
          </div>
        </div>

        <div className="relative mb-4 rounded-3xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Reports ({reports.length})</h4>
            {loadingReports && <span className="text-[10px] text-cyan-200">Loading...</span>}
          </div>

          {!loadingReports && reports.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-4 text-center text-xs font-bold text-slate-500">No reports on this post.</p>
          ) : (
            <div className="max-h-36 space-y-2 overflow-y-auto">
              {reports.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <p className="text-xs font-black text-red-200">{r.reason}</p>
                  <p className="mt-1 text-[10px] text-slate-500">by @{r.reporter_username} • {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative grid grid-cols-2 gap-2">
          {moderationActions.map((item) => (
            <button
              key={item.action}
              onClick={() => handleModAction(item.action)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-black transition ${item.className}`}
            >
              {item.icon} {item.label}
            </button>
          ))}

          <button onClick={() => handleModAction('disable_uploads')} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-3 text-xs font-black text-red-200 transition hover:bg-red-500/20">
            <UserX size={13} /> Disable User Uploads
          </button>
        </div>
      </div>
    </div>
  )
}
