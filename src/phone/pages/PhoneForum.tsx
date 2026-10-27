import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Image,
  MessageCircle,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Video,
} from 'lucide-react'
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
  created_at: string
  reply_to_post_id?: string | null
  user_liked?: boolean
  upvotes?: number
  downvotes?: number
  comment_count?: number
}

interface Community {
  slug: string
  name: string
  icon: React.ElementType
}

const COMMUNITIES: Community[] = [
  { slug: 'gaming', name: 'Gaming', icon: Video },
  { slug: 'broadcasting', name: 'Broadcasting', icon: Sparkles },
  { slug: 'battles', name: 'Battles', icon: TrendingUp },
  { slug: 'entertainment', name: 'Entertainment', icon: Image },
  { slug: 'local-cities', name: 'Local Cities', icon: User },
  { slug: 'mai-troll', name: 'Mai Troll', icon: MessageCircle },
]

const _FORUM_KEYWORDS = [
  'scam',
  'fraud',
  'phishing',
  'illegal',
  'drugs',
  'weapon',
  'hate',
  'slur',
  'nazi',
  'terror',
  'bomb',
  'suicide',
  'self-harm',
  'child',
  'minor',
  'porn',
  'xxx',
  'nsfw',
  'sex',
  'naked',
  'nude',
]

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

export default function PhoneForum() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [posts, setPosts] = useState<ForumPost[]>([])
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top'>('hot')
  const [searchQuery, setSearchQuery] = useState('')
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [selectedCommunityForPost, setSelectedCommunityForPost] = useState<string>('mai-troll')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => {
        if (selectedCommunity && post.community !== selectedCommunity) return false
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          return (
            post.title?.toLowerCase().includes(q) ||
            post.content.toLowerCase().includes(q) ||
            post.community?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'new') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        if (sortBy === 'top') {
          return (b.upvotes ?? b.likes ?? 0) - (a.upvotes ?? a.likes ?? 0)
        }
        const scoreA = (a.upvotes ?? a.likes ?? 0) - (a.downvotes ?? 0)
        const scoreB = (b.upvotes ?? b.likes ?? 0) - (b.downvotes ?? 0)
        const ageA = Date.now() - new Date(a.created_at).getTime()
        const ageB = Date.now() - new Date(b.created_at).getTime()
        const hotA = scoreA / Math.pow(Math.max(1, ageA / 3600000), 1.5)
        const hotB = scoreB / Math.pow(Math.max(1, ageB / 3600000), 1.5)
        return hotB - hotA
      })
  }, [posts, selectedCommunity, searchQuery, sortBy])

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('troll_wall_posts_public')
        .select('*')
        .is('reply_to_post_id', null)
        .order('created_at', { ascending: false })
        .limit(100)

      if (selectedCommunity) {
        query = query.ilike('metadata->>community', `%${selectedCommunity}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const rows: ForumPost[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        username: row.username || 'User',
        avatar_url: row.avatar_url,
        community: row.metadata?.community || 'mai-troll',
        community_name: row.metadata?.community_name || 'Mai Troll',
        title: row.metadata?.title || row.content.slice(0, 60),
        content: row.content,
        likes: row.likes || 0,
        created_at: row.created_at,
        reply_to_post_id: row.reply_to_post_id,
        user_liked: row.user_liked || false,
        upvotes: row.upvotes ?? row.likes ?? 0,
        downvotes: row.downvotes ?? 0,
        comment_count: row.comment_count ?? 0,
      }))
      setPosts(rows)
    } catch (err) {
      console.error('[PhoneForum] Failed to fetch posts:', err)
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [selectedCommunity])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleVote = async (postId: string, type: 'up' | 'down') => {
    if (!user?.id) {
      navigate('/auth')
      return
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              upvotes: type === 'up' ? (p.upvotes ?? 0) + 1 : p.upvotes ?? 0,
              downvotes: type === 'down' ? (p.downvotes ?? 0) + 1 : p.downvotes ?? 0,
            }
          : p
      )
    )
    try {
      const { error } = await supabase
        .from('troll_wall_likes')
        .insert({ post_id: postId, user_id: user.id, like_type: type })
      if (error) throw error
    } catch {
      toast.error('Unable to vote')
    }
  }

  const handleCreatePost = async () => {
    if (!user?.id) {
      navigate('/auth')
      return
    }
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }
    const moderation = await checkModeration(`${title}\n${content}`, 'forum_post')
    if (!moderation.allowed) {
      toast.error(moderation.message || 'Post contains prohibited content')
      return
    }
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user.id,
          post_type: 'forum',
          title: title.trim(),
          content: content.trim(),
          metadata: {
            community: selectedCommunityForPost,
            community_name:
              COMMUNITIES.find((c) => c.slug === selectedCommunityForPost)?.name ||
              selectedCommunityForPost,
            title: title.trim(),
          },
        })
        .select('*')
        .single()
      if (error) throw error
      const newPost: ForumPost = {
        id: data.id,
        user_id: data.user_id,
        username: profile?.username || 'You',
        avatar_url: profile?.avatar_url || null,
        community: selectedCommunityForPost,
        community_name: COMMUNITIES.find((c) => c.slug === selectedCommunityForPost)?.name || selectedCommunityForPost,
        title: title.trim(),
        content: content.trim(),
        likes: 0,
        created_at: data.created_at,
        reply_to_post_id: null,
        user_liked: false,
        upvotes: 0,
        downvotes: 0,
        comment_count: 0,
      }
      setPosts((prev) => [newPost, ...prev])
      setTitle('')
      setContent('')
      setSelectedCommunityForPost('mai-troll')
      setDrawerOpen(false)
      toast.success('Post created')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  const _handleReply = async (postId: string, replyContent: string) => {
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
    try {
      const { error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user.id,
          post_type: 'forum_reply',
          content: replyContent.trim(),
          reply_to_post_id: postId,
          metadata: { community: selectedCommunity || 'mai-troll' },
        })
      if (error) throw error
      toast.success('Reply posted')
      fetchPosts()
    } catch {
      toast.error('Failed to post reply')
    }
  }

  return (
    <div className="relative min-h-screen w-full pb-20 text-white">
      <PhoneDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-[#0a0420]/80 px-4 py-4 backdrop-blur border-[#BF00FF]/30">
        <button
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
        >
          <span className="text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">☰</span>
        </button>
        <h1 className={`text-xl font-black tracking-tight ${neonTextGradient}`}>
          Community Forum
        </h1>
        <div className="w-6" />
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Communities */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">
              Communities
            </h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCommunity(null)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                !selectedCommunity
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-slate-800/50 text-slate-300 border-slate-700'
              }`}
            >
              All
            </button>
            {COMMUNITIES.map((community) => {
              const Icon = community.icon
              return (
                <button
                  key={community.slug}
                  onClick={() => setSelectedCommunity(community.slug)}
                  className={`shrink-0 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    selectedCommunity === community.slug
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-800/50 text-slate-300 border-slate-700'
                  }`}
                >
                  <Icon size={13} />
                  {community.name}
                </button>
              )
            })}
          </div>
        </section>

        {/* Sort */}
        <div className="flex items-center justify-between px-1 mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Sort
          </span>
          <div className="flex gap-1">
            {['hot', 'new', 'top'].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s as 'hot' | 'new' | 'top')}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition ${
                  sortBy === s
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-1 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Create post */}
        {!user ? (
          <div className="px-1 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center mb-4">
            <p className="text-xs text-slate-400 mb-3">
              Sign in to create posts and join the conversation.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="text-xs font-bold text-purple-400 underline underline-offset-4"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="px-1 rounded-xl border border-slate-700 bg-slate-800/50 p-3 space-y-3 mb-4">
            <div className="flex gap-2">
              <select
                value={selectedCommunityForPost}
                onChange={(e) => setSelectedCommunityForPost(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 pl-3 pr-2 py-2 text-xs text-slate-300 focus:border-purple-500 focus:outline-none"
              >
                {COMMUNITIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 pl-3 pr-2 py-2 text-xs text-white placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                maxLength={200}
              />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to discuss?..."
              className="w-full min-h-[80px] rounded-xl border border-slate-700 bg-slate-800/50 p-2 text-xs text-white placeholder-zinc-600 focus:border-purple-500 focus:outline-none resize-none"
              maxLength={5000}
            />
            <button
              onClick={handleCreatePost}
              disabled={submitting || !title.trim() || !content.trim()}
              className="w-full rounded-lg py-2 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                submitting
                  ? 'bg-slate-700 text-slate-400'
                  : 'bg-purple-600 text-white hover:bg-purple-500'
              }"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
            <p className="text-[10px] text-slate-500">
              Posts are checked against community keywords before publishing.
            </p>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-3">
          {loading ? (
            <div className="px-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-gradient-to-r from-[#FF7A00]/5 to-[#A855F7]/5 animate-pulse" />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="px-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">No posts yet. Start a discussion.</p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <article
                key={post.id}
                className="rounded-xl border border-slate-800 bg-[#0b0614]/60 p-3 hover:border-purple-500/30 transition"
              >
                <div className="flex gap-2 mb-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-[10px] font-black text-white">
                    {(post.username || 'U')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30">
                        {post.community_name || post.community}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        • {timeAgo(post.created_at)}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1 leading-tight group-hover:text-purple-300 transition">
                      {post.title || 'Untitled'}
                    </h3>
                    <p className="text-[11px] text-slate-300 line-clamp-2 mb-2">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 text-[10px]">
                      <div
                        className="flex items-center gap-1 text-[#00BFFF]"
                        onClick={() => handleVote(post.id, 'up')}
                      >
                        <span className="font-black">{post.upvotes ?? post.likes ?? 0}</span>
                      </div>
                      <span className="text-slate-500">
                        {post.comment_count ?? 0} comments
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
