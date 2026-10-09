import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Badge {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  category: string
  rarity: string
  criteria: any
  earned_at?: string
  metadata?: any
}

export interface BadgeWithEarned extends Badge {
  earned_at: string
  metadata?: any
}

/**
 * Fetch all badge definitions
 */
export async function fetchAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('category', { ascending: true })
    .order('rarity', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Fetch badges earned by a specific user
 */
export async function fetchUserBadges(userId: string): Promise<BadgeWithEarned[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select(`
      earned_at,
      metadata,
      badge:badges(*)
    `)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  if (error) throw error
  
  return (data || []).map(item => ({
    ...(item.badge as any),
    earned_at: item.earned_at,
    metadata: item.metadata
  }))
}

/**
 * Hook to fetch user badges with real-time updates
 */
export function useUserBadges(userId: string | null | undefined) {
  const [badges, setBadges] = useState<BadgeWithEarned[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || userId.startsWith('TC-')) {
      setBadges([])
      setLoading(false)
      return
    }

    let isSubscribed = false
    let channel: any = null

    const loadBadges = async () => {
      try {
        const data = await fetchUserBadges(userId)
        if (!isSubscribed) {
          setBadges(data)
          setLoading(false)
        }
      } catch (err) {
        console.error('[useUserBadges] Failed to load badges:', err)
        if (!isSubscribed) {
          setBadges([])
          setLoading(false)
        }
      }
    }

    loadBadges()

    // Subscribe to real-time updates
    channel = supabase
      .channel(`user-badges-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadBadges()
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

  return { badges, loading }
}

/**
 * Award a badge to a user (called via RPC for security)
 */
export async function awardBadge(userId: string, badgeSlug: string, metadata?: any) {
  const { data, error } = await supabase.rpc('award_badge', {
    p_user_id: userId,
    p_badge_slug: badgeSlug,
    p_metadata: metadata || {}
  })

  if (error) throw error
  return data
}

/**
 * Check and award badges based on user stats
 * This should be called after XP changes, level ups, etc.
 */
export async function checkAndAwardBadges(userId: string, _userStats: any) {
  // This would be implemented as a comprehensive check
  // For now, we'll rely on the RPC function
  const { data, error } = await supabase.rpc('check_and_award_badges', {
    p_user_id: userId
  })

  if (error) throw error
  return data
}

/**
 * Get icon component for a badge
 */
export function getBadgeIcon(iconName: string | null) {
  if (!iconName) return null
  
  // Map common icon names to Lucide icons
  const iconMap: Record<string, string> = {
    'Star': 'Star',
    'Award': 'Award',
    'Crown': 'Crown',
    'Trophy': 'Trophy',
    'Sparkles': 'Sparkles',
    'Medal': 'Medal',
    'Gem': 'Gem',
    'PenTool': 'PenTool',
    'FileText': 'FileText',
    'BookOpen': 'BookOpen',
    'UserPlus': 'UserPlus',
    'Users': 'Users',
    'Heart': 'Heart',
    'ShieldCheck': 'ShieldCheck',
    'FlaskConical': 'FlaskConical',
    'Gift': 'Gift',
    'Radio': 'Radio',
    'Tv': 'Tv',
    'Mars': 'Mars',
    'Venus': 'Venus',
    'Asterisk': 'Asterisk',
    'Shield': 'Shield',
    'Gavel': 'Gavel',
    'Landmark': 'Landmark',
  }

  return iconMap[iconName] || 'Award'
}

/**
 * Get rarity color classes
 */
export function getRarityClasses(rarity: string): string {
  switch (rarity) {
    case 'mythic':
      return 'border-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-pink-500/10'
    case 'legendary':
      return 'border-gradient-to-r from-amber-500 to-orange-500 bg-gradient-to-r from-amber-500/10 to-orange-500/10'
    case 'epic':
      return 'border-gradient-to-r from-purple-500 to-violet-500 bg-gradient-to-r from-purple-500/10 to-violet-500/10'
    case 'rare':
      return 'border-gradient-to-r from-blue-500 to-cyan-500 bg-gradient-to-r from-blue-500/10 to-cyan-500/10'
    case 'common':
    default:
      return 'border-white/20 bg-white/5'
  }
}

/**
 * Get category color
 */
export function getCategoryColor(category: string): string {
  switch (category) {
    case 'gender': return '#EC4899'
    case 'level': return '#FBBF24'
    case 'league': return '#3B82F6'
    case 'milestone': return '#22C55E'
    case 'special': return '#A855F7'
    case 'event': return '#F59E0B'
    case 'role': return '#EF4444'
    default: return '#94A3B8'
  }
}