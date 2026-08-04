import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Heart, Gift, Send, Image, Smile, Video } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { WallPost } from '@/types/trollWall'
import { trackPrideWallAction } from '@/services/prideChallengeTracker'
import HorizontalScrollRow from './HorizontalScrollRow'
import TrollWallPostModal from './TrollWallPostModal'
import MentionTextarea from '../MentionTextarea'
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

/** Small avatar component for wall posts — extracts useUserFrame out of .map() */
function PostAvatar({ userId, avatarUrl, username }: { userId?: string; avatarUrl: string; username: string }) {
  const frame = useUserFrame(userId)
  return (
    <div className="h-8 w-8 shrink-0 rounded-full ring-1 ring-white/10" style={{ overflow: 'visible' }}>
      <ProfileFrame frame={frame} avatarUrl={avatarUrl} username={username} size="xs" />
    </div>
  )
}

interface TrollWallFeedProps {
  onRequireAuth: (intent?: string) => boolean
  feedClassName?: string
}

export default function TrollWallFeed({ onRequireAuth, feedClassName }: TrollWallFeedProps) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<WallPost | null>(null)
  const currentUserFrame = useUserFrame(user?.id)

  // Composer state
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select(
          '*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, is_verified, is_gold, username_style, badge, officer_level, troller_level, is_troller)'
        )
        .is('reply_to_post_id', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(24)

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

      setPosts(sortWallPosts(rows))
    } catch (err) {
      console.error('[TrollWallFeed] Failed to fetch posts:', err)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
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

  const handleSubmit = async () => {
    if (!onRequireAuth('create a post')) return
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

  const hasData = posts.length > 0

  return (
    <div className={`space-y-4 ${feedClassName ?? ''}`}>
      {/* Composer */}
      <div
        className="rounded-2xl border border-white/[0.07] bg-[#080c1a]/90 p-3"
        onClick={() => onRequireAuth('create a post')}
      >
        {mediaFile && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
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
        <div className="flex items-end gap-2">
          <div className="h-8 w-8 shrink-0 rounded-full bg-white/5" style={{ overflow: 'visible' }}>
            {profile?.avatar_url ? (
              <ProfileFrame frame={currentUserFrame} avatarUrl={profile.avatar_url} username={profile.username || 'User'} size="xs" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full text-xs text-white/60">
                {profile?.username?.[0]?.toUpperCase() || 'T'}
              </div>
            )}
          </div>
          <div className="flex-1">
            <MentionTextarea
              value={content}
              onChange={setContent}
              placeholder="What's happening in the City? Use # to tag users"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white placeholder-white/40 focus:border-purple-400/60 focus:outline-none"
              maxLength={5000}
              onFocus={() => onRequireAuth('create a post')}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (!onRequireAuth('add media')) return
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*,video/*'
                input.onchange = handleMediaChange as any
                input.click()
              }}
              className="rounded-lg bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
              title="Upload image or video"
            >
              {mediaType === 'video' ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <Image className="h-3.5 w-3.5" />
              )}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!onRequireAuth('add an emoji')) return
                  setShowEmoji((prev) => !prev)
                }}
                className="rounded-lg bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full right-0 z-10 mb-2 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl">
                  <div className="flex gap-2">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEmojiInsert(emoji)
                        }}
                        className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSubmit()
              }}
              disabled={submitting || !content.trim()}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 p-1.5 text-white hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Posts row */}
      <HorizontalScrollRow
        title="Troll Wall"
        subtitle={hasData ? `${posts.length} posts` : 'No posts yet — be the first!'}
        icon={<MessageCircle className="h-3.5 w-3.5 text-cyan-400" />}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[220px] w-[180px] shrink-0 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]"
              />
            ))
          : hasData
            ? posts.map((post) => {
                const boosted = isPostBoostActive(post)
                const avatarUrl =
                  post.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(post.username || 'TC')}`
                const hasImage = !!post.metadata?.image_url
                const thumbnailUrl = post.metadata?.thumbnail_url || post.metadata?.image_url
                const commentCount = post.replies?.length || 0
                const giftCount = post.gifts
                  ? Object.values(post.gifts as Record<string, { count?: number }>).reduce(
                      (sum, g) => sum + (g?.count || 0),
                      0
                    )
                  : 0

                const borderClasses = post.is_pinned
                  ? 'border-yellow-400/80 shadow-[0_0_24px_rgba(250,204,21,0.24)] hover:border-yellow-400/90 hover:shadow-[0_0_30px_rgba(250,204,21,0.32)]'
                  : 'border-white/[0.08] hover:border-cyan-400/30 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)]'

                return (
                    <button
                    key={post.id}
                    onClick={() => handlePostClick(post)}
                    className={`group relative flex h-[220px] w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-[#080c1a]/95 text-left transition-all duration-200 ${borderClasses}`}
                  >
                    {boosted && (
                      <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.8)]" />
                    )}
                    {boosted && (
                      <div className="absolute right-2 top-2 z-10 rounded-full border border-amber-200/30 bg-amber-400/90 px-2 py-0.5 text-[9px] font-black text-black shadow-lg">
                        Boosted
                      </div>
                    )}
                    {post.is_pinned && (
                      <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent" />
                    )}

                    {hasImage && thumbnailUrl ? (
                      <div className="relative h-[130px] w-full shrink-0 overflow-hidden">
                        <img
                          src={thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#080c1a]/95" />
                      </div>
                    ) : (
                      <div className="h-[6px] w-full shrink-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20" />
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                      <div className="flex items-center gap-2">
                        {post.is_system_generated ? (
                          <div className="h-8 w-8 shrink-0 rounded-full ring-1 ring-white/10 flex items-center justify-center bg-cyan-500/20 text-[9px] text-cyan-400">
                            ⚡
                          </div>
                        ) : (
                          <PostAvatar userId={post.user_id} avatarUrl={avatarUrl} username={post.username || 'User'} />
                        )}
                        <div className="min-w-0 flex-1">
                          {post.is_system_generated ? (
                            <span className="block truncate text-xs font-bold text-white/80">
                              Mai Troll System
                            </span>
                          ) : (
                            <span
                              onClick={(e) => { e.stopPropagation(); navigate(`/profile/id/${post.user_id}`); }}
                              className="block truncate text-xs font-bold text-white/80 hover:text-cyan-300 transition-colors text-left cursor-pointer"
                              role="button"
                              tabIndex={0}
                            >
                              {post.username || 'Unknown'}
                            </span>
                          )}
                          <span className="text-[10px] text-white/30">{timeAgo(post.created_at)}</span>
                        </div>
                      </div>

                      <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-white/50 group-hover:text-white/70">
                        {post.is_system_generated && <span className="text-cyan-400/80">⚡ </span>}
                        {(post.content || '').split(/\s+/).slice(0, 12).join(' ')}
                        {(post.content || '').split(/\s+/).length > 12 ? '…' : ''}
                      </p>

                      <div className="mt-auto flex items-center gap-3 text-[10px] text-white/30">
                        <span className="flex items-center gap-0.5">
                          <Heart className="h-3 w-3" />
                          {post.likes || 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="h-3 w-3" />
                          {commentCount}
                        </span>
                        {giftCount > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Gift className="h-3 w-3" />
                            {giftCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            : (
                <div className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-[#080c1a]/60 p-4 text-center">
                  <MessageCircle className="h-8 w-8 text-cyan-400/40" />
                  <p className="text-xs font-bold text-white/30">No Posts Yet</p>
                  <p className="text-[10px] text-white/15">Be the first to post!</p>
                </div>
              )}
      </HorizontalScrollRow>

      {/* Post detail modal */}
      {selectedPost && (
        <TrollWallPostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onRequireAuth={onRequireAuth}
        />
      )}
    </div>
  )
}
