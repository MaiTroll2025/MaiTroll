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

  const [title, setTitle] = useState('')
  const [category, setCategory] =
    useState<BroadcastCategory>('general')

  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)

  const [facingMode, setFacingMode] =
    useState<'user' | 'environment'>('user')

  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const [cameraTrack, setCameraTrack] =
    useState<LocalVideoTrack | null>(null)

  const [microphoneTrack, setMicrophoneTrack] =
    useState<LocalAudioTrack | null>(null)

  /*
   * Attach the native MediaStream to the phone preview.
   */
  const attachPreview = useCallback((mediaStream: MediaStream) => {
    const video = videoRef.current

    if (!video) return

    video.srcObject = mediaStream
    video.muted = true
    video.playsInline = true

    video.play().catch(() => {})
  }, [])

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
      microphoneTrack.track.enabled = nextState
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
      cameraTrack.track.enabled = nextState
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

    if (!import.meta.env.VITE_LIVEKIT_URL) {
      toast.error('LiveKit is not configured.')
      return
    }

    startingRef.current = true
    setStarting(true)

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

      const {
        audioTrack,
        videoTrack,
      } = createLiveKitTracks(mediaStream)

      if (!audioTrack || !videoTrack) {
        throw new Error(
          'Camera and microphone tracks could not be created.'
        )
      }

      setMicrophoneTrack(audioTrack)
      setCameraTrack(videoTrack)

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

        stream_type: 'standard',

        camera_ready: true,

        status: 'starting',
        is_live: false,

        started_at: null,

        box_count: 2,
        seat_count: 1,

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
      const tokenData = await requestLiveKitToken(roomName, user.id)

      /*
       * Connect to LiveKit.
       */
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

      /*
       * Publish microphone and camera.
       */
      await room.localParticipant.publishTrack(
        audioTrack
      )

      await room.localParticipant.publishTrack(
        videoTrack
      )

      /*
       * Preserve the exact LiveKit objects so
       * BroadcastPage can reuse the existing connection.
       */
      PreflightStore.setLivekitRoom(room)

      PreflightStore.setLivekitTracks([
        audioTrack,
        videoTrack,
      ])

      PreflightStore.setTrackEnabledStates(
        true,
        true
      )

      usePreflightStore
        .getState()
        .setPreflightConnection({
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
        participantIdentity:
          tokenData.participantIdentity ||
          user.id,

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

      /*
       * Mark the Supabase stream LIVE only after
       * LiveKit has connected and tracks published.
       */
      const {
        error: liveError,
      } = await supabase
        .from('streams')
        .update({
          status: 'live',
          is_live: true,
          started_at:
            new Date().toISOString(),
        })
        .eq('id', streamId)

      if (liveError) {
        throw liveError
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
       * BroadcastPage owns them now.
       */
      startingRef.current = false

      navigate(`/broadcast/${streamId}`)
    } catch (error: any) {
      console.error(
        '[PhoneGoLive] Broadcast failed:',
        error
      )

      if (streamId) {
        await supabase
          .from('streams')
          .update({
            status: 'failed',
            is_live: false,
          })
          .eq('id', streamId)
          .then(() => {})
          .catch(() => {})
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
    } finally {
      if (mountedRef.current) {
        setStarting(false)
      }
    }
  }, [
    acquireMedia,
    cameraOn,
    category,
    createLiveKitTracks,
    facingMode,
    micOn,
    navigate,
    title,
    user?.id,
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
    <div className="min-h-screen bg-gradient-to-b from-[#090014] via-black to-[#090014] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-fuchsia-500/20 bg-black/90 px-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={handleClose}
          disabled={starting}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10 disabled:opacity-40"
        >
          <ArrowLeft size={21} />
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

        <button
          type="button"
          onClick={handleClose}
          disabled={starting}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10 disabled:opacity-40"
        >
          <X size={20} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-4 p-4 pb-8">
        {/* Camera */}
        <section className="relative aspect-video max-h-[40vh] overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-zinc-950 shadow-[0_0_40px_rgba(168,85,247,.12)]">
          {permissionError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <CameraOff
                size={46}
                className="mb-4 text-red-400"
              />

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
                    await acquireMedia(
                      facingMode
                    )
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
          ) : (
            <video
              ref={videoRef}
              muted
              autoPlay
              playsInline
              className={`absolute inset-0 h-full w-full object-cover ${
                cameraOn
                  ? ''
                  : 'opacity-0'
              }`}
            />
          )}

          {!cameraOn && !permissionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
              <VideoOff
                size={48}
                className="text-zinc-700"
              />
            </div>
          )}

          {/* Preview badge */}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] font-bold backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
            PREVIEW
          </div>

          {/* Camera controls */}
          {!permissionError && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              <button
                type="button"
                onClick={toggleMic}
                className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-xl transition ${
                  micOn
                    ? 'border-white/10 bg-black/70'
                    : 'border-red-500/40 bg-red-600/80'
                }`}
              >
                {micOn ? (
                  <Mic size={20} />
                ) : (
                  <MicOff size={20} />
                )}
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-xl transition ${
                  cameraOn
                    ? 'border-white/10 bg-black/70'
                    : 'border-red-500/40 bg-red-600/80'
                }`}
              >
                {cameraOn ? (
                  <Camera size={20} />
                ) : (
                  <CameraOff size={20} />
                )}
              </button>

              <button
                type="button"
                onClick={flipCamera}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/70 backdrop-blur-xl"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          )}
        </section>

        {/* Title */}
        <section className="space-y-2">
          <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Stream Title
          </label>

          <input
            value={title}
            onChange={e =>
              setTitle(e.target.value)
            }
            disabled={starting}
            maxLength={120}
            placeholder="What are you doing?"
            className="w-full rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3.5 text-sm outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-500/50"
          />
        </section>

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

        {/* Status */}
        <div className="flex items-center justify-between rounded-2xl border border-cyan-500/10 bg-cyan-500/5 px-4 py-3">
          <div>
            <p className="text-xs font-bold">
              Camera & Microphone
            </p>

            <p className="mt-0.5 text-[10px] text-zinc-500">
              Ready for LiveKit
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span
              className={
                micOn
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              MIC
            </span>

            <span
              className={
                cameraOn
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              CAM
            </span>
          </div>
        </div>

        {/* Go Live */}
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
              <Loader2
                size={20}
                className="animate-spin"
              />
              Starting Broadcast...
            </>
          ) : (
            <>
              <Radio size={20} />
              GO LIVE
            </>
          )}
        </button>
      </main>
    </div>
  )
}