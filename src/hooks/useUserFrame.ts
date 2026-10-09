import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useProfileFrameStore } from '@/stores/useProfileFrameStore'
import type { ProfileFrame } from '@/config/profileFrames'
import { frameCache, frameListeners, notifyFrameListeners } from '@/lib/frameCache';

// ─── Realtime subscription management ─────────────────────────
const activeSubscriptions = new Map<string, ReturnType<typeof supabase.channel>>()

/** Fetch a user's equipped frame and update the cache.
 *  First tries the in-memory catalog, then falls back to a direct DB join
 *  so newly-purchased frames are found immediately without a catalog reload. */
async function fetchAndCacheUserFrame(userId: string) {
  try {
    const catalog = useProfileFrameStore.getState().catalog

    // 1) Get the equipped frame_id for this user
    const { data: userFrame } = await supabase
      .from('user_profile_frames')
      .select('frame_id')
      .eq('user_id', userId)
      .eq('is_equipped', true)
      .maybeSingle()

    if (!userFrame?.frame_id) {
      frameCache.set(userId, null)
      return null
    }

    // 2) Try to find it in the in-memory catalog first (instant)
    let found = catalog.find((f: ProfileFrame) => f.id === userFrame.frame_id) || null

    // 3) If not in catalog (e.g. just purchased), fetch frame data directly from DB
    if (!found) {
      const { data: frameRow } = await supabase
        .from('profile_frames')
        .select('*')
        .eq('id', userFrame.frame_id)
        .maybeSingle()

      if (frameRow) {
        found = {
          id: frameRow.id,
          name: frameRow.name,
          description: frameRow.description || '',
          icon: frameRow.icon || '✨',
          animationType: frameRow.animation_type,
          frameStyle: frameRow.frame_style || 'flat',
          borderColor: frameRow.border_color || '#ffffff',
          borderGradient: frameRow.border_gradient || null,
          glowColor: frameRow.glow_color || null,
          glowIntensity: frameRow.glow_intensity ?? 1,
          animationSpeed: frameRow.animation_speed || 'normal',
          hasParticles: frameRow.has_particles ?? false,
          particleColor: frameRow.particle_color || null,
          particleCount: frameRow.particle_count ?? 4,
          hasSparkles: frameRow.has_sparkles ?? false,
          hasEnergyRings: frameRow.has_energy_rings ?? false,
          rarity: frameRow.rarity || 'common',
          coinCost: frameRow.coin_cost ?? 0,
          isActive: frameRow.is_active ?? true,
          isLimited: frameRow.is_limited ?? false,
          limitedQuantity: frameRow.limited_quantity ?? null,
          sortOrder: frameRow.sort_order ?? 0,
        }
        // Also push into the Zustand catalog so future lookups are instant
        const state = useProfileFrameStore.getState()
        if (!state.catalog.find((f: ProfileFrame) => f.id === found!.id)) {
          useProfileFrameStore.setState({
            catalog: [...state.catalog, found],
          })
        }
      }
    }

    frameCache.set(userId, found)
    return found
  } catch {
    frameCache.set(userId, null)
    return null
  }
}

/** Ensure a realtime subscription exists for a user's frame changes */
function ensureSubscription(userId: string) {
  if (activeSubscriptions.has(userId)) return

  const channel = supabase
    .channel(`user-frame-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_profile_frames',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        // Frame changed in DB — re-fetch and notify all listeners
        fetchAndCacheUserFrame(userId).then(() => notifyFrameListeners())
      }
    )
    .subscribe()

  activeSubscriptions.set(userId, channel)
}

// ─── Hook ─────────────────────────────────────────────────────
export function useUserFrame(userId: string | undefined): ProfileFrame | null {
  const [frame, setFrame] = useState<ProfileFrame | null>(() => {
    if (!userId) return null
    return frameCache.get(userId) ?? null
  })
  const catalog = useProfileFrameStore((s) => s.catalog)
  const fetchedRef = useRef<string | null>(null)

  // Subscribe to global cache invalidation notifications
  useEffect(() => {
    const listener = () => {
      if (userId && frameCache.has(userId)) {
        setFrame(frameCache.get(userId) ?? null)
      }
    }
    frameListeners.add(listener)
    return () => { frameListeners.delete(listener) }
  }, [userId])

  // When the equipped frame changes in the Zustand store (for current user), re-fetch
  const equippedFrameId = useProfileFrameStore((s) => s.equippedFrameId)
  const currentUserId = useAuthStore((s) => s.user?.id)
  useEffect(() => {
    if (userId && userId === currentUserId) {
      frameCache.delete(userId)
      fetchAndCacheUserFrame(userId).then((f) => setFrame(f))
    }
  }, [equippedFrameId, userId, currentUserId])

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!userId) {
      setFrame(null)
      return
    }

    if (frameCache.has(userId)) {
      setFrame(frameCache.get(userId) ?? null)
    } else if (fetchedRef.current !== userId) {
      fetchedRef.current = userId
      fetchAndCacheUserFrame(userId).then((f) => setFrame(f))
    }

    // Set up realtime subscription for this user's frame changes
    ensureSubscription(userId)
  }, [userId, catalog])

  return frame
}

export function clearUserFrameCache() {
  frameCache.clear()
}
