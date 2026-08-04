import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export interface QuickGift {
  id: string
  gift_id?: string
  name: string
  icon: string
  cost: number
  category?: string
  slug?: string
  usage_count?: number // Optional: how many times sent in this stream
}

interface UseQuickBroadcastGiftsOptions {
  streamId: string | null
  recentGifts?: Array<{ gift_name?: string; gift_id?: string; quantity?: number }> // For live usage ranking
  limit?: number
}

/**
 * Hook to fetch and rank quick gifts for the broadcast quick gift row.
 * 
 * Strategy:
 * 1. Fetch active gifts from the gift catalog
 * 2. Score them by: stream usage (highest), then platform usage, then alphabetical
 * 3. Return top N gifts for the quick row
 * 4. Update usage as real gifts arrive
 *
 * This is a unique Mai Troll feature: "live rotating quick gifts"
 */
export function useQuickBroadcastGifts({
  streamId,
  recentGifts = [],
  limit = 6,
}: UseQuickBroadcastGiftsOptions) {
  const [allGifts, setAllGifts] = useState<QuickGift[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On mount, fetch all active gifts from the catalog
  useEffect(() => {
    setIsLoading(true)
    setError(null)

    const fetchGiftCatalog = async () => {
      try {
        // Try multiple tables in order of preference
        const tables = [
          'gift_items',
          'gifts',
          'gift_catalog',
          'broadcast_gifts',
        ]

        let rawGifts: any[] = []

        for (const table of tables) {
          try {
            const { data, error: err } = await supabase
              .from(table)
              .select('id, gift_id, name, gift_name, icon, icon_url, value, cost, price, coin_cost, category, gift_slug')
              .limit(200)

            if (!err && data && data.length > 0) {
              rawGifts = data
              if (import.meta.env.DEV) {
                console.debug(`[useQuickBroadcastGifts] Loaded ${data.length} gifts from table "${table}"`)
              }
              break
            }
          } catch (err) {
            console.warn(`[useQuickBroadcastGifts] Table "${table}" failed:`, err)
            continue
          }
        }

        if (!rawGifts.length) {
          console.warn('[useQuickBroadcastGifts] No gifts found in any table')
          setAllGifts([])
          setIsLoading(false)
          return
        }

        // Normalize to QuickGift format
        const normalized: QuickGift[] = rawGifts.map((g: any) => ({
          id: g.id || '',
          gift_id: g.gift_id || g.id || '',
          name: g.name || g.gift_name || 'Unknown Gift',
          icon: g.icon || g.icon_url || '🎁',
          cost: g.coin_cost || g.value || g.cost || g.price || 0,
          category: g.category || 'general',
          slug: g.slug || g.gift_slug || (g.name || 'gift').toLowerCase().replace(/\s+/g, '-'),
          usage_count: 0,
        }))

        setAllGifts(normalized)
        setIsLoading(false)
      } catch (err) {
        console.error('[useQuickBroadcastGifts] Error fetching gifts:', err)
        setError(err instanceof Error ? err.message : 'Failed to load gifts')
        setIsLoading(false)
      }
    }

    fetchGiftCatalog()
  }, [])

  // Score and rank gifts based on recent usage in this stream
  const quickGifts = useMemo(() => {
    if (allGifts.length === 0) return []

    // Count usage of each gift in recent gifts
    const usageMap = new Map<string, number>()

    recentGifts.forEach((gift) => {
      const key = (gift.gift_name || gift.gift_id || '').toLowerCase()
      if (key) {
        usageMap.set(key, (usageMap.get(key) || 0) + (gift.quantity || 1))
      }
    })

    // Score each gift
    const scored = allGifts.map((gift) => {
      const usage = usageMap.get(gift.name.toLowerCase()) || 0
      return {
        ...gift,
        usage_count: usage,
        score:
          usage * 1000 + // Heavily weight recent usage
          (1000 - gift.cost), // Then weight by value (cheaper first as fallback)
      }
    })

    // Sort by score descending, then by cost ascending
    const sorted = scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.cost - b.cost
      })
      .slice(0, limit)
      .map(({ score, ...rest }) => rest) // Remove temporary score field

    return sorted
  }, [allGifts, recentGifts, limit])

  return {
    quickGifts,
    isLoading,
    error,
    allGifts, // Useful for debugging or if caller wants full list
  }
}
