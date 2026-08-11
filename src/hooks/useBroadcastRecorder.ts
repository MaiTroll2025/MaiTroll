import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UseBroadcastRecorderReturn {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  recordingSize: number
  recordingId: string | null
  startRecording: (streamId: string) => Promise<void>
  stopRecording: () => Promise<Blob | null>
  saveClip: () => Promise<string | null>
  error: string | null
}

interface UseBroadcastRecorderOptions {
  /** Static MediaStream, or a function that returns a MediaStream (or null) at record-time.
   *  Use a lazy getter to avoid getDisplayMedia popup until recording starts,
   *  or to build the stream from live tracks (e.g. Agora audio). */
  sourceStream?: MediaStream | null | (() => MediaStream | null | Promise<MediaStream | null>)
  sourceStreamCleanup?: boolean
  sourceUrl?: string | null
  /** Label for the replay: 'broadcast', 'podcast', 'hytro_gaming', etc.
   *  Stored in broadcast_replays.source and used to display where the replay came from. */
  replaySource?: string
  /** Custom title prefix for the replay. If set, the replay title becomes "{prefix} — {streamTitle}". */
  replayTitlePrefix?: string
}

export function useBroadcastRecorder(options: UseBroadcastRecorderOptions = {}): UseBroadcastRecorderReturn {
  const { sourceStream, sourceStreamCleanup = false, sourceUrl, replaySource, replayTitlePrefix } = options
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingSize, setRecordingSize] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ownsSourceStreamRef = useRef(false)
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null)
  const playbackStreamRef = useRef<MediaStream | null>(null)
  const ownsPlaybackStreamRef = useRef(false)
  const chunksRef = useRef<Blob[]>([])
  const clipBufferRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef<string | undefined>(undefined)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)
  const streamIdRef = useRef<string | null>(null)



  const BUCKET_NAME = 'replays'
  const CLIP_BUFFER_SECONDS = 60
  const BUFFER_INTERVAL_MS = 1000

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current)
      if (streamRef.current && ownsSourceStreamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (playbackVideoRef.current) {
        playbackVideoRef.current.pause()
        playbackVideoRef.current.removeAttribute('src')
        playbackVideoRef.current.load()
        playbackVideoRef.current = null
      }
      if (playbackStreamRef.current && ownsPlaybackStreamRef.current) {
        playbackStreamRef.current.getTracks().forEach(track => track.stop())
      }
      playbackStreamRef.current = null
      ownsPlaybackStreamRef.current = false
    }
  }, [])

  const uploadBlobToStorage = useCallback(async (blob: Blob, userId: string, streamId: string, isClip: boolean = false): Promise<string | null> => {
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4'
    const path = isClip
      ? `clips/${userId}/${Date.now()}.${ext}`
      : `recordings/${userId}/${streamId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        contentType: blob.type || 'video/webm',
        cacheControl: '3600',
      })

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
    return data.publicUrl
  }, [])

  const saveClipToTreelz = useCallback(async (blob: Blob, userId: string): Promise<string | null> => {
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4'
    const path = `treelz-clips/${userId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('treelz-videos')
      .upload(path, blob, {
        contentType: blob.type || 'video/webm',
        cacheControl: '3600',
      })

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage.from('treelz-videos').getPublicUrl(path)
    return data.publicUrl
  }, [])

  const startRecording = useCallback(async (streamId: string) => {
    if (mediaRecorderRef.current?.state === 'recording') return

    try {
      setError(null)
      setIsUploading(false)
      setIsRecording(true)
      setRecordingDuration(0)
      streamIdRef.current = streamId
      startTimeRef.current = Date.now()
      chunksRef.current = []
      clipBufferRef.current = []
      mimeTypeRef.current = undefined
      setRecordingSize(0)

      console.log('[useBroadcastRecorder] Starting MediaRecorder for stream:', streamId)

      let displayStream: MediaStream | null = null

      // Resolve sourceStream: can be a static MediaStream, a lazy getter function, or null
      let resolvedStream: MediaStream | null = null
      if (typeof sourceStream === 'function') {
        resolvedStream = await sourceStream()
      } else {
        resolvedStream = sourceStream ?? null
      }

      try {
        if (sourceUrl) {
          const video = document.createElement('video')
          video.playsInline = true
          video.muted = true
          video.src = sourceUrl
          playbackVideoRef.current = video

          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => resolve()
            const onError = () => reject(new Error('Unable to load broadcast playback stream'))
            video.addEventListener('loadedmetadata', onLoaded, { once: true })
            video.addEventListener('error', onError, { once: true })
          })

          await video.play()

          const captureStream =
            typeof (video as any).captureStream === 'function'
              ? (video as any).captureStream()
              : (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.()

          if (!captureStream) {
            throw new Error('Browser does not support capturing video playback for recording')
          }

          displayStream = captureStream
          playbackStreamRef.current = captureStream
          ownsPlaybackStreamRef.current = true
        } else if (resolvedStream?.getTracks().length) {
          // Source stream provided (e.g. LiveKit local + remote tracks).
          // Capture the full screen via getDisplayMedia for the Mai Troll UI,
          // then merge in audio tracks from the source stream (mic + seat users).
          console.log('[useBroadcastRecorder] Capturing screen via getDisplayMedia, merging source audio')
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser', frameRate: 30 } as any,
            audio: false,
          })
          const combinedTracks: MediaStreamTrack[] = [
            ...screenStream.getVideoTracks(),
            ...resolvedStream.getAudioTracks(),
          ]
          displayStream = new MediaStream(combinedTracks)
          ownsSourceStreamRef.current = true
        } else {
          // No source stream or URL — capture the entire screen the viewer sees
          // (full Mai Troll UI: podcast room, gaming viewer, broadcast viewer, etc.)
          // Uses getDisplayMedia which shows a one-time browser screen share picker
          console.log('[useBroadcastRecorder] Capturing entire screen via getDisplayMedia')
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser', frameRate: 30 } as any,
            audio: false,
          })
          ownsSourceStreamRef.current = true
        }

        if (!displayStream.getVideoTracks().length) {
          throw new Error('Recording stream does not include a video track')
        }

        if (!displayStream.getAudioTracks().length) {
          console.warn('[useBroadcastRecorder] Recording stream does not include an audio track')
        }

        streamRef.current = displayStream

        displayStream
          .getVideoTracks()[0]
          ?.addEventListener('ended', () => {
            console.log('[useBroadcastRecorder] Display track ended')
            if (
              mediaRecorderRef.current?.state ===
              'recording'
            ) {
              mediaRecorderRef.current.stop.call(mediaRecorderRef.current)
            }
          })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) throw new Error('Not authenticated')

        const { data: canRecord, error: checkError } = await supabase.rpc('can_user_record', {
          p_user_id: user.id,
        })

        if (checkError) throw checkError

        if (!canRecord?.can_record) {
          displayStream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          setIsRecording(false)
          if (canRecord?.reason === 'no_plan') {
            toast.error('You need a storage plan to record. Visit the Cloud Storage tab in the Coin Store.')
          } else if (canRecord?.reason === 'storage_full') {
            toast.error('Your storage is full. Upgrade your plan in the Cloud Storage tab.')
          } else if (canRecord?.reason === 'replay_restricted') {
            toast.error('Replay balance is restricted. Add replay balance before recording.')
          }
          return
        }

        const supportedMimeTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ]
        const mimeType = supportedMimeTypes.find(type => MediaRecorder.isTypeSupported(type))
        mimeTypeRef.current = mimeType

        const mediaRecorder = new MediaRecorder(
          displayStream,
          mimeType ? { mimeType } : undefined
        )
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.onerror = (event) => {
          console.error('[Recorder Error]', event.error)
          setError(event.error?.message || 'MediaRecorder failed')
        }

        mediaRecorder.ondataavailable = (event) => {
          console.log(
            '[Recorder Chunk]',
            event.data.size
          )
          if (event.data.size > 0) {
            chunksRef.current.push(event.data)
            clipBufferRef.current.push(event.data)
            if (
              clipBufferRef.current.length >
              CLIP_BUFFER_SECONDS
            ) {
              clipBufferRef.current.shift()
            }
            setRecordingSize(prev => prev + event.data.size)
          }
        }

        mediaRecorder.onstop = async () => {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }

          try {
            const activeStreamId = streamIdRef.current
            if (!activeStreamId) {
              throw new Error('Missing stream ID')
            }
            const durationSeconds = Math.floor(
              (Date.now() - startTimeRef.current) / 1000
            )
            const blob = new Blob(chunksRef.current, {
              type: mimeTypeRef.current || mediaRecorder.mimeType || 'video/webm',
            })
            console.log(
              '[Recorder] Blob Size:',
              blob.size
            )
            if (blob.size === 0) {
              throw new Error('Recording is empty')
            }
            const publicUrl =
              await uploadBlobToStorage(
                blob,
                user.id,
                activeStreamId
              )
            if (publicUrl) {
              await supabase
                .from('streams')
                .update({
                  recording_url: publicUrl,
                })
                .eq('id', activeStreamId)
              const { data: streamData } =
                await supabase
                  .from('streams')
                  .select('title')
                  .eq('id', activeStreamId)
                  .maybeSingle()
              const replayTitle = replayTitlePrefix
                ? `${replayTitlePrefix} — ${streamData?.title || 'Live Stream'}`
                : streamData?.title || 'Live Stream'
              // Build the replay record — only include columns that exist in the table
              const replayRecord: Record<string, any> = {
                stream_id: activeStreamId,
                user_id: user.id,
                title: replayTitle,
                replay_url: publicUrl,
                duration_seconds: durationSeconds,
                file_size_bytes: blob.size,
              }
              // Only include source column if it exists (added in migration 20260620000000)
              if (replaySource) {
                replayRecord.source = replaySource
              }
              const { error: replayError } = await supabase
                .from('broadcast_replays')
                .upsert(
                  {
                    stream_id: activeStreamId,
                    user_id: user.id,
                    title: replayTitle,
                    replay_url: publicUrl,
                    duration_seconds: durationSeconds,
                    file_size_bytes: blob.size,
                  },
                  { onConflict: 'stream_id' }
                )
              if (replayError) {
                console.error('[Recorder] Replay insert error:', replayError)
              }
            }
            toast.success('Recording saved!')
          } catch (err) {
            console.error(
              '[Recorder Upload Error]',
              err
            )
            toast.error(
              'Failed to save recording'
            )
          }

          setIsRecording(false)
          setRecordingId(null)
          setRecordingDuration(0)
          setRecordingSize(0)
          mediaRecorderRef.current = null
          streamIdRef.current = null
        }

        mediaRecorder.start(BUFFER_INTERVAL_MS)

        toast.success('Recording started — capturing screen share')

        setRecordingId(`browser-recording-${Date.now()}`)

        timerRef.current = setInterval(() => {
          setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }, 1000)
      } catch (err) {
        if (displayStream) {
          displayStream.getTracks().forEach(track => track.stop())
          if (streamRef.current === displayStream) streamRef.current = null
        }
        throw err
      }
    } catch (err: any) {
      setIsRecording(false)

      if (err.name === 'NotAllowedError') {
        setError('Broadcast recording permission denied')
        toast.error('Broadcast recording permission was denied')
      } else {
        setError(err?.message || 'Failed to start recording')
        toast.error(err?.message || 'Failed to start recording')
      }
    }
  }, [sourceStream, sourceUrl, uploadBlobToStorage, replaySource, replayTitlePrefix])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || !streamIdRef.current) {
      setError('No active recording to stop')
      return null
    }

    try {
      setIsUploading(true)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      const mediaRecorder = mediaRecorderRef.current
      if (mediaRecorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          const originalOnStop = mediaRecorder.onstop
          mediaRecorder.onstop = async (event) => {
            try {
              await originalOnStop?.call(mediaRecorder, event)
            } finally {
              resolve()
            }
          }
          mediaRecorder.stop.call(mediaRecorder)
        })
      }

      if (streamRef.current && ownsSourceStreamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      streamRef.current = null
      ownsSourceStreamRef.current = false

      if (playbackVideoRef.current) {
        playbackVideoRef.current.pause()
        playbackVideoRef.current.removeAttribute('src')
        playbackVideoRef.current.load()
        playbackVideoRef.current = null
      }
      if (playbackStreamRef.current && ownsPlaybackStreamRef.current) {
        playbackStreamRef.current.getTracks().forEach(track => track.stop())
      }
      playbackStreamRef.current = null
      ownsPlaybackStreamRef.current = false

      setIsRecording(false)
      setRecordingId(null)
      setRecordingDuration(0)
      setRecordingSize(0)
      mediaRecorderRef.current = null
      streamIdRef.current = null
      let finalBlob: Blob | null = new Blob(chunksRef.current, {
        type: mimeTypeRef.current || mediaRecorder.mimeType || 'video/webm',
      })

      if (finalBlob.size === 0) {
        finalBlob = null
      }

      // finalBlob can be posted to your replays API as FormData with the streamId/userId metadata.
      return finalBlob
    } catch (err: any) {
      setError(err?.message || 'Failed to stop recording')
      toast.error(err?.message || 'Failed to stop recording')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [])

  const saveClip = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      toast.error('Not authenticated')
      return null
    }

    if (clipBufferRef.current.length === 0) {
      toast.error('No clip buffer available. Start recording first.')
      return null
    }

    try {
      setIsUploading(true)

      const blob = new Blob(clipBufferRef.current, { type: 'video/webm' })
      const publicUrl = await saveClipToTreelz(blob, user.id)

      if (publicUrl && streamIdRef.current) {
        await supabase
          .from('treelz_posts')
          .insert({
            user_id: user.id,
            video_url: publicUrl,
            caption: '🔴 Game Clip',
            status: 'active',
            video_size_bytes: blob.size,
          })
          .select()
          .single()

        toast.success('Clip saved to Treelz!')
      }

      return publicUrl
    } catch (err: any) {
      setError(err?.message || 'Failed to save clip')
      toast.error(err?.message || 'Failed to save clip')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [saveClipToTreelz])

  return {
    isRecording,
    isUploading,
    recordingDuration,
    recordingSize,
    recordingId,
    startRecording,
    stopRecording,
    saveClip,
    error,
  }
}