import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpDown,
  Image,
  MessageCircle,
  Plus,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Video,
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
  user_created_at?: string
  community?: string
  community_name?: string
  post_type: string
  title?: string
  content: string
  metadata: Record<string, any>
  likes: number
  created_at: string
  reply_to_post_id?: string | null
  user_liked?: boolean
  user_disliked?: boolean
  replies?: ForumPost[]
  upvotes?: number
  downvotes?: number
  comment_count?: number
}

interface Community {
  slug: string
  name: string
  description: string
  member_count: number
  icon: React.ElementType
}

const COMMUNITIES: Community[] = [
  {
    slug: 'gaming',
    name: 'Gaming',
    description: 'Gaming streams, battles, and HytroGaming talk.',
    member_count: 12400,
    icon: Video,
  },
  {
    slug: 'broadcasting',
    name: 'Broadcasting',
    description: 'Live streaming tips, setups, and broadcaster talk.',
    member_count: 9800,
    icon: Sparkles,
  },
  {
    slug: 'battles',
    name: 'Battles',
    description: 'Battle results, matchups, and competition talk.',
    member_count: 8600,
    icon: TrendingUp,
  },
  {
    slug: 'entertainment',
    name: 'Entertainment',
    description: 'Movies, music, TV, and pop culture.',
    member_count: 15200,
    icon: Image,
  },
  {
    slug: 'local-cities',
    name: 'Local Cities',
    description: 'Meetups, events, and city-specific discussion.',
    member_count: 7300,
    icon: User,
  },
  {
    slug: 'mai-troll',
    name: 'Mai Troll',
    description: 'Official announcements and platform discussion.',
    member_count: 21000,
    icon: Shield,
  },
]

const FORUM_KEYWORDS = [
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

export default function ForumPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [posts, setPosts] = useState<ForumPost[]>([])
  const [communities, _setCommunities] = useState<Community[]>(COMMUNITIES)
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top'>('hot')
  const [searchQuery, setSearchQuery] = useState('')
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [selectedCommunityForPost, setSelectedCommunityForPost] = useState<string>('mai-troll')
  const [submitting, setSubmitting] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

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
        // hot: simple blend of score and recency
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
        user_created_at: row.user_created_at,
        community: row.metadata?.community || 'mai-troll',
        community_name: row.metadata?.community_name || 'Mai Troll',
        post_type: row.post_type || 'forum',
        title: row.metadata?.title || row.content.slice(0, 60),
        content: row.content,
        metadata: row.metadata || {},
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
      console.error('[ForumPage] Failed to fetch posts:', err)
      toast.error('Failed to load forum posts')
    }
  }, [selectedCommunity])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const _handleVote = async (postId: string, type: 'up' | 'down') => {
    if (!user?.id) {
      navigate('/auth')
      return
    }
    // Optimistic update
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
        .insert({
          post_id: postId,
          user_id: user.id,
          like_type: type,
        })
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

    // Keyword moderation check on title + content before posting
    const fullText = `${title}\n${content}`
    const moderation = await checkModeration(fullText, 'forum_post')
    if (!moderation.allowed) {
      toast.error(moderation.message || 'Post contains prohibited content')
      return
    }

    setSubmitting(true)
    try {
      const community = communities.find((c) => c.slug === selectedCommunityForPost)
      const { data, error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user.id,
          post_type: 'forum',
          title: title.trim(),
          content: content.trim(),
          metadata: {
            community: selectedCommunityForPost,
            community_name: community?.name || selectedCommunityForPost,
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
        user_created_at: profile?.created_at,
        community: selectedCommunityForPost,
        community_name: community?.name || selectedCommunityForPost,
        post_type: 'forum',
        title: title.trim(),
        content: content.trim(),
        metadata: data.metadata || {},
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
      const { data: _data, error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user.id,
          post_type: 'forum_reply',
          content: replyContent.trim(),
          reply_to_post_id: postId,
          metadata: { community: selectedCommunity || 'mai-troll' },
        })
        .select('*')
        .single()
      if (error) throw error
      toast.success('Reply posted')
      fetchPosts()
    } catch {
      toast.error('Failed to post reply')
    }
  }

  const _containsKeyword = (text: string): boolean => {
    const lower = text.toLowerCase()
    return FORUM_KEYWORDS.some((k) => lower.includes(k))
  }

  return (
    <SEOLayout
      title="Mai Troll Community Forum"
      description="Join the Mai Troll community forum. Discuss gaming, broadcasting, battles, entertainment, and local cities with other users."
      keywords={[
        'Mai Troll forum',
        'Mai Troll community',
        'gaming forum',
        'broadcasting forum',
        'Mai Troll discussions',
        'community forum',
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Community Forum' }]} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 mb-3">
              <MessageCircle className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 font-medium text-sm uppercase tracking-wider">
                Community Forum
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Mai Troll Forum</h1>
            <p className="text-slate-400">
              Discuss gaming, broadcasting, battles, entertainment, and your city
              with the Mai Troll community.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search forums & posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 w-64 sm:w-80"
            />
            <Link
              to="/auth"
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all"
            >
              Create Post
            </Link>
          </div>
        </header>

        {/* Communities */}
        <section className="mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCommunity(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                !selectedCommunity
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Communities
            </button>
            {communities.map((community) => {
              const Icon = community.icon
              return (
                <button
                  key={community.slug}
                  onClick={() => setSelectedCommunity(community.slug)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedCommunity === community.slug
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon size={14} />
                  {community.name}
                </button>
              )
            })}
          </div>
        </section>

        {/* Sort */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Sort by
          </div>
          <div className="flex gap-2">
            {['hot', 'new', 'top'].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s as 'hot' | 'new' | 'top')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  sortBy === s
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Create Post (inline, public-facing) */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">Start a Discussion</h3>
          </div>

          {!user ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center">
              <p className="text-slate-400 text-sm mb-3">
                Sign in to create posts and join the conversation.
              </p>
              <Link
                to="/auth"
                className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <select
                  value={selectedCommunityForPost}
                  onChange={(e) => setSelectedCommunityForPost(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-purple-500 focus:outline-none"
                >
                  {communities.map((c) => (
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
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  maxLength={200}
                />
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you want to discuss?..."
                className="w-full min-h-[120px] rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none"
                maxLength={5000}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleCreatePost}
                  disabled={submitting || !title.trim() || !content.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    submitting
                      ? 'bg-slate-700 text-slate-400'
                      : 'bg-purple-600 text-white hover:bg-purple-500'
                  }"
                >
                  {submitting ? 'Posting...' : 'Post'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Posts are checked against community keywords before publishing.
              </p>
            </div>
          )}
        </section>

        {/* Posts */}
        <div className="space-y-3" ref={scrollRef}>
          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-1">No posts yet</h3>
              <p className="text-slate-400 text-sm">
                Be the first to start a discussion in{' '}
                {selectedCommunity ? selectedCommunity : 'the community'}.
              </p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <article
                key={post.id}
                className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-purple-500/30 transition"
              >
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-xs font-bold text-white">
                    {(post.username || 'U')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30">
                        {post.community_name || post.community}
                      </span>
                      <span className="text-[11px] text-slate-500">• {post.user_liked ? 'You' : post.username || 'User'}</span>
                      <span className="text-[11px] text-slate-500 ml-auto">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1 leading-snug group-hover:text-purple-300 transition">
                      {post.title || 'Untitled'}
                    </h3>
                    <p className="text-sm text-slate-300 line-clamp-2 mb-3">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5 text-[#00BFFF]">
                        <ArrowUpDown className="w-4 h-4" />
                        <span className="font-bold">
                          {post.upvotes ?? post.likes ?? 0}
                        </span>
                      </div>
                      <span className="text-slate-500">
                        {post.comment_count ?? 0} comments
                      </span>
                      <Link
                        to={`/community/post/${post.id}`}
                        className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                      >
                        View discussion
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </SEOLayout>
  )
}
