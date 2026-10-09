import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Heart, Gift, Image, Smile, Video, Pin, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { WallPost } from '@/types/trollWall'
import { trackPrideWallAction } from '@/services/prideChallengeTracker'
import MentionTextarea from '@/components/MentionTextarea'
import TrollWallPostModal from '@/components/home/TrollWallPostModal'
import { parseTextWithLinks } from '@/lib/utils'
import { notifySomeoneMentioned } from '@/lib/notifications'

const EMOJI_OPTIONS = [':)', ':D', '<3', ':-)', ';)', ':P']

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

function isPostBoostActive(post: WallPost) {
  const expiresAt = post.metadata?.boost_expires_at ? new Date(post.metadata.boost_expires_at).getTime() : 0
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

function sortWallPosts(rows: WallPost[]) {
  return [...rows].sort((a, b) => {
    const aPinned = a.is_pinned ? 1 : 0
    const bPinned = b.is_pinned ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned

    const aBoosted = isPostBoostActive(a) ? 1 : 0
    const bBoosted = isPostBoostActive(b) ? 1 : 0
    if (aBoosted !== bBoosted) return bBoosted - aBoosted

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

const glass =
  'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]'

/* ─── Single Post Card (extracted to avoid hooks-in-loop) ─── */
function WallPostCard({
  post,
  onLike,
  onClick,
}: {
  post: WallPost
  onLike: (post: WallPost, e: React.MouseEvent) => void
  onClick: (post: WallPost) => void
}) {
  const navigate = useNavigate()
  const frame = useUserFrame(post.user_id)
  const boosted = isPostBoostActive(post)
  const avatarUrl =
    post.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(post.username || 'TC')}`
  const hasImage = !!post.metadata?.image_url
  const hasVideo = !!post.metadata?.video_url
  const commentCount = post.replies?.length || 0
  const isLongPost = post.content.length > 100
  const displayContent = isLongPost ? `${post.content.slice(0, 100).trimEnd()}…` : post.content
  const giftCount = post.gifts
    ? Object.values(post.gifts as Record<string, { count?: number }>).reduce(
        (sum, g) => sum + (g?.count || 0),
        0
      )
    : 0

  return (
    <div
      className={`${glass} rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/20`}
    >
      {/* Boosted indicator */}
      {boosted && (
        <div className="h-1 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500" />
      )}
      {post.is_pinned && (
        <div className="h-1 bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent" />
      )}

      {/* Post Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full ring-1 ring-white/10" style={{ overflow: 'visible' }}>
            <ProfileFrame
              frame={frame}
              avatarUrl={avatarUrl}
              username={post.username || 'User'}
              size="sm"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                onClick={() => navigate(`/profile/id/${post.user_id}`)}
                className="text-sm font-bold text-white hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {post.username || 'Unknown'}
              </span>
              {post.is_pinned && (
                <Pin className="h-3 w-3 text-yellow-400" />
              )}
              {boosted && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                  ⚡ Boosted
                </span>
              )}
              {post.is_system_generated && (
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-black text-cyan-300">
                  ⚡ System
                </span>
              )}
            </div>
            <span className="text-xs text-white/40">{timeAgo(post.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pt-3">
        <p className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap break-words">
          {parseTextWithLinks(displayContent)}
        </p>
        {isLongPost && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick(post)
            }}
            className="mt-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            more
          </button>
        )}
      </div>

      {/* Media */}
      {hasImage && (
        <div className="mt-3 px-4">
          <img
            src={post.metadata!.image_url}
            alt=""
            className="max-h-96 w-full rounded-xl object-cover"
          />
        </div>
      )}
      {hasVideo && (
        <div className="mt-3 px-4">
          <video
            src={post.metadata!.video_url}
            controls
            className="max-h-96 w-full rounded-xl"
          />
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1 border-t border-white/5 px-2 py-1">
        <button
          onClick={(e) => onLike(post, e)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
            post.user_liked
              ? 'text-pink-400 bg-pink-500/10'
              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          }`}
        >
          <Heart className={`h-4 w-4 ${post.user_liked ? 'fill-pink-400' : ''}`} />
          {post.likes || 0}
        </button>
        <button
          onClick={() => onClick(post)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </button>
        {giftCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white/50">
            <Gift className="h-4 w-4" />
            {giftCount}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => onClick(post)}
          className="rounded-lg px-3 py-2 text-xs font-bold text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
        >
          View
        </button>
      </div>
    </div>
  )
}

/* ─── Main Wall Page ─── */
export default function WallPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<WallPost | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const currentUserFrame = useUserFrame(user?.id)

  // Composer state
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const POSTS_PER_PAGE = 15

  const fetchPosts = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) setLoading(true)
      else setLoadingMore(true)

      const from = (pageNum - 1) * POSTS_PER_PAGE
      const to = from + POSTS_PER_PAGE - 1

      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select(
          '*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, is_verified, is_gold, username_style, badge, officer_level, troller_level, is_troller)'
        )
        .is('reply_to_post_id', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      const rows: WallPost[] = (data || []).map((row: any) => ({
        ...row,
        username: row.user_profiles?.username || row.username,
        avatar_url: row.user_profiles?.avatar_url || row.avatar_url,
        is_admin: row.user_profiles?.is_admin ?? row.is_admin,
        is_troll_officer: row.user_profiles?.is_troll_officer ?? row.is_troll_officer,
        is_og_user: row.user_profiles?.is_og_user ?? row.is_og_user,
        user_created_at: row.user_profiles?.created_at ?? row.user_created_at,
        is_verified: row.user_profiles?.is_verified,
        is_gold: row.user_profiles?.is_gold,
        username_style: row.user_profiles?.username_style,
        badge: row.user_profiles?.badge,
        officer_level: row.user_profiles?.officer_level,
        troller_level: row.user_profiles?.troller_level,
        is_troller: row.user_profiles?.is_troller,
        replies: [],
        user_liked: false,
        reactions: {},
        gifts: {},
      }))

      const sorted = sortWallPosts(rows)
      setHasMore(rows.length === POSTS_PER_PAGE)

      if (append) {
        setPosts((prev) => [...prev, ...sorted])
      } else {
        setPosts(sorted)
      }
    } catch (err) {
      console.error('[WallPage] Failed to fetch posts:', err)
      if (!append) setPosts([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts(1)
  }, [fetchPosts])

  // Real-time subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel('wall-page-posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'troll_wall_posts' },
        () => {
          fetchPosts(1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPosts])

  const handleEmojiInsert = (emoji: string) => {
    setContent((prev) => `${prev}${prev ? ' ' : ''}${emoji}`)
    setShowEmoji(false)
  }

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const type = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : null

    if (!type) {
      toast.error('Upload an image or video file')
      event.target.value = ''
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('File must be under 100MB')
      event.target.value = ''
      return
    }

    setMediaFile(file)
    setMediaType(type)
  }

  const requireAuth = (intent?: string) => {
    if (user) return true
    toast.info(`Sign in to ${intent || 'continue'}.`)
    navigate('/auth')
    return false
  }

  const handleSubmit = async () => {
    if (!requireAuth('create a post')) return
    if (!content.trim()) {
      toast.error('Write something before posting')
      return
    }

    setSubmitting(true)
    try {
      const metadata: Record<string, string> = {}

      if (mediaFile && user) {
        const extension = mediaFile.name.split('.').pop() || 'png'
        const fileName = `${user.id}/${Date.now()}_media.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, mediaFile)

        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName)

        if (mediaType === 'video') {
          metadata.video_url = publicData.publicUrl
        } else {
          metadata.image_url = publicData.publicUrl
        }
      }

      const { data, error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user?.id,
          post_type: 'text',
          content: content.trim(),
          metadata,
        })
        .select('*')
        .single()

      if (error) throw error

      const mentionedUsernames = new Set<string>()
      const mentionRegex = /#([A-Za-z0-9_]+)/g
      let mentionMatch
      while ((mentionMatch = mentionRegex.exec(content)) !== null) {
        mentionedUsernames.add(mentionMatch[1])
      }

      if (mentionedUsernames.size > 0 && user?.id) {
        for (const username of mentionedUsernames) {
          const { data: mentionedUser } = await supabase
            .from('user_profiles')
            .select('id')
            .ilike('username', username)
            .maybeSingle()

          if (mentionedUser?.id && mentionedUser.id !== user.id) {
            await notifySomeoneMentioned(mentionedUser.id, profile?.username || 'Someone', 'the Troll Wall')
          }
        }
      }

      const optimisticPost: WallPost = {
        ...(data as WallPost),
        username: profile?.username || 'You',
        avatar_url: profile?.avatar_url || null,
        is_admin: profile?.is_admin || false,
        is_troll_officer: profile?.is_troll_officer || false,
        is_og_user: profile?.is_og_user || false,
        user_created_at: profile?.created_at,
        user_liked: false,
        reactions: {},
        gifts: {},
        replies: [],
      }

      setPosts((prev) => [optimisticPost, ...prev])
      setContent('')
      setMediaFile(null)
      setMediaType(null)
      toast.success('Post created')

      if (user?.id) {
        trackPrideWallAction(user.id, 'wall_posts')
        trackPrideWallAction(user.id, 'share_moment')
      }
    } catch (err: any) {
      console.error('Error creating post:', err)
      toast.error(err?.message || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePostClick = useCallback((post: WallPost) => {
    setSelectedPost(post)
  }, [])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPosts(nextPage, true)
  }

  const handleLike = async (post: WallPost, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!requireAuth('like a post')) return

    try {
      const { data, error } = await supabase.rpc('toggle_wall_post_like', {
        p_post_id: post.id,
        p_user_id: user!.id,
      })
      if (error) throw error

      if (data) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, likes: data.likes_count, user_liked: data.liked }
              : p
          )
        )
        if (data.liked && user?.id) {
          trackPrideWallAction(user.id, 'like_posts')
        }
      }
    } catch {
      toast.error('Failed to like post')
    }
  }

  return (
    <div className="relative min-h-full w-full overflow-y-auto overflow-x-hidden md:overflow-hidden text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#050715]" />
        <div className="absolute inset-0 opacity-[0.20] [background:radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.25),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(14,165,233,0.20),transparent_30%),radial-gradient(circle_at_50%_92%,rgba(99,102,241,0.18),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.055)_1px,transparent_1px)] bg-[length:58px_58px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_26%,rgba(3,7,18,0.72)_100%)]" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-8 pt-4 md:px-6">
        {/* Header */}
        <div className={`${glass} rounded-2xl p-4`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-purple-400" />
                Troll Wall
              </h1>
              <p className="text-xs text-slate-400">Share updates, achievements, and connect with the community</p>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div
          className={`${glass} rounded-2xl p-4`}
          onClick={() => requireAuth('create a post')}
        >
          {mediaFile && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
              <span className="truncate">
                {mediaFile.name} {mediaType === 'video' ? '(video)' : '(image)'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMediaFile(null)
                  setMediaType(null)
                }}
                className="ml-2 text-red-300 hover:text-red-200"
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/5" style={{ overflow: 'visible' }}>
              {profile?.avatar_url ? (
                <ProfileFrame frame={currentUserFrame} avatarUrl={profile.avatar_url} username={profile.username || 'User'} size="sm" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full text-sm text-white/60">
                  {profile?.username?.[0]?.toUpperCase() || 'T'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <MentionTextarea
                value={content}
                onChange={setContent}
                placeholder="What's happening in the City? Use # to tag users"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-purple-400/60 focus:outline-none min-h-[80px]"
                maxLength={5000}
                onFocus={() => requireAuth('create a post')}
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!requireAuth('add media')) return
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*,video/*'
                      input.onchange = handleMediaChange as any
                      input.click()
                    }}
                    className="rounded-lg bg-white/5 p-2 text-white/70 hover:bg-white/10"
                    title="Upload image or video"
                  >
                    {mediaType === 'video' ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <Image className="h-4 w-4" />
                    )}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!requireAuth('add an emoji')) return
                        setShowEmoji((prev) => !prev)
                      }}
                      className="rounded-lg bg-white/5 p-2 text-white/70 hover:bg-white/10"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                    {showEmoji && (
                      <div className="absolute bottom-full left-0 z-10 mb-2 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl">
                        <div className="flex gap-2">
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEmojiInsert(emoji)
                              }}
                              className="rounded-lg bg-white/5 px-2 py-1 text-sm text-white/80 hover:bg-white/10"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSubmit()
                  }}
                  disabled={submitting || !content.trim()}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {submitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Feed - Tile Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${glass} rounded-2xl p-4 animate-pulse`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-white/5" />
                    <div className="h-2 w-16 rounded bg-white/5" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-white/5" />
                  <div className="h-3 w-3/4 rounded bg-white/5" />
                </div>
              </div>
            ))
          ) : posts.length === 0 ? (
            <div className="col-span-full">
              <div className={`${glass} rounded-2xl p-12 text-center`}>
                <MessageCircle className="mx-auto h-12 w-12 text-cyan-400/40" />
                <p className="mt-4 text-sm font-bold text-white/50">No Posts Yet</p>
                <p className="mt-1 text-xs text-white/30">Be the first to post on the Troll Wall!</p>
              </div>
            </div>
          ) : (
            posts.map((post) => (
              <WallPostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onClick={handlePostClick}
              />
            ))
          )}
        </div>

        {/* Load More */}
        {hasMore && !loading && posts.length > 0 && (
          <div className="col-span-full">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className={`${glass} w-full rounded-2xl px-6 py-3 text-sm font-bold text-white/70 hover:text-white hover:border-white/20 transition-all disabled:opacity-50`}
            >
              {loadingMore ? 'Loading...' : 'Load More Posts'}
            </button>
          </div>
        )}
      </main>

      {/* Post detail modal */}
      {selectedPost && (
        <TrollWallPostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onRequireAuth={requireAuth}
        />
      )}
    </div>
  )
}
