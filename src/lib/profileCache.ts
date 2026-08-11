import { supabase } from './supabase'

type Profile = {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string | null
  is_ghost_mode?: boolean
  [key: string]: any
}

const profileCache = new Map<string, Profile>()
const inflightRequests = new Map<string, Promise<Profile[]>>()

export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return []

  const cached = ids.map(id => profileCache.get(id)).filter(Boolean) as Profile[]
  const missingIds = ids.filter(id => !profileCache.has(id))
  if (missingIds.length === 0) return cached

  const cacheKey = missingIds.sort().join(',')
  if (inflightRequests.has(cacheKey)) {
    const results = await inflightRequests.get(cacheKey)!
    results.forEach(p => profileCache.set(p.id, p))
    return [...cached, ...results]
  }

  const promise = supabase
    .from('user_profiles')
    .select('*')
    .in('id', missingIds)
    .then(({ data, error }) => {
      inflightRequests.delete(cacheKey)
      if (error || !data) return []
      data.forEach(p => profileCache.set(p.id, p))
      return data as Profile[]
    })
    .then(undefined, () => {
      inflightRequests.delete(cacheKey)
      return []
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
  if (userId) {
    profileCache.delete(userId)
  } else {
    profileCache.clear()
  }
}

export function getCachedProfile(userId: string): Profile | undefined {
  return profileCache.get(userId)
}
