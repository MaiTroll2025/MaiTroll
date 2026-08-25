import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Camera,
  ChevronRight,
  Image as ImageIcon,
  Lock,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  RefreshCw,
  Zap,
  Eye,
  Heart,
  Send,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type PiksMode = 'feed' | 'camera' | 'story'
type StoryVisibility = 'public' | 'private'

interface PiksNotification {
  id: string
  username: string
  avatarUrl?: string | null
  type: 'story' | 'feed' | 'live' | 'private-story'
  message: string
  createdAt: string
  read?: boolean
}

interface PiksStory {
  id: string
  username: string
  avatarUrl?: string | null
  thumbnailUrl?: string | null
  visibility: StoryVisibility
  hasAccess?: boolean
  isOwn?: boolean
}

interface PiksFeedItem {
  id: string
  username: string
  avatarUrl?: string | null
  mediaUrl?: string | null
  caption?: string
  createdAt: string
  visibility: StoryVisibility
  isOwn?: boolean
}

interface PhoneMaiPiksProps {
  onBackToMaiTroll?: () => void
  notifications?: PiksNotification[]
  stories?: PiksStory[]
  feed?: PiksFeedItem[]
  screenshotsAllowed?: boolean

  onScreenshotDetected?: (payload: {
    contentType: 'story' | 'feed' | 'profile' | 'chat' | 'broadcast'
    contentId?: string
    ownerUserId?: string
  }) => void

  onCreatePik?: (payload: {
    mode: 'feed' | 'story'
    visibility: StoryVisibility
    mediaUrl?: string
    caption?: string
  }) => void

  hasPrivateStoryAccess?: (story: PiksStory) => boolean
}

export default function PhoneMaiPiks({
  onBackToMaiTroll,
  notifications = [],
  stories = [],
  feed = [],
  screenshotsAllowed = true,
  onScreenshotDetected,
  onCreatePik,
  hasPrivateStoryAccess,
}: PhoneMaiPiksProps) {
  const navigate = useNavigate()

  const [mode, setMode] = useState<PiksMode>('camera')
  const [showNotifications, setShowNotifications] = useState(false)
  const [selectedStory, setSelectedStory] = useState<PiksStory | null>(null)
  const [selectedFeedItem, setSelectedFeedItem] =
    useState<PiksFeedItem | null>(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const [facingMode, setFacingMode] =
    useState<'user' | 'environment'>('user')

  const [mediaStream, setMediaStream] =
    useState<MediaStream | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read,
  ).length

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                             */
  /* ---------------------------------------------------------------------- */

  const stopCamera = () => {
    if (!mediaStream) return

    mediaStream.getTracks().forEach((track) => track.stop())
    setMediaStream(null)
  }

  const handleBack = () => {
    stopCamera()

    if (onBackToMaiTroll) {
      onBackToMaiTroll()
      return
    }

    navigate('/phone')
  }

  const openFeed = () => {
    stopCamera()
    setCameraReady(false)
    setMode('feed')
  }

  const openCamera = () => {
    setMode('camera')
  }

  const openStory = () => {
    stopCamera()
    setCameraReady(false)
    setMode('story')
  }

  /* ---------------------------------------------------------------------- */
  /* Camera                                                                 */
  /* ---------------------------------------------------------------------- */

  const startCamera = async () => {
    try {
      setCameraError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Camera access is not available on this device.',
        )
        return
      }

      stopCamera()

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
          },
          audio: false,
        })

      setMediaStream(stream)
      setCameraReady(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (error) {
      console.error('MAI Piks camera error:', error)

      setCameraReady(false)

      setCameraError(
        'Camera permission is required to use MAI Piks.',
      )
    }
  }

  const flipCamera = () => {
    setFacingMode((current) =>
      current === 'user' ? 'environment' : 'user',
    )
  }

  useEffect(() => {
    if (mode !== 'camera') {
      stopCamera()
      setCameraReady(false)
      return
    }

    startCamera()

    return () => {
      stopCamera()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, facingMode])

  /* ---------------------------------------------------------------------- */
  /* Screenshot lifecycle                                                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (screenshotsAllowed) return

    const handleVisibilityChange = () => {
      /*
       * Actual screenshot prevention/detection belongs to the
       * native Android/iOS layer.
       */
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [screenshotsAllowed])

  /* ---------------------------------------------------------------------- */
  /* Capture                                                                */
  /* ---------------------------------------------------------------------- */

  const capturePhoto = async () => {
    const video = videoRef.current

    if (!video || !cameraReady) return

    const canvas = document.createElement('canvas')

    canvas.width = video.videoWidth || 1080
    canvas.height = video.videoHeight || 1920

    const context = canvas.getContext('2d')

    if (!context) return

    if (facingMode === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    const mediaUrl = canvas.toDataURL(
      'image/jpeg',
      0.92,
    )

    onCreatePik?.({
      mode: 'story',
      visibility: 'public',
      mediaUrl,
    })
  }

  /* ---------------------------------------------------------------------- */
  /* Private stories                                                        */
  /* ---------------------------------------------------------------------- */

  const canViewStory = (story: PiksStory) => {
    if (story.isOwn) return true

    if (story.visibility === 'public') {
      return true
    }

    if (story.hasAccess !== undefined) {
      return story.hasAccess
    }

    if (hasPrivateStoryAccess) {
      return hasPrivateStoryAccess(story)
    }

    return false
  }

  const openStoryViewer = (story: PiksStory) => {
    if (!canViewStory(story)) {
      return
    }

    setSelectedStory(story)
  }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#03030a] text-white">

      {/* ------------------------------------------------------------------ */}
      {/* GLOBAL NEON ATMOSPHERE                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#00BFFF]/10 blur-[110px]" />
        <div className="absolute -right-32 top-32 h-96 w-96 rounded-full bg-[#BF00FF]/10 blur-[120px]" />

        <div className="absolute left-1/2 top-[35%] h-72 w-72 -translate-x-1/2 rounded-full bg-[#1E90FF]/5 blur-[100px]" />

        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rotate-12 bg-gradient-to-br from-[#00BFFF]/5 via-transparent to-[#BF00FF]/5 blur-3xl" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <header className="relative z-40 flex h-[62px] shrink-0 items-center border-b border-[#00BFFF]/15 bg-[#03030a]/85 px-3 backdrop-blur-2xl">

        <button
          type="button"
          onClick={handleBack}
          className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 transition active:scale-95"
        >
          <ArrowLeft
            size={17}
            className="text-[#00BFFF] transition group-hover:text-white"
          />

          <span className="text-xs font-black">
            MAI Troll
          </span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles
              size={13}
              className="text-[#BF00FF] drop-shadow-[0_0_7px_#BF00FF]"
            />

            <h1 className="bg-gradient-to-r from-[#00BFFF] via-white to-[#BF00FF] bg-clip-text text-base font-black tracking-tight text-transparent">
              MAI Piks
            </h1>
          </div>

          <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.25em] text-zinc-600">
            Capture • Share • Connect
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/5 text-[#00BFFF]"
          >
            <Bell size={17} />

            {unreadNotifications > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#BF00FF] px-1 text-[8px] font-black text-white shadow-[0_0_10px_#BF00FF]">
                {unreadNotifications > 9
                  ? '9+'
                  : unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setShowNotifications((value) => !value)
            }
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 text-[#BF00FF]"
          >
            <Zap size={16} />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* NOTIFICATION TICKER                                                */}
      {/* ------------------------------------------------------------------ */}

      {notifications.length > 0 && (
        <div className="relative z-30 shrink-0 border-b border-white/5 bg-[#05050d]/90">
          <div className="flex h-9 items-center gap-2 overflow-x-auto px-3 scrollbar-none">

            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#00BFFF]/20 bg-[#00BFFF]/5 px-2.5 py-1">
              <Radio
                size={11}
                className="text-[#00BFFF]"
              />

              <span className="text-[8px] font-black uppercase tracking-wider text-[#00BFFF]">
                Piks
              </span>
            </div>

            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.035] px-2.5 py-1"
              >
                <span className="text-[9px] font-black text-[#BF00FF]">
                  @{notification.username}
                </span>

                <span className="text-[9px] text-zinc-500">
                  {notification.message}
                </span>

                {!notification.read && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00BFFF] shadow-[0_0_7px_#00BFFF]" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* NOTIFICATION PANEL                                                 */}
      {/* ------------------------------------------------------------------ */}

      {showNotifications && (
        <div className="absolute right-3 top-[70px] z-[100] w-[calc(100%-1.5rem)] max-w-[380px] overflow-hidden rounded-3xl border border-[#00BFFF]/20 bg-[#05050d]/95 shadow-[0_0_40px_rgba(0,191,255,0.12)] backdrop-blur-2xl">

          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#00BFFF]">
                MAI Piks
              </p>

              <h3 className="mt-1 text-sm font-black">
                Notifications
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowNotifications(false)}
              className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.035]"
            >
              <X size={15} />
            </button>
          </div>

          <div className="max-h-[55vh] overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex gap-3 border-b border-white/5 px-4 py-3"
              >
                <Avatar
                  src={notification.avatarUrl}
                  purple
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black">
                    @{notification.username}
                  </p>

                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {notification.message}
                  </p>

                  <p className="mt-1 text-[8px] text-zinc-700">
                    {notification.createdAt}
                  </p>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Bell
                  size={24}
                  className="mx-auto text-zinc-700"
                />

                <p className="mt-3 text-xs font-bold text-zinc-500">
                  No notifications
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MAIN CONTENT                                                       */}
      {/* ------------------------------------------------------------------ */}

      <main className="relative z-10 min-h-0 flex-1">

        {/* ================================================================ */}
        {/* CAMERA                                                           */}
        {/* ================================================================ */}

        {mode === 'camera' && (
          <div className="absolute inset-0 overflow-hidden bg-black">

            {cameraReady ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-cover ${
                  facingMode === 'user'
                    ? '-scale-x-100'
                    : ''
                }`}
              />
            ) : (
              <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,191,255,.12),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(191,0,255,.12),transparent_35%)]" />

                <div className="relative">
                  <div className="absolute -inset-6 rounded-full bg-[#00BFFF]/10 blur-2xl" />

                  <div className="relative grid h-24 w-24 place-items-center rounded-full border border-[#00BFFF]/30 bg-gradient-to-br from-[#00BFFF]/15 to-[#BF00FF]/15 shadow-[0_0_35px_rgba(0,191,255,0.15)]">
                    <Camera
                      size={34}
                      className="text-[#00BFFF] drop-shadow-[0_0_10px_#00BFFF]"
                    />
                  </div>
                </div>

                <h2 className="relative mt-7 text-2xl font-black">
                  Capture the moment.
                </h2>

                <p className="relative mt-2 max-w-[290px] text-xs leading-relaxed text-zinc-500">
                  {cameraError ||
                    'MAI Piks puts your camera first. Capture something worth sharing.'}
                </p>

                <button
                  type="button"
                  onClick={startCamera}
                  className="relative mt-6 flex items-center gap-2 rounded-2xl border border-[#00BFFF]/40 bg-gradient-to-r from-[#00BFFF]/20 to-[#BF00FF]/20 px-6 py-3.5 text-xs font-black shadow-[0_0_25px_rgba(0,191,255,0.12)]"
                >
                  <Camera size={16} />
                  Enable Camera
                </button>
              </div>
            )}

            {/* Camera atmospheric overlay */}
            {cameraReady && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />

                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent" />
              </>
            )}

            {/* Camera top UI */}
            <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">

              <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-xl">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />

                  <span className="text-[8px] font-black uppercase tracking-[0.18em]">
                    MAI Piks Camera
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={flipCamera}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/40 backdrop-blur-xl transition active:scale-90"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {/* Camera bottom */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center px-5 pb-8 pt-24">

              <button
                type="button"
                onClick={capturePhoto}
                className="group relative grid h-24 w-24 place-items-center rounded-full border-[5px] border-white bg-black/20 shadow-[0_0_40px_rgba(0,191,255,0.2)] transition active:scale-90"
              >
                <span className="absolute -inset-3 rounded-full border border-[#00BFFF]/20 opacity-0 transition group-hover:opacity-100" />

                <div className="h-[68px] w-[68px] rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] p-[3px] shadow-[0_0_30px_rgba(0,191,255,0.45)]">
                  <div className="h-full w-full rounded-full bg-white" />
                </div>
              </button>

              <p className="mt-4 text-[9px] font-black uppercase tracking-[0.25em] text-white/50">
                Tap to capture
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-xl">
                <Sparkles
                  size={11}
                  className="text-[#BF00FF]"
                />

                <span className="text-[8px] font-bold text-zinc-500">
                  Share your moment with MaiTroll
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* FEED                                                             */}
        {/* ================================================================ */}

        {mode === 'feed' && (
          <div className="absolute inset-0 overflow-y-auto">

            <div className="px-4 pb-8 pt-5">

              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />

                    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#00BFFF]">
                      MAI Piks
                    </p>
                  </div>

                  <h1 className="mt-1 text-2xl font-black">
                    Your Feed
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={openCamera}
                  className="flex items-center gap-2 rounded-xl border border-[#00BFFF]/25 bg-[#00BFFF]/10 px-3 py-2 text-[10px] font-black text-[#00BFFF]"
                >
                  <Camera size={14} />
                  Create
                </button>
              </div>

              {/* Feed stories rail */}
              <div className="mb-5 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={openCamera}
                  className="relative flex min-w-[72px] flex-col items-center gap-1.5"
                >
                  <div className="relative grid h-[68px] w-[68px] place-items-center rounded-2xl border border-dashed border-[#00BFFF]/40 bg-gradient-to-br from-[#00BFFF]/10 to-[#BF00FF]/10">
                    <Plus
                      size={22}
                      className="text-[#00BFFF]"
                    />
                  </div>

                  <span className="text-[8px] font-black">
                    Add Piks
                  </span>
                </button>

                {stories.slice(0, 8).map((story) => (
                  <StoryAvatar
                    key={story.id}
                    story={story}
                    onClick={() =>
                      openStoryViewer(story)
                    }
                  />
                ))}
              </div>

              <div className="space-y-5">
                {feed.map((item) => (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.02] shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
                    onClick={() => {
                      if (!screenshotsAllowed) {
                        onScreenshotDetected?.({
                          contentType: 'feed',
                          contentId: item.id,
                        })
                      }

                      setSelectedFeedItem(item)
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">

                      <Avatar
                        src={item.avatarUrl}
                        blue
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black">
                          @{item.username}
                        </p>

                        <p className="mt-0.5 text-[8px] text-zinc-600">
                          {item.createdAt}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.035]"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="relative">
                      {item.mediaUrl ? (
                        <img
                          src={item.mediaUrl}
                          alt=""
                          className="max-h-[65vh] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-[#00BFFF]/10 via-[#090913] to-[#BF00FF]/10">
                          <ImageIcon
                            size={40}
                            className="text-white/10"
                          />
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>

                    <div className="px-4 py-3">

                      <div className="mb-2 flex items-center gap-4">
                        <Heart
                          size={17}
                          className="text-[#BF00FF]"
                        />

                        <Send
                          size={17}
                          className="text-[#00BFFF]"
                        />

                        <Eye
                          size={17}
                          className="ml-auto text-zinc-600"
                        />
                      </div>

                      {item.caption && (
                        <p className="text-xs leading-relaxed text-zinc-300">
                          {item.caption}
                        </p>
                      )}
                    </div>

                    {!screenshotsAllowed && (
                      <div className="flex items-center gap-2 border-t border-[#00BFFF]/10 bg-[#00BFFF]/5 px-4 py-2.5 text-[8px] font-black uppercase tracking-wider text-[#00BFFF]">
                        <ShieldCheck size={12} />
                        Protected Piks
                      </div>
                    )}
                  </article>
                ))}

                {feed.length === 0 && (
                  <EmptyState
                    icon={ImageIcon}
                    title="Your feed is waiting"
                    description="Follow people on MaiTroll and their MAI Piks will appear here."
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STORIES                                                          */}
        {/* ================================================================ */}

        {mode === 'story' && (
          <div className="absolute inset-0 overflow-y-auto">

            <div className="px-4 pb-8 pt-5">

              <div className="mb-6 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#BF00FF] shadow-[0_0_8px_#BF00FF]" />

                    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#BF00FF]">
                      MAI Piks
                    </p>
                  </div>

                  <h1 className="mt-1 text-2xl font-black">
                    Stories
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={openCamera}
                  className="flex items-center gap-2 rounded-xl border border-[#BF00FF]/30 bg-[#BF00FF]/10 px-3 py-2 text-[10px] font-black text-[#BF00FF]"
                >
                  <Plus size={14} />
                  Story
                </button>
              </div>

              {/* Story carousel */}
              <div className="mb-7 flex gap-4 overflow-x-auto pb-2 scrollbar-none">

                <button
                  type="button"
                  onClick={openCamera}
                  className="flex min-w-[72px] shrink-0 flex-col items-center gap-2"
                >
                  <div className="relative h-[70px] w-[70px] rounded-2xl border border-dashed border-[#00BFFF]/40 bg-gradient-to-br from-[#00BFFF]/10 to-[#BF00FF]/10">
                    <div className="absolute inset-1 flex items-center justify-center rounded-[13px] bg-[#05050d]">
                      <Plus
                        size={22}
                        className="text-[#00BFFF]"
                      />
                    </div>
                  </div>

                  <span className="text-[8px] font-black">
                    Your Story
                  </span>
                </button>

                {stories.map((story) => (
                  <StoryAvatar
                    key={story.id}
                    story={story}
                    onClick={() =>
                      openStoryViewer(story)
                    }
                    square
                  />
                ))}
              </div>

              {/* Stories list */}
              <div className="space-y-3">

                {stories.map((story) => {
                  const hasAccess =
                    canViewStory(story)

                  return (
                    <button
                      type="button"
                      key={`list-${story.id}`}
                      onClick={() =>
                        openStoryViewer(story)
                      }
                      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.045] to-white/[0.02] p-3 text-left transition active:scale-[0.99]"
                    >
                      <div
                        className={`h-12 w-12 rounded-2xl p-[2px] ${
                          story.visibility === 'private'
                            ? 'bg-gradient-to-br from-[#BF00FF] to-[#9B30FF]'
                            : 'bg-gradient-to-br from-[#00BFFF] to-[#BF00FF]'
                        }`}
                      >
                        <div className="h-full w-full overflow-hidden rounded-[13px] bg-[#05050d]">
                          {story.thumbnailUrl ? (
                            <img
                              src={story.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <User
                                size={18}
                                className="text-zinc-600"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black">
                          @{story.username}
                        </p>

                        <p className="mt-1 text-[9px] text-zinc-600">
                          {story.visibility === 'private'
                            ? hasAccess
                              ? 'Private • Access granted'
                              : 'Private • Subscription required'
                            : 'Public story'}
                        </p>
                      </div>

                      {story.visibility === 'private' ? (
                        <Lock
                          size={15}
                          className={
                            hasAccess
                              ? 'text-[#00BFFF]'
                              : 'text-[#BF00FF]'
                          }
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          className="text-zinc-700"
                        />
                      )}
                    </button>
                  )
                })}

                {stories.length === 0 && (
                  <EmptyState
                    icon={Users}
                    title="No stories yet"
                    description="Stories from people you follow will appear here."
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* FLOATING NAVIGATION                                                */}
      {/* ------------------------------------------------------------------ */}

      <nav className="relative z-40 shrink-0 border-t border-[#00BFFF]/10 bg-[#03030a]/90 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-2xl">
<div className="mx-auto grid h-[68px] max-w-md grid-cols-3 gap-2 rounded-3xl border border-transparent bg-transparent p-1.5 shadow-none">
          <PiksNavButton
            icon={<ImageIcon size={19} />}
            label="Feed"
            active={mode === 'feed'}
            onClick={openFeed}
            color="blue"
          />

          <PiksCameraNav
            active={mode === 'camera'}
            onClick={openCamera}
          />

          <PiksNavButton
            icon={<Radio size={19} />}
            label="Stories"
            active={mode === 'story'}
            onClick={openStory}
            color="purple"
          />
        </div>
      </nav>

      {/*  */}
‎  
      {selectedStory && (
        <div className="fixed inset-0 z-[200] bg-black">

          <div className="absolute left-0 right-0 top-0 z-20 h-28 bg-gradient-to-b from-black/80 to-transparent" />

          <div className="absolute left-4 right-4 top-4 z-30 flex items-center justify-between">

            <div className="flex items-center gap-2">
              <Avatar
                src={selectedStory.avatarUrl}
                purple
              />

              <div>
                <p className="text-xs font-black">
                  @{selectedStory.username}
                </p>

                <p className="text-[8px] text-zinc-500">
                  MAI Piks Story
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedStory(null)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/50 backdrop-blur-xl"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex h-full items-center justify-center">
            {selectedStory.thumbnailUrl ? (
              <img
                src={selectedStory.thumbnailUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center">
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF]">
                  <User size={38} />
                </div>

                <p className="mt-4 text-sm font-black">
                  @{selectedStory.username}
                </p>
              </div>
            )}
          </div>

          <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#00BFFF]/20 bg-black/70 px-4 py-2 backdrop-blur-xl">

            {screenshotsAllowed ? (
              <>
                <Sparkles
                  size={12}
                  className="text-[#BF00FF]"
                />

                <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">
                  MAI Piks
                </span>
              </>
            ) : (
              <>
                <ShieldCheck
                  size={12}
                  className="text-[#00BFFF]"
                />

                <span className="text-[8px] font-black uppercase tracking-wider text-[#00BFFF]">
                  Protected Piks
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FEED VIEWER                                                        */}
      {/* ------------------------------------------------------------------ */}

      {selectedFeedItem && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">

          <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#03030a]/90 px-4 py-3 backdrop-blur-xl">

            <div className="flex items-center gap-2">
              <Avatar
                src={selectedFeedItem.avatarUrl}
                blue
              />

              <div>
                <p className="text-xs font-black">
                  @{selectedFeedItem.username}
                </p>

                <p className="text-[8px] text-zinc-600">
                  {selectedFeedItem.createdAt}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedFeedItem(null)
              }
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035]"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-[#00BFFF]/5 via-black to-[#BF00FF]/5">
            {selectedFeedItem.mediaUrl ? (
              <img
                src={selectedFeedItem.mediaUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImageIcon
                size={50}
                className="text-white/10"
              />
            )}
          </div>

          <div className="shrink-0 border-t border-white/5 bg-[#03030a]/95 px-4 py-4">

            <div className="mb-3 flex items-center gap-4">
              <button className="text-[#BF00FF]">
                <Heart size={19} />
              </button>

              <button className="text-[#00BFFF]">
                <Send size={19} />
              </button>

              <button className="ml-auto text-zinc-600">
                <Eye size={19} />
              </button>
            </div>

            {selectedFeedItem.caption && (
              <p className="text-xs leading-relaxed text-zinc-300">
                {selectedFeedItem.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* AVATAR                                                                    */
/* ========================================================================= */

function Avatar({
  src,
  purple = false,
  blue = false,
}: {
  src?: string | null
  purple?: boolean
  blue?: boolean
}) {
  return (
    <div
      className={`h-10 w-10 shrink-0 rounded-xl p-[2px] ${
        purple
          ? 'bg-gradient-to-br from-[#BF00FF] to-[#9B30FF]'
          : blue
            ? 'bg-gradient-to-br from-[#00BFFF] to-[#1E90FF]'
            : 'bg-gradient-to-br from-[#00BFFF] to-[#BF00FF]'
      }`}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#05050d]">
        {src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <User
            size={16}
            className="text-zinc-600"
          />
        )}
      </div>
    </div>
  )
}

/* ========================================================================= */
/* STORY AVATAR                                                              */
/* ========================================================================= */

function StoryAvatar({
  story,
  onClick,
  square = false,
}: {
  story: PiksStory
  onClick: () => void
  square?: boolean
}) {
  const isPrivate =
    story.visibility === 'private'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[72px] shrink-0 flex-col items-center gap-1.5"
    >
      <div
        className={`relative ${
          square
            ? 'h-[70px] w-[70px] rounded-2xl'
            : 'h-[68px] w-[68px] rounded-2xl'
        } ${
          isPrivate
            ? 'bg-gradient-to-br from-[#BF00FF] via-[#9B30FF] to-[#00BFFF]'
            : 'bg-gradient-to-br from-[#00BFFF] via-[#1E90FF] to-[#BF00FF]'
        } p-[2px] shadow-[0_0_18px_rgba(0,191,255,0.15)]`}
      >
        <div className="h-full w-full overflow-hidden rounded-[13px] bg-[#05050d]">
          {story.thumbnailUrl ? (
            <img
              src={story.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <User
                size={20}
                className="text-zinc-600"
              />
            </div>
          )}
        </div>

        {isPrivate && (
          <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-[#03030a] bg-[#BF00FF] shadow-[0_0_10px_#BF00FF]">
            <Lock size={9} />
          </div>
        )}
      </div>

      <span className="max-w-[72px] truncate text-[8px] font-black text-zinc-400">
        {story.isOwn ? 'Your Story' : story.username}
      </span>
    </button>
  )
}

/* ========================================================================= */
/* NAVIGATION                                                                */
/* ========================================================================= */

function PiksNavButton({
  icon,
  label,
  active,
  onClick,
  color,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  color: 'blue' | 'purple'
}) {
  const isBlue = color === 'blue'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
        active
          ? isBlue
            ? 'border border-[#00BFFF]/25 bg-[#00BFFF]/10 text-[#00BFFF]'
            : 'border border-[#BF00FF]/25 bg-[#BF00FF]/10 text-[#BF00FF]'
          : 'border border-transparent text-zinc-600'
      }`}
    >
      {active && (
        <span
          className={`absolute bottom-0 h-[2px] w-8 rounded-full ${
            isBlue
              ? 'bg-[#00BFFF] shadow-[0_0_10px_#00BFFF]'
              : 'bg-[#BF00FF] shadow-[0_0_10px_#BF00FF]'
          }`}
        />
      )}

      <span
        className={
          active
            ? isBlue
              ? 'drop-shadow-[0_0_7px_#00BFFF]'
              : 'drop-shadow-[0_0_7px_#BF00FF]'
            : ''
        }
      >
        {icon}
      </span>

      <span
        className={`text-[8px] font-black uppercase tracking-wider ${
          active ? 'text-white' : 'text-zinc-600'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

/* ========================================================================= */
/* CAMERA NAV                                                               */
/* ========================================================================= */

function PiksCameraNav({
  active,
  onClick,
}: {
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-0.5"
    >
      <div
        className={`relative grid h-12 w-12 place-items-center rounded-full p-[2px] transition ${
          active
            ? 'bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_25px_rgba(0,191,255,0.35)]'
            : 'bg-white/10'
        }`}
      >
        <div
          className={`grid h-full w-full place-items-center rounded-full ${
            active
              ? 'bg-[#05050d] text-white'
              : 'bg-[#111118] text-zinc-500'
          }`}
        >
          <Camera size={20} />
        </div>
      </div>

      <span
        className={`text-[8px] font-black uppercase tracking-wider ${
          active ? 'text-[#00BFFF]' : 'text-zinc-600'
        }`}
      >
        Camera
      </span>
    </button>
  )
}

/* ========================================================================= */
/* EMPTY STATE                                                              */
/* ========================================================================= */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#00BFFF]/5 via-white/[0.02] to-[#BF00FF]/5 px-6 py-14 text-center">
      <div className="absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 rounded-full bg-[#00BFFF]/10 blur-3xl" />

      <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/5">
        <Icon
          size={25}
          className="text-[#00BFFF]"
        />
      </div>

      <h3 className="relative mt-5 text-sm font-black">
        {title}
      </h3>

      <p className="relative mx-auto mt-2 max-w-[260px] text-[10px] leading-relaxed text-zinc-600">
        {description}
      </p>
    </div>
  )
}