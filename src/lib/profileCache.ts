import { supabase } from './supabase'
import { useAuthStore } from './store'

type Profile = {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string | null
  is_ghost_mode?: boolean
  [key: string]: any
}

const profileCache = new Map<string, Profile>()
const inflightRequests = new Map<string, Promise<any>>()
const profileCacheTimestamps = new Map<string, number>()
const PROFILE_CACHE_TTL_MS = 15_000

export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  const viewerId = useAuthStore.getState().user?.id || 'anonymous'
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return []

  const now = Date.now()
  const cacheKeyFor = (userId: string) => `${viewerId}:${userId}`
  const cached = ids
    .filter(id => {
      const cacheKey = cacheKeyFor(id)
      const cachedAt = profileCacheTimestamps.get(cacheKey)
      if (cachedAt !== undefined && now - cachedAt <= PROFILE_CACHE_TTL_MS) return true
      profileCache.delete(cacheKey)
      profileCacheTimestamps.delete(cacheKey)
      return false
    })
    .map(id => profileCache.get(cacheKeyFor(id)))
    .filter(Boolean) as Profile[]
  const missingIds = ids.filter(id => !profileCache.has(cacheKeyFor(id)))
  if (missingIds.length === 0) return cached

  const cacheKey = `${viewerId}:${missingIds.sort().join(',')}`
  if (inflightRequests.has(cacheKey)) {
    const results = await inflightRequests.get(cacheKey)!
    results.forEach(p => {
      profileCache.set(cacheKeyFor(p.id), p)
      profileCacheTimestamps.set(cacheKeyFor(p.id), Date.now())
    })
    return [...cached, ...results]
  }

  const promise = Promise.resolve(
    Promise.all([
      supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, is_ghost_mode')
        .in('id', missingIds),
      supabase
        .from('user_profiles_public_identity')
        .select('id, username, avatar_url')
        .in('id', missingIds),
    ])
  )
    .then(([profilesResult, identitiesResult]) => {
      inflightRequests.delete(cacheKey)
      if (profilesResult.error) throw profilesResult.error
      if (identitiesResult.error) throw identitiesResult.error

      const identities = new Map(
        (identitiesResult.data || []).map(identity => [identity.id, identity]),
      )
      const data: Profile[] = (profilesResult.data || []).map(profile => {
        const identity = identities.get(profile.id)
        return {
          ...profile,
          username: identity?.username ?? 'xxxxx',
          display_name: identity?.username ?? 'xxxxx',
          avatar_url: identity?.avatar_url ?? null,
        }
      })
      const presentIds = new Set(data.map(profile => profile.id))
      for (const identity of identitiesResult.data || []) {
        if (!presentIds.has(identity.id)) {
          data.push({
            id: identity.id,
            username: identity.username || 'xxxxx',
            display_name: identity.username || 'xxxxx',
            avatar_url: identity.avatar_url || null,
          })
        }
      }
      data.forEach(profile => {
        profileCache.set(cacheKeyFor(profile.id), profile)
        profileCacheTimestamps.set(cacheKeyFor(profile.id), Date.now())
      })
      return data
    })
    .then(undefined, error => {
      inflightRequests.delete(cacheKey)
      throw error
    })

  inflightRequests.set(cacheKey, promise)
  const results = await promise
  return [...cached, ...results]
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const [profile] = await getProfiles([userId])
  return profile ?? null
}

export function clearProfileCache(userId?: string) {
  if (!userId) {
    profileCache.clear()
    profileCacheTimestamps.clear()
    return
  }
  for (const key of profileCache.keys()) {
    if (key.endsWith(`:${userId}`)) profileCache.delete(key)
  }
  for (const key of profileCacheTimestamps.keys()) {
    if (key.endsWith(`:${userId}`)) profileCacheTimestamps.delete(key)
  }
}

export function getCachedProfile(userId: string): Profile | undefined {
  const cacheKey = `${useAuthStore.getState().user?.id || 'anonymous'}:${userId}`
  const cachedAt = profileCacheTimestamps.get(cacheKey)
  if (cachedAt === undefined || Date.now() - cachedAt > PROFILE_CACHE_TTL_MS) {
    profileCache.delete(cacheKey)
    profileCacheTimestamps.delete(cacheKey)
    return undefined
  }
  return profileCache.get(cacheKey)
}
