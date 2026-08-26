import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  Bookmark,
  Coins,
  Copy,
  Download,
  Gift,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Play,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Flame,
  TrendingUp,
  Users,
  Heart,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

import type {
  TreelzPost,
  TreelzComment,
  TreelzFeedCursor,
} from '../../types/treelz'

import {
  fetchTreelzFeed,
  fetchTrendingTreelz,
  fetchTreelzProfile,
  recordTreelzView,
  loadTreelzSettings,
  toggleTreelzTroll,
  toggleTreelzSave,
  fetchTreelzComments,
  addTreelzComment,
  sendTreelzTip,
  recordTreelzShare,
  downloadTreelzVideo,
  reportTreelzPost,
} from '../../services/treelzService'

/* =========================================================
   CONSTANTS
========================================================= */

const CATEGORIES = [
  {
    key: 'discover',
    label: 'Discover',
    icon: Sparkles,
  },
  {
    key: 'trending',
    label: 'Trending',
    icon: Flame,
  },
  {
    key: 'most-trolled',
    label: 'Most Trolled',
    icon: TrendingUp,
  },
  {
    key: 'most-gifted',
    label: 'Most Gifted',
    icon: Gift,
  },
  {
    key: 'following',
    label: 'Following',
    icon: Users,
  },
]

/* =========================================================
   HELPERS
========================================================= */

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  return value.toLocaleString()
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'

  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)

  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

/* =========================================================
   CREATOR AVATAR
========================================================= */

function CreatorAvatar({
  post,
}: {
  post: TreelzPost
}) {
  const avatar = post.author?.avatar_url
  const username = post.author?.username || '?'

  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white/20 shadow-[0_0_25px_rgba(0,191,255,0.25)]"
      />
    )
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] via-[#8B5CF6] to-[#BF00FF] text-sm font-black text-white shadow-[0_0_28px_rgba(0,191,255,0.3)]">
      {username.charAt(0).toUpperCase()}
    </div>
  )
}

/* =========================================================
   PHONE VIDEO
========================================================= */

interface PhoneTreelzVideoProps {
  post: TreelzPost
  active: boolean
  autoPlay: boolean
  onComment: () => void
  onShare: () => void
  onTip: () => void
  onMore: () => void
  onView: (watchSeconds: number, completed: boolean) => void
}

const PhoneTreelzVideo = memo(function PhoneTreelzVideo({
  post,
  active,
  autoPlay,
  onComment,
  onShare,
  onTip,
  onMore,
  onView,
}: PhoneTreelzVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [showTroll, setShowTroll] = useState(false)
  const [progress, setProgress] = useState(0)

  const watchStartedRef = useRef<number | null>(null)
  const completedRef = useRef(false)
  const lastTapRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { user } = useAuthStore()

  useEffect(() => {
    const video = videoRef.current

    if (!video) return

    completedRef.current = false

    if (active) {
      watchStartedRef.current = Date.now()

      video.currentTime = 0

      if (autoPlay) {
        video
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false))
      } else {
        setPlaying(false)
      }
    } else {
      if (watchStartedRef.current !== null) {
        const seconds = Math.max(
          0,
          Math.floor(
            (Date.now() - watchStartedRef.current) / 1000,
          ),
        )

        if (seconds > 0) {
          onView(seconds, completedRef.current)
        }
      }

      watchStartedRef.current = null

      video.pause()
      video.currentTime = 0
      setPlaying(false)
      setProgress(0)
    }

    return () => {
      if (watchStartedRef.current !== null) {
        const seconds = Math.max(
          0,
          Math.floor(
            (Date.now() - watchStartedRef.current) / 1000,
          ),
        )

        if (seconds > 0) {
          onView(seconds, completedRef.current)
        }

        watchStartedRef.current = null
      }
    }
  }, [active, autoPlay, onView])

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current)
      }
    }
  }, [])

  const togglePlayback = useCallback(() => {
    const video = videoRef.current

    if (!video) return

    if (video.paused) {
      video
        .play()
        .then(() => setPlaying(true))
        .catch(() => {})
    } else {
      video.pause()
      setPlaying(false)
    }
  }, [])

  const handleTroll = useCallback(async () => {
    setShowTroll(true)

    window.setTimeout(() => {
      setShowTroll(false)
    }, 850)

    if (!user) {
      toast.info('Sign in to troll')
      return
    }

    try {
      await toggleTreelzTroll(user.id, post.id)
    } catch {
      // Keep the same forgiving interaction behavior as web actions.
    }
  }, [post.id, user])

  const handleTap = useCallback(() => {
    const now = Date.now()

    if (now - lastTapRef.current < 280) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current)
      }

      lastTapRef.current = 0
      handleTroll()
      return
    }

    lastTapRef.current = now

    tapTimerRef.current = setTimeout(() => {
      if (Date.now() - lastTapRef.current >= 280) {
        togglePlayback()
      }
    }, 280)
  }, [handleTroll, togglePlayback])

  const toggleMute = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()

      const video = videoRef.current

      if (!video) return

      video.muted = !video.muted
      setMuted(video.muted)
    },
    [],
  )

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current

    if (!video || !video.duration) return

    const value = Math.min(
      100,
      Math.max(
        0,
        (video.currentTime / video.duration) * 100,
      ),
    )

    setProgress(value)

    if (
      value >= 95 &&
      !completedRef.current
    ) {
      completedRef.current = true

      if (watchStartedRef.current !== null) {
        const seconds = Math.max(
          0,
          Math.floor(
            (Date.now() - watchStartedRef.current) /
              1000,
          ),
        )

        onView(seconds, true)
      }
    }
  }, [onView])

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black text-white"
      onClick={handleTap}
    >
      {/* Blurred background */}
      <video
        src={post.video_url}
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-3xl"
        autoPlay={active && autoPlay}
        muted
        loop
        playsInline
      />

      {/* Main video */}
      <video
        ref={videoRef}
        src={post.video_url}
        poster={post.thumbnail_url || undefined}
        className="relative z-10 h-full w-full object-cover"
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Overlays */}
      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/65 via-transparent to-black/90" />

      <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_25%,transparent_15%,rgba(0,0,0,0.2)_60%,rgba(0,0,0,0.7)_100%)]" />

      {/* Top label */}
      <div className="absolute left-4 right-4 top-4 z-30 flex items-center justify-between">
        <div className="rounded-full border border-cyan-300/20 bg-black/40 px-3 py-1.5 backdrop-blur-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
            <Sparkles size={11} />
            Treelz
          </div>
        </div>

        <button
          onClick={toggleMute}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl active:scale-90"
        >
          {muted ? (
            <VolumeX size={17} />
          ) : (
            <Volume2 size={17} />
          )}
        </button>
      </div>

      {/* Live promotion */}
      {post.is_live_promotion && (
        <div className="absolute left-4 top-20 z-30 flex items-center gap-2 rounded-full border border-red-400/30 bg-red-600/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-xl">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Live
        </div>
      )}

      {/* Center play */}
      {!playing && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-black/45 shadow-[0_0_50px_rgba(0,191,255,0.3)] backdrop-blur-xl">
            <Play
              size={34}
              fill="white"
              className="ml-1 text-white"
            />
          </div>
        </div>
      )}

      {/* Double-tap Troll */}
      {showTroll && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div className="animate-[heartPop_0.85s_cubic-bezier(.2,1.6,.4,1)_both] text-[90px] drop-shadow-[0_0_45px_rgba(0,191,255,0.8)]">
            🤡
          </div>
        </div>
      )}

      {/* Creator information */}
      <div className="absolute bottom-5 left-4 right-[78px] z-30">
        <div className="rounded-3xl border border-white/10 bg-black/35 p-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <CreatorAvatar post={post} />

            <div className="min-w-0 flex-1">
              <button
                onClick={(event) => {
                  event.stopPropagation()
                }}
                className="block max-w-full truncate text-left text-sm font-black text-white"
              >
                @{post.author?.username || 'unknown'}
              </button>

              <p className="truncate text-[10px] font-bold text-white/50">
                {post.author?.display_name || 'Creator'}
              </p>
            </div>
          </div>

          {post.caption && (
            <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-white/90">
              {post.caption}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[9px] font-black text-cyan-100">
              #treelz
            </span>

            {post.video_duration_seconds > 0 && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black text-white/60">
                {formatDuration(
                  post.video_duration_seconds,
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action rail */}
      <div className="absolute bottom-7 right-3 z-40 flex flex-col items-center gap-3">
        <PhoneAction
          icon={<span className="text-[25px]">🤡</span>}
          count={post.likes_count || 0}
          onClick={async (event) => {
            event.stopPropagation()

            if (!user) {
              toast.info('Sign in to troll')
              return
            }

            try {
              await toggleTreelzTroll(
                user.id,
                post.id,
              )
            } catch {
              // Keep action silent like web.
            }
          }}
        />

        <PhoneAction
          icon={<MessageCircle size={22} />}
          count={post.comments_count || 0}
          onClick={(event) => {
            event.stopPropagation()
            onComment()
          }}
        />

        <PhoneAction
          icon={<Share2 size={21} />}
          count={post.shares_count || 0}
          onClick={(event) => {
            event.stopPropagation()
            onShare()
          }}
        />

        <PhoneAction
          icon={<Gift size={21} />}
          count={post.gifts_received || 0}
          onClick={(event) => {
            event.stopPropagation()
            onTip()
          }}
        />

        <PhoneAction
          icon={<Bookmark size={21} />}
          onClick={async (event) => {
            event.stopPropagation()

            if (!user) {
              toast.info('Sign in to save')
              return
            }

            try {
              await toggleTreelzSave(
                user.id,
                post.id,
              )

              toast.success('Saved')
            } catch {
              toast.error('Unable to save')
            }
          }}
        />

        <PhoneAction
          icon={<MoreHorizontal size={22} />}
          onClick={(event) => {
            event.stopPropagation()
            onMore()
          }}
        />
      </div>

      {/* Progress */}
      <div className="absolute bottom-0 left-0 right-0 z-50 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[#00BFFF] via-[#BF00FF] to-fuchsia-400 shadow-[0_0_20px_rgba(0,191,255,0.7)]"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </div>
  )
})

/* =========================================================
   ACTION BUTTON
========================================================= */

function PhoneAction({
  icon,
  count,
  onClick,
}: {
  icon: React.ReactNode
  count?: number
  onClick: (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-black/45 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-90">
        {icon}
      </span>

      {typeof count === 'number' && (
        <span className="text-[10px] font-black text-white drop-shadow">
          {formatCount(count)}
        </span>
      )}
    </button>
  )
}

/* =========================================================
   CATEGORY BAR
========================================================= */

function PhoneCategoryBar({
  activeCategory,
  onChange,
}: {
  activeCategory: string
  onChange: (category: string) => void
}) {
  return (
    <div className="absolute left-0 right-0 top-[64px] z-[55] flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
      {CATEGORIES.map(
        ({ key, label, icon: Icon }) => {
          const active = activeCategory === key

          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black backdrop-blur-xl transition active:scale-95 ${
                active
                  ? 'border-[#00BFFF]/40 bg-[#00BFFF]/15 text-white shadow-[0_0_20px_rgba(0,191,255,0.12)]'
                  : 'border-white/10 bg-black/35 text-white/55'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          )
        },
      )}
    </div>
  )
}

/* =========================================================
   COMMENTS
========================================================= */

function PhoneComments({
  post,
  open,
  onClose,
}: {
  post: TreelzPost | null
  open: boolean
  onClose: () => void
}) {
  const { user, isAdmin } = useAuthStore()

  const [comments, setComments] = useState<
    TreelzComment[]
  >([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !post) return

    let cancelled = false

    setLoading(true)

    fetchTreelzComments(post.id)
      .then((data) => {
        if (!cancelled) {
          setComments(data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, post])

  const submit = async () => {
    if (!post) return

    if (!user) {
      toast.info('Sign in to comment')
      return
    }

    const value = text.trim()

    if (!value) return

    try {
      await addTreelzComment(
        user.id,
        post.id,
        value,
      )

      setText('')

      const updated =
        await fetchTreelzComments(post.id)

      setComments(updated)
    } catch (error: any) {
      toast.error(
        error?.message || 'Unable to comment',
      )
    }
  }

  const deleteComment = async (
    commentId: string,
    commentUserId: string,
  ) => {
    if (!user || !post) return

    if (
      commentUserId !== user.id &&
      post.user_id !== user.id &&
      !isAdmin
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('treelz_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      setComments((current) =>
        current.filter(
          (comment) => comment.id !== commentId,
        ),
      )

      toast.success('Comment deleted')
    } catch {
      toast.error('Unable to delete comment')
    }
  }

  if (!open || !post) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <div
        className="relative flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#080614]/98 shadow-[0_-30px_100px_rgba(0,191,255,0.18)]"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-cyan-300/70">
              Treelz
            </p>

            <h2 className="text-xl font-black">
              Comments
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-14 text-center">
              <MessageCircle className="mx-auto h-9 w-9 text-cyan-300/40" />

              <p className="mt-3 text-sm font-black">
                No comments yet
              </p>

              <p className="mt-1 text-xs text-white/40">
                Be the first to comment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                  {comment.author?.avatar_url ? (
                    <img
                      src={
                        comment.author.avatar_url
                      }
                      alt=""
                      className="h-9 w-9 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-xs font-black">
                      {comment.author?.username
                        ?.charAt(0)
                        .toUpperCase() || '?'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-black text-cyan-200">
                        @
                        {comment.author?.username ||
                          'unknown'}
                      </span>

                      {user &&
                        (comment.user_id ===
                          user.id ||
                          post.user_id ===
                            user.id ||
                          isAdmin) && (
                          <button
                            onClick={() =>
                              deleteComment(
                                comment.id,
                                comment.user_id,
                              )
                            }
                            className="ml-auto text-red-300/60"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                    </div>

                    <p className="mt-1 text-sm leading-relaxed text-white/80">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-black/30 p-3">
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
            <input
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submit()
                }
              }}
              placeholder={
                user
                  ? 'Add a comment...'
                  : 'Sign in to comment...'
              }
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/30"
            />

            <button
              onClick={submit}
              disabled={!text.trim()}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-4 text-xs font-black disabled:opacity-30"
            >
              <Send size={14} />
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   TIP MODAL
========================================================= */

function PhoneTipModal({
  post,
  open,
  onClose,
}: {
  post: TreelzPost | null
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuthStore()

  const amounts = [10, 50, 100, 500]

  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)

  if (!open || !post) return null

  const sendTip = async (amount: number) => {
    if (!user) {
      toast.info('Sign in to tip')
      return
    }

    if (!amount || amount <= 0) return

    setSending(true)

    try {
      await sendTreelzTip(
        user.id,
        post.user_id,
        post.id,
        amount,
      )

      toast.success(`Tipped ${amount} coins!`)
      onClose()
    } catch (error: any) {
      toast.error(
        error?.message || 'Unable to send tip',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[#080614]/98 p-6 shadow-[0_0_90px_rgba(191,0,255,0.2)]"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
        >
          <X size={16} />
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-orange-500 text-black shadow-[0_0_45px_rgba(245,158,11,0.3)]">
            <Gift size={28} />
          </div>

          <h2 className="mt-4 text-xl font-black">
            Send Creator Love
          </h2>

          <p className="mt-1 text-xs text-white/40">
            Tip @{post.author?.username || 'creator'}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {amounts.map((amount) => (
            <button
              key={amount}
              disabled={sending}
              onClick={() => sendTip(amount)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] py-4 transition active:scale-95 disabled:opacity-40"
            >
              <Coins className="mx-auto mb-2 h-4 w-4 text-amber-300" />

              <span className="text-sm font-black">
                {amount}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          <input
            value={custom}
            onChange={(event) =>
              setCustom(
                event.target.value.replace(/\D/g, ''),
              )
            }
            placeholder="Custom amount"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-white/30"
          />

          <button
            disabled={!custom || sending}
            onClick={() => sendTip(Number(custom))}
            className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 px-4 text-xs font-black text-black disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   SHARE MODAL
========================================================= */

function PhoneShareModal({
  post,
  open,
  onClose,
}: {
  post: TreelzPost | null
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuthStore()

  if (!open || !post) return null

  const share = async (type: string) => {
    if (user) {
      await recordTreelzShare(
        user.id,
        post.id,
        type,
      ).catch(() => {})
    }

    if (type === 'copy') {
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}/treelz?post=${post.id}`,
        )

        toast.success('Link copied!')
      } catch {
        toast.error('Unable to copy link')
      }
    }

    if (type === 'download') {
      if (!user) {
        toast.info('Sign in to download')
        return
      }

      try {
        await downloadTreelzVideo(
          user.id,
          post.id,
          post.video_url,
        )

        toast.success(
          'Download started! (-10 coins)',
        )
      } catch (error: any) {
        toast.error(
          error?.message || 'Download failed',
        )
      }
    }

    if (type === 'trollwall') {
      if (!user) {
        toast.info(
          'Sign in to share to TrollWall',
        )
        return
      }

      try {
        const { data: profile } =
          await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', user.id)
            .single()

        const username =
          profile?.username || 'unknown'

        const { error } =
          await supabase
            .from('troll_wall_posts')
            .insert({
              user_id: user.id,
              post_type: 'text',
              content: `🎬 @${username} shared a Treelz: ${
                post.caption ||
                'Check out this video!'
              }`,
              metadata: {
                video_url: post.video_url,
                thumbnail_url:
                  post.thumbnail_url,
                treelz_post_id: post.id,
                type: 'treelz_share',
              },
            })

        if (error) throw error

        toast.success(
          'Shared to TrollWall!',
        )
      } catch (error: any) {
        toast.error(
          error?.message ||
            'Unable to share',
        )
      }
    }

    if (type === 'messages') {
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}/treelz?post=${post.id}`,
        )

        toast.success(
          'Treelz link copied for messaging',
        )
      } catch {
        toast.error('Unable to copy link')
      }
    }

    onClose()
  }

  const items = [
    {
      key: 'copy',
      label: 'Copy Link',
      icon: <Copy size={20} />,
      gradient:
        'from-[#00BFFF] to-blue-500',
    },
    {
      key: 'download',
      label: 'Save Video',
      icon: <Download size={20} />,
      gradient:
        'from-amber-300 to-orange-500',
    },
    {
      key: 'trollwall',
      label: 'TrollWall',
      icon: <MessageSquare size={20} />,
      gradient:
        'from-[#BF00FF] to-pink-500',
    },
    {
      key: 'messages',
      label: 'Message',
      icon: <Share2 size={20} />,
      gradient:
        'from-emerald-300 to-teal-500',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/75 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-[2rem] border border-white/10 bg-[#080614]/98 p-5 sm:mx-auto sm:max-w-md sm:rounded-[2rem]"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-cyan-300/70">
              Treelz
            </p>

            <h2 className="text-xl font-black">
              Share
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => share(item.key)}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left transition active:scale-95"
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient}`}
              >
                {item.icon}
              </div>

              <p className="mt-3 text-sm font-black">
                {item.label}
              </p>

              <p className="mt-1 text-[10px] text-white/35">
                {item.key === 'download'
                  ? 'Costs 10 coins'
                  : 'Share Treelz'}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   MORE MODAL
========================================================= */

function PhoneMoreModal({
  post,
  open,
  onClose,
}: {
  post: TreelzPost | null
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuthStore()

  if (!open || !post) return null

  const report = async () => {
    if (!user) {
      toast.info('Sign in to report')
      return
    }

    try {
      await reportTreelzPost(
        user.id,
        post.id,
        'reported_from_treelz_phone',
      )

      toast.success('Report submitted')
      onClose()
    } catch {
      toast.error(
        'Unable to submit report',
      )
    }
  }

  const download = async () => {
    if (!user) {
      toast.info('Sign in to download')
      return
    }

    try {
      await downloadTreelzVideo(
        user.id,
        post.id,
        post.video_url,
      )

      toast.success(
        'Download started! (-10 coins)',
      )

      onClose()
    } catch (error: any) {
      toast.error(
        error?.message ||
          'Download failed',
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/75 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-[2rem] border border-white/10 bg-[#080614]/98 p-3 sm:mx-auto sm:max-w-sm sm:rounded-[2rem]"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

        <div className="px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/35">
            Treelz
          </p>

          <h2 className="text-lg font-black">
            More Actions
          </h2>
        </div>

        <button
          onClick={download}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left active:bg-white/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
            <Download size={18} />
          </span>

          <span>
            <span className="block text-sm font-black">
              Download Video
            </span>

            <span className="text-[10px] text-white/35">
              Costs 10 coins
            </span>
          </span>
        </button>

        <button
          onClick={report}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left active:bg-white/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
            <Heart size={18} />
          </span>

          <span>
            <span className="block text-sm font-black">
              Report Treelz
            </span>

            <span className="text-[10px] text-white/35">
              Send to moderation
            </span>
          </span>
        </button>

        <button
          onClick={onClose}
          className="mt-1 flex w-full items-center justify-center rounded-2xl px-4 py-4 text-sm font-black text-white/50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/* =========================================================
   LOADING
========================================================= */

function PhoneTreelzLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0A0814]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#00BFFF]" />

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
          Loading Treelz
        </p>
      </div>
    </div>
  )
}

/* =========================================================
   EMPTY STATE
========================================================= */

function PhoneTreelzEmpty({
  userSignedIn,
}: {
  userSignedIn: boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#00BFFF]/10 to-[#BF00FF]/10 shadow-[0_0_50px_rgba(0,191,255,0.12)]">
        <Play
          size={30}
          className="text-cyan-300"
        />
      </div>

      <h2 className="mt-5 text-xl font-black">
        No Treelz Yet
      </h2>

      <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/40">
        There are no Treelz videos available
        yet. Be the first creator to post one.
      </p>

      <button
        onClick={() =>
          navigate(
            userSignedIn
              ? '/treelz/upload'
              : '/auth',
          )
        }
        className="mt-6 rounded-2xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-6 py-3 text-xs font-black shadow-[0_0_35px_rgba(0,191,255,0.25)]"
      >
        {userSignedIn
          ? 'Create Treelz'
          : 'Sign In to Create'}
      </button>
    </div>
  )
}

/* =========================================================
   MAIN PHONE TREELZ
========================================================= */

export default function PhoneTreelz() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] =
    useSearchParams()

  const { user } = useAuthStore()

  const initialPostId =
    searchParams.get('post')

  const [posts, setPosts] = useState<
    TreelzPost[]
  >([])

  const [nextCursor, setNextCursor] =
    useState<TreelzFeedCursor | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [activeIndex, setActiveIndex] =
    useState(0)

  const [activeCategory, setActiveCategory] =
    useState('discover')

  const [profileUserId, setProfileUserId] =
    useState<string | null>(null)

  const [commentPost, setCommentPost] =
    useState<TreelzPost | null>(null)

  const [tipPost, setTipPost] =
    useState<TreelzPost | null>(null)

  const [sharePost, setSharePost] =
    useState<TreelzPost | null>(null)

  const [morePost, setMorePost] =
    useState<TreelzPost | null>(null)

  const [settings] = useState(
    loadTreelzSettings(),
  )

  const feedRef =
    useRef<HTMLDivElement>(null)

  const loadingMoreRef =
    useRef(false)

  /* =======================================================
     LOAD SAME FEED AS WEB
  ======================================================= */

  const loadFeed = useCallback(
    async (
      category = activeCategory,
      profileId: string | null = profileUserId,
    ) => {
      setLoading(true)

      try {
        let result: {
          posts: TreelzPost[]
          nextCursor: TreelzFeedCursor | null
        }

        if (profileId) {
          const profilePosts =
            await fetchTreelzProfile(
              user?.id || null,
              profileId,
            )

          result = {
            posts: profilePosts,
            nextCursor: null,
          }
        } else if (
          category === 'trending'
        ) {
          const trendingPosts =
            await fetchTrendingTreelz(30)

          result = {
            posts: trendingPosts,
            nextCursor: null,
          }
        } else {
          /*
           * IMPORTANT:
           *
           * This intentionally uses the exact
           * same feed service as TreelzPage.
           *
           * Phone is no longer querying treelz_posts
           * directly to create its own feed.
           */
          result = await fetchTreelzFeed(
            user?.id || null,
            null,
          )
        }

        setPosts(result.posts)
        setNextCursor(result.nextCursor)

        const requestedIndex =
          initialPostId
            ? result.posts.findIndex(
                (post) =>
                  post.id === initialPostId,
              )
            : -1

        setActiveIndex(
          requestedIndex >= 0
            ? requestedIndex
            : 0,
        )
      } catch (error) {
        console.error(
          'Failed to load Phone Treelz:',
          error,
        )

        toast.error(
          'Unable to load Treelz right now',
        )

        setPosts([])
        setNextCursor(null)
      } finally {
        setLoading(false)
      }
    },
    [
      activeCategory,
      initialPostId,
      profileUserId,
      user?.id,
    ],
  )

  /* =======================================================
     LOAD MORE USING SAME WEB CURSOR
  ======================================================= */

  const loadMore = useCallback(
    async () => {
      if (
        !nextCursor ||
        loading ||
        loadingMoreRef.current ||
        profileUserId ||
        activeCategory === 'trending'
      ) {
        return
      }

      loadingMoreRef.current = true

      try {
        const result =
          await fetchTreelzFeed(
            user?.id || null,
            nextCursor,
          )

        setPosts((current) => [
          ...current,
          ...result.posts,
        ])

        setNextCursor(
          result.nextCursor,
        )
      } catch (error) {
        console.error(
          'Failed to load more Phone Treelz:',
          error,
        )
      } finally {
        loadingMoreRef.current = false
      }
    },
    [
      activeCategory,
      loading,
      nextCursor,
      profileUserId,
      user?.id,
    ],
  )

  /* =======================================================
     INITIAL LOAD / CATEGORY / URL
  ======================================================= */

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  const switchCategory = useCallback(
    (category: string) => {
      setActiveCategory(category)
      setProfileUserId(null)
      setActiveIndex(0)
      setSearchParams({})

      loadFeed(category, null)
    },
    [loadFeed, setSearchParams],
  )

  /* =======================================================
     OPEN SPECIFIC POST
  ======================================================= */

  const openPost = useCallback(
    (postId: string) => {
      const index = posts.findIndex(
        (post) => post.id === postId,
      )

      if (index < 0) return

      setActiveIndex(index)

      setSearchParams({
        post: postId,
      })

      requestAnimationFrame(() => {
        const container =
          feedRef.current

        const card =
          container?.children[
            index
          ] as HTMLElement | undefined

        card?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    },
    [posts, setSearchParams],
  )

  /* =======================================================
     ACTIVE POST
  ======================================================= */

  const currentPost =
    posts[activeIndex] || null

  /* =======================================================
     VIEW TRACKING
  ======================================================= */

  const handleView = useCallback(
    (
      postId: string,
      watchSeconds: number,
      completed: boolean,
    ) => {
      if (!postId || watchSeconds <= 0) {
        return
      }

      recordTreelzView(
        postId,
        watchSeconds,
        completed,
      ).catch(() => {})
    },
    [],
  )

  /* =======================================================
     INTERSECTION / SNAP POSITION
  ======================================================= */

  useEffect(() => {
    const container =
      feedRef.current

    if (!container) return

    const cards = Array.from(
      container.children,
    ) as HTMLElement[]

    if (!cards.length) return

    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return
            }

            const index =
              cards.indexOf(
                entry.target as HTMLElement,
              )

            if (index < 0) return

            setActiveIndex(index)

            const post = posts[index]

            if (post) {
              setSearchParams(
                { post: post.id },
                {
                  replace: true,
                },
              )
            }

            if (
              index >= posts.length - 3
            ) {
              loadMore()
            }
          })
        },
        {
          root: container,
          threshold: 0.7,
        },
      )

    cards.forEach((card) =>
      observer.observe(card),
    )

    return () =>
      observer.disconnect()
  }, [
    posts,
    loadMore,
    setSearchParams,
  ])

  /* =======================================================
     REALTIME REFRESH
  ======================================================= */

  useEffect(() => {
    const channel = supabase
      .channel('phone-treelz-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'treelz_posts',
        },
        () => {
          /*
           * Re-run the same feed service used by web.
           * This keeps phone synchronized without
           * creating a second feed implementation.
           */
          loadFeed()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadFeed])

  /* =======================================================
     KEYBOARD / SWIPE-FRIENDLY PROGRAMMATIC NAVIGATION
  ======================================================= */

  const goNext = useCallback(() => {
    if (
      activeIndex >=
      posts.length - 1
    ) {
      loadMore()
      return
    }

    const nextIndex =
      activeIndex + 1

    setActiveIndex(nextIndex)

    const nextPost =
      posts[nextIndex]

    if (nextPost) {
      setSearchParams(
        { post: nextPost.id },
        { replace: true },
      )

      requestAnimationFrame(() => {
        const card =
          feedRef.current?.children[
            nextIndex
          ] as HTMLElement | undefined

        card?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }

    if (
      nextIndex >=
      posts.length - 3
    ) {
      loadMore()
    }
  }, [
    activeIndex,
    posts,
    loadMore,
    setSearchParams,
  ])

  const goPrevious =
    useCallback(() => {
      if (activeIndex <= 0) return

      const previousIndex =
        activeIndex - 1

      setActiveIndex(previousIndex)

      const previousPost =
        posts[previousIndex]

      if (previousPost) {
        setSearchParams(
          {
            post: previousPost.id,
          },
          { replace: true },
        )

        requestAnimationFrame(() => {
          const card =
            feedRef.current?.children[
              previousIndex
            ] as
              | HTMLElement
              | undefined

          card?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        })
      }
    }, [
      activeIndex,
      posts,
      setSearchParams,
    ])

  useEffect(() => {
    const handleKeyboard =
      (event: KeyboardEvent) => {
        if (
          event.key === 'ArrowDown' ||
          event.key === 'ArrowRight'
        ) {
          goNext()
        }

        if (
          event.key === 'ArrowUp' ||
          event.key === 'ArrowLeft'
        ) {
          goPrevious()
        }
      }

    window.addEventListener(
      'keydown',
      handleKeyboard,
    )

    return () =>
      window.removeEventListener(
        'keydown',
        handleKeyboard,
      )
  }, [goNext, goPrevious])

  /* =======================================================
     CREATOR PROFILE
  ======================================================= */

  const openCreatorProfile =
    useCallback(
      async (authorId: string) => {
        try {
          const creatorPosts =
            await fetchTreelzProfile(
              user?.id || null,
              authorId,
            )

          setProfileUserId(authorId)
          setActiveCategory('discover')
          setPosts(creatorPosts)
          setNextCursor(null)
          setActiveIndex(0)
          setSearchParams({})
        } catch {
          toast.error(
            'Unable to load this creator',
          )
        }
      },
      [user?.id, setSearchParams],
    )

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading && posts.length === 0) {
    return <PhoneTreelzLoading />
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0A0814] text-white">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="absolute left-0 right-0 top-0 z-[60] flex items-center justify-between px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/45 backdrop-blur-xl active:scale-90"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-xl">
          <span className="bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] bg-clip-text text-xs font-black uppercase tracking-[0.25em] text-transparent">
            Treelz
          </span>
        </div>

        <button
          onClick={() =>
            navigate('/treelz/upload')
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10 text-[#00BFFF] backdrop-blur-xl active:scale-90"
        >
          <Sparkles size={18} />
        </button>
      </header>

      {/* ===================================================
          CATEGORY NAV
      =================================================== */}

      <PhoneCategoryBar
        activeCategory={
          activeCategory
        }
        onChange={switchCategory}
      />

      {/* ===================================================
          PROFILE MODE BACK BUTTON
      =================================================== */}

      {profileUserId && (
        <button
          onClick={() => {
            setProfileUserId(null)
            setActiveCategory(
              'discover',
            )
            setActiveIndex(0)
            setSearchParams({})
            loadFeed(
              'discover',
              null,
            )
          }}
          className="absolute left-3 top-[108px] z-[55] flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[10px] font-black text-white/80 backdrop-blur-xl"
        >
          <ArrowLeft size={12} />
          Back to Treelz
        </button>
      )}

      {/* ===================================================
          EMPTY STATE
      =================================================== */}

      {posts.length === 0 ? (
        <PhoneTreelzEmpty
          userSignedIn={Boolean(user)}
        />
      ) : (
        /* =================================================
           REAL PHONE FEED
        ================================================= */

        <div
          ref={feedRef}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
          style={{
            scrollbarWidth: 'none',
          }}
        >
          {posts.map(
            (post, index) => (
              <div
                key={post.id}
                className="relative h-[100svh] w-full snap-start snap-always"
              >
                <PhoneTreelzVideo
                  post={post}
                  active={
                    index ===
                    activeIndex
                  }
                  autoPlay={
                    settings.autoPlayEnabled
                  }
                  onView={(
                    seconds,
                    completed,
                  ) =>
                    handleView(
                      post.id,
                      seconds,
                      completed,
                    )
                  }
                  onComment={() =>
                    setCommentPost(
                      post,
                    )
                  }
                  onShare={() =>
                    setSharePost(
                      post,
                    )
                  }
                  onTip={() =>
                    setTipPost(
                      post,
                    )
                  }
                  onMore={() =>
                    setMorePost(
                      post,
                    )
                  }
                />
              </div>
            ),
          )}
        </div>
      )}

      {/* ===================================================
          MODALS
      =================================================== */}

      <PhoneComments
        post={commentPost}
        open={Boolean(commentPost)}
        onClose={() =>
          setCommentPost(null)
        }
      />

      <PhoneTipModal
        post={tipPost}
        open={Boolean(tipPost)}
        onClose={() =>
          setTipPost(null)
        }
      />

      <PhoneShareModal
        post={sharePost}
        open={Boolean(sharePost)}
        onClose={() =>
          setSharePost(null)
        }
      />

      <PhoneMoreModal
        post={morePost}
        open={Boolean(morePost)}
        onClose={() =>
          setMorePost(null)
        }
      />

      {/* ===================================================
          LOADING MORE
      =================================================== */}

      {loading &&
        posts.length > 0 && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-cyan-300" />

              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
                Loading
              </span>
            </div>
          </div>
        )}
    </div>
  )
}