import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  ChevronRight,
  Coins,
  Eye,
  Flame,
  Gift,
  Heart,
  History,
  Home,
  MessageCircle,
  MoreHorizontal,
  Play,
  Radio,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Upload,
  User,
  Users,
} from 'lucide-react'
import {
  TreelzVideoPlayer,
  TreelzActions,
  CommentSheet,
  TipModal,
  ShareModal,
  MoreModal,
} from '@/components/treelz/TreelzVideoPlayer'
import {
  fetchTreelzFeed,
  fetchTrendingTreelz,
  recordTreelzView,
  loadTreelzSettings,
  fetchTreelzProfile,
  reportTreelzPost,
  downloadTreelzVideo,
} from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import type { TreelzFeedCursor, TreelzPost } from '@/types/treelz'

const CATEGORIES = [
  { key: 'discover', label: 'Discover', icon: Sparkles },
  { key: 'trending', label: 'Trending', icon: Flame },
  { key: 'most-trolled', label: 'Most Trolled', icon: TrendingUp },
  { key: 'most-gifted', label: 'Most Gifted', icon: Gift },
  { key: 'following', label: 'Following', icon: Users },
]

const TOPICS = [
  { label: '#Mai Troll', posts: '12.4K posts' },
  { label: '#TreelzChallenge', posts: '8.7K posts' },
  { label: '#FunnyAF', posts: '6.2K posts' },
  { label: '#DanceVibes', posts: '5.1K posts' },
  { label: '#GiftKings', posts: '3.9K posts' },
]

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

export default function TreelzPage() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialPostId = searchParams.get('post')

  const [posts, setPosts] = useState<TreelzPost[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<TreelzFeedCursor | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('discover')
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  const [showComments, setShowComments] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const [settings] = useState(loadTreelzSettings())

  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({})

  const preloadPreviousRef = useRef<HTMLVideoElement>(null)
  const preloadNextRef = useRef<HTMLVideoElement>(null)

  const currentPost = posts[currentIndex]
  const previousPost = currentIndex > 0 ? posts[currentIndex - 1] : null
  const nextPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null

  const upNext = useMemo(
    () => posts.slice(currentIndex + 1, currentIndex + 7),
    [posts, currentIndex],
  )

  const loadFeed = useCallback(
    async (category?: string, profileId?: string | null) => {
      setLoading(true)

      try {
        const selectedCategory = category || activeCategory
        let result: {
          posts: TreelzPost[]
          nextCursor: TreelzFeedCursor | null
        }

        if (profileId) {
          const profilePosts = await fetchTreelzProfile(
            user?.id || null,
            profileId,
          )
          result = { posts: profilePosts, nextCursor: null }
        } else if (selectedCategory === 'trending') {
          const trendingPosts = await fetchTrendingTreelz(30)
          result = { posts: trendingPosts, nextCursor: null }
        } else {
          result = await fetchTreelzFeed(user?.id || null, null)
        }

        setPosts(result.posts)
        setNextCursor(result.nextCursor)

        const requestedIndex = initialPostId
          ? result.posts.findIndex((post) => post.id === initialPostId)
          : -1

        setCurrentIndex(requestedIndex >= 0 ? requestedIndex : 0)
      } catch (error) {
        console.error('Failed to load Treelz feed:', error)
        toast.error('Unable to load Treelz right now')
      } finally {
        setLoading(false)
      }
    },
    [activeCategory, initialPostId, user?.id],
  )

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return

    try {
      const result = await fetchTreelzFeed(user?.id || null, nextCursor)
      setPosts((previous) => [...previous, ...result.posts])
      setNextCursor(result.nextCursor)
    } catch (error) {
      console.error('Failed to load more Treelz:', error)
    }
  }, [loading, nextCursor, user?.id])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  useEffect(() => {
    if (previousPost && preloadPreviousRef.current) {
      preloadPreviousRef.current.src = previousPost.video_url
      preloadPreviousRef.current.load()
    }
  }, [previousPost?.video_url])

  useEffect(() => {
    if (nextPost && preloadNextRef.current) {
      preloadNextRef.current.src = nextPost.video_url
      preloadNextRef.current.load()
    }
  }, [nextPost?.video_url])

  const switchCategory = useCallback(
    (category: string) => {
      setActiveCategory(category)
      setProfileUserId(null)
      setCurrentIndex(0)
      setSearchParams({})
      loadFeed(category)
    },
    [loadFeed, setSearchParams],
  )

  const openPost = useCallback(
    (postId: string) => {
      const index = posts.findIndex((post) => post.id === postId)
      if (index < 0) return

      setCurrentIndex(index)
      setSearchParams({ post: postId })
    },
    [posts, setSearchParams],
  )

  const goNext = useCallback(() => {
    if (currentIndex >= posts.length - 1) return

    setCurrentIndex((index) => index + 1)

    if (currentIndex >= posts.length - 3) {
      loadMore()
    }
  }, [currentIndex, loadMore, posts.length])

  const goPrevious = useCallback(() => {
    if (currentIndex <= 0) return
    setCurrentIndex((index) => index - 1)
  }, [currentIndex])

  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goPrevious()
      if (event.key === 'ArrowRight') goNext()
    }

    window.addEventListener('keydown', handleKeyboardNavigation)
    return () => window.removeEventListener('keydown', handleKeyboardNavigation)
  }, [goNext, goPrevious])

  const handleView = useCallback(
    (postId: string, watchSeconds: number, completed: boolean) => {
      recordTreelzView(postId, watchSeconds, completed).catch(() => {})
    },
    [],
  )

  const openCreatorProfile = useCallback(async () => {
    if (!currentPost?.author) return

    try {
      const creatorPosts = await fetchTreelzProfile(
        user?.id || null,
        currentPost.author.id,
      )

      setProfileUserId(currentPost.author.id)
      setPosts(creatorPosts)
      setNextCursor(null)
      setCurrentIndex(0)
    } catch {
      toast.error('Unable to load this creator')
    }
  }, [currentPost?.author, user?.id])

  const handleFollowAuthor = useCallback(async (authorId: string) => {
    if (!user) {
      toast.error('Please sign in to follow users')
      return
    }

    const currentlyFollowing = !!followedAuthors[authorId]

    try {
      if (currentlyFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', authorId)
        if (error) throw error
        setFollowedAuthors((prev) => ({ ...prev, [authorId]: false }))
        toast.success('Unfollowed')
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: authorId })
        if (error) throw error
        setFollowedAuthors((prev) => ({ ...prev, [authorId]: true }))
        toast.success('Following')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update follow')
    }
  }, [user, followedAuthors])

  useEffect(() => {
    if (!currentPost?.author?.id || !user?.id) return

    let cancelled = false

    const checkFollow = async () => {
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', currentPost.author!.id)
        .maybeSingle()

      if (!cancelled) {
        setFollowedAuthors((prev) => ({
          ...prev,
          [currentPost.author!.id]: !!data,
        }))
      }
    }

    checkFollow()
    return () => { cancelled = true }
  }, [currentPost?.author?.id, user?.id])

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#03050b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(168,85,247,0.12),transparent_28%),radial-gradient(circle_at_85%_45%,rgba(34,211,238,0.06),transparent_24%)]" />

      <Header user={user} />

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <DesktopSidebar
          activeCategory={activeCategory}
          profileUserId={profileUserId}
          onCategoryChange={switchCategory}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MobileCategoryBar
            activeCategory={activeCategory}
            profileUserId={profileUserId}
            onCategoryChange={switchCategory}
          />

          <CategoryPills />

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <section className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden px-2 py-2 sm:px-4 lg:px-5">
              <Link
                to="/"
                aria-label="Back to home"
                className="absolute left-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-xl transition hover:border-purple-400/40 hover:bg-purple-500/15"
              >
                <ArrowLeft size={17} />
              </Link>

              {loading ? (
                <LoadingState />
              ) : posts.length === 0 ? (
                <EmptyState
                  userSignedIn={Boolean(user)}
                  profileMode={Boolean(profileUserId)}
                  onCategoryChange={switchCategory}
                />
              ) : (
                <div className="flex h-full w-full max-w-[1120px] items-center justify-center gap-3">
                  <NavigationButton
                    direction="previous"
                    disabled={currentIndex === 0}
                    onClick={goPrevious}
                  />

                  <div className="relative h-full min-h-0 w-full max-w-[760px] overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_25px_100px_rgba(0,0,0,0.55)]">
                    {currentPost && (
                      <TreelzVideoPlayer
                        post={currentPost}
                        isActive
                        autoPlay={settings.autoPlayEnabled}
                        onView={(seconds, completed) =>
                          handleView(currentPost.id, seconds, completed)
                        }
                      />
                    )}

                    <video
                      ref={preloadPreviousRef}
                      className="hidden"
                      muted
                      playsInline
                      preload="auto"
                    />
                    <video
                      ref={preloadNextRef}
                      className="hidden"
                      muted
                      playsInline
                      preload="auto"
                    />

                    {currentPost && (
                      <>
                        <CreatorOverlay
                          post={currentPost}
                          onCreatorClick={openCreatorProfile}
                          onMore={() => setShowMore(true)}
                        />

                        <CaptionOverlay post={currentPost} />

                        <div className="absolute bottom-4 right-3 z-20 sm:right-4">
                          <TreelzActions
                            post={currentPost}
                            onCommentClick={() => setShowComments(true)}
                            onShare={() => setShowShare(true)}
                            onTip={() => setShowTip(true)}
                            onMore={() => setShowMore(true)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <NavigationButton
                    direction="next"
                    disabled={currentIndex >= posts.length - 1}
                    onClick={goNext}
                  />
                </div>
              )}
            </section>

            <DesktopRightPanel
              currentPost={currentPost}
              posts={upNext}
              onOpenPost={openPost}
              onOpenComments={() => setShowComments(true)}
              onCreatorClick={openCreatorProfile}
            />
          </div>

          {!loading && posts.length > 0 && (
            <div className="hidden shrink-0 border-t border-white/5 bg-[#050711]/90 px-5 py-3 lg:block">
              <div className="mx-auto flex max-w-[1120px] items-center justify-between">
                <button
                  onClick={goPrevious}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowLeft size={16} />
                  Previous
                </button>

                <p className="text-xs font-bold text-slate-500">
                  {currentIndex + 1} / {posts.length}
                </p>

                <button
                  onClick={goNext}
                  disabled={currentIndex >= posts.length - 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {currentPost && (
        <>
          <CommentSheet
            post={currentPost}
            isOpen={showComments}
            onClose={() => setShowComments(false)}
          />

          <TipModal
            post={currentPost}
            isOpen={showTip}
            onClose={() => setShowTip(false)}
          />

          <ShareModal
            post={currentPost}
            isOpen={showShare}
            onClose={() => setShowShare(false)}
          />

          <MoreModal
            post={currentPost}
            isOpen={showMore}
            onClose={() => setShowMore(false)}
            onReport={() => {
              if (!user) {
                toast.info('Sign in to report')
                return
              }

              reportTreelzPost(
                user.id,
                currentPost.id,
                'reported_from_treelz',
              )
                .then(() => toast.success('Report submitted'))
                .catch(() => toast.error('Failed to report'))
            }}
            onDownload={() => {
              if (!user) {
                toast.info('Sign in to download')
                return
              }

              downloadTreelzVideo(
                user.id,
                currentPost.id,
                currentPost.video_url,
              )
                .then(() => toast.success('Download started! (-10 coins)'))
                .catch((error: any) =>
                  toast.error(error?.message || 'Download failed'),
                )
            }}
          />
        </>
      )}
    </div>
  )
}

function Header({ user }: { user: any }) {
  return (
    <header className="relative z-30 flex h-[72px] shrink-0 items-center gap-4 border-b border-white/10 bg-[#03050b]/95 px-4 backdrop-blur-2xl lg:px-6">
      <Link to="/" className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <Sparkles className="h-7 w-7 text-fuchsia-400 drop-shadow-[0_0_12px_rgba(232,121,249,0.85)]" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.9)]" />
        </div>

        <div className="leading-none">
          <p className="text-xl font-black italic tracking-tight text-white">
            TREELZ
          </p>
          <p className="mt-1 text-[8px] font-black uppercase tracking-[0.18em] text-lime-400">
            by Mai Troll
          </p>
        </div>
      </Link>

      <div className="mx-auto hidden w-full max-w-md md:block">
        <Link
          to="/treelz/search"
          className="flex h-11 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm text-slate-500 transition hover:border-purple-400/30 hover:bg-white/[0.055]"
        >
          <span>Search Treelz...</span>
          <Search size={18} className="text-slate-300" />
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/treelz/search"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 md:hidden"
        >
          <Search size={17} />
        </Link>

        {user ? (
          <>
            <Link
              to="/treelz/upload"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 text-sm font-black text-purple-100 shadow-[0_0_24px_rgba(147,51,234,0.18)] transition hover:bg-purple-500/20"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload</span>
            </Link>

            <button className="relative hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 transition hover:bg-white/[0.07] sm:flex">
              <Bell size={17} />
            </button>

            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 lg:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-xs font-black">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-xs font-black text-white">
                  {user.user_metadata?.username || 'Creator'}
                </p>
                <p className="text-[9px] text-slate-500">Treelz Citizen</p>
              </div>
            </div>
          </>
        ) : (
          <Link
            to="/auth"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08]"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}

function DesktopSidebar({
  activeCategory,
  profileUserId,
  onCategoryChange,
}: {
  activeCategory: string
  profileUserId: string | null
  onCategoryChange: (category: string) => void
}) {
  return (
    <aside className="hidden w-[246px] shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#04060d]/96 p-4 xl:flex">
      <nav className="space-y-1">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const active = activeCategory === key && !profileUserId

          return (
            <button
              key={key}
              onClick={() => onCategoryChange(key)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${
                active
                  ? 'border-purple-500/50 bg-purple-500/10 text-white shadow-[0_0_20px_rgba(147,51,234,0.12)]'
                  : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon
                size={18}
                className={active ? 'text-fuchsia-300' : 'text-slate-500'}
              />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="my-4 border-t border-white/10" />

      <nav className="space-y-1">
        <SidebarLink icon={User} label="My Profile" to="/profile" />
        <SidebarLink icon={Heart} label="My Likes" to="/treelz/likes" />
        <SidebarLink icon={Bookmark} label="My Bookmarks" to="/treelz/bookmarks" />
        <SidebarLink icon={History} label="History" to="/treelz/history" />
      </nav>

      <div className="mt-4 rounded-2xl border border-purple-500/30 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_58%),rgba(255,255,255,0.025)] p-4 text-center">
        <p className="text-xs font-bold text-white">Go LIVE on</p>
        <p className="mt-1 text-xl font-black italic text-lime-400">
          Mai Troll
        </p>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Start your broadcast and grow your city.
        </p>
        <Link
          to="/broadcast"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/40 bg-purple-500/15 px-3 py-2 text-xs font-black text-purple-100 transition hover:bg-purple-500/25"
        >
          <Radio size={14} />
          GO LIVE
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={15} className="text-orange-400" />
            <p className="text-xs font-black text-white">TRENDING NOW</p>
          </div>
          <span className="text-[9px] font-bold text-purple-400">View all</span>
        </div>

        <div className="space-y-3">
          {TOPICS.map((topic) => (
            <button key={topic.label} className="block w-full text-left">
              <p className="text-xs font-bold text-slate-200">{topic.label}</p>
              <p className="mt-0.5 text-[9px] text-slate-600">{topic.posts}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-5">
        <p className="text-[10px] text-slate-600">© 2026 Mai Troll</p>
        <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
          <Link to="/legal/safety">Safety</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({
  icon: Icon,
  label,
  to,
}: {
  icon: React.ElementType
  label: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
    >
      <Icon size={18} className="text-slate-500" />
      {label}
    </Link>
  )
}

function MobileCategoryBar({
  activeCategory,
  profileUserId,
  onCategoryChange,
}: {
  activeCategory: string
  profileUserId: string | null
  onCategoryChange: (category: string) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-[#050711] px-3 py-2 scrollbar-hide xl:hidden">
      {CATEGORIES.map(({ key, label, icon: Icon }) => {
        const active = activeCategory === key && !profileUserId

        return (
          <button
            key={key}
            onClick={() => onCategoryChange(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              active
                ? 'border-purple-400/40 bg-purple-500/15 text-white'
                : 'border-white/5 bg-white/[0.025] text-slate-500'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function CategoryPills() {
  const pills = ['For You', 'Gaming', 'Music', 'Comedy', 'Lifestyle', 'Sports', 'Animals', 'Art']

  return (
    <div className="hidden shrink-0 items-center gap-2 overflow-x-auto border-b border-white/5 bg-[#050711] px-5 py-3 scrollbar-hide md:flex">
      {pills.map((pill, index) => (
        <button
          key={pill}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
            index === 0
              ? 'border-purple-400/40 bg-purple-500/20 text-white'
              : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          {pill}
        </button>
      ))}
    </div>
  )
}

function CreatorOverlay({
  post,
  onCreatorClick,
  onMore,
  onFollow,
  isFollowing,
}: {
  post: TreelzPost
  onCreatorClick: () => void
  onMore: () => void
  onFollow?: (authorId: string) => void
  isFollowing?: boolean
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/75 via-black/25 to-transparent p-4">
      <button
        onClick={onCreatorClick}
        className="flex items-center gap-3 text-left"
      >
        {post.author?.avatar_url ? (
          <img
            src={post.author.avatar_url}
            alt=""
            className="h-11 w-11 rounded-full object-cover ring-2 ring-fuchsia-400"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-sm font-black ring-2 ring-fuchsia-400">
            {post.author?.username?.charAt(0).toUpperCase() || '?'}
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-white">
              {post.author?.username || 'unknown'}
            </p>
            <span className="rounded-full bg-purple-500 px-1.5 py-0.5 text-[8px] font-black">
              CREATOR
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-white/65">
            {post.author?.display_name || 'Treelz creator'}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-2">
        <button className="rounded-xl border border-purple-400/50 bg-purple-500/15 px-4 py-2 text-xs font-black text-white backdrop-blur-md transition hover:bg-purple-500/25">
          Follow
        </button>
        <button
          onClick={onMore}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white backdrop-blur-md"
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
    </div>
  )
}

function CaptionOverlay({ post }: { post: TreelzPost }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/55 to-transparent px-5 pb-6 pt-28 pr-24">
      <p className="max-w-xl text-sm font-semibold leading-6 text-white sm:text-base">
        {post.caption || 'Watch this Treelz video'}
      </p>

      <p className="mt-2 text-sm font-bold text-fuchsia-300">
        #Mai Troll #Treelz #NewVibes
      </p>

      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-md">
        <Play size={13} />
        Original Sound
      </div>
    </div>
  )
}

function NavigationButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 'previous' ? ArrowLeft : ArrowRight

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'previous' ? 'Previous video' : 'Next video'}
      className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:border-purple-400/30 hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-20 lg:flex"
    >
      <Icon size={19} />
    </button>
  )
}

function DesktopRightPanel({
  currentPost,
  posts,
  onOpenPost,
  onOpenComments,
  onCreatorClick,
}: {
  currentPost?: TreelzPost
  posts: TreelzPost[]
  onOpenPost: (postId: string) => void
  onOpenComments: () => void
  onCreatorClick: () => void
}) {
  return (
    <aside className="hidden w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#050711]/95 2xl:flex">
      <div className="border-b border-white/10 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-white">Video Details</h2>
          <button
            onClick={onOpenComments}
            className="inline-flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-black text-purple-100"
          >
            <MessageCircle size={14} />
            Comments
          </button>
        </div>

        {currentPost && (
          <>
            <button
              onClick={onCreatorClick}
              className="flex items-center gap-3 text-left"
            >
              {currentPost.author?.avatar_url ? (
                <img
                  src={currentPost.author.avatar_url}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-cyan-400/30"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-sm font-black">
                  {currentPost.author?.username?.charAt(0).toUpperCase() || '?'}
                </div>
              )}

              <div>
                <p className="text-sm font-black text-white">
                  @{currentPost.author?.username || 'unknown'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {currentPost.author?.display_name || 'Treelz creator'}
                </p>
              </div>
            </button>

            <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">
              {currentPost.caption || 'No caption'}
            </p>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <Metric icon={Eye} value={currentPost.views_count || 0} />
              <Metric icon={Heart} value={currentPost.likes_count || 0} />
              <Metric
                icon={MessageCircle}
                value={currentPost.comments_count || 0}
              />
              <Metric icon={Gift} value={currentPost.gifts_received || 0} />
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Up Next
          </h3>
          <ChevronRight size={14} className="text-slate-600" />
        </div>

        <div className="space-y-3">
          {posts.length > 0 ? (
            posts.map((post) => (
              <button
                key={post.id}
                onClick={() => onOpenPost(post.id)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-2.5 text-left transition hover:border-purple-400/30 hover:bg-purple-500/[0.06]"
              >
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-black">
                  {post.thumbnail_url ? (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Play size={16} className="text-white/30" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-bold leading-5 text-white/85">
                    {post.caption || 'Untitled Treelz'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    @{post.author?.username || 'unknown'}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[9px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <Eye size={10} />
                      {formatCount(post.views_count || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={10} />
                      {formatCount(post.likes_count || 0)}
                    </span>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-xs text-slate-500">No more videos yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 p-5">
        <button
          onClick={onOpenComments}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-400 transition hover:border-purple-400/30 hover:bg-purple-500/[0.06]"
        >
          <span>Add or view comments...</span>
          <MessageCircle size={17} />
        </button>
      </div>
    </aside>
  )
}

function Metric({
  icon: Icon,
  value,
}: {
  icon: React.ElementType
  value: number
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center">
      <Icon size={13} className="mx-auto text-purple-300" />
      <p className="mt-1 text-[10px] font-black text-white">
        {formatCount(value)}
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex h-full w-full max-w-[760px] flex-col items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.025]">
      <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
      <div className="mt-5 h-4 w-36 animate-pulse rounded-full bg-white/10" />
      <div className="mt-3 h-3 w-24 animate-pulse rounded-full bg-white/5" />
    </div>
  )
}

function EmptyState({
  userSignedIn,
  profileMode,
  onCategoryChange,
}: {
  userSignedIn: boolean
  profileMode: boolean
  onCategoryChange: (category: string) => void
}) {
  return (
    <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/[0.025] p-8 text-center shadow-2xl">
      <Sparkles className="mx-auto h-12 w-12 text-fuchsia-400" />

      <h2 className="mt-4 text-xl font-black text-white">
        {profileMode ? 'No Treelz Yet' : 'Explore Treelz'}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        {profileMode
          ? "This creator hasn't uploaded any Treelz yet."
          : 'Watch, troll, gift, comment, and share short videos from across Mai Troll.'}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {CATEGORIES.filter((category) => category.key !== 'following').map(
          ({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onCategoryChange(key)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-purple-400/30 hover:bg-purple-500/[0.06]"
            >
              <Icon size={18} className="text-fuchsia-300" />
              <span className="text-sm font-black text-white">{label}</span>
            </button>
          ),
        )}
      </div>

      <Link
        to={userSignedIn ? '/treelz/upload' : '/auth'}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-3 text-sm font-black text-white shadow-[0_0_28px_rgba(168,85,247,0.25)]"
      >
        <Upload size={16} />
        {userSignedIn ? 'Upload Your First Treelz' : 'Sign In to Upload'}
      </Link>
    </div>
  )
}