import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Settings, Sparkles, MessageCircle } from 'lucide-react'
import { useSwipeable } from 'react-swipeable'
import { TreelzVideoPlayer, TreelzActions, CommentSheet, TipModal, ShareModal, MoreModal } from '@/components/treelz/TreelzVideoPlayer'
import { fetchTreelzFeed, recordTreelzView, loadTreelzSettings, reportTreelzPost, downloadTreelzVideo } from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import type { TreelzPost, TreelzFeedCursor } from '@/types/treelz'

export default function MobileTreelzPage() {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState<TreelzPost[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<TreelzFeedCursor | null>(null)
  const [loading, setLoading] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [settings, setSettings] = useState(loadTreelzSettings())
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchTreelzFeed(user?.id || null, null)
      setPosts(result.posts)
      setNextCursor(result.nextCursor)
    } catch { /* ignore */ }
    setLoading(false)
  }, [user?.id])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return
    try {
      const result = await fetchTreelzFeed(user?.id || null, nextCursor)
      setPosts((prev) => [...prev, ...result.posts])
      setNextCursor(result.nextCursor)
    } catch { /* ignore */ }
  }, [nextCursor, loading, user?.id])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  const goNext = useCallback(() => {
    if (currentIndex < posts.length - 1) {
      setDirection('left')
      setCurrentIndex((i) => i + 1)
      if (currentIndex >= posts.length - 3) loadMore()
    }
  }, [currentIndex, posts.length, loadMore])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection('right')
      setCurrentIndex((i) => i - 1)
    }
  }, [currentIndex])

  const handleSwipe = useCallback((dir: 'left' | 'right') => {
    if (dir === 'left') goNext()
    else goPrev()
  }, [goNext, goPrev])

  const handleView = useCallback((postId: string, watchSeconds: number, completed: boolean) => {
    recordTreelzView(postId, watchSeconds, completed).catch(() => {})
    if (settings.autoPlayNext && completed && currentIndex < posts.length - 1) {
      setTimeout(() => goNext(), 500)
    }
  }, [settings.autoPlayNext, currentIndex, posts.length, goNext])

  const currentPost = posts[currentIndex]
  const prevPost = currentIndex > 0 ? posts[currentIndex - 1] : null
  const nextPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null
  const preloadRef1 = useRef<HTMLVideoElement>(null)
  const preloadRef2 = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (prevPost && preloadRef1.current) {
      preloadRef1.current.src = prevPost.video_url
      preloadRef1.current.load()
    }
  }, [prevPost?.video_url])

  useEffect(() => {
    if (nextPost && preloadRef2.current) {
      preloadRef2.current.src = nextPost.video_url
      preloadRef2.current.load()
    }
  }, [nextPost?.video_url])

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    preventScrollOnSwipe: false,
    trackMouse: false,
  })

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 animate-pulse text-cyan-400" />
          <span className="text-xs font-bold text-slate-400">Loading Treelz...</span>
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black px-6">
        <Sparkles className="mb-4 h-12 w-12 text-cyan-400" />
        <h2 className="mb-2 text-xl font-black text-white">Explore Treelz</h2>
        <p className="mb-6 text-center text-sm text-slate-400">Watch, troll, and share short videos from the community.</p>
        {user ? (
          <Link
            to="/treelz/upload"
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-sm font-black text-white"
          >
            Upload Your First Treelz
          </Link>
        ) : (
          <Link
            to="/auth"
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-sm font-black text-white"
          >
            Sign In to Upload
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-y-auto overflow-x-hidden md:overflow-hidden bg-black">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-sm font-black text-white">Treelz</h1>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/treelz/upload" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
              <Upload size={16} />
            </Link>
          ) : (
            <Link to="/auth" className="flex h-7 items-center rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 px-2.5 text-[10px] font-black text-white">
              Sign In
            </Link>
          )}
          <Link to="/treelz/settings" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
            <Settings size={16} />
          </Link>
        </div>
      </div>

      {/* Video feed */}
      <div {...swipeHandlers} className="h-full w-full">
        <div className="relative h-full w-full">
          {currentPost && (
            <TreelzVideoPlayer
              post={currentPost}
              isActive={true}
              autoPlay={settings.autoPlayEnabled}
              onView={(sec, completed) => handleView(currentPost.id, sec, completed)}
            />
          )}
          <video ref={preloadRef1} className="hidden" muted playsInline preload="auto" />
          <video ref={preloadRef2} className="hidden" muted playsInline preload="auto" />
        </div>
      </div>

      {/* Actions overlay */}
      {currentPost && (
        <>
          {/* Left side: Chat button */}
          <div className="absolute left-2 top-1/2 z-20 -translate-y-1/2">
            <button
              onClick={() => setShowComments(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
            >
              <MessageCircle size={18} />
            </button>
          </div>

          <TreelzActions
            post={currentPost}
            onCommentClick={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            onTip={() => setShowTip(true)}
            onMore={() => setShowMore(true)}
          />
        </>
      )}

      {/* Post counter */}
      <div className="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white/60 backdrop-blur-sm">
        {currentIndex + 1} / {posts.length}
      </div>

      {/* Navigation hints */}
      {currentIndex === 0 && (
        <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 animate-bounce rounded-full bg-black/40 px-3 py-1 text-[10px] font-bold text-white/60 backdrop-blur-sm">
          ← Swipe to browse →
        </div>
      )}

      {/* Modals */}
      {currentPost && (
        <>
          <CommentSheet post={currentPost} isOpen={showComments} onClose={() => setShowComments(false)} />
          <TipModal post={currentPost} isOpen={showTip} onClose={() => setShowTip(false)} />
          <ShareModal post={currentPost} isOpen={showShare} onClose={() => setShowShare(false)} />
          <MoreModal
            post={currentPost}
            isOpen={showMore}
            onClose={() => setShowMore(false)}
            onReport={() => {
              if (!user) { toast.info('Sign in to report'); return }
              reportTreelzPost(user.id, currentPost.id, 'reported_from_treelz')
                .then(() => toast.success('Report submitted'))
                .catch(() => toast.error('Failed to report'))
            }}
            onDownload={() => {
              if (!user) { toast.info('Sign in to download'); return }
              downloadTreelzVideo(user.id, currentPost.id, currentPost.video_url)
                .then(() => toast.success('Download started! (-10 coins)'))
                .catch((err: any) => toast.error(err?.message || 'Download failed'))
            }}
          />
        </>
      )}
    </div>
  )
}
