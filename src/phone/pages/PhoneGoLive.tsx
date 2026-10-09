import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CameraOff,
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  Settings,
  VideoOff,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  Track,
} from 'livekit-client'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { PreflightStore } from '@/lib/preflightStore'
import { usePreflightStore } from '@/lib/preflightStore'
import { requestLiveKitToken } from '@/lib/livekitToken'
import { awardKeyToUser } from '@/services/keyService'
import { useKeyDiscoveryStore } from '@/stores/useKeyDiscoveryStore'
import { useBroadcastViewerCap } from '@/hooks/useBroadcastViewerCap'
import CameraOffImageUpload from '@/components/broadcast/CameraOffImageUpload'
import { MAX_GUEST_SEATS } from '@/config/broadcastCategories'
import { isStaffProfile } from '@/lib/staff'
import { applyCameraVideoPresentation } from '@/lib/cameraVideoPresentation'

type BroadcastCategory =
  | 'general'
  | 'gaming'
  | 'podcast'
  | 'irl'
  | 'education'
  | 'fitness'
  | 'business'
  | 'spiritual'
  | 'debate'

const CATEGORIES: Array<{
  id: BroadcastCategory
  name: string
  icon: string
}> = [
  { id: 'general', name: 'General', icon: '🎥' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'podcast', name: 'Podcast', icon: '🎙️' },
  { id: 'irl', name: 'IRL', icon: '📱' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'fitness', name: 'Fitness', icon: '💪' },
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'spiritual', name: 'Spiritual', icon: '🙏' },
  { id: 'debate', name: 'Debate', icon: '⚖️' },
]

export default function PhoneGoLive() {
  const navigate = useNavigate()

  const { user, profile } = useAuthStore()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const roomRef = useRef<Room | null>(null)

  const mountedRef = useRef(true)
  const startingRef = useRef(false)
  const keyAwardedRef = useRef(false)

  // Safety net: if broadcast start hangs, force-reset the guard so the
  // user can retry instead of being stuck on a frozen button.
  const START_BROADCAST_TIMEOUT_MS = 30_000;
  const startSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState('')
  const [category, setCategory] =
    useState<BroadcastCategory>('general')
  const [seatCount, setSeatCount] = useState(0)

  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)

  const [facingMode, setFacingMode] =
    useState<'user' | 'environment'>('user')

  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [cameraTrack, setCameraTrack] =
    useState<LocalVideoTrack | null>(null)

  const [microphoneTrack, setMicrophoneTrack] =
    useState<LocalAudioTrack | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    applyCameraVideoPresentation(video, {
      track: cameraTrack?.mediaStreamTrack,
      facingMode,
      isLocal: true,
    })
  }, [cameraTrack, facingMode])

  const {
    startCapEnabled,
    startCapMax,
    viewerCapEnabled,
    viewerCapMax,
    viewerCapHours,
    seatCapEnabled,
    seatCapMax,
    allRestrictionsDisabled,
    loading: capLoading,
  } = useBroadcastViewerCap()

  const maxGuestSeats = seatCapEnabled
    ? Math.max(0, Math.min(MAX_GUEST_SEATS, seatCapMax))
    : MAX_GUEST_SEATS
  const configuredSeatCount = Math.max(0, Math.min(seatCount, maxGuestSeats))

  /*
   * Attach the native MediaStream to the phone preview.
   */
  const attachPreview = useCallback((mediaStream: MediaStream) => {
    const video = videoRef.current

    if (!video) return

    video.srcObject = mediaStream
    video.muted = true
    video.playsInline = true
    applyCameraVideoPresentation(video, {
      track: mediaStream.getVideoTracks()[0],
      facingMode,
      isLocal: true,
    })

    video.play().catch(() => {})
  }, [facingMode])

  /*
   * Stop all currently owned media.
   */
  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop()
        } catch {}
      })

      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  /*
   * Acquire camera + microphone.
   */
  const acquireMedia = useCallback(
    async (
      requestedFacingMode: 'user' | 'environment' = facingMode
    ) => {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          'Camera and microphone are not supported by this browser.'
        )
      }

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            facingMode: requestedFacingMode,
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
          },
        })

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach(track => track.stop())
        return null
      }

      streamRef.current = mediaStream

      const audio = mediaStream.getAudioTracks()[0]
      const video = mediaStream.getVideoTracks()[0]

      setMicOn(!!audio)
      setCameraOn(!!video)

      attachPreview(mediaStream)

      return mediaStream
    },
    [attachPreview, facingMode]
  )

  /*
   * Initial camera/microphone permission request.
   */
  useEffect(() => {
    mountedRef.current = true

    const initialize = async () => {
      try {
        setLoading(true)
        setPermissionError(null)

        await acquireMedia('user')
      } catch (error: any) {
        console.error(
          '[PhoneGoLive] Media permission error:',
          error
        )

        setPermissionError(
          error?.message ||
            'Camera and microphone access is required.'
        )
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    initialize()

    return () => {
      mountedRef.current = false

      if (!startingRef.current) {
        stopMedia()
      }
    }
  }, [acquireMedia, stopMedia])

  /*
   * Toggle microphone.
   */
  const toggleMic = useCallback(() => {
    const stream = streamRef.current

    if (!stream) return

    const nextState = !micOn

    stream.getAudioTracks().forEach(track => {
      track.enabled = nextState
    })

    if (microphoneTrack) {
      microphoneTrack.mediaStreamTrack.enabled = nextState
    }

    setMicOn(nextState)
  }, [micOn, microphoneTrack])

  /*
   * Toggle camera.
   */
  const toggleCamera = useCallback(() => {
    const stream = streamRef.current

    if (!stream) return

    const nextState = !cameraOn

    stream.getVideoTracks().forEach(track => {
      track.enabled = nextState
    })

    if (cameraTrack) {
      cameraTrack.mediaStreamTrack.enabled = nextState
    }

    setCameraOn(nextState)
  }, [cameraOn, cameraTrack])

  /*
   * Flip front/rear camera.
   */
  const flipCamera = useCallback(async () => {
    if (startingRef.current) return

    const nextFacingMode =
      facingMode === 'user'
        ? 'environment'
        : 'user'

    try {
      const oldStream = streamRef.current

      if (oldStream) {
        oldStream.getVideoTracks().forEach(track => {
          try {
            track.stop()
          } catch {}
        })
      }

      const newStream =
        await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: nextFacingMode,
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
          },
        })

      const newVideo =
        newStream.getVideoTracks()[0]

      if (!newVideo) {
        throw new Error('No camera was found.')
      }

      /*
       * Keep the existing microphone.
       */
      const currentStream = streamRef.current
      const microphone =
        currentStream?.getAudioTracks()[0]

      const combinedStream = new MediaStream()

      if (microphone) {
        combinedStream.addTrack(microphone)
      }

      combinedStream.addTrack(newVideo)

      streamRef.current = combinedStream

      setFacingMode(nextFacingMode)
      setCameraOn(true)

      attachPreview(combinedStream)

      /*
       * If a LiveKit track already exists during setup,
       * replace its underlying media track.
       */
      if (cameraTrack) {
        try {
          await cameraTrack.replaceTrack(newVideo)
        } catch (error) {
          console.warn(
            '[PhoneGoLive] Failed to replace LiveKit camera track',
            error
          )
        }
      }
    } catch (error) {
      console.error(
        '[PhoneGoLive] Failed to flip camera:',
        error
      )

      toast.error('Unable to switch cameras.')
    }
  }, [
    attachPreview,
    cameraTrack,
    facingMode,
  ])

  /*
   * Build the LiveKit tracks from the native stream.
   */
  const createLiveKitTracks = useCallback(
    (mediaStream: MediaStream) => {
      const audio =
        mediaStream.getAudioTracks()[0]

      const video =
        mediaStream.getVideoTracks()[0]

      const audioTrack = audio
        ? new LocalAudioTrack(audio)
        : null

      const videoTrack = video
        ? new LocalVideoTrack(video)
        : null

      if (audioTrack) {
        audioTrack.source = Track.Source.Microphone
      }

      if (videoTrack) {
        videoTrack.source = Track.Source.Camera
      }

      return {
        audioTrack,
        videoTrack,
      }
    },
    []
  )

  /*
   * Start the actual broadcast.
   */
  const startBroadcast = useCallback(async () => {
    if (startingRef.current) return

    if (!user?.id) {
      toast.error('You must be signed in to go live.')
      return
    }

    if (!title.trim()) {
      toast.error('Enter a title for your broadcast.')
      return
    }

    if (!cameraOn) {
      toast.error('Camera must be enabled to start your broadcast.')
      return
    }

    if (!micOn) {
      toast.error('Microphone must be enabled to start your broadcast.')
      return
    }

    const rtcProvider = isStaffProfile(profile) ? 'getstream' : 'livekit'

    if (rtcProvider === 'livekit' && !import.meta.env.VITE_LIVEKIT_URL) {
      toast.error('LiveKit is not configured.')
      return
    }

    startingRef.current = true
    setStarting(true)

    // Safety net: if broadcast start hangs, force-reset the guard so the
    // user can retry instead of being stuck on a frozen button.
    if (startSafetyTimeoutRef.current) {
      clearTimeout(startSafetyTimeoutRef.current);
    }
    startSafetyTimeoutRef.current = setTimeout(() => {
      startingRef.current = false;
      startSafetyTimeoutRef.current = null;
    }, START_BROADCAST_TIMEOUT_MS);

    let streamId: string | null = null
    let room: Room | null = null

    try {
      /*
       * Make sure we have a current native stream.
       */
      let mediaStream = streamRef.current

      if (!mediaStream) {
        mediaStream = await acquireMedia(facingMode)

        if (!mediaStream) {
          throw new Error(
            'Camera and microphone are unavailable.'
          )
        }
      }

      if (
        !mediaStream.getAudioTracks()[0] ||
        !mediaStream.getVideoTracks()[0]
      ) {
        throw new Error(
          'Camera and microphone tracks are unavailable.'
        )
      }

      let audioTrack: LocalAudioTrack | null = null
      let videoTrack: LocalVideoTrack | null = null
      if (rtcProvider === 'livekit') {
        const liveKitTracks = createLiveKitTracks(mediaStream)
        audioTrack = liveKitTracks.audioTrack
        videoTrack = liveKitTracks.videoTrack
        if (!audioTrack || !videoTrack) {
          throw new Error(
            'Camera and microphone tracks could not be prepared for LiveKit.'
          )
        }
        setMicrophoneTrack(audioTrack)
        setCameraTrack(videoTrack)
      }

      /*
       * Generate a unique stream/room ID.
       */
      streamId =
        crypto.randomUUID()

      const roomName = streamId

      /*
       * Create the Supabase stream row first.
       */
      const insertData = {
        id: streamId,
        user_id: user.id,
        broadcaster_id: user.id,
        streamer_id: user.id,
        owner_id: user.id,

        title: title.trim(),
        category,
        rtc_provider: rtcProvider,

        stream_type: 'standard',

        camera_ready: true,

        status: 'starting',
        is_live: false,

        started_at: null,

        box_count: configuredSeatCount + 1,
        seat_count: configuredSeatCount,

        layout_mode: 'grid',

        livekit_room_name: roomName,
        agora_channel: roomName,

        broadcast_disclaimer_accepted: true,
        broadcast_disclaimer_accepted_at:
          new Date().toISOString(),
        broadcast_disclaimer_user_id: user.id,
      }

      const {
        data,
        error,
      } = await supabase
        .from('streams')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        throw error
      }

      streamId = data.id

      /*
       * Request LiveKit token using the same backend
       * endpoint/function used by the desktop setup.
       */
      if (rtcProvider === 'livekit') {
        if (!audioTrack || !videoTrack) {
          throw new Error('LiveKit media tracks are unavailable.')
        }

        const tokenData = await requestLiveKitToken(roomName, user.id)

        room = new Room({
          audioCaptureOptions: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          videoCaptureOptions: {
            facingMode,
          },
          dynacast: true,
        } as any)

        await room.connect(
          import.meta.env.VITE_LIVEKIT_URL,
          tokenData.token
        )

        roomRef.current = room
        await room.localParticipant.publishTrack(audioTrack)
        await room.localParticipant.publishTrack(videoTrack)

        PreflightStore.setLivekitRoom(room)
        PreflightStore.setLivekitTracks([audioTrack, videoTrack])
        PreflightStore.setTrackEnabledStates(true, true)
        usePreflightStore.getState().setPreflightConnection({
          room,
          audioTrack,
          videoTrack,
          streamId,
          roomName,
        })

        PreflightStore.setTransferSession({
          room,
          roomName,
          streamId,
          participantIdentity: tokenData.participantIdentity || user.id,
          cameraTrack: videoTrack,
          microphoneTrack: audioTrack,
          screenTrack: null,
          screenAudioTrack: null,
          mode: 'camera',
          cameraOverlayEnabled: false,
          transferredAt: Date.now(),
          ownership: 'broadcast-page',
          transitionInProgress: true,
        })

        const { error: liveError } = await supabase
          .from('streams')
          .update({
            status: 'live',
            is_live: true,
            started_at: new Date().toISOString(),
          })
          .eq('id', streamId)

        if (liveError) throw liveError
      } else {
        mediaStream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        PreflightStore.setLivekitRoom(null)
        PreflightStore.setLivekitTracks([null, null])
        PreflightStore.clearTransferSession()
        usePreflightStore.getState().clearPreflightConnection()
      }

      if (!keyAwardedRef.current) {
        keyAwardedRef.current = true
        void (async () => {
          try {
            const result = await awardKeyToUser(user.id)
            if (result?.success && result.key_letter) {
              useKeyDiscoveryStore.getState().openDiscovery({
                key_letter: result.key_letter,
                rarity: result.rarity || 'COMMON',
                value: result.value || 0,
                is_key_to_city: !!result.is_key_to_city,
                cashout_available_at: result.cashout_available_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              })
            }
          } catch {
            // non-blocking
          }
        })()
      }

      /*
       * Let the next page know this is a live
       * stream transition.
       */
      sessionStorage.setItem(
        'tc_starting_stream',
        'true'
      )

      sessionStorage.setItem(
        'tc_camera_facing_mode',
        facingMode
      )

      sessionStorage.setItem(
        'tc_video_enabled',
        'true'
      )

      sessionStorage.setItem(
        'tc_audio_enabled',
        'true'
      )

      /*
       * IMPORTANT:
       * Do not stop the tracks here.
       *
       * BroadcastPage owns them now. Keep `startingRef` true so the
       * unmount cleanup leaves the LiveKit-owned camera/mic tracks running
       * (stopping them here would kill the broadcast camera on the phone).
       */
      startingRef.current = true

      navigate(`/broadcast/${streamId}`)
    } catch (error: any) {
      console.error(
        '[PhoneGoLive] Broadcast failed:',
        error
      )

      if (streamId) {
        try {
          await supabase
            .from('streams')
            .update({
              status: 'failed',
              is_live: false,
            })
            .eq('id', streamId)
        } catch {
          // ignore
        }
      }

      if (room) {
        try {
          room.disconnect()
        } catch {}
      }

      toast.error(
        error?.message ||
          'Unable to start your broadcast.'
      )

      startingRef.current = false
      // Clear safety timeout on success so it doesn't erroneously reset the guard later.
      if (startSafetyTimeoutRef.current) {
        clearTimeout(startSafetyTimeoutRef.current);
        startSafetyTimeoutRef.current = null;
      }
    } finally {
      if (mountedRef.current) {
        setStarting(false)
      }
    }
  }, [
    acquireMedia,
    cameraOn,
    category,
    configuredSeatCount,
    createLiveKitTracks,
    facingMode,
    micOn,
    navigate,
    title,
    user?.id,
    profile,
  ])

  /*
   * Leave setup without starting.
   */
  const handleClose = useCallback(() => {
    if (startingRef.current) return

    stopMedia()

    navigate(-1)
  }, [navigate, stopMedia])

  /*
   * Browser back / component cleanup.
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!startingRef.current) {
        stopMedia()
      }
    }

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    )

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      )

      mountedRef.current = false

      if (!startingRef.current) {
        stopMedia()
      }
    }
  }, [stopMedia])

  return (
    <div className="relative h-dvh overflow-hidden bg-black text-white">
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Full-screen camera preview */}
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${
          cameraOn && !permissionError ? '' : 'opacity-0'
        }`}
      />

      {/* Camera off overlay */}
      {!cameraOn && !permissionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
          <VideoOff size={48} className="text-zinc-700" />
        </div>
      )}

      {/* Permission error overlay */}
      {permissionError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
          <CameraOff size={46} className="mb-4 text-red-400" />

          <h2 className="mb-2 text-base font-bold">
            Camera Access Required
          </h2>

          <p className="mb-5 max-w-xs text-xs leading-relaxed text-zinc-400">
            {permissionError}
          </p>

          <button
            type="button"
            onClick={async () => {
              try {
                setPermissionError(null)
                await acquireMedia(facingMode)
              } catch (error: any) {
                setPermissionError(
                  error?.message ||
                    'Unable to access camera.'
                )
              }
            }}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-3 text-xs font-black text-black"
          >
            Allow Camera & Mic
          </button>
        </div>
      )}

      {/* Preview badge */}
      {!permissionError && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] font-bold backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
          PREVIEW
        </div>
      )}

      {/* Overlay UI */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 backdrop-blur-xl">
          <button
            type="button"
            onClick={handleClose}
            disabled={starting}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          >
            <ArrowLeft size={26} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 shadow-[0_0_18px_rgba(168,85,247,.35)]">
              <Radio size={16} />
            </div>

            <div>
              <h1 className="text-sm font-black">
                Go Live
              </h1>

              <p className="text-[9px] uppercase tracking-widest text-zinc-500">
                Broadcast Setup
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              disabled={starting}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
              aria-label="Open stream settings"
            >
              <Settings size={24} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              disabled={starting}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
              aria-label="Close setup"
            >
              <X size={26} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            </button>
          </div>
        </header>

        <div className="flex-1" />

        {/* Bottom controls */}
        <div className="shrink-0 space-y-3 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {/* Stream title */}
          <input
            value={title}
            onChange={e =>
              setTitle(e.target.value)
            }
            disabled={starting}
            maxLength={120}
            placeholder="What are you doing?"
            className="w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3.5 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-zinc-500 focus:border-fuchsia-500/50"
          />

          {/* Go live */}
          <button
            type="button"
            onClick={startBroadcast}
            disabled={
              starting ||
              loading ||
              !title.trim() ||
              !!permissionError ||
              !cameraOn ||
              !micOn
            }
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-600 py-4 text-sm font-black text-white shadow-[0_0_30px_rgba(168,85,247,.25)] transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {starting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Starting Broadcast...
              </>
            ) : (
              <>
                <Radio size={20} />
                GO LIVE
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings sheet */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
            className="absolute inset-0 bg-black/70"
          />

          <aside className="scrollbar-none absolute bottom-0 left-0 right-0 mx-auto max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0a0a0a] p-4 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black">Stream Settings</h2>
                <p className="text-[10px] text-zinc-500">
                  Category, seats, camera and microphone
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                disabled={starting}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>

            {/* Category */}
            <section className="space-y-2">
              <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Category
              </label>

              <div className="relative">
                <select
                  value={category}
                  onChange={e =>
                    setCategory(
                      e.target.value as BroadcastCategory
                    )
                  }
                  disabled={starting}
                  className="w-full appearance-none rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3.5 pr-10 text-sm font-semibold outline-none focus:border-fuchsia-500/50"
                >
                  {CATEGORIES.map(item => (
                    <option
                      key={item.id}
                      value={item.id}
                      className="bg-zinc-900"
                    >
                      {item.icon} {item.name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              </div>
            </section>

            {/* Guest seats */}
            <section className="mt-4 space-y-2">
              <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Guest Seats
              </label>

              <div className="flex items-center justify-between rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">Available seats</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Host is not included</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSeatCount(Math.max(0, configuredSeatCount - 1))}
                    disabled={starting || configuredSeatCount <= 0}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Remove a guest seat"
                  >
                    -
                  </button>

                  <span className="min-w-12 text-center text-sm font-black text-cyan-200">
                    {configuredSeatCount} / {maxGuestSeats}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSeatCount(Math.min(maxGuestSeats, configuredSeatCount + 1))}
                    disabled={starting || configuredSeatCount >= maxGuestSeats}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Add a guest seat"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>

            {/* Camera */}
            <section className="mt-4 space-y-2">
              <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Camera
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleCamera}
                  disabled={starting}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-40 ${
                    cameraOn
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-red-500/40 bg-red-600/80 text-white'
                  }`}
                >
                  {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
                  {cameraOn ? 'Camera On' : 'Camera Off'}
                </button>

                <button
                  type="button"
                  onClick={flipCamera}
                  disabled={starting}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition disabled:opacity-40"
                >
                  <RefreshCw size={18} />
                  Flip Camera
                </button>
              </div>

              <p className="px-1 text-[10px] text-zinc-600">
                Using {facingMode === 'user' ? 'front' : 'rear'} camera
              </p>
            </section>

            {/* Microphone */}
            <section className="mt-4 space-y-2">
              <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Microphone
              </label>

              <button
                type="button"
                onClick={toggleMic}
                disabled={starting}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-40 ${
                  micOn
                    ? 'border-white/10 bg-white/5 text-white'
                    : 'border-red-500/40 bg-red-600/80 text-white'
                }`}
              >
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                {micOn ? 'Microphone On' : 'Microphone Off'}
              </button>
            </section>

            {/* Camera off image */}
            <section className="mt-4 space-y-2">
              <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Camera Off Image
              </label>
              <p className="px-1 text-[10px] text-zinc-600">
                Show this image when your camera is off during broadcast
              </p>
              <CameraOffImageUpload />
            </section>

            {/* Broadcast limits */}
            {!capLoading && !allRestrictionsDisabled && (
              <section className="mt-4 space-y-2">
                <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Broadcast Limits
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {startCapEnabled && (
                    <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-amber-400/80">
                        Start Cap
                      </p>
                      <p className="mt-1 text-sm font-black text-amber-300">
                        {startCapMax} live
                      </p>
                      <p className="text-[9px] text-zinc-500">
                        Max concurrent broadcasts
                      </p>
                    </div>
                  )}

                  {viewerCapEnabled && (
                    <div className="rounded-2xl border border-fuchsia-500/10 bg-fuchsia-500/5 px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-fuchsia-400/80">
                        Viewer Cap
                      </p>
                      <p className="mt-1 text-sm font-black text-fuchsia-300">
                        {viewerCapMax} viewers
                      </p>
                      <p className="text-[9px] text-zinc-500">
                        Per stream for {viewerCapHours}h
                      </p>
                    </div>
                  )}

                  {seatCapEnabled && (
                    <div className="rounded-2xl border border-cyan-500/10 bg-cyan-500/5 px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-cyan-400/80">
                        Seat Cap
                      </p>
                      <p className="mt-1 text-sm font-black text-cyan-300">
                        {seatCapMax} boxes
                      </p>
                      <p className="text-[9px] text-zinc-500">
                        Max seats per broadcast
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}