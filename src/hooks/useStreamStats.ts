import { useEffect, useState, useRef, useCallback } from 'react'

import { supabase } from '../lib/supabase'

export function useStreamStats(streamerId: string | null) {
  const [viewerCount, _setViewerCount] = useState(1)
  const [streamerStats, setStreamerStats] = useState<any>(null)
  const startRef = useRef(Date.now())
  const [, forceUpdate] = useState(0)

  // Update duration every 10s instead of every 1s to reduce re-renders
  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate(n => n + 1)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const getDuration = useCallback(() => {
    const diff = Date.now() - startRef.current
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [])

  // Fetch streamer stats (coins, level, badge)
  useEffect(() => {
    if (!streamerId) return

    const fetchStreamerStats = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('username, level, total_earned_coins, troll_coins, troll_coins')
          .eq('id', streamerId)
          .single()

        if (data) {
          setStreamerStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch streamer stats:', error)
      }
    }

    fetchStreamerStats()
    
    // Polling for streamer stats (coins/level) instead of Realtime
    // Reduced frequency to minimize DB load when many viewers watch one streamer
    const interval = setInterval(() => {
        fetchStreamerStats();
    }, 120000); // Poll every 60s

    return () => {
      clearInterval(interval);
    }
  }, [streamerId])

  return { viewerCount, getDuration, streamerStats }
}

