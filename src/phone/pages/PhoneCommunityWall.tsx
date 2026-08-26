import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Heart,
  Gift,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Smile,
  Video,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { WallPost } from '@/types/trollWall'
import { trackPrideWallAction } from '@/services/prideChallengeTracker'
import TrollWallPostModal from '@/components/home/TrollWallPostModal'
import MentionTextarea from '@/components/MentionTextarea'
import { notifySomeoneMentioned } from '@/lib/notifications'

import { neonCard, neonTextGradient } from '../phoneTheme'

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
  const expiresAt = post.metadata?.boost_expires_at
    ? new Date(post.metadata.boost_expires_at).getTime()
    : 0

  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

function sortWallPosts(rows: WallPost[]) {
  return [...rows].sort((a, b) => {
    const aPinned = a.is_pinned ? 1 : 0
    const bPinned = b.is_pinned ? 1 : 0

    if (aPinned !== bPinned) {
      return bPinned - aPinned
    }

    const aBoosted = isPostBoostActive(a) ? 1 : 0
    const bBoosted = isPostBoostActive(b) ? 1 : 0

    if (aBoosted !== bBoosted) {
      return bBoosted - aBoosted
    }

    return (
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
    )
  })
}

function PostAvatar({
  userId,
  avatarUrl,
  username,
}: {
  userId?: string
  avatarUrl: string
  username: string
}) {
  const frame = useUserFrame(userId)

  return (
    <div
      className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10"
      style={{ overflow: 'visible' }}
    >
      <ProfileFrame
        frame={frame}
        avatarUrl={avatarUrl}
        username={username}
        size="xs"
      />
    </div>
  )
}

export default function PhoneCommunityWall() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedPost, setSelectedPost] =
    useState<WallPost | null>(null)

  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(
    null
  )

  const [showEmoji, setShowEmoji] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const currentUserFrame = useUserFrame(user?.id)

  const requireAuth = useCallback(
    (intent = 'use the Community Wall') => {
      if (user?.id) return true

      toast.error(`Please sign in to ${intent}.`)
      navigate('/auth')

      return false
    },
    [user?.id, navigate]
  )

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
        .limit(50)

      if (error) throw error

      const rows: WallPost[] = (data || []).map((row: any) => ({
        ...row,

        username:
          row.user_profiles?.username ||
          row.username,

        avatar_url:
          row.user_profiles?.avatar_url ||
          row.avatar_url,

        is_admin:
          row.user_profiles?.is_admin ??
          row.is_admin,

        is_troll_officer:
          row.user_profiles?.is_troll_officer ??
          row.is_troll_officer,

        is_og_user:
          row.user_profiles?.is_og_user ??
          row.is_og_user,

        user_created_at:
          row.user_profiles?.created_at ??
          row.user_created_at,

        is_verified:
          row.user_profiles?.is_verified,

        is_gold:
          row.user_profiles?.is_gold,

        username_style:
          row.user_profiles?.username_style,

        badge:
          row.user_profiles?.badge,

        officer_level:
          row.user_profiles?.officer_level,

        troller_level:
          row.user_profiles?.troller_level,

        is_troller:
          row.user_profiles?.is_troller,

        replies: [],
        user_liked: false,
        reactions: {},
        gifts: {},
      }))

      setPosts(sortWallPosts(rows))
    } catch (err) {
      console.error(
        '[PhoneCommunityWall] Failed to fetch posts:',
        err
      )

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

  const handleMediaChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
    if (!requireAuth('create a post')) return

    if (!content.trim()) {
      toast.error('Write something before posting')
      return
    }

    setSubmitting(true)

    try {
      const metadata: Record<string, string> = {}

      if (mediaFile && user) {
        const extension =
          mediaFile.name.split('.').pop() || 'png'

        const fileName =
          `${user.id}/${Date.now()}_media.${extension}`

        const { error: uploadError } =
          await supabase.storage
            .from('post-media')
            .upload(fileName, mediaFile)

        if (uploadError) {
          throw uploadError
        }

        const { data: publicData } =
          supabase.storage
            .from('post-media')
            .getPublicUrl(fileName)

        if (mediaType === 'video') {
          metadata.video_url =
            publicData.publicUrl
        } else {
          metadata.image_url =
            publicData.publicUrl
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

      /*
       * ----------------------------------------------------------
       * Mentions
       * ----------------------------------------------------------
       */

      const mentionedUsernames = new Set<string>()

      const mentionRegex = /#([A-Za-z0-9_]+)/g

      let mentionMatch

      while (
        (mentionMatch = mentionRegex.exec(content)) !== null
      ) {
        mentionedUsernames.add(
          mentionMatch[1]
        )
      }

      if (
        mentionedUsernames.size > 0 &&
        user?.id
      ) {
        for (const username of mentionedUsernames) {
          const { data: mentionedUser } =
            await supabase
              .from('user_profiles')
              .select('id')
              .ilike('username', username)
              .maybeSingle()

          if (
            mentionedUser?.id &&
            mentionedUser.id !== user.id
          ) {
            await notifySomeoneMentioned(
              mentionedUser.id,
              profile?.username || 'Someone',
              'the Troll Wall'
            )
          }
        }
      }

      const optimisticPost: WallPost = {
        ...(data as WallPost),

        username:
          profile?.username || 'You',

        avatar_url:
          profile?.avatar_url || null,

        is_admin:
          profile?.is_admin || false,

        is_troll_officer:
          profile?.is_troll_officer || false,

        is_og_user:
          profile?.is_og_user || false,

        user_created_at:
          profile?.created_at,

        user_liked: false,
        reactions: {},
        gifts: {},
        replies: [],
      }

      setPosts((prev) =>
        sortWallPosts([
          optimisticPost,
          ...prev,
        ])
      )

      setContent('')
      setMediaFile(null)
      setMediaType(null)

      toast.success('Post created')

      if (user?.id) {
        trackPrideWallAction(
          user.id,
          'wall_posts'
        )

        trackPrideWallAction(
          user.id,
          'share_moment'
        )
      }
    } catch (err: any) {
      console.error(
        '[PhoneCommunityWall] Error creating post:',
        err
      )

      toast.error(
        err?.message ||
          'Failed to create post'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#03030a] text-white">

      {/* ------------------------------------------------------ */}
      {/* Header                                                  */}
      {/* ------------------------------------------------------ */}

      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#00BFFF]/20 bg-[#03030a]/95 px-3 py-3 backdrop-blur-2xl">

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white transition active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="text-center">
          <h1
            className={`text-sm font-black uppercase tracking-[0.2em] ${neonTextGradient}`}
          >
            Community Wall
          </h1>

          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600">
            Troll Wall
          </p>
        </div>

        <div className="w-9" />
      </header>

      <main className="px-3 pb-24 pt-3">

        {/* ---------------------------------------------------- */}
        {/* Composer                                               */}
        {/* ---------------------------------------------------- */}

        <section
          className={`${neonCard} mb-4 overflow-visible p-3`}
        >
          <div className="mb-2 flex items-center gap-2">

            <div
              className="h-9 w-9 shrink-0 rounded-full"
              style={{ overflow: 'visible' }}
            >
              {profile?.avatar_url ? (
                <ProfileFrame
                  frame={currentUserFrame}
                  avatarUrl={profile.avatar_url}
                  username={
                    profile.username || 'User'
                  }
                  size="xs"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#BF00FF] to-[#00BFFF] text-xs font-black">
                  {profile?.username?.[0]?.toUpperCase() ||
                    'T'}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-black text-white">
                {profile?.username ||
                  'Join the conversation'}
              </p>

              <p className="text-[9px] text-zinc-500">
                Share something with the City
              </p>
            </div>
          </div>

          <MentionTextarea
            value={content}
            onChange={setContent}
            placeholder="What's happening in the City? Use # to tag users"
            className="min-h-[76px] w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-[#BF00FF]/50 focus:outline-none"
            maxLength={5000}
            onFocus={() =>
              requireAuth('create a post')
            }
          />

          {/* Media preview */}

          {mediaFile && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">

              {mediaType === 'video' ? (
                <Video
                  size={14}
                  className="text-[#00BFFF]"
                />
              ) : (
                <ImageIcon
                  size={14}
                  className="text-[#BF00FF]"
                />
              )}

              <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">
                {mediaFile.name}
              </span>

              <button
                type="button"
                onClick={() => {
                  setMediaFile(null)
                  setMediaType(null)
                }}
                className="text-zinc-500 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Composer controls */}

          <div className="mt-2 flex items-center justify-between">

            <div className="flex items-center gap-1">

              <button
                type="button"
                onClick={() => {
                  if (
                    !requireAuth('add media')
                  ) {
                    return
                  }

                  const input =
                    document.createElement(
                      'input'
                    )

                  input.type = 'file'
                  input.accept =
                    'image/*,video/*'

                  input.onchange =
                    handleMediaChange as any

                  input.click()
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-400 transition hover:bg-[#00BFFF]/10 hover:text-[#00BFFF]"
              >
                {mediaType === 'video' ? (
                  <Video size={15} />
                ) : (
                  <ImageIcon size={15} />
                )}
              </button>

              <div className="relative">

                <button
                  type="button"
                  onClick={() => {
                    if (
                      !requireAuth(
                        'add an emoji'
                      )
                    ) {
                      return
                    }

                    setShowEmoji(
                      (prev) => !prev
                    )
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-400 transition hover:bg-[#BF00FF]/10 hover:text-[#BF00FF]"
                >
                  <Smile size={15} />
                </button>

                {showEmoji && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 rounded-xl border border-white/10 bg-[#0b0b18] p-2 shadow-2xl">

                    <div className="flex gap-1">
                      {EMOJI_OPTIONS.map(
                        (emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() =>
                              handleEmojiInsert(
                                emoji
                              )
                            }
                            className="rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-white hover:bg-[#BF00FF]/20"
                          >
                            {emoji}
                          </button>
                        )
                      )}
                    </div>

                  </div>
                )}

              </div>

            </div>

            <button
              type="button"
              disabled={
                submitting ||
                !content.trim()
              }
              onClick={handleSubmit}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#BF00FF] to-[#00BFFF] px-3 text-[10px] font-black text-white shadow-[0_0_18px_rgba(191,0,255,0.2)] transition active:scale-95 disabled:opacity-30"
            >
              <Send size={13} />
              Post
            </button>

          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* Wall heading                                          */}
        {/* ---------------------------------------------------- */}

        <div className="mb-3 flex items-center justify-between">

          <div className="flex items-center gap-2">

            <MessageCircle
              size={16}
              className="text-[#00BFFF]"
            />

            <div>
              <h2 className="text-sm font-black text-white">
                Troll Wall
              </h2>

              <p className="text-[9px] text-zinc-600">
                {posts.length > 0
                  ? `${posts.length} posts`
                  : 'The City conversation'}
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={fetchPosts}
            className="text-[9px] font-black uppercase tracking-widest text-[#00BFFF]"
          >
            Refresh
          </button>

        </div>

        {/* ---------------------------------------------------- */}
        {/* Posts                                                  */}
        {/* ---------------------------------------------------- */}

        {loading ? (
          <div className="space-y-3">

            {Array.from({
              length: 5,
            }).map((_, index) => (
              <div
                key={index}
                className="h-[210px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]"
              />
            ))}

          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-3">

            {posts.map((post) => {
              const boosted =
                isPostBoostActive(post)

              const avatarUrl =
                post.avatar_url ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                  post.username || 'TC'
                )}`

              const hasImage =
                !!post.metadata?.image_url

              const thumbnailUrl =
                post.metadata
                  ?.thumbnail_url ||
                post.metadata?.image_url

              const commentCount =
                post.replies?.length || 0

              const giftCount =
                post.gifts
                  ? Object.values(
                      post.gifts as Record<
                        string,
                        { count?: number }
                      >
                    ).reduce(
                      (sum, gift) =>
                        sum +
                        (gift?.count || 0),
                      0
                    )
                  : 0

              return (
                <article
                  key={post.id}
                  onClick={() =>
                    setSelectedPost(post)
                  }
                  className={`relative overflow-hidden rounded-2xl border bg-[#080812]/95 transition active:scale-[0.995] ${
                    post.is_pinned
                      ? 'border-yellow-400/60 shadow-[0_0_25px_rgba(250,204,21,0.12)]'
                      : boosted
                        ? 'border-amber-400/40 shadow-[0_0_25px_rgba(245,158,11,0.1)]'
                        : 'border-white/[0.08]'
                  }`}
                >

                  {/* Boosted */}

                  {boosted && (
                    <div className="absolute left-0 right-0 top-0 z-20 h-[2px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500" />
                  )}

                  {post.is_pinned && (
                    <div className="absolute left-0 right-0 top-0 z-20 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                  )}

                  {/* Image */}

                  {hasImage &&
                  thumbnailUrl ? (
                    <div className="relative h-[190px] w-full overflow-hidden">

                      <img
                        src={thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-[#080812] via-transparent to-black/10" />

                      {boosted && (
                        <span className="absolute right-2 top-2 rounded-full border border-amber-200/30 bg-amber-400/90 px-2 py-1 text-[8px] font-black uppercase text-black">
                          Boosted
                        </span>
                      )}

                    </div>
                  ) : (
                    <div className="h-1 w-full bg-gradient-to-r from-[#BF00FF]/50 via-[#00BFFF]/50 to-[#BF00FF]/50" />
                  )}

                  <div className="p-3">

                    {/* User */}

                    <div className="flex items-center gap-2">

                      {post.is_system_generated ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00BFFF]/10 text-sm ring-1 ring-[#00BFFF]/20">
                          ⚡
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()

                            navigate(
                              `/profile/id/${post.user_id}`
                            )
                          }}
                        >
                          <PostAvatar
                            userId={
                              post.user_id
                            }
                            avatarUrl={
                              avatarUrl
                            }
                            username={
                              post.username ||
                              'User'
                            }
                          />
                        </button>
                      )}

                      <div className="min-w-0 flex-1">

                        {post.is_system_generated ? (
                          <p className="truncate text-xs font-black text-[#00BFFF]">
                            Mai Troll System
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()

                              navigate(
                                `/profile/id/${post.user_id}`
                              )
                            }}
                            className="block max-w-full truncate text-left text-xs font-black text-white hover:text-[#00BFFF]"
                          >
                            {post.username ||
                              'Unknown'}
                          </button>
                        )}

                        <p className="text-[9px] text-zinc-600">
                          {timeAgo(
                            post.created_at
                          )}
                        </p>

                      </div>

                      {post.is_pinned && (
                        <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[8px] font-black uppercase text-yellow-400">
                          Pinned
                        </span>
                      )}

                    </div>

                    {/* Content */}

                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
                      {post.is_system_generated && (
                        <span className="text-[#00BFFF]">
                          ⚡{' '}
                        </span>
                      )}

                      {post.content}
                    </p>

                    {/* Stats */}

                    <div className="mt-4 flex items-center gap-4 border-t border-white/[0.05] pt-3 text-[10px] text-zinc-600">

                      <span className="flex items-center gap-1">
                        <Heart
                          size={13}
                          className="text-pink-400/70"
                        />
                        {post.likes || 0}
                      </span>

                      <span className="flex items-center gap-1">
                        <MessageCircle
                          size={13}
                          className="text-[#00BFFF]/70"
                        />
                        {commentCount}
                      </span>

                      {giftCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Gift
                            size={13}
                            className="text-amber-400/70"
                          />
                          {giftCount}
                        </span>
                      )}

                      <span className="ml-auto text-[9px] font-bold text-zinc-700">
                        Tap to open
                      </span>

                    </div>

                  </div>

                </article>
              )
            })}

          </div>
        ) : (
          <section
            className={`${neonCard} flex flex-col items-center justify-center p-10 text-center`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#BF00FF]/20 to-[#00BFFF]/20">
              <MessageCircle
                size={30}
                className="text-[#00BFFF]"
              />
            </div>

            <h3 className="mt-4 text-sm font-black text-white">
              No Posts Yet
            </h3>

            <p className="mt-1 max-w-[260px] text-[10px] leading-relaxed text-zinc-600">
              Be the first person to say
              something on the Troll Wall.
            </p>
          </section>
        )}

      </main>

      {/* ------------------------------------------------------ */}
      {/* Post modal                                             */}
      {/* ------------------------------------------------------ */}

      {selectedPost && (
        <TrollWallPostModal
          post={selectedPost}
          onClose={() =>
            setSelectedPost(null)
          }
          onRequireAuth={requireAuth}
        />
      )}

    </div>
  )
}