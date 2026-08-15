import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

export interface SubscriptionTierInfo {
  id: string
  name: string
  color_hex: string
  icon_name: string
  sort_order: number
  price_coins?: number
  benefits?: string[]
  sla_uptime_guarantee_pct?: number
  sla_quality_guarantee?: string
  sla_chat_priority?: string
  sla_support_response_secs?: number
  sla_features?: string[]
}

export function useCreatorSubscription(broadcasterId?: string, userId?: string) {
  const { user } = useAuthStore()
  const targetBroadcasterId = broadcasterId
  const targetUserId = userId || user?.id

  const [isSubscribed, setIsSubscribed] = useState(false)
  const [tier, setTier] = useState<SubscriptionTierInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const checkSubscription = useCallback(async () => {
    if (!targetBroadcasterId || !targetUserId) {
      setIsSubscribed(false)
      setTier(null)
      return
    }

    setLoading(true)
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('id, tier:subscription_tiers (id, name, color_hex, icon_name, sort_order, price_coins, benefits, sla_uptime_guarantee_pct, sla_quality_guarantee, sla_chat_priority, sla_support_response_secs, sla_features)')
        .eq('subscriber_id', targetUserId)
        .eq('broadcaster_id', targetBroadcasterId)
        .eq('is_active', true)
        .maybeSingle()

      setIsSubscribed(!!data)
      if (data?.tier) {
        setTier(data.tier as SubscriptionTierInfo)
      } else {
        setTier(null)
      }
    } catch {
      setIsSubscribed(false)
      setTier(null)
    } finally {
      setLoading(false)
    }
  }, [targetBroadcasterId, targetUserId])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  return { isSubscribed, tier, loading, refresh: checkSubscription }
}

export function useSubscriberUsernames(broadcasterId?: string) {
  const [usernames, setUsernames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!broadcasterId) {
      setUsernames(new Set())
      return
    }

    setLoading(true)
    ;(supabase
      .from('user_subscriptions')
      .select(`
        subscriber_id,
        user_profiles:subscriber_id (username),
        tier:subscription_tiers (name, color_hex)
      `)
      .eq('broadcaster_id', broadcasterId)
      .eq('is_active', true) as any
    ).then(({ data }) => {
      if (data) {
        const nameSet = new Set<string>()
        data.forEach((row: any) => {
          if (row.user_profiles?.username) {
            nameSet.add(row.user_profiles.username)
          }
        })
        setUsernames(nameSet)
      }
    })
    .then(undefined, (err) => {
      console.error('[useSubscriberUsernames] error:', err)
      setUsernames(new Set())
    })
    .finally(() => setLoading(false))
  }, [broadcasterId])

  return { subscriberUsernames: usernames, loading }
}

export interface SubscriberBadge {
  username: string
  tierName: string
  tierColor: string
  slaUptimeGuarantee?: number
  slaQualityGuarantee?: string
}

export function useSubscriberBadges(broadcasterId?: string) {
  const [badges, setBadges] = useState<Map<string, SubscriberBadge>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!broadcasterId) {
      setBadges(new Map())
      return
    }

    setLoading(true)
      ;(supabase
        .from('user_subscriptions')
        .select(`
          subscriber_id,
          user_profiles:subscriber_id (username),
          tier:subscription_tiers (name, color_hex, sla_uptime_guarantee_pct, sla_quality_guarantee)
        `)
        .eq('broadcaster_id', broadcasterId)
        .eq('is_active', true) as any
      ).then(({ data }) => {
        const badgeMap = new Map<string, SubscriberBadge>()
        if (data) {
          data.forEach((row: any) => {
            if (row.user_profiles?.username) {
              badgeMap.set(row.user_profiles.username, {
                username: row.user_profiles.username,
                tierName: row.tier?.name || 'Fan',
                tierColor: row.tier?.color_hex || '#6B7280',
                slaUptimeGuarantee: row.tier?.sla_uptime_guarantee_pct || undefined,
                slaQualityGuarantee: row.tier?.sla_quality_guarantee || undefined,
              })
            }
          })
        }
        setBadges(badgeMap)
      })
      .then(undefined, (err) => {
        console.error('[useSubscriberBadges] error:', err)
        setBadges(new Map())
      })
      .finally(() => setLoading(false))
  }, [broadcasterId])

  const isSubscriber = useCallback((username: string) => {
    return badges.has(username)
  }, [badges])

  const getBadge = useCallback((username: string) => {
    return badges.get(username) || null
  }, [badges])

  return { isSubscriber, getBadge, badges, loading }
}

/**
 * Get the highest subscription tier a user holds across all broadcasters.
 * VIP+ subscribers get auto-highlighted chat in ALL streams they watch.
 */
export function useUserSubscriptionTier(userId?: string) {
  const { user } = useAuthStore()
  const targetUserId = userId || user?.id
  const [highestTier, setHighestTier] = useState<SubscriptionTierInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!targetUserId) {
      setHighestTier(null)
      return
    }
    setLoading(true)
    ;(supabase
      .from('user_subscriptions')
      .select('tier:subscription_tiers (id, name, color_hex, icon_name, sort_order, price_coins, benefits, sla_uptime_guarantee_pct, sla_quality_guarantee, sla_chat_priority, sla_support_response_secs, sla_features)')
      .eq('subscriber_id', targetUserId)
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .limit(1) as any
    ).then(({ data }) => {
      if (data && data.length > 0 && data[0].tier) {
        setHighestTier(data[0].tier as SubscriptionTierInfo)
      } else {
        setHighestTier(null)
      }
    })
    .then(undefined, () => setHighestTier(null))
    .finally(() => setLoading(false))
  }, [targetUserId])

  return { highestTier, loading }
}