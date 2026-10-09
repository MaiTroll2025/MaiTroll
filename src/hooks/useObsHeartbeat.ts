import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface UseObsHeartbeatOptions {
  streamId: string | null
  sessionId?: string | null
  enabled?: boolean
  interval?: number // milliseconds between heartbeats
}

interface HeartbeatResult {
  ok: boolean
  error?: string
}

/**
 * Hook that sends periodic heartbeats to notify the backend that OBS is streaming.
 * This updates the streams.updated_at timestamp so the health check knows OBS is connected.
 */
export function useObsHeartbeat({
  streamId,
  sessionId,
  enabled = true,
  interval = 5000, // Default: every 5 seconds
}: UseObsHeartbeatOptions) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  const sendHeartbeat = useCallback(async (): Promise<HeartbeatResult> => {
    const targetId = sessionId || streamId
    if (!targetId || !enabled) {
      return { ok: false, error: 'Session ID not set or heartbeat disabled' }
    }

    try {
      console.log('[useObsHeartbeat] Sending heartbeat for session:', targetId)

      const { data, error } = await supabase.functions.invoke('agora-stream', {
        body: {
          action: 'heartbeat',
          sessionId: targetId,
        },
      })

      if (error) {
        console.warn('[useObsHeartbeat] Heartbeat error:', error)
        return { ok: false, error: error.message }
      }

      if (!data?.ok) {
        console.warn('[useObsHeartbeat] Heartbeat failed:', data)
        return { ok: false, error: data?.error || 'Unknown error' }
      }

      console.log('[useObsHeartbeat] Heartbeat sent successfully')
      return { ok: true }
    } catch (err: any) {
      console.error('[useObsHeartbeat] Heartbeat exception:', err)
      return { ok: false, error: err?.message || String(err) }
    }
  }, [sessionId, streamId, enabled])

  // Start heartbeat interval
  useEffect(() => {
    isMountedRef.current = true

    if (!streamId || !enabled) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      return
    }

    // Send initial heartbeat immediately
    void sendHeartbeat()

    // Then send periodic heartbeats
    heartbeatRef.current = setInterval(() => {
      if (isMountedRef.current) {
        void sendHeartbeat()
      }
    }, interval)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [streamId, enabled, interval, sendHeartbeat])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
    }
  }, [])

  return { sendHeartbeat }
}
