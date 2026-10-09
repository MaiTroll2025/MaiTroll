import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface PhoneXPState {
  level: number
  totalXp: number
  xpToNext: number
  progress: number
  nextLevelAbsolute: number
  isLoading: boolean
}

/**
 * Compute XP state using the same logic as the web useXPStore
 * This ensures phone and web profiles show consistent XP/level data
 */
export function computePhoneXP(data: {
  level?: number
  xp?: number
  total_xp?: number
  next_level_xp?: number
  xp_total?: number
  xp_to_next_level?: number
  current_level?: number
  current_xp?: number
  buyer_level?: number
  buyer_xp?: number
  stream_level?: number
  stream_xp?: number
  [key: string]: any
}): Omit<PhoneXPState, 'isLoading'> {
  // Use xp_total from user_stats table (as calculated by SQL migration)
  const absoluteXp = data.xp_total || data.total_xp || data.xp || 0

  // Calculate level based on the same thresholds as the SQL migration
  let levelValue = 1
  let xpNeededThisLevel = 100
  let prevLevelAbsolute = 0
  let nextLevelAbsolute = 100

  if (absoluteXp < 100) {
    levelValue = 1
    xpNeededThisLevel = 100
    prevLevelAbsolute = 0
    nextLevelAbsolute = 100
  } else if (absoluteXp < 250) {
    levelValue = 2
    xpNeededThisLevel = 150
    prevLevelAbsolute = 100
    nextLevelAbsolute = 250
  } else if (absoluteXp < 500) {
    levelValue = 3
    xpNeededThisLevel = 250
    prevLevelAbsolute = 250
    nextLevelAbsolute = 500
  } else if (absoluteXp < 800) {
    levelValue = 4
    xpNeededThisLevel = 300
    prevLevelAbsolute = 500
    nextLevelAbsolute = 800
  } else if (absoluteXp < 1200) {
    levelValue = 5
    xpNeededThisLevel = 400
    prevLevelAbsolute = 800
    nextLevelAbsolute = 1200
  } else if (absoluteXp < 1700) {
    levelValue = 6
    xpNeededThisLevel = 500
    prevLevelAbsolute = 1200
    nextLevelAbsolute = 1700
  } else if (absoluteXp < 2300) {
    levelValue = 7
    xpNeededThisLevel = 600
    prevLevelAbsolute = 1700
    nextLevelAbsolute = 2300
  } else if (absoluteXp < 3000) {
    levelValue = 8
    xpNeededThisLevel = 700
    prevLevelAbsolute = 2300
    nextLevelAbsolute = 3000
  } else if (absoluteXp < 4000) {
    levelValue = 9
    xpNeededThisLevel = 1000
    prevLevelAbsolute = 3000
    nextLevelAbsolute = 4000
  } else {
    // Level 10+: Each level requires 1000 more XP
    levelValue = 10 + Math.floor((absoluteXp - 4000) / 1000)
    xpNeededThisLevel = 1000
    prevLevelAbsolute = 4000 + ((levelValue - 10) * 1000)
    nextLevelAbsolute = prevLevelAbsolute + 1000
  }

  const xpIntoLevel = Math.max(0, absoluteXp - prevLevelAbsolute)
  const progressValue = Math.min(100, (xpIntoLevel / xpNeededThisLevel) * 100)

  return {
    level: levelValue,
    totalXp: absoluteXp,
    xpToNext: Math.max(0, xpNeededThisLevel - xpIntoLevel),
    progress: progressValue,
    nextLevelAbsolute,
  }
}

/**
 * Hook to fetch and subscribe to XP data for phone profile
 * Mirrors the web useXPStore behavior
 */
export function usePhoneXP(userId: string | null | undefined): PhoneXPState {
  const [xpState, setXpState] = useState<PhoneXPState>({
    level: 1,
    totalXp: 0,
    xpToNext: 100,
    progress: 0,
    nextLevelAbsolute: 100,
    isLoading: true,
  })

  useEffect(() => {
    if (!userId || userId.startsWith('TC-')) {
      setXpState({
        level: 1,
        totalXp: 0,
        xpToNext: 100,
        progress: 0,
        nextLevelAbsolute: 100,
        isLoading: false,
      })
      return
    }

    let isSubscribed = false
    let channel: any = null

    const fetchXP = async () => {
      try {
        const { data, error } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) throw error

        if (data && !isSubscribed) {
          const computed = computePhoneXP(data)
          setXpState({ ...computed, isLoading: false })
        }
      } catch (err) {
        console.error('[PhoneXP] Failed to fetch XP:', err)
        if (!isSubscribed) {
          setXpState(prev => ({ ...prev, isLoading: false }))
        }
      }
    }

    // Initial fetch
    fetchXP()

    // Subscribe to real-time updates
    channel = supabase
      .channel(`phone-xp-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stats',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && !isSubscribed) {
            const computed = computePhoneXP(payload.new as any)
            setXpState({ ...computed, isLoading: false })
          }
        }
      )
      .subscribe()

    isSubscribed = true

    return () => {
      isSubscribed = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  return xpState
}