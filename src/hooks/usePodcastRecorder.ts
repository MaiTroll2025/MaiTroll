import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UsePodcastRecorderReturn {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  recordingId: string | null
  startRecording: (podcastId: string, channelName?: string) => Promise<void>
  stopRecording: () => Promise<string | null>
  saveClip: () => Promise<string | null>
  error: string | null
}

/**
 * usePodcastRecorder — Records the entire podcast screen the viewer sees.
 *
 * Now uses the same client-side MediaRecorder + getDisplayMedia approach
 * as the broadcast recorder, capturing the full screen that a viewer sees
 * in the podcast room (audio waveforms, chat, host controls, etc).
 *
 * Flow:
 * 1. startRecording(podcastId) — captures the entire screen via getDisplayMedia()
 * 2. stopRecording() — stops capture, uploads to Supabase Storage, saves as podcast episode
 * 3. saveClip() — saves the last 60 seconds as a clip
 */
export function usePodcastRecorder(): UsePodcastRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const clipBufferRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef<string | undefined>(undefined)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const podcastIdRef = useRef<string | null>(null)

  const CLIP_BUFFER_SECONDS = 60
  const BUFFER_INTERVAL_MS = 1000

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const uploadBlobToStorage = useCallback(async (
    blob: Blob,
    userId: string,
    podcastId: string,
  ): Promise<string | null> => {
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4'
    const path = `podcast-recordings/${userId}/${podcastId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('replays')
      .upload(path, blob, {
        contentType: blob.type || 'video/webm',
        cacheControl: '3600',
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('replays').getPublicUrl(path)
    return data.publicUrl
  }, [])

  const saveClipToBucket = useCallback(async (blob: Blob, userId: string): Promise<string | null> => {
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4'
    const path = `treelz-clips/${userId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('treelz-videos')
      .upload(path, blob, {
        contentType: blob.type || 'video/webm',
        cacheControl: '3600',
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('treelz-videos').getPublicUrl(path)
    return data.publicUrl
  }, [])

  const startRecording = useCallback(async (podcastId: string, _channelName?: string) => {
    if (mediaRecorderRef.current?.state === 'recording') return

    try {
      setError(null)
      setIsUploading(false)
      setIsRecording(true)
      setRecordingDuration(0)
      podcastIdRef.current = podcastId
      startTimeRef.current = Date.now()
      chunksRef.current = []
      clipBufferRef.current = []
      mimeTypeRef.current = undefined

      console.log('[usePodcastRecorder] Starting screen recording for podcast:', podcastId)

      // Capture the entire screen that the viewer sees in the podcast room
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: 30 } as any,
        audio: true,
      })

      streamRef.current = displayStream

      if (!displayStream.getVideoTracks().length) {
        throw new Error('Screen capture does not include a video track')
      }

      // Auto-stop when user stops sharing via browser UI
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        console.log('[usePodcastRecorder] Display track ended (user stopped sharing)')
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      })

      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Not authenticated')

      // Check recording permission
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
        mimeType ? { mimeType } : undefined,
      )
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.onerror = (event) => {
        console.error('[usePodcastRecorder Error]', event.error)
        setError(event.error?.message || 'MediaRecorder failed')
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          clipBufferRef.current.push(event.data)
          if (clipBufferRef.current.length > CLIP_BUFFER_SECONDS) {
            clipBufferRef.current.shift()
          }
        }
      }

      mediaRecorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        try {
          const activePodcastId = podcastIdRef.current
          if (!activePodcastId) throw new Error('Missing podcast ID')

          const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
          const blob = new Blob(chunksRef.current, {
            type: mimeTypeRef.current || mediaRecorder.mimeType || 'video/webm',
          })

          if (blob.size === 0) throw new Error('Recording is empty')

          const publicUrl = await uploadBlobToStorage(blob, user.id, activePodcastId)

          if (publicUrl) {
            // Save recording URL as a podcast episode
            await supabase
              .from('podcast_episodes')
              .insert({
                podcast_id: activePodcastId,
                title: "Recording " + new Date().toLocaleDateString(),
                audio_url: publicUrl,
                video_url: publicUrl,
                duration_seconds: durationSeconds,
                recorded_at: new Date().toISOString(),
              })

            toast.success('Podcast recording saved!')
          }

        } catch (err) {
          console.error('[usePodcastRecorder Upload Error]', err)
          toast.error('Failed to save podcast recording')
        }

        setIsRecording(false)
        setRecordingId(null)
        setRecordingDuration(0)
        mediaRecorderRef.current = null
        podcastIdRef.current = null
      }

      mediaRecorder.start(BUFFER_INTERVAL_MS)

      toast.success('Recording started — capturing entire podcast screen')

      setRecordingId('podcast-recording-' + Date.now())

      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch (err: any) {
      setIsRecording(false)

      if (err.name === 'NotAllowedError') {
        setError('Screen recording permission denied')
        toast.error('Screen recording permission was denied')
      } else {
        setError(err?.message || 'Failed to start recording')
        toast.error(err?.message || 'Failed to start podcast recording')
      }
    }
  }, [uploadBlobToStorage])

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!mediaRecorderRef.current || !podcastIdRef.current) {
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

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      streamRef.current = null

      setIsRecording(false)
      setRecordingId(null)
      setRecordingDuration(0)
      mediaRecorderRef.current = null
      podcastIdRef.current = null

      return null
    } catch (err: any) {
      setError(err?.message || 'Failed to stop recording')
      toast.error(err?.message || 'Failed to stop podcast recording')
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
      const publicUrl = await saveClipToBucket(blob, user.id)

      if (publicUrl && podcastIdRef.current) {
        await supabase
          .from('treelz_posts')
          .insert({
            user_id: user.id,
            video_url: publicUrl,
            caption: '🔴 Podcast Clip',
            status: 'active',
            video_size_bytes: blob.size,
          })
          .select()
          .single()

        toast.success('Clip saved!')
      }

      return publicUrl
    } catch (err: any) {
      setError(err?.message || 'Failed to save clip')
      toast.error(err?.message || 'Failed to save clip')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [saveClipToBucket])

  return {
    isRecording,
    isUploading,
    recordingDuration,
    recordingId,
    startRecording,
    stopRecording,
    saveClip,
    error,
  }
}
