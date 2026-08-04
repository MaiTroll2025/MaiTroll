import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Heart,
  Reply,
  Pin,
  Trash2,
  Share2,
  MessageSquare,
  PlayCircle,
  ExternalLink,
  Coins,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useNavigate } from 'react-router-dom'
import { WallPost } from '@/types/trollWall'
import NeonGlowUsername from '@/components/NeonGlowUsername'
import UserNameWithAge from '@/components/UserNameWithAge'
import { parseTextWithLinks } from '@/lib/utils'
import { trackPrideWallAction } from '@/services/prideChallengeTracker'
import WallShareModal from '@/components/trollWall/WallShareModal'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { notifySomeoneMentioned } from '@/lib/notifications'

/** Small avatar component for reply items — extracts useUserFrame out of .map() */
function ReplyAvatar({ userId, avatarUrl, username }: { userId?: string; avatarUrl: string; username: string }) {
  const frame = useUserFrame(userId)
  return (
    <div className="h-7 w-7 shrink-0 rounded-full bg-white/5 ring-1 ring-white/10" style={{ overflow: 'visible' }}>
      <ProfileFrame frame={frame} avatarUrl={avatarUrl} username={username} size="xs" />
    </div>
  )
}

const WALL_BOOST_PERK_IDS = ['wall_boost_24h', 'wall_boost_7d']

function formatWallBoostLabel(perkId: string) {
  if (perkId === 'wall_boost_7d') return '7 Days'
  return '24 Hours'
}

interface TrollWallPostModalProps {
  post: WallPost | null
  onClose: () => void
  onRequireAuth: (intent?: string) => boolean
}

export default function TrollWallPostModal({
  post,
  onClose,
  onRequireAuth,
}: TrollWallPostModalProps) {
  const { user, profile, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const [replies, setReplies] = useState<WallPost[]>([])
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [liking, setLiking] = useState(false)
  const [sharingPost, setSharingPost] = useState<WallPost | null>(null)
  const [currentPost, setCurrentPost] = useState<WallPost | null>(post)
  const [streamStatus, setStreamStatus] = useState<'live' | 'ended' | 'unknown' | null>(null)
  const [activeWallBoosts, setActiveWallBoosts] = useState<any[]>([])
  const [loadingWallBoosts, setLoadingWallBoosts] = useState(false)
  const [applyingBoost, setApplyingBoost] = useState(false)
  const [boostMenuOpen, setBoostMenuOpen] = useState(false)

  // Check stream status when post has a stream_id
  useEffect(() => {
    if (!currentPost?.metadata?.stream_id) {
      setStreamStatus(null)
      return
    }
    const checkStreamStatus = async () => {
      try {
        const { data } = await supabase
          .from('streams')
          .select('status, ended_at')
          .eq('id', currentPost.metadata!.stream_id)
          .maybeSingle()
        if (data) {
          setStreamStatus(data.status === 'ended' ? 'ended' : 'live')
        } else {
          setStreamStatus('unknown')
        }
      } catch {
        setStreamStatus('unknown')
      }
    }
    checkStreamStatus()
  }, [currentPost?.metadata?.stream_id])

  useEffect(() => {
    setCurrentPost(post)
  }, [post])

  // Load replies when post changes
  useEffect(() => {
    if (!post?.id) {
      setReplies([])
      return
    }
    supabase
      .from('troll_wall_posts')
      .select(
        '*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, is_verified, is_gold, username_style, badge, officer_level, troller_level, is_troller)'
      )
      .eq('reply_to_post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data, error }) => {
        if (error) return
        const rows = (data || []).map((r: any) => ({
          ...r,
          username: r.user_profiles?.username,
          avatar_url: r.user_profiles?.avatar_url,
          is_admin: r.user_profiles?.is_admin,
          is_troll_officer: r.user_profiles?.is_troll_officer,
          is_og_user: r.user_profiles?.is_og_user,
          user_created_at: r.user_profiles?.created_at,
          is_verified: r.user_profiles?.is_verified,
          is_gold: r.user_profiles?.is_gold,
        })) as WallPost[]
        setReplies(rows)
      })
  }, [post?.id])

  const loadActiveWallBoosts = useCallback(async () => {
    if (!user?.id) {
      setActiveWallBoosts([])
      return
    }

    setLoadingWallBoosts(true)
    try {
      const { data, error } = await supabase
        .from('user_perks')
        .select('*')
        .eq('user_id', user.id)
        .in('perk_id', WALL_BOOST_PERK_IDS)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })

      if (error) throw error
      setActiveWallBoosts((data || []) as any[])
    } catch (err) {
      console.warn('[TrollWallPostModal] Failed to load wall boosts:', err)
      setActiveWallBoosts([])
    } finally {
      setLoadingWallBoosts(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadActiveWallBoosts()
  }, [loadActiveWallBoosts, currentPost?.id])

  // Close on Escape
  useEffect(() => {
    if (!post) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [post, onClose])

  const handleLike = useCallback(async () => {
    if (!currentPost || !user?.id) {
      onRequireAuth('like a post')
      return
    }
    if (liking) return
    setLiking(true)
    try {
      const { data, error } = await supabase.rpc('toggle_wall_post_like', {
        p_post_id: currentPost.id,
        p_user_id: user.id,
      })
      if (error) throw error
      if (data) {
        setCurrentPost((prev) =>
          prev
            ? { ...prev, likes: data.likes_count, user_liked: data.liked }
            : prev
        )
        if (data.liked && user?.id) {
          trackPrideWallAction(user.id, 'like_posts')
        }
      }
    } catch {
      toast.error('Failed to like post')
    } finally {
      setLiking(false)
    }
  }, [currentPost, user?.id, onRequireAuth, liking])

  const handleReply = useCallback(async () => {
    if (!currentPost || !user?.id) {
      onRequireAuth('reply to a post')
      return
    }
    if (!replyText.trim()) {
      toast.error('Write a reply before posting')
      return
    }
    setReplying(true)
    try {
      const { error } = await supabase.rpc('create_wall_post_reply', {
        p_original_post_id: currentPost.id,
        p_user_id: user.id,
        p_content: replyText.trim(),
      })
      if (error) throw error

      const mentionedUsernames = new Set<string>()
      const mentionRegex = /#([A-Za-z0-9_]+)/g
      let mentionMatch
      while ((mentionMatch = mentionRegex.exec(replyText)) !== null) {
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
            await notifySomeoneMentioned(mentionedUser.id, profile?.username || 'Someone', 'a Troll Wall reply')
          }
        }
      }

      toast.success('Reply posted')
      setReplyText('')
      if (user?.id) {
        trackPrideWallAction(user.id, 'reply_posts')
      }
      // Reload replies
      const { data } = await supabase
        .from('troll_wall_posts')
        .select(
          '*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, is_verified, is_gold)'
        )
        .eq('reply_to_post_id', currentPost.id)
        .order('created_at', { ascending: true })
        .limit(50)
      if (data) {
        setReplies(
          data.map((r: any) => ({
            ...r,
            username: r.user_profiles?.username,
            avatar_url: r.user_profiles?.avatar_url,
          })) as WallPost[]
        )
      }
    } catch {
      toast.error('Failed to post reply')
    } finally {
      setReplying(false)
    }
  }, [currentPost, user?.id, replyText, onRequireAuth])

  const handlePin = useCallback(async () => {
    if (!currentPost || !user?.id) return
    try {
      const { data, error } = await supabase.rpc('toggle_wall_post_pin', {
        p_post_id: currentPost.id,
        p_user_id: user.id,
      })
      if (error) throw error
      const pinned = typeof data === 'boolean' ? data : !currentPost.is_pinned
      setCurrentPost((prev) => (prev ? { ...prev, is_pinned: pinned } : prev))
      toast.success(pinned ? 'Post pinned' : 'Post unpinned')
    } catch {
      toast.error('Failed to pin/unpin')
    }
  }, [currentPost, user?.id])

  const handleBoostPost = useCallback(async (boost: any) => {
    if (!currentPost || !user?.id) return
    if (applyingBoost) return

    setApplyingBoost(true)
    try {
      const now = new Date()
      const expiresAt = new Date(boost.expires_at || now.getTime() + Number(boost.metadata?.boost_duration_hours || 24) * 3600000).toISOString()
      const metadata = {
        ...(currentPost.metadata || {}),
        is_boosted: true,
        boost_expires_at: expiresAt,
        boost_package_id: boost.perk_id,
        boosted_at: now.toISOString(),
        boosted_by: user.id,
      }

      const { data, error } = await supabase
        .from('troll_wall_posts')
        .update({ metadata })
        .eq('id', currentPost.id)
        .select('*')
        .single()

      if (error) throw error

      await supabase
        .from('user_perks')
        .update({
          is_active: false,
          metadata: {
            ...(boost.metadata || {}),
            consumed_post_id: currentPost.id,
            consumed_at: now.toISOString(),
          },
        })
        .eq('id', boost.id)

      const updatedPost = {
        ...currentPost,
        ...data,
        metadata,
      }
      setCurrentPost(updatedPost)
      setActiveWallBoosts((prev) => prev.filter((item) => item.id !== boost.id))
      setBoostMenuOpen(false)
      toast.success(`Post boosted for ${formatWallBoostLabel(boost.perk_id)}`)
    } catch (err: any) {
      console.error('[TrollWallPostModal] Boost failed:', err)
      toast.error(err?.message || 'Failed to boost post')
    } finally {
      setApplyingBoost(false)
    }
  }, [currentPost, user?.id, applyingBoost])

  const handleDelete = useCallback(async () => {
    if (!currentPost || !user?.id) return
    if (!confirm('Delete this post?')) return
    try {
      let query = supabase.from('troll_wall_posts').delete().eq('id', currentPost.id)
      if (!isAdmin) query = query.eq('user_id', user.id)
      const { error } = await query
      if (error) throw error
      toast.success('Post deleted')
      onClose()
    } catch {
      toast.error('Failed to delete')
    }
  }, [currentPost, user?.id, isAdmin, onClose])

  if (!post || !currentPost) return null

  const avatarUrl =
    currentPost.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      currentPost.username || 'TC'
    )}`

  const modalContent = (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#070b19]/95 shadow-[0_0_60px_rgba(34,211,238,0.12)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">Post</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Author */}
          <div className="px-4 pt-4">
            {currentPost.is_system_generated ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-cyan-500/10 text-sm text-cyan-400">
                  ⚡
                </div>
                <div>
                  <span className="text-sm font-bold text-cyan-400">Mai Troll System</span>
                  <span className="ml-2 inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-cyan-300">
                    System
                  </span>
                </div>
              </div>
            ) : currentPost.username ? (
              <NeonGlowUsername
                username={currentPost.username}
                userId={currentPost.user_id}
                avatarUrl={avatarUrl}
                profile={{
                  is_admin: currentPost.is_admin,
                  is_troll_officer: currentPost.is_troll_officer,
                  is_og_user: currentPost.is_og_user,
                  is_verified: currentPost.is_verified,
                  is_gold: currentPost.is_gold,
                  officer_level: currentPost.officer_level,
                  troller_level: currentPost.troller_level,
                  is_troller: currentPost.is_troller,
                  username_style: currentPost.username_style,
                  badge: currentPost.badge,
                }}
                size="md"
                onClick={() => navigate(`/profile/id/${currentPost.user_id}`)}
              />
            ) : (
              <span className="text-sm text-white/50">Deleted User</span>
            )}
            <p className="mt-1 text-[10px] text-white/30">
              {new Date(currentPost.created_at).toLocaleString()}
            </p>
          </div>

          {/* Content */}
          <div className="mt-3 px-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/90">
              {parseTextWithLinks(currentPost.content)}
            </p>
          </div>

          {/* Stream Link — supports both live and ended streams */}
          {currentPost.metadata?.stream_id && streamStatus && streamStatus !== 'unknown' && (
            <div className="mt-3 px-4">
              <button
                type="button"
                onClick={() => {
                  if (streamStatus === 'ended') {
                    navigate(`/replay/id/${currentPost.metadata!.stream_id}`)
                  } else {
                    navigate(`/stream/${currentPost.metadata!.stream_id}`)
                  }
                }}
                className="flex items-center gap-2 rounded-xl border border-purple-400/20 bg-purple-500/10 px-4 py-2.5 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 hover:text-purple-200 w-full"
              >
                {streamStatus === 'ended' ? (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    <span>Watch Replay</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    <span>Join Live Stream</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Media */}
          {currentPost.metadata?.image_url && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/10 px-4">
              <img
                src={currentPost.metadata.image_url}
                alt="Post media"
                className="max-h-80 w-full rounded-2xl object-contain"
              />
            </div>
          )}
          {currentPost.metadata?.video_url && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/10 px-4">
              <video
                controls
                preload="metadata"
                poster={currentPost.metadata?.thumbnail_url || undefined}
                className="max-h-80 w-full rounded-2xl bg-black"
              >
                <source src={currentPost.metadata.video_url} type="video/mp4" />
                <source src={currentPost.metadata.video_url} type="video/webm" />
              </video>
            </div>
          )}

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] px-4 py-3">
            <button
              type="button"
              onClick={handleLike}
              disabled={liking}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                currentPost.user_liked
                  ? 'border-pink-400/20 bg-pink-500/15 text-pink-300'
                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-cyan-300/20 hover:text-cyan-100'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${currentPost.user_liked ? 'fill-current' : ''}`} />
              {currentPost.likes || 0}
            </button>

            {user &&
              (currentPost.user_id === user.id || isAdmin) && (
                <>
                  <button
                    type="button"
                    onClick={handlePin}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                      currentPost.is_pinned
                        ? 'border-yellow-300/20 bg-yellow-500/15 text-yellow-300'
                        : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-yellow-200'
                    }`}
                  >
                    <Pin className={`h-3.5 w-3.5 ${currentPost.is_pinned ? 'fill-current' : ''}`} />
                    {currentPost.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 rounded-full border border-red-300/10 bg-red-500/5 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharingPost(currentPost)}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:text-blue-200"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                </>
              )}

            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    void loadActiveWallBoosts()
                    setBoostMenuOpen((prev) => !prev)
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20"
                >
                  <Coins className="h-3.5 w-3.5" />
                  Boost
                </button>
                {boostMenuOpen && (
                  <div className="absolute bottom-full right-0 z-20 mb-2 w-56 rounded-2xl border border-amber-300/20 bg-slate-950/98 p-3 shadow-2xl backdrop-blur-xl">
                    <div className="mb-2 text-xs font-black text-white">Apply Wall Boost</div>
                    {loadingWallBoosts ? (
                      <p className="text-[10px] text-slate-400">Loading boosts...</p>
                    ) : activeWallBoosts.length > 0 ? (
                      <div className="space-y-2">
                        {activeWallBoosts.map((boost) => (
                          <button
                            key={boost.id}
                            type="button"
                            onClick={() => void handleBoostPost(boost)}
                            disabled={applyingBoost}
                            className="w-full rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-left text-xs font-bold text-amber-100 disabled:opacity-50"
                          >
                            {formatWallBoostLabel(boost.perk_id)}
                            <span className="ml-2 text-[10px] text-amber-300/70">expires {new Date(boost.expires_at).toLocaleDateString()}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-400">No Wall Boosts available. Buy one in Coin Store &gt; Perks.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setBoostMenuOpen(false)
                            navigate('/store?tab=perks')
                          }}
                          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          Open Coin Store
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Replies section */}
          {replies.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-3">
              <p className="mb-3 text-xs font-bold text-white/50">
                {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
              </p>
              <div className="space-y-3">
                {replies.map((reply) => {
                  const rAvatar =
                    reply.avatar_url ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      reply.username || 'TC'
                    )}`
                  return (
                    <div
                      key={reply.id}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <ReplyAvatar userId={reply.user_id} avatarUrl={rAvatar} username={reply.username || 'User'} />
                        <UserNameWithAge
                          user={{
                            username: reply.username || 'Unknown',
                            id: reply.user_id,
                            is_admin: reply.is_admin,
                            is_troll_officer: reply.is_troll_officer,
                            is_og_user: reply.is_og_user,
                            created_at: reply.user_created_at,
                          }}
                          className="text-xs font-semibold text-white"
                        />
                        <span className="ml-auto text-[9px] text-white/30">
                          {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-white/70">
                        {parseTextWithLinks(reply.content)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Reply input */}
        {user && (
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleReply()
                  }
                }}
                placeholder="Write a reply..."
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/30 focus:border-cyan-400/30 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleReply}
                disabled={replying || !replyText.trim()}
                className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-purple-500 disabled:opacity-40"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {sharingPost && (
        <WallShareModal
          isOpen={!!sharingPost}
          onClose={() => setSharingPost(null)}
          post={sharingPost}
          postUrl={`${window.location.origin}/wall/${sharingPost.id}`}
          onShare={(postId) => {
            if (!user?.id) return
            supabase
              .from('troll_wall_post_shares')
              .insert({ post_id: postId, user_id: user.id })
              .then(({ error }) => {
                if (error) console.warn('Failed to record share:', error)
              })
          }}
        />
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
