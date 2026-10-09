import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { Crown } from 'lucide-react'

interface TopSubscriber {
  id: string
  subscriber_id: string
  subscriber_username: string
  subscriber_display_name: string | null
  subscriber_avatar_url: string | null
  tier_name: string | null
  tier_color_hex: string | null
  created_at: string
}

interface TopSubscribersBarProps {
  broadcasterId: string
  maxSubscribers?: number
}

export const TopSubscribersBar: React.FC<TopSubscribersBarProps> = ({
  broadcasterId,
  maxSubscribers = 3
}) => {
  const { user: _user } = useAuthStore()
  const [subscribers, setSubscribers] = useState<TopSubscriber[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTopSubscribers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          subscriber_id,
          created_at,
          tier:tier_id (name, color_hex)
        `)
        .eq('broadcaster_id', broadcasterId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(maxSubscribers)

      if (error) throw error

      // Fetch subscriber profiles
      const subscriberIds = (data || []).map((s: any) => s.subscriber_id).filter(Boolean)
      if (subscriberIds.length === 0) {
        setSubscribers([])
        return
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', subscriberIds)

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const formatted: TopSubscriber[] = (data || []).map((s: any) => ({
        id: s.id,
        subscriber_id: s.subscriber_id,
        subscriber_username: profileMap.get(s.subscriber_id)?.username || 'unknown',
        subscriber_display_name: profileMap.get(s.subscriber_id)?.display_name,
        subscriber_avatar_url: profileMap.get(s.subscriber_id)?.avatar_url,
        tier_name: s.tier?.name,
        tier_color_hex: s.tier?.color_hex,
        created_at: s.created_at
      }))

      setSubscribers(formatted)
    } catch (err) {
      console.error('[TopSubscribersBar] Error fetching subscribers:', err)
    } finally {
      setLoading(false)
    }
  }, [broadcasterId, maxSubscribers])

  useEffect(() => {
    if (!broadcasterId) return

    fetchTopSubscribers()
  }, [broadcasterId, fetchTopSubscribers])

  if (loading || subscribers.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/30 border border-cyan-500/20 backdrop-blur">
      <Crown className="w-4 h-4 text-cyan-400" />
      <span className="text-xs font-semibold text-cyan-300 mr-1">Top Fans:</span>
      <div className="flex -space-x-2">
        {subscribers.map((sub) => (
          <div
            key={sub.id}
            className="relative group"
            title={`${sub.subscriber_display_name || sub.subscriber_username} - ${sub.tier_name || 'Fan'}`}
          >
            <img
              src={sub.subscriber_avatar_url || '/default-avatar.png'}
              alt={sub.subscriber_username}
              className="w-6 h-6 rounded-full border-2 border-cyan-500/50 object-cover"
              style={{
                boxShadow: `0 0 8px ${sub.tier_color_hex || '#06B6D4'}40`
              }}
            />
            <div
              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-slate-900"
              style={{ backgroundColor: sub.tier_color_hex || '#06B6D4' }}
            />
          </div>
        ))}
      </div>
</div>
    )
  }

export default TopSubscribersBar