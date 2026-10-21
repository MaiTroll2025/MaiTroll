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

export interface BadgeLogEntry extends Badge {
  earned: boolean
  earned_at?: string
  metadata?: any
}

type BadgeCatalogRow = Omit<Badge, 'icon' | 'color' | 'criteria'> & {
  icon?: string | null
  icon_url?: string | null
  color?: string | null
  criteria?: any
}

function normalizeBadge(row: BadgeCatalogRow): Badge {
  return {
    ...row,
    icon: row.icon ?? row.icon_url ?? null,
    color: row.color ?? null,
    criteria: row.criteria ?? null,
  }
}

/**
 * Fetch all badge definitions
 */
export async function fetchAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badge_catalog')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('rarity', { ascending: false })

  if (error) throw error
  return (data || []).map(row => normalizeBadge(row as BadgeCatalogRow))
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
      badge:badge_catalog(*)
    `)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  if (error) throw error
  
  return (data || []).flatMap(item => {
    const relatedBadge = item.badge as BadgeCatalogRow | BadgeCatalogRow[] | null
    const badge = Array.isArray(relatedBadge) ? relatedBadge[0] : relatedBadge
    if (!badge) return []

    return [{
      ...normalizeBadge(badge),
      earned_at: item.earned_at,
      metadata: item.metadata,
    }]
  })
}

export async function fetchUserBadgeLog(userId: string): Promise<BadgeLogEntry[]> {
  const [catalog, earnedBadges] = await Promise.all([
    fetchAllBadges(),
    fetchUserBadges(userId),
  ])
  const earnedBySlug = new Map(earnedBadges.map(badge => [badge.slug, badge]))

  return catalog.map(badge => {
    const earned = earnedBySlug.get(badge.slug)
    return {
      ...badge,
      earned: !!earned,
      earned_at: earned?.earned_at,
      metadata: earned?.metadata,
    }
  })
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

    let isActive = true
    let channel: any = null

    const loadBadges = async () => {
      try {
        const data = await fetchUserBadges(userId)
        if (isActive) {
          setBadges(data)
          setLoading(false)
        }
      } catch (err) {
        console.error('[useUserBadges] Failed to load badges:', err)
        if (isActive) {
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

    return () => {
      isActive = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  return { badges, loading }
}

export function useUserBadgeLog(userId: string | null | undefined) {
  const [badges, setBadges] = useState<BadgeLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || userId.startsWith('TC-')) {
      setBadges([])
      setLoading(false)
      return
    }

    let isActive = true
    const loadBadgeLog = async () => {
      try {
        const data = await fetchUserBadgeLog(userId)
        if (isActive) {
          setBadges(data)
          setLoading(false)
        }
      } catch (err) {
        console.error('[useUserBadgeLog] Failed to load badge log:', err)
        if (isActive) {
          setBadges([])
          setLoading(false)
        }
      }
    }

    void loadBadgeLog()
    const channel = supabase
      .channel(`user-badge-log-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadBadgeLog()
        },
      )
      .subscribe()

    return () => {
      isActive = false
      void supabase.removeChannel(channel)
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