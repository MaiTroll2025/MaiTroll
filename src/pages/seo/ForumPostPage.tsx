import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  Copy,
  Facebook,
  Mail,
  MessageCircle,
  Twitter,
  Users,
} from 'lucide-react'
import SEOLayout, { Breadcrumb } from './SEOLayout'
import { checkModeration } from '@/lib/moderationCheck'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

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

export default function ForumPostPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { postId } = useParams<{ postId: string }>()

  const [post, setPost] = useState<ForumPost | null>(null)
  const [replies, setReplies] = useState<ForumReply[]>([])
  const [replyContent, setReplyContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submittingReply, setSubmittingReply] = useState(false)

  const canonicalUrl = `https://www.maitroll.com/community/post/${postId}`

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
      console.error('[ForumPostPage] Failed to fetch post:', err)
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
      console.error('[ForumPostPage] Failed to fetch replies')
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

  const handleShare = async (platform: 'twitter' | 'facebook' | 'mail' | 'copy') => {
    const text = post?.title || 'Mai Troll Community Forum'
    const url = canonicalUrl
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      } catch {
        toast.error('Failed to copy link')
      }
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
      <SEOLayout title="Loading..." description="" keywords={[]}>
        <div className="flex min-h-screen items-center justify-center text-slate-400">
          Loading post...
        </div>
      </SEOLayout>
    )
  }

  if (!post) {
    return (
      <SEOLayout title="Post Not Found" description="" keywords={[]}>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <MessageCircle className="mx-auto h-12 w-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Post not found</h2>
          <p className="text-slate-400 mb-6">This discussion no longer exists.</p>
          <Link
            to="/community"
            className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4"
          >
            Back to Forum
          </Link>
        </div>
      </SEOLayout>
    )
  }

  return (
    <SEOLayout
      title={`${post.title || 'Discussion'} | Mai Troll Forum`}
      description={post.content.slice(0, 160)}
      keywords={['Mai Troll forum', post.title || 'discussion', 'community discussion']}
      ogImage={post.avatar_url}
    >
      <Breadcrumb items={[
        { label: 'Home', path: '/' },
        { label: 'Community Forum', path: '/community' },
        { label: post.title || 'Discussion' },
      ]} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Post */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-xs font-black text-white">
              {(post.username || 'U')[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30">
                  {post.community_name || post.community}
                </span>
                <span className="text-[11px] text-slate-500">
                  • {post.username || 'User'} • {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2 leading-snug">
                {post.title || 'Untitled'}
              </h1>
              <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                {post.content.split('\n').map((line, i) => (
                  <p key={i} className="mb-3 leading-relaxed whitespace-pre-line">
                    {line}
                  </p>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs">
                <div
                  className="flex items-center gap-1.5 text-[#00BFFF] cursor-pointer group"
                  onClick={() => handleVote('up')}
                >
                  <ChevronRight size={14} className="rotate-90" />
                  <span className="font-bold">{post.upvotes ?? post.likes ?? 0}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <Users className="w-4 h-4" />
                  <span>{post.comment_count ?? 0} comments</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => handleShare('copy')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-white/20 transition"
                    title="Copy link"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-[#1da1f2] hover:border-[#1da1f2]/30 transition"
                    title="Share on X"
                  >
                    <Twitter size={16} />
                  </button>
                  <button
                    onClick={() => handleShare('facebook')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-[#3b5998] hover:border-[#3b5998]/30 transition"
                    title="Share on Facebook"
                  >
                    <Facebook size={16} />
                  </button>
                  <button
                    onClick={() => handleShare('mail')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-purple-400 hover:border-purple-400/30 transition"
                    title="Share via email"
                  >
                    <Mail size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Replies */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">
                {replies.length} Comments
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            {replies.length === 0 ? (
              <p className="text-slate-500 text-sm">No replies yet. Be the first to reply.</p>
            ) : (
              replies.map((reply) => (
                <article
                  key={reply.id}
                  className="rounded-xl border border-slate-800 bg-slate-800/40 p-4"
                >
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-[10px] font-black text-white">
                      {(reply.username || 'U')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-bold text-slate-300">
                          {reply.username || 'User'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          • {new Date(reply.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="prose prose-invert prose-xs text-slate-300 max-w-none whitespace-pre-line">
                        {reply.content}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Reply composer */}
          {!user ? (
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center">
              <p className="text-sm text-slate-400 mb-3">
                Sign in to reply to this discussion.
              </p>
              <Link
                to="/auth"
                className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-[10px] font-black text-white">
                  {(profile?.username || 'Y')[0]?.toUpperCase()}
                </div>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 min-h-[80px] rounded-xl border border-slate-700 bg-transparent p-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none resize-none"
                  maxLength={5000}
                />
              </div>
              <button
                onClick={handleCreateReply}
                disabled={submittingReply || !replyContent.trim()}
                className="mt-3 px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
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
      </div>
    </SEOLayout>
  )
}
