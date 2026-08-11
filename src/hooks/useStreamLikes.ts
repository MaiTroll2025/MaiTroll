import { useEffect, useCallback, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

export function useStreamLikes(streamId: string, initialTotalLikes: number = 0) {
  const { user } = useAuthStore()
  const [displayedLikes, setDisplayedLikes] = useState(initialTotalLikes)
  const pendingLikesRef = useRef(0)
  const flushInProgressRef = useRef(false)

  const flushLikes = useCallback(async () => {
    if (flushInProgressRef.current) return

    const batch = pendingLikesRef.current
    if (batch <= 0) return

    pendingLikesRef.current = 0
    flushInProgressRef.current = true

    try {
      const { data, error } = await supabase.rpc('increment_stream_likes', {
        p_stream_id: streamId,
        p_like_count: batch,
      })

      if (error) throw error

      if (typeof data === 'number') {
        setDisplayedLikes(data)
      }
    } catch (error) {
      pendingLikesRef.current += batch
      console.error('Failed to flush likes:', error)
    } finally {
      flushInProgressRef.current = false
    }
  }, [streamId])

  useEffect(() => {
    const interval = window.setInterval(() => {
      flushLikes()
    }, 2500)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushLikes()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      void flushLikes()
    }
  }, [flushLikes])

  const handleLike = useCallback(() => {
    if (!user) return

    pendingLikesRef.current += 2
    setDisplayedLikes((current) => current + 2)

    if (pendingLikesRef.current >= 25) {
      flushLikes()
    }
  }, [user, flushLikes])

  return {
    displayedLikes,
    handleLike,
    flushLikes,
  }
}
