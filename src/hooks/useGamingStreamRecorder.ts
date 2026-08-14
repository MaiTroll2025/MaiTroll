import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UseGamingStreamRecorderReturn {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  startRecording: (sourceElement?: HTMLElement | null) => Promise<void>
  stopRecording: () => Promise<Blob | null>
  uploadRecording: (streamId: string) => Promise<string | null>
  error: string | null
}

/**
 * useGamingStreamRecorder
 *
 * Records the HytroGaming viewer page and uploads to Supabase Storage.
 * Video files are stored directly in the stream-recordings bucket.
 *
 * Flow:
 * 1. startRecording() — captures the game element via captureStream()
 * 2. stopRecording() — stops capture, returns the recorded blob
 * 3. uploadRecording(streamId) — uploads to Supabase Storage and saves metadata
 */
export function useGamingStreamRecorder(): UseGamingStreamRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startRecording = useCallback(async (sourceElement?: HTMLElement | null) => {
    try {
      setError(null)
      chunksRef.current = []

      let captureStream: MediaStream

      if (sourceElement && typeof (sourceElement as any).captureStream === 'function') {
        captureStream = (sourceElement as any).captureStream(30)
      } else if (sourceElement && typeof (sourceElement as any).webkitCaptureStream === 'function') {
        captureStream = (sourceElement as any).webkitCaptureStream(30)
      } else {
        captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser', frameRate: 30 } as any,
          audio: true,
        })
      }

      streamRef.current = captureStream

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm'

      const recorder = new MediaRecorder(captureStream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      const videoTrack = captureStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            if (timerRef.current) clearInterval(timerRef.current)
          }
        })
      }

      recorder.start(1000)
      setIsRecording(true)
      startTimeRef.current = Date.now()
      setRecordingDuration(0)

      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch (err: any) {
      setIsRecording(false)
      if (err.name === 'NotAllowedError') {
        setError('Screen capture permission denied')
      } else {
        setError(err?.message || 'Failed to start recording')
      }
    }
  }, [])

const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return null
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        setRecordedBlob(blob)
        setIsRecording(false)

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }

        resolve(blob)
      }

      recorder.stop()
    })
  }, [])

  /**
   * Upload the recorded blob to Supabase Storage.
   */
  const uploadRecording = useCallback(async (streamId: string, blobOverride?: Blob | null): Promise<string | null> => {
    const blob = blobOverride ?? recordedBlob
    if (!blob || blob.size === 0) {
      toast.error('No recording to upload')
      return null
    }

    setIsUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        throw new Error('Not authenticated')
      }

      console.log('[useGamingStreamRecorder] Uploading...')
      console.log('[useGamingStreamRecorder] filePath:', `${user.id}/${streamId}/`)
      console.log('[useGamingStreamRecorder] blob.size:', blob.size, 'blob.type:', blob.type)

      const fileName = `gaming_${streamId}_${Date.now()}.webm`
      const filePath = `${user.id}/${streamId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('stream-recordings')
        .upload(filePath, blob, { 
          contentType: 'video/webm', 
          upsert: false,
          cacheControl: '3600',
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('stream-recordings')
        .getPublicUrl(filePath)

      const recordingUrl = urlData.publicUrl

      await supabase
        .from('streams')
        .update({
          recording_url: recordingUrl,
          playback_url: recordingUrl,
        })
        .eq('id', streamId)

      toast.success('Recording saved to your profile')
      return recordingUrl
    } catch (err: any) {
      console.error('[useGamingStreamRecorder] Upload failed:', err)
      toast.error(err?.message || 'Failed to upload recording')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [recordedBlob])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return {
    isRecording,
    isUploading,
    recordingDuration,
    startRecording,
    stopRecording,
    uploadRecording,
    error,
  }
}
