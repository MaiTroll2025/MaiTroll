import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Trash2,
  User,
  Users,
  Video,
  X,
  RefreshCw,
  Zap,
  Eye,
  Heart,
  Send,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { createNotification } from '../../lib/notifications'
import StoryViewer from '../components/MaiPiksStoryViewer'
import {
  ExpiryCountdown,
  formatRecordClock,
  HOLD_TO_RECORD_MS,
  MAX_VIDEO_MS,
  type PiksStory,
  type PiksStoryItem,
  type StoryVisibility,
} from '../components/maiPiksShared'

type PiksMode = 'feed' | 'camera' | 'story'

interface PiksNotification {
  id: string
  username: string
  avatarUrl?: string | null
  type: 'story' | 'feed' | 'live' | 'private-story'
  message: string
  createdAt: string
  read?: boolean
}

interface PiksFeedItem {
  id: string
  userId: string
  username: string
  avatarUrl?: string | null
  mediaUrl?: string | null
  mediaType?: 'photo' | 'video'
  caption?: string
  createdAt: string
  visibility: StoryVisibility
  isOwn?: boolean
}

interface CurrentUser {
  id: string
  username: string
  avatarUrl?: string | null
  screenshotsAllowed: boolean
  trollCoins: number
}

export default function PhoneMaiPiks() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<PiksMode>('camera')
  const [showNotifications, setShowNotifications] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [selectedFeedItem, setSelectedFeedItem] = useState<PiksFeedItem | null>(null)

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [notifications, setNotifications] = useState<PiksNotification[]>([])
  const [stories, setStories] = useState<PiksStory[]>([])
  const [feed, setFeed] = useState<PiksFeedItem[]>([])
  const [loading, setLoading] = useState(true)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordMs, setRecordMs] = useState(0)
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<BlobPart[]>([])
  const holdTimerRef = useRef<number | null>(null)
  const recordTickRef = useRef<number | null>(null)
  const recordStopTimerRef = useRef<number | null>(null)
  const recordStartedAtRef = useRef<number>(0)
  const didRecordRef = useRef(false)

  /* ---------------------------------------------------------------------- */
  /* Current user & profile                                                 */
  /* ---------------------------------------------------------------------- */

  const fetchCurrentUser = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) return null

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url, screenshots_allowed, troll_coins')
      .eq('id', authData.user.id)
      .single()

    if (!profile) return null

    return {
      id: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      screenshotsAllowed: profile.screenshots_allowed ?? true,
      trollCoins: Number(profile.troll_coins ?? 0),
    }
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!currentUser) return

    const { data } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', currentUser.id)
      .maybeSingle()

    if (data) {
      setCurrentUser((prev) => (prev ? { ...prev, trollCoins: Number(data.troll_coins ?? 0) } : prev))
    }
  }, [currentUser])

  /* ---------------------------------------------------------------------- */
  /* Feed                                                                   */
  /* ---------------------------------------------------------------------- */

  const fetchFeed = useCallback(async (userId: string) => {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)

    const followingIds = (follows || []).map((f) => f.following_id)
    const viewerIds = [userId, ...followingIds]

    const { data } = await supabase
      .from('maipiks_posts')
      .select('id, user_id, media_url, media_type, caption, visibility, created_at, deleted_at')
      .in('user_id', viewerIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) return []

    const postUserIds = [...new Set(data.map((p) => p.user_id))]
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', postUserIds)

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    return data.map((post) => {
      const profile = profileMap.get(post.user_id)
      return {
        id: post.id,
        userId: post.user_id,
        username: profile?.username || 'user',
        avatarUrl: profile?.avatar_url,
        mediaUrl: post.media_url,
        mediaType: post.media_type,
        caption: post.caption,
        createdAt: post.created_at,
        visibility: post.visibility,
        isOwn: post.user_id === userId,
      }
    })
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Stories                                                                */
  /* ---------------------------------------------------------------------- */

  const fetchStories = useCallback(async (userId: string): Promise<PiksStory[]> => {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)

    const followingIds = (follows || []).map((f) => f.following_id)
    const viewerIds = [userId, ...followingIds]
    const nowIso = new Date().toISOString()

    const { data: storyRows } = await supabase
      .from('maipiks_stories')
      .select('id, user_id, visibility, expires_at, deleted_at, created_at, tips_received_coins')
      .in('user_id', viewerIds)
      .is('deleted_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })

    if (!storyRows || storyRows.length === 0) return []

    const storyIds = storyRows.map((s) => s.id)

    const { data: itemRows } = await supabase
      .from('maipiks_story_items')
      .select('id, story_id, media_url, media_type, thumbnail_url, caption, duration_ms, sort_order, created_at, expires_at')
      .in('story_id', storyIds)
      .is('deleted_at', null)
      .gt('expires_at', nowIso)
      .order('sort_order', { ascending: true })

    const storyUserIds = [...new Set(storyRows.map((s) => s.user_id))]
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', storyUserIds)

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
    const storyOwner = new Map(storyRows.map((s) => [s.id, s]))

    /* Everything a single user posted in the last 24h is one continuous story. */
    const grouped = new Map<string, PiksStory>()

    ;(itemRows || []).forEach((item) => {
      const story = storyOwner.get(item.story_id)
      if (!story) return

      const profile = profileMap.get(story.user_id)

      const piksItem: PiksStoryItem = {
        id: item.id,
        storyId: item.story_id,
        mediaUrl: item.media_url,
        mediaType: (item.media_type === 'video' ? 'video' : 'photo') as 'photo' | 'video',
        thumbnailUrl: item.thumbnail_url,
        caption: item.caption,
        durationMs: item.duration_ms,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
      }

      const existing = grouped.get(story.user_id)

      if (existing) {
        existing.items.push(piksItem)
        if (!existing.storyIds.includes(item.story_id)) existing.storyIds.push(item.story_id)
        if (!existing.expiresAt || item.expires_at > existing.expiresAt) existing.expiresAt = item.expires_at
        return
      }

      grouped.set(story.user_id, {
        id: item.story_id,
        storyIds: [item.story_id],
        userId: story.user_id,
        username: profile?.username || 'user',
        avatarUrl: profile?.avatar_url,
        thumbnailUrl: piksItem.thumbnailUrl || piksItem.mediaUrl,
        visibility: story.visibility,
        isOwn: story.user_id === userId,
        expiresAt: item.expires_at,
        items: [piksItem],
        tipsReceived: Number(story.tips_received_coins ?? 0),
      })
    })

    const result = [...grouped.values()].map((story) => {
      const items = [...story.items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const first = items[0]
      return {
        ...story,
        items,
        /* The newest container wins, so new media keeps combining into it. */
        id: items[items.length - 1]?.storyId || story.id,
        thumbnailUrl: first?.thumbnailUrl || first?.mediaUrl || story.thumbnailUrl,
      }
    })

    /* Your own story first, then whoever posted most recently. */
    result.sort((a, b) => {
      if (a.isOwn && !b.isOwn) return -1
      if (!a.isOwn && b.isOwn) return 1
      const aLast = a.items[a.items.length - 1]?.createdAt || ''
      const bLast = b.items[b.items.length - 1]?.createdAt || ''
      return bLast.localeCompare(aLast)
    })

    return result
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Notifications                                                          */
  /* ---------------------------------------------------------------------- */

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, metadata, read, created_at')
      .eq('user_id', userId)
      .in('type', ['maipiks_new_post', 'maipiks_new_story', 'maipiks_screenshot', 'maipiks_story_tip'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (!data) return []

    const actorIds = [...new Set(data.map((n) => n.metadata?.actor_id).filter(Boolean))]
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', actorIds)

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    return data.map((n) => {
      const actor = profileMap.get(n.metadata?.actor_id)
      return {
        id: n.id,
        username: actor?.username || 'user',
        avatarUrl: actor?.avatar_url,
        type: n.type === 'maipiks_new_story' ? 'story' : n.type === 'maipiks_screenshot' ? 'private-story' : 'feed',
        message: n.message || '',
        createdAt: n.created_at,
        read: n.read,
      } as PiksNotification
    })
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Initial load                                                           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false

    async function load() {
      const user = await fetchCurrentUser()
      if (cancelled) return

      if (!user) {
        setLoading(false)
        return
      }

      setCurrentUser(user)

      const [feedData, storyData, notifData] = await Promise.all([
        fetchFeed(user.id),
        fetchStories(user.id),
        fetchNotifications(user.id),
      ])

      if (cancelled) return

      setFeed(feedData)
      setStories(storyData)
      setNotifications(notifData)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fetchCurrentUser, fetchFeed, fetchStories, fetchNotifications])

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
    navigate('/')
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
        setCameraError('Camera access is not available on this device.')
        return
      }

      stopCamera()

      /* Audio is requested so hold-to-record captures sound with the video. */
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        })
      }

      setMediaStream(stream)
      setCameraReady(true)
    } catch (error) {
      console.error('MAI Piks camera error:', error)
      setCameraReady(false)
      setCameraError('Camera permission is required to use MAI Piks.')
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !mediaStream || !cameraReady) return

    video.srcObject = mediaStream

    const playVideo = async () => {
      try {
        await video.play()
      } catch (error) {
        console.error('[MAIPiks] Video playback error:', error)
      }
    }

    playVideo()
  }, [mediaStream, cameraReady])

  const flipCamera = () => {
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'))
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
    if (!currentUser || currentUser.screenshotsAllowed) return

    const handleVisibilityChange = () => {
      /*
       * Actual screenshot prevention/detection belongs to the
       * native Android/iOS layer.
       */
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentUser])

  /* ---------------------------------------------------------------------- */
  /* Media upload                                                           */
  /* ---------------------------------------------------------------------- */

  /** Uploads any blob into the shared `maipiks` bucket and returns url + path. */
  const uploadBlob = async (
    blob: Blob,
    ext: string
  ): Promise<{ url: string; path: string } | null> => {
    if (!currentUser) return null

    try {
      setUploading(true)

      const path = `${currentUser.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('maipiks')
        .upload(path, blob, { upsert: true, contentType: blob.type || undefined })

      if (uploadError) {
        console.error('[MAIPiks] Upload failed:', uploadError)
        toast.error('Upload failed. Please try again.')
        return null
      }

      const { data: urlData } = supabase.storage.from('maipiks').getPublicUrl(path)
      return { url: urlData.publicUrl, path }
    } catch (err) {
      console.error('[MAIPiks] Upload error:', err)
      toast.error('Upload failed. Please try again.')
      return null
    } finally {
      setUploading(false)
    }
  }

  const uploadMedia = async (dataUrl: string): Promise<{ url: string; path: string } | null> => {
    try {
      const byteString = atob(dataUrl.split(',')[1])
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mimeString })
      const ext = mimeString.includes('jpeg') || mimeString.includes('jpg') ? 'jpg' : 'png'

      return await uploadBlob(blob, ext)
    } catch (err) {
      console.error('[MAIPiks] Upload error:', err)
      return null
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Create post / story                                                    */
  /* ---------------------------------------------------------------------- */

  const createPost = async (mediaUrl: string, caption: string, visibility: StoryVisibility) => {
    if (!currentUser) return

    const { error } = await supabase.from('maipiks_posts').insert({
      user_id: currentUser.id,
      media_url: mediaUrl,
      media_type: 'photo',
      caption,
      visibility,
    })

    if (error) {
      console.error('[MAIPiks] Create post failed:', error)
      return
    }

    const freshFeed = await fetchFeed(currentUser.id)
    setFeed(freshFeed)
  }

  /**
   * Adds media to the user's story. Anything captured inside the 24h window is
   * combined into the same story server-side by `maipiks_add_story_item`.
   */
  const addToStory = async (
    media: { url: string; path: string },
    mediaType: 'photo' | 'video',
    visibility: StoryVisibility,
    durationMs?: number
  ) => {
    if (!currentUser) return false

    const { data, error } = await supabase.rpc('maipiks_add_story_item', {
      p_media_url: media.url,
      p_media_type: mediaType,
      p_visibility: visibility,
      p_storage_path: media.path,
      p_thumbnail_url: null,
      p_caption: null,
      p_duration_ms: durationMs ?? null,
    })

    if (error) {
      console.error('[MAIPiks] Add story media failed:', error)
      toast.error(error.message || 'Could not add this to your story')
      return false
    }

    const combined = Boolean((data as any)?.combined)
    toast.success(
      combined
        ? mediaType === 'video'
          ? 'Video added to your story'
          : 'Photo added to your story'
        : 'Story started — it disappears in 24h'
    )

    const freshStories = await fetchStories(currentUser.id)
    setStories(freshStories)
    return true
  }

  /* ---------------------------------------------------------------------- */
  /* Capture — tap for a photo, hold for video                              */
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

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const media = await uploadMedia(dataUrl)

    if (!media) return

    const ok = await addToStory(media, 'photo', 'everyone')
    if (ok) setMode('story')
  }

  /** Picks a container the browser can actually record. */
  const pickRecorderMime = (): string | undefined => {
    if (typeof MediaRecorder === 'undefined') return undefined

    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]

    return candidates.find((type) => {
      try {
        return MediaRecorder.isTypeSupported(type)
      } catch {
        return false
      }
    })
  }

  const clearRecordTimers = () => {
    if (recordTickRef.current) {
      window.clearInterval(recordTickRef.current)
      recordTickRef.current = null
    }
    if (recordStopTimerRef.current) {
      window.clearTimeout(recordStopTimerRef.current)
      recordStopTimerRef.current = null
    }
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const beginRecording = () => {
    if (!mediaStream || !cameraReady || recording) return

    if (typeof MediaRecorder === 'undefined') {
      toast.error('Video recording is not supported on this device')
      return
    }

    const mimeType = pickRecorderMime()

    let recorder: MediaRecorder
    try {
      recorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream)
    } catch (err) {
      console.error('[MAIPiks] MediaRecorder failed to start:', err)
      toast.error('Video recording is not supported on this device')
      return
    }

    recordChunksRef.current = []
    didRecordRef.current = true
    recordStartedAtRef.current = Date.now()

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordChunksRef.current.push(event.data)
    }

    recorder.onstop = async () => {
      clearRecordTimers()
      setRecording(false)

      const elapsed = Date.now() - recordStartedAtRef.current
      setRecordMs(0)

      const chunks = recordChunksRef.current
      recordChunksRef.current = []
      recorderRef.current = null

      if (!chunks.length) return

      const type = recorder.mimeType || mimeType || 'video/webm'
      const blob = new Blob(chunks, { type })
      const ext = type.includes('mp4') ? 'mp4' : 'webm'

      const media = await uploadBlob(blob, ext)
      if (!media) return

      const ok = await addToStory(media, 'video', 'everyone', elapsed)
      if (ok) setMode('story')
    }

    recorder.start(250)
    recorderRef.current = recorder
    setRecording(true)
    setRecordMs(0)

    recordTickRef.current = window.setInterval(() => {
      setRecordMs(Date.now() - recordStartedAtRef.current)
    }, 100)

    /* Hard 3 minute cap. */
    recordStopTimerRef.current = window.setTimeout(() => {
      toast.info('3 minute limit reached')
      stopRecording()
    }, MAX_VIDEO_MS)
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (!recorder) return

    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch (err) {
      console.error('[MAIPiks] Failed to stop recorder:', err)
      clearRecordTimers()
      setRecording(false)
      recorderRef.current = null
    }
  }

  /** Press starts a hold timer: short press = photo, long press = video. */
  const handleShutterPressStart = () => {
    if (uploading || !cameraReady) return

    didRecordRef.current = false

    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)

    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null
      beginRecording()
    }, HOLD_TO_RECORD_MS)
  }

  const handleShutterPressEnd = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null

      /* Released before the hold threshold — take a photo instead. */
      if (!didRecordRef.current && !recording) {
        void capturePhoto()
      }
      return
    }

    if (recording) stopRecording()
  }

  /* Never leave a recorder or timer running behind us. */
  useEffect(() => {
    return () => {
      clearRecordTimers()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  /*
   * Safety net: if the pointer is released outside the shutter (dragged off with
   * a mouse, or the browser steals the gesture) the recording still stops.
   */
  useEffect(() => {
    if (!recording) return

    const handleRelease = () => stopRecording()

    window.addEventListener('pointerup', handleRelease)
    window.addEventListener('pointercancel', handleRelease)
    window.addEventListener('blur', handleRelease)

    return () => {
      window.removeEventListener('pointerup', handleRelease)
      window.removeEventListener('pointercancel', handleRelease)
      window.removeEventListener('blur', handleRelease)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  useEffect(() => {
    if (mode !== 'camera' && recording) stopRecording()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  /* ---------------------------------------------------------------------- */
  /* Screenshot notification                                                */
  /* ---------------------------------------------------------------------- */

  const handleScreenshotDetected = async (payload: {
    contentType: 'story' | 'feed' | 'profile' | 'chat' | 'broadcast'
    contentId?: string
    ownerUserId?: string
  }) => {
    if (!currentUser || !payload.ownerUserId || payload.ownerUserId === currentUser.id) return

    await createNotification(
      payload.ownerUserId,
      'maipiks_screenshot',
      'Screenshot Taken',
      `@${currentUser.username} took a screenshot of your MAIPiks ${payload.contentType}.`,
      {
        actor_id: currentUser.id,
        actor_username: currentUser.username,
        content_type: payload.contentType,
        content_id: payload.contentId,
      }
    )
  }

  /* ---------------------------------------------------------------------- */
  /* Private stories                                                        */
  /* ---------------------------------------------------------------------- */

  const canViewStory = (story: PiksStory) => {
    if (story.isOwn) return true
    if (story.visibility === 'everyone' || story.visibility === 'followers') return true
    if (story.hasAccess !== undefined) return story.hasAccess
    return false
  }

  /** Only stories the viewer is allowed to open take part in left/right scrolling. */
  const viewableStories = useMemo(
    () => stories.filter((story) => canViewStory(story) && story.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories]
  )

  const openStoryViewer = (story: PiksStory) => {
    if (!canViewStory(story)) {
      toast.error('This story is private')
      return
    }

    if (story.items.length === 0) {
      toast.info('This story has no media left')
      return
    }

    const index = viewableStories.findIndex((s) => s.userId === story.userId)
    setViewerIndex(index >= 0 ? index : 0)
  }

  const closeStoryViewer = () => setViewerIndex(null)

  /* ---------------------------------------------------------------------- */
  /* Delete own story                                                       */
  /* ---------------------------------------------------------------------- */

  /** Hard deletes one piece of media out of the caller's own story. */
  const deleteStoryItem = async (item: PiksStoryItem) => {
    if (!currentUser) return false

    setDeletingStoryId(item.id)

    const { error } = await supabase.rpc('maipiks_delete_story_item', { p_item_id: item.id })

    setDeletingStoryId(null)

    if (error) {
      console.error('[MAIPiks] Delete story media failed:', error)
      toast.error(error.message || 'Could not delete that')
      return false
    }

    toast.success('Deleted from your story')

    const fresh = await fetchStories(currentUser.id)
    setStories(fresh)
    return true
  }

  /** Hard deletes an entire story the caller owns. */
  const deleteWholeStory = async (story: PiksStory) => {
    if (!currentUser || !story.isOwn) return

    if (!window.confirm('Delete your whole story? This cannot be undone.')) return

    setDeletingStoryId(story.id)

    for (const storyId of story.storyIds) {
      const { error } = await supabase.rpc('maipiks_delete_story', { p_story_id: storyId })
      if (error) {
        console.error('[MAIPiks] Delete story failed:', error)
        toast.error(error.message || 'Could not delete your story')
        setDeletingStoryId(null)
        return
      }
    }

    setDeletingStoryId(null)
    setViewerIndex(null)
    toast.success('Story deleted')

    const fresh = await fetchStories(currentUser.id)
    setStories(fresh)
  }

  /* ---------------------------------------------------------------------- */
  /* Tipping                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Sends troll coins to a story owner. The RPC deducts the tipper's balance,
   * pays the owner 80% and routes the 20% platform fee to the Fee Pool.
   */
  const sendStoryTip = async (story: PiksStory, item: PiksStoryItem | null, amount: number) => {
    if (!currentUser) {
      toast.error('Sign in to tip')
      return false
    }

    if (story.userId === currentUser.id) {
      toast.error('You cannot tip your own story')
      return false
    }

    if (!Number.isFinite(amount) || amount < 1) {
      toast.error('Enter a tip amount')
      return false
    }

    if (amount > currentUser.trollCoins) {
      toast.error('Not enough troll coins')
      return false
    }

    const { data, error } = await supabase.rpc('tip_maipiks_story', {
      p_story_id: item?.storyId || story.id,
      p_amount: amount,
      p_story_item_id: item?.id ?? null,
      p_message: null,
    })

    if (error) {
      console.error('[MAIPiks] Tip failed:', error)
      toast.error(error.message || 'Tip failed')
      return false
    }

    const ownerCoins = Number((data as any)?.owner_coins ?? Math.floor(amount * 0.8))
    const newBalance = Number((data as any)?.new_balance ?? currentUser.trollCoins - amount)

    setCurrentUser((prev) => (prev ? { ...prev, trollCoins: newBalance } : prev))
    setStories((prev) =>
      prev.map((s) =>
        s.userId === story.userId ? { ...s, tipsReceived: (s.tipsReceived || 0) + ownerCoins } : s
      )
    )

    toast.success(`Tipped ${amount} coins — @${story.username} received ${ownerCoins}`)
    void refreshBalance()
    return true
  }

  /* ---------------------------------------------------------------------- */
  /* Unread count                                                           */
  /* ---------------------------------------------------------------------- */

  const unreadNotifications = notifications.filter((n) => !n.read).length

  /* ---------------------------------------------------------------------- */
  /* Loading state                                                          */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#03030a] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#00BFFF]/10 blur-[110px]" />
          <div className="absolute -right-32 top-32 h-96 w-96 rounded-full bg-[#BF00FF]/10 blur-[120px]" />
        </div>
        <div className="relative grid h-20 w-20 place-items-center rounded-full border border-[#00BFFF]/30 bg-gradient-to-br from-[#00BFFF]/15 to-[#BF00FF]/15">
          <Camera size={30} className="text-[#00BFFF] animate-pulse" />
        </div>
        <p className="relative mt-6 text-sm font-black text-zinc-400">Loading MAI Piks...</p>
      </div>
    )
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
          <ArrowLeft size={17} className="text-[#00BFFF] transition group-hover:text-white" />
          <span className="text-xs font-black">MAI Troll</span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles size={13} className="text-[#BF00FF] drop-shadow-[0_0_7px_#BF00FF]" />
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
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowNotifications((value) => !value)}
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
              <Radio size={11} className="text-[#00BFFF]" />
              <span className="text-[8px] font-black uppercase tracking-wider text-[#00BFFF]">Piks</span>
            </div>

            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.035] px-2.5 py-1"
              >
                <span className="text-[9px] font-black text-[#BF00FF]">@{notification.username}</span>
                <span className="text-[9px] text-zinc-500">{notification.message}</span>
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
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#00BFFF]">MAI Piks</p>
              <h3 className="mt-1 text-sm font-black">Notifications</h3>
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
              <div key={notification.id} className="flex gap-3 border-b border-white/5 px-4 py-3">
                <Avatar src={notification.avatarUrl} purple />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black">@{notification.username}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">{notification.message}</p>
                  <p className="mt-1 text-[8px] text-zinc-700">{notification.createdAt}</p>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Bell size={24} className="mx-auto text-zinc-700" />
                <p className="mt-3 text-xs font-bold text-zinc-500">No notifications</p>
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
                className={`h-full w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
            ) : (
              <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,191,255,.12),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(191,0,255,.12),transparent_35%)]" />
                <div className="relative">
                  <div className="absolute -inset-6 rounded-full bg-[#00BFFF]/10 blur-2xl" />
                  <div className="relative grid h-24 w-24 place-items-center rounded-full border border-[#00BFFF]/30 bg-gradient-to-br from-[#00BFFF]/15 to-[#BF00FF]/15 shadow-[0_0_35px_rgba(0,191,255,0.15)]">
                    <Camera size={34} className="text-[#00BFFF] drop-shadow-[0_0_10px_#00BFFF]" />
                  </div>
                </div>
                <h2 className="relative mt-7 text-2xl font-black">Capture the moment.</h2>
                <p className="relative mt-2 max-w-[290px] text-xs leading-relaxed text-zinc-500">
                  {cameraError || 'MAI Piks puts your camera first. Capture something worth sharing.'}
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
                  <span className="text-[8px] font-black uppercase tracking-[0.18em]">MAI Piks Camera</span>
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
              {uploading && (
                <div className="mb-4 flex items-center gap-2 rounded-full border border-[#00BFFF]/20 bg-black/60 px-4 py-2 backdrop-blur-xl">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#00BFFF] border-t-transparent" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#00BFFF]">Uploading...</span>
                </div>
              )}

              {recording && (
                <div className="mb-4 flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2 backdrop-blur-xl">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
                  <span className="font-mono text-xs font-black text-red-200">{formatRecordClock(recordMs)}</span>
                  <span className="text-[8px] font-black uppercase tracking-wider text-red-300/70">
                    / 3:00 max
                  </span>
                </div>
              )}

              <button
                type="button"
                disabled={uploading}
                onPointerDown={(event) => {
                  event.preventDefault()
                  handleShutterPressStart()
                }}
                onPointerUp={(event) => {
                  event.preventDefault()
                  handleShutterPressEnd()
                }}
                onPointerCancel={() => handleShutterPressEnd()}
                onContextMenu={(event) => event.preventDefault()}
                className={`group relative grid h-24 w-24 select-none place-items-center rounded-full border-[5px] bg-black/20 transition active:scale-95 disabled:opacity-50 ${
                  recording
                    ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.45)]'
                    : 'border-white shadow-[0_0_40px_rgba(0,191,255,0.2)]'
                }`}
                style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
              >
                {/* Recording progress ring up to the 3 minute cap */}
                {recording && (
                  <svg className="pointer-events-none absolute -inset-2 h-[112px] w-[112px] -rotate-90" viewBox="0 0 112 112">
                    <circle
                      cx="56"
                      cy="56"
                      r="52"
                      fill="none"
                      stroke="rgba(239,68,68,0.9)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 52}
                      strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(recordMs / MAX_VIDEO_MS, 1))}
                    />
                  </svg>
                )}

                <span className="absolute -inset-3 rounded-full border border-[#00BFFF]/20 opacity-0 transition group-hover:opacity-100" />

                {recording ? (
                  <div className="grid h-[54px] w-[54px] place-items-center rounded-2xl bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                    <Video size={22} className="text-white" />
                  </div>
                ) : (
                  <div className="h-[68px] w-[68px] rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] p-[3px] shadow-[0_0_30px_rgba(0,191,255,0.45)]">
                    <div className="h-full w-full rounded-full bg-white" />
                  </div>
                )}
              </button>

              <p className="mt-4 text-center text-[9px] font-black uppercase tracking-[0.25em] text-white/50">
                {recording ? 'Release to post video' : 'Tap for photo • Hold for video'}
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-xl">
                <Sparkles size={11} className="text-[#BF00FF]" />
                <span className="text-[8px] font-bold text-zinc-500">
                  Everything you post in 24h joins the same story
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
                    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#00BFFF]">MAI Piks</p>
                  </div>
                  <h1 className="mt-1 text-2xl font-black">Your Feed</h1>
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
                    <Plus size={22} className="text-[#00BFFF]" />
                  </div>
                  <span className="text-[8px] font-black">Add Piks</span>
                </button>

                {stories.slice(0, 8).map((story) => (
                  <StoryAvatar key={story.id} story={story} onClick={() => openStoryViewer(story)} />
                ))}
              </div>

              <div className="space-y-5">
                {feed.map((item) => (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.02] shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
                    onClick={() => {
                      if (currentUser && !currentUser.screenshotsAllowed) {
                        handleScreenshotDetected({
                          contentType: 'feed',
                          contentId: item.id,
                          ownerUserId: item.userId,
                        })
                      }
                      setSelectedFeedItem(item)
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Avatar src={item.avatarUrl} blue />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black">@{item.username}</p>
                        <p className="mt-0.5 text-[8px] text-zinc-600">{item.createdAt}</p>
                      </div>
                      <button type="button" className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.035]">
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="relative">
                      {item.mediaUrl ? (
                        <img src={item.mediaUrl} alt="" className="max-h-[65vh] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-[#00BFFF]/10 via-[#090913] to-[#BF00FF]/10">
                          <ImageIcon size={40} className="text-white/10" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>

                    <div className="px-4 py-3">
                      <div className="mb-2 flex items-center gap-4">
                        <Heart size={17} className="text-[#BF00FF]" />
                        <Send size={17} className="text-[#00BFFF]" />
                        <Eye size={17} className="ml-auto text-zinc-600" />
                      </div>
                      {item.caption && <p className="text-xs leading-relaxed text-zinc-300">{item.caption}</p>}
                    </div>

                    {currentUser && !currentUser.screenshotsAllowed && (
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
                    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#BF00FF]">MAI Piks</p>
                  </div>
                  <h1 className="mt-1 text-2xl font-black">Stories</h1>
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
                      <Plus size={22} className="text-[#00BFFF]" />
                    </div>
                  </div>
                  <span className="text-[8px] font-black">Your Story</span>
                </button>

                {stories.map((story) => (
                  <StoryAvatar key={story.id} story={story} onClick={() => openStoryViewer(story)} square />
                ))}
              </div>

              {/* Stories list */}
              <div className="space-y-3">
                {stories.map((story) => {
                  const hasAccess = canViewStory(story)
                  const mediaCount = story.items.length
                  const videoCount = story.items.filter((i) => i.mediaType === 'video').length

                  return (
                    <div
                      key={`list-${story.id}`}
                      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.045] to-white/[0.02] p-3 text-left"
                    >
                      <button
                        type="button"
                        onClick={() => openStoryViewer(story)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99]"
                      >
                        <div
                          className={`h-12 w-12 shrink-0 rounded-2xl p-[2px] ${
                            story.visibility === 'private'
                              ? 'bg-gradient-to-br from-[#BF00FF] to-[#9B30FF]'
                              : 'bg-gradient-to-br from-[#00BFFF] to-[#BF00FF]'
                          }`}
                        >
                          <div className="h-full w-full overflow-hidden rounded-[13px] bg-[#05050d]">
                            {story.thumbnailUrl ? (
                              <img src={story.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <User size={18} className="text-zinc-600" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-black">
                              {story.isOwn ? 'Your Story' : `@${story.username}`}
                            </p>
                            {videoCount > 0 && <Video size={11} className="shrink-0 text-[#00BFFF]" />}
                          </div>

                          <p className="mt-1 text-[9px] text-zinc-600">
                            {mediaCount} {mediaCount === 1 ? 'piks' : 'piks'} •{' '}
                            {story.visibility === 'private'
                              ? hasAccess
                                ? 'Private • Access granted'
                                : 'Private • Subscription required'
                              : 'Public story'}
                          </p>

                          {/* 24h expiry countdown */}
                          <div className="mt-1.5">
                            <ExpiryCountdown expiresAt={story.expiresAt} />
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        {story.visibility === 'private' ? (
                          <Lock size={15} className={hasAccess ? 'text-[#00BFFF]' : 'text-[#BF00FF]'} />
                        ) : (
                          <ChevronRight size={16} className="text-zinc-700" />
                        )}

                        {/* Users can delete their own story at any time */}
                        {story.isOwn && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void deleteWholeStory(story)
                            }}
                            disabled={deletingStoryId === story.id}
                            aria-label="Delete your story"
                            className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 transition active:scale-90 disabled:opacity-50"
                          >
                            {deletingStoryId === story.id ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
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

          <PiksCameraNav active={mode === 'camera'} onClick={openCamera} />

          <PiksNavButton
            icon={<Radio size={19} />}
            label="Stories"
            active={mode === 'story'}
            onClick={openStory}
            color="purple"
          />
        </div>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* STORY VIEWER                                                       */}
      {/* ------------------------------------------------------------------ */}

      {viewerIndex !== null && viewableStories[viewerIndex] && (
        <StoryViewer
          stories={viewableStories}
          startIndex={viewerIndex}
          currentUser={currentUser}
          onClose={closeStoryViewer}
          onDeleteItem={deleteStoryItem}
          onTip={sendStoryTip}
          onScreenshot={handleScreenshotDetected}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FEED VIEWER                                                        */}
      {/* ------------------------------------------------------------------ */}

      {selectedFeedItem && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#03030a]/90 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Avatar src={selectedFeedItem.avatarUrl} blue />
              <div>
                <p className="text-xs font-black">@{selectedFeedItem.username}</p>
                <p className="text-[8px] text-zinc-600">{selectedFeedItem.createdAt}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedFeedItem(null)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035]"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-[#00BFFF]/5 via-black to-[#BF00FF]/5">
            {selectedFeedItem.mediaUrl ? (
              <img src={selectedFeedItem.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <ImageIcon size={50} className="text-white/10" />
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
              <p className="text-xs leading-relaxed text-zinc-300">{selectedFeedItem.caption}</p>
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
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <User size={16} className="text-zinc-600" />
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
  const isPrivate = story.visibility === 'private'

  return (
    <button type="button" onClick={onClick} className="flex min-w-[72px] shrink-0 flex-col items-center gap-1.5">
      <div
        className={`relative ${
          square ? 'h-[70px] w-[70px] rounded-2xl' : 'h-[68px] w-[68px] rounded-2xl'
        } ${
          isPrivate
            ? 'bg-gradient-to-br from-[#BF00FF] via-[#9B30FF] to-[#00BFFF]'
            : 'bg-gradient-to-br from-[#00BFFF] via-[#1E90FF] to-[#BF00FF]'
        } p-[2px] shadow-[0_0_18px_rgba(0,191,255,0.15)]`}
      >
        <div className="h-full w-full overflow-hidden rounded-[13px] bg-[#05050d]">
          {story.thumbnailUrl ? (
            <img src={story.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <User size={20} className="text-zinc-600" />
            </div>
          )}
        </div>

        {isPrivate && (
          <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-[#03030a] bg-[#BF00FF] shadow-[0_0_10px_#BF00FF]">
            <Lock size={9} />
          </div>
        )}

        {/* How many piks are stacked inside this story */}
        {story.items.length > 1 && (
          <div className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border border-[#03030a] bg-[#00BFFF] px-1 text-[8px] font-black text-black shadow-[0_0_10px_#00BFFF]">
            {story.items.length}
          </div>
        )}
      </div>

      <span className="max-w-[72px] truncate text-[8px] font-black text-zinc-400">
        {story.isOwn ? 'Your Story' : story.username}
      </span>

      {/* Countdown to the 24h hard delete */}
      <ExpiryCountdown expiresAt={story.expiresAt} compact />
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
            isBlue ? 'bg-[#00BFFF] shadow-[0_0_10px_#00BFFF]' : 'bg-[#BF00FF] shadow-[0_0_10px_#BF00FF]'
          }`}
        />
      )}

      <span className={active ? (isBlue ? 'drop-shadow-[0_0_7px_#00BFFF]' : 'drop-shadow-[0_0_7px_#BF00FF]') : ''}>
        {icon}
      </span>

      <span className={`text-[8px] font-black uppercase tracking-wider ${active ? 'text-white' : 'text-zinc-600'}`}>
        {label}
      </span>
    </button>
  )
}

/* ========================================================================= */
/* CAMERA NAV                                                               */
/* ========================================================================= */

function PiksCameraNav({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="relative flex flex-col items-center justify-center gap-0.5">
      <div
        className={`relative grid h-12 w-12 place-items-center rounded-full p-[2px] transition ${
          active
            ? 'bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_25px_rgba(0,191,255,0.35)]'
            : 'bg-white/10'
        }`}
      >
        <div
          className={`grid h-full w-full place-items-center rounded-full ${
            active ? 'bg-[#05050d] text-white' : 'bg-[#111118] text-zinc-500'
          }`}
        >
          <Camera size={20} />
        </div>
      </div>

      <span className={`text-[8px] font-black uppercase tracking-wider ${active ? 'text-[#00BFFF]' : 'text-zinc-600'}`}>
        Camera
      </span>
    </button>
  )
}

/* ========================================================================= */
/* EMPTY STATE                                                              */
/* ========================================================================= */

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#00BFFF]/5 via-white/[0.02] to-[#BF00FF]/5 px-6 py-14 text-center">
      <div className="absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 rounded-full bg-[#00BFFF]/10 blur-3xl" />

      <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/5">
        <Icon size={25} className="text-[#00BFFF]" />
      </div>

      <h3 className="relative mt-5 text-sm font-black">{title}</h3>

      <p className="relative mx-auto mt-2 max-w-[260px] text-[10px] leading-relaxed text-zinc-600">{description}</p>
    </div>
  )
}
