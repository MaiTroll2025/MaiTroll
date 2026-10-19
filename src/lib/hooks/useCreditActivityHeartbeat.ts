import { useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'

export type CreditActivityRole = 'host' | 'viewer'

export function useCreditActivityHeartbeat(
  streamId: string | null | undefined,
  role: CreditActivityRole,
  enabled = true,
) {
  const userId = useAuthStore((state) => state.user?.id)
  const lastErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !userId || !streamId) return

    let disposed = false
    const recordHeartbeat = async () => {
      try {
        const { error } = await supabase.rpc('credit_activity_heartbeat', {
          p_stream_id: streamId,
          p_activity_role: role,
        })

        if (disposed) return
        if (error) {
          const message = error.message || 'Credit activity heartbeat failed'
          if (lastErrorRef.current !== message) {
            console.error('[credit-activity] Heartbeat failed', {
              streamId,
              role,
              error,
            })
            lastErrorRef.current = message
          }
          return
        }

        lastErrorRef.current = null
      } catch (error) {
        if (disposed) return
        const message = error instanceof Error ? error.message : String(error)
        if (lastErrorRef.current !== message) {
          console.error('[credit-activity] Heartbeat failed', {
            streamId,
            role,
            error,
          })
          lastErrorRef.current = message
        }
      }
    }

    void recordHeartbeat()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void recordHeartbeat()
      }
    }, 60_000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [enabled, role, streamId, userId])
}
