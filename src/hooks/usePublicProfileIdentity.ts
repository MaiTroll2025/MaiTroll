import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

export interface PublicProfileIdentity {
  id: string
  username: string
  avatar_url: string | null
}

const IDENTITY_CACHE_TTL_MS = 15_000
const identityCache = new Map<string, { identity: PublicProfileIdentity; expiresAt: number }>()

export function usePublicProfileIdentity(userId?: string | null) {
  const viewerId = useAuthStore((state) => state.user?.id || 'anonymous')
  const [identityState, setIdentityState] = useState<{
    cacheKey: string
    identity: PublicProfileIdentity | null
  } | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const cacheKey = userId ? `${viewerId}:${userId}` : null
  const identity = identityState?.cacheKey === cacheKey ? identityState.identity : null

  useEffect(() => {
    if (!userId) {
      setIdentityState(null)
      setLoading(false)
      return
    }

    const requestCacheKey = `${viewerId}:${userId}`
    let mounted = true
    let requestInFlight = false

    const loadIdentity = async () => {
      const cached = identityCache.get(requestCacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        if (mounted) {
          setIdentityState({ cacheKey: requestCacheKey, identity: cached.identity })
          setLoading(false)
        }
        return
      }
      if (requestInFlight) return
      requestInFlight = true

      try {
        const { data, error } = await supabase
          .from('user_profiles_public_identity')
          .select('id, username, avatar_url')
          .eq('id', userId)
          .maybeSingle()

        if (error) throw error
        const safeIdentity = data
          ? {
              id: data.id,
              username: data.username || 'xxxxx',
              avatar_url: data.avatar_url || null,
            }
          : null

        if (safeIdentity) {
          identityCache.set(requestCacheKey, {
            identity: safeIdentity,
            expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS,
          })
        } else {
          identityCache.delete(requestCacheKey)
        }
        if (mounted) setIdentityState({ cacheKey: requestCacheKey, identity: safeIdentity })
      } catch (error) {
        console.error('[usePublicProfileIdentity] Failed to load authorized identity projection:', error)
        identityCache.delete(requestCacheKey)
        if (mounted) setIdentityState({ cacheKey: requestCacheKey, identity: null })
      } finally {
        requestInFlight = false
        if (mounted) setLoading(false)
      }
    }

    setIdentityState(null)
    setLoading(true)
    void loadIdentity()
    const refresh = window.setInterval(() => {
      identityCache.delete(requestCacheKey)
      void loadIdentity()
    }, IDENTITY_CACHE_TTL_MS)

    return () => {
      mounted = false
      window.clearInterval(refresh)
    }
  }, [userId, viewerId])

  return { identity, loading }
}

export function clearPublicProfileIdentityCache(userId?: string) {
  if (!userId) {
    identityCache.clear()
    return
  }
  for (const key of identityCache.keys()) {
    if (key.endsWith(`:${userId}`)) identityCache.delete(key)
  }
}
