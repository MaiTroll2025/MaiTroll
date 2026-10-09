 import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePageVisibilityContext } from './usePageVisibilityContext'

// Query keys
export const queryKeys = {
  streams: ['streams'] as const,
  liveStreams: ['streams', 'live'] as const,
  newUsers: ['users', 'new'] as const,
  userProfile: (id: string) => ['users', 'profile', id] as const,
  followers: (id: string) => ['users', 'followers', id] as const,
  notifications: (id: string) => ['users', 'notifications', id] as const,
}

// Live streams query
export function useLiveStreams(options?: { refetchInterval?: number; enabled?: boolean }) {
  const { isVisible } = usePageVisibilityContext()
  const refetchInterval = options?.refetchInterval ?? 30000

  return useQuery({
    queryKey: queryKeys.liveStreams,
    queryFn: async () => {
      // Use Scalable RPC - public endpoint, no auth needed for viewing live streams
      const { data, error } = await supabase.rpc('get_active_streams_paged', {
        p_limit: 20,
        p_offset: 0
      });

      if (error) throw error

      return (data || []).map((s: any) => ({
        id: s.id,
        broadcaster_id: s.broadcaster_id,
        title: s.title,
        category: s.category,
        current_viewers: s.current_viewers,
        is_live: true,
        start_time: s.start_time,
        thumbnail_url: s.thumbnail_url,
        stream_momentum: s.stream_momentum || { momentum: 0 },
        user_profiles: {
            username: s.broadcaster_username,
            avatar_url: s.broadcaster_avatar,
            date_of_birth: s.broadcaster_dob
        }
      }))
    },
    refetchInterval: isVisible ? refetchInterval : false,
    enabled: options?.enabled ?? true,
  })
}

// New users query
export function useNewUsers() {
  const { isVisible } = usePageVisibilityContext()

  return useQuery({
    queryKey: queryKeys.newUsers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, tier, level, troll_coins, created_at, role, is_banned, rgb_username_expires_at, glowing_username_color')
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) throw error

      // Filter real users
      return (data || []).filter(user => {
        if (user.role === 'admin') return false

        const username = (user.username || '').toLowerCase()

        const isRealUser = !username.includes('test') &&
                         !username.includes('demo') &&
                         !username.includes('mock')

        const isNotBanned = !user.is_banned

        return isRealUser && isNotBanned
      }).slice(0, 20) // Take top 20
    },
    refetchInterval: isVisible ? 30000 : false,
  })
}

// Stream by ID query
export function useStream(streamId: string) {
  return useQuery({
    queryKey: ['streams', streamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, current_viewers, viewer_count, is_live, broadcaster_id, broadcaster:user_profiles!streams_broadcaster_id_fkey(id, username, avatar_url)')
        .eq('id', streamId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!streamId,
    staleTime: 5000, // Consider fresh for 5 seconds
  })
}

// User profile query
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  })
}
