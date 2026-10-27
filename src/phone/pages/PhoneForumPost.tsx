import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Copy, Mail, MessageCircle, Twitter, Users, Facebook } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { checkModeration } from '@/lib/moderationCheck'
import PhoneDrawer from '../PhoneDrawer'
import { neonTextGradient } from '../phoneTheme'

interface ForumPost {
  id: string
  user_id: string
  username?: string
  avatar_url?: string
  community?: string
  community_name?: string
  title?: string
  content: string
  likes: number
  upvotes?: number
  downvotes?: number
  created_at: string
  reply_to_post_id?: string | null
  user_liked?: boolean
  comment_count?: number
}

interface ForumReply {
  id: string
  user_id: string
  username?: string
  avatar_url?: string
  content: string
  likes: number
  created_at: string
  user_liked?: boolean
}

export default function PhoneForumPost() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { postId } = useParams<{ postId: string }>()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [post, setPost] = useState<ForumPost | null>(null)
  const [replies, setReplies] = useState<ForumReply[]>([])
  const [replyContent, setReplyContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submittingReply, setSubmittingReply] = useState(false)

  const fetchPost = useCallback(async () => {
    if (!postId) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('troll_wall_posts_public')
        .select('*')
        .eq('id', postId)
        .maybeSingle()
      if (error) throw error

      const row = data
      if (!row) {
        setPost(null)
        setLoading(false)
        return
      }

      setPost({
        id: row.id,
        user_id: row.user_id,
        username: row.username || 'User',
        avatar_url: row.avatar_url,
        community: row.metadata?.community || 'mai-troll',
        community_name: row.metadata?.community_name || 'Mai Troll',
        title: row.metadata?.title || row.content.slice(0, 60),
        content: row.content,
        likes: row.likes || 0,
        upvotes: row.upvotes ?? row.likes ?? 0,
        downvotes: row.downvotes ?? 0,
        created_at: row.created_at,
        reply_to_post_id: row.reply_to_post_id,
        user_liked: row.user_liked || false,
        comment_count: row.comment_count ?? 0,
      })
    } catch (err) {
      console.error('[PhoneForumPost] Failed to fetch post:', err)
      toast.error('Failed to load post')
      setLoading(false)
    }
  }, [postId])

  const fetchReplies = useCallback(async () => {
    if (!postId) return
    try {
      const { data, error } = await supabase
        .from('troll_wall_posts_public')
        .select('*')
        .eq('reply_to_post_id', postId)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      const rows: ForumReply[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        username: row.username || 'User',
        avatar_url: row.avatar_url,
        content: row.content,
        likes: row.likes || 0,
        created_at: row.created_at,
        user_liked: row.user_liked || false,
      }))
      setReplies(rows)
    } catch {
      console.error('[PhoneForumPost] Failed to fetch replies')
    }
  }, [postId])

  useEffect(() => {
    fetchPost()
    fetchReplies()
  }, [fetchPost, fetchReplies])

  const handleVote = async (type: 'up' | 'down') => {
    if (!user?.id) {
      navigate('/auth')
      return
    }
    if (!post) return
    try {
      const { error } = await supabase
        .from('troll_wall_likes')
        .insert({ post_id: post.id, user_id: user.id, like_type: type })
      if (error) throw error
      setPost((p) => {
        if (!p) return null
        return {
          ...p,
          upvotes: type === 'up' ? (p.upvotes ?? 0) + 1 : p.upvotes ?? 0,
          downvotes: type === 'down' ? (p.downvotes ?? 0) + 1 : p.downvotes ?? 0,
        }
      })
    } catch {
      toast.error('Unable to vote')
    }
  }

  const handleCreateReply = async () => {
    if (!user?.id) {
      navigate('/auth')
      return
    }
    if (!replyContent.trim()) return
    const moderation = await checkModeration(replyContent, 'forum_reply')
    if (!moderation.allowed) {
      toast.error(moderation.message || 'Reply contains prohibited content')
      return
    }
    setSubmittingReply(true)
    try {
      const { error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user.id,
          post_type: 'forum_reply',
          content: replyContent.trim(),
          reply_to_post_id: postId,
          metadata: {
            community: post?.community || 'mai-troll',
            community_name: post?.community_name || 'Mai Troll',
          },
        })
      if (error) throw error
      setReplyContent('')
      setSubmittingReply(false)
      toast.success('Reply posted')
      fetchReplies()
      setPost((p) => (p ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : null))
    } catch {
      setSubmittingReply(false)
      toast.error('Failed to post reply')
    }
  }

  const handleShare = (platform: 'copy' | 'twitter' | 'facebook' | 'mail') => {
    if (!post) return
    const text = post.title || 'Mai Troll Community Forum'
    const url = `https://www.maitroll.com/community/post/${postId}`
    if (platform === 'copy') {
      navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))
      return
    }
    if (platform === 'mail') {
      window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`
      return
    }
    const shareUrl =
      platform === 'twitter'
        ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
        : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="relative min-h-screen w-full pb-20 text-white">
        <PhoneDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex min-h-[70vh] items-center justify-center text-slate-400">
          Loading post...
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="relative min-h-screen w-full pb-20 text-white">
        <PhoneDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-[#0a0420]/80 px-4 py-4 backdrop-blur border-[#BF00FF]/30">
          <button
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white"
            onClick={() => navigate('/community')}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className={`text-xl font-black tracking-tight ${neonTextGradient}`}>Post Not Found</h1>
          <div className="w-6" />
        </header>
        <main className="px-4 py-4 text-center">
          <MessageCircle className="mx-auto h-12 w-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Post not found</h2>
          <p className="text-slate-400 mb-6">This discussion no longer exists.</p>
          <button
            onClick={() => navigate('/community')}
            className="rounded-lg px-5 py-2 text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500"
          >
            Back to Forum
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full pb-20 text-white">
      <PhoneDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-[#0a0420]/80 px-4 py-4 backdrop-blur border-[#BF00FF]/30">
        <button
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white"
          onClick={() => navigate('/community')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className={`text-xl font-black tracking-tight ${neonTextGradient}`}>
          Community Forum
        </h1>
        <div className="w-6" />
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Post */}
        <article className="rounded-xl border border-slate-800 bg-[#0b0614]/60 p-3 mb-2">
          <div className="flex gap-2 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-[10px] font-black text-white">
              {(post.username || 'U')[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30">
                  {post.community_name || post.community}
                </span>
                <span className="text-[10px] text-slate-500">
                  • {post.username || 'User'}
                </span>
                <span className="text-[10px] text-slate-500 ml-auto">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>
              <h2 className="text-sm font-bold text-white mb-1 leading-tight">
                {post.title || 'Untitled'}
              </h2>
              <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line mb-2">
                {post.content.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                <div
                  className="flex items-center gap-1 text-[#00BFFF] cursor-pointer"
                  onClick={() => handleVote('up')}
                >
                  <ChevronRight size={12} className="rotate-90" />
                  <span className="font-black">{post.upvotes ?? post.likes ?? 0}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <Users className="w-3 h-3" />
                  <span>{post.comment_count ?? 0} comments</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => handleShare('copy')}
                    className="text-slate-400 hover:text-white"
                    title="Copy link"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    className="text-slate-400 hover:text-[#1da1f2]"
                    title="Share on X"
                  >
                    <Twitter size={14} />
                  </button>
                  <button
                    onClick={() => handleShare('facebook')}
                    className="text-slate-400 hover:text-[#3b5998]"
                    title="Share on Facebook"
                  >
                    <Facebook size={14} />
                  </button>
                  <button
                    onClick={() => handleShare('mail')}
                    className="text-slate-400 hover:text-purple-400"
                    title="Share via email"
                  >
                    <Mail size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Replies */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">{replies.length} Comments</h3>
            </div>
          </div>

          <div className="space-y-3">
            {replies.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center">No replies yet. Be the first to reply.</p>
            ) : (
              replies.map((reply) => (
                <article key={reply.id} className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                  <div className="flex gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-[9px] font-black text-white">
                      {(reply.username || 'U')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] font-bold text-slate-300">
                          {reply.username || 'User'}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          • {new Date(reply.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
                        {reply.content.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            <br />
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Reply composer */}
          {!user ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-center">
              <p className="text-xs text-slate-400 mb-2">Sign in to reply.</p>
              <button
                onClick={() => navigate('/auth')}
                className="text-xs font-bold text-purple-400 underline underline-offset-4"
              >
                Sign in
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
              <div className="flex gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-[9px] font-black text-white">
                  {(profile?.username || 'Y')[0]?.toUpperCase()}
                </div>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 min-h-[70px] rounded-xl border border-slate-700 bg-transparent p-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none resize-none"
                  maxLength={5000}
                />
              </div>
              <button
                onClick={handleCreateReply}
                disabled={submittingReply || !replyContent.trim()}
                className="w-full rounded-lg py-2 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  submittingReply
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-purple-600 text-white hover:bg-purple-500'
                }"
              >
                {submittingReply ? 'Posting...' : 'Post Reply'}
              </button>
            </div>
          )}
        </section>
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
