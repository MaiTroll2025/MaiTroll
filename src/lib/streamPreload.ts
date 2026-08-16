import { supabase } from './supabase'

export interface PreloadedStreamData {
  id: string
  title: string
  status: string
  is_live: boolean
  user_id: string
  seat_count: number
  box_count: number
  seat_prices: number[] | null
  total_likes: number
  current_viewers: number
  livekit_room_name: string | null
  thumbnail_url: string | null
  poster_url: string | null
  broadcaster?: {
    id: string
    username: string
    avatar_url: string | null
  }
}

const preloadCache = new Map<string, PreloadedStreamData>()

export async function preloadStreamData(streamId: string): Promise<PreloadedStreamData | null> {
  if (!streamId) return null
  const cached = preloadCache.get(streamId)
  if (cached) return cached

  try {
    const { data, error } = await supabase
      .from('streams')
      .select(
        'id, title, status, is_live, user_id, seat_count, box_count, seat_prices, total_likes, current_viewers, livekit_room_name, thumbnail_url, poster_url'
      )
      .eq('id', streamId)
      .maybeSingle()

    if (error || !data) return null

    const result: PreloadedStreamData = {
      id: data.id,
      title: data.title || '',
      status: data.status || '',
      is_live: data.is_live || false,
      user_id: data.user_id || '',
      seat_count: data.seat_count || 0,
      box_count: data.box_count || 0,
      seat_prices: Array.isArray(data.seat_prices) ? data.seat_prices : null,
      total_likes: data.total_likes || 0,
      current_viewers: data.current_viewers || 0,
      livekit_room_name: data.livekit_room_name || null,
      thumbnail_url: data.thumbnail_url || null,
      poster_url: data.poster_url || null,
    }

    preloadCache.set(streamId, result)
    return result
  } catch {
    return null
  }
}

export async function preloadBroadcasterProfile(userId: string): Promise<{ id: string; username: string; avatar_url: string | null } | null> {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null
    return {
      id: data.id,
      username: data.username || '',
      avatar_url: data.avatar_url || null,
    }
  } catch {
    return null
  }
}

export function preloadImage(url: string | null | undefined) {
  if (!url) return
  try {
    const img = new window.Image()
    img.src = url
  } catch {
    // ignore
  }
}

export function getCachedStreamData(streamId: string): PreloadedStreamData | undefined {
  return preloadCache.get(streamId)
}

export function clearStreamPreloadCache(streamId?: string) {
  if (streamId) {
    preloadCache.delete(streamId)
  } else {
    preloadCache.clear()
  }
}
