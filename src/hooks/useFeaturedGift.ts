import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FeaturedGiftCycle, FeaturedGiftLadderItem } from '@/types/featuredLive'

export interface FeaturedGiftState {
  cycle: FeaturedGiftCycle | null
  gift: FeaturedGiftLadderItem | null
  endsAt: string | null
  remainingMs: number
  isActive: boolean
}

export function useFeaturedGift() {
  const [cycle, setCycle] = useState<FeaturedGiftCycle | null>(null)
  const [gift, setGift] = useState<FeaturedGiftLadderItem | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      const { data, error } = await supabase.rpc('get_current_featured_gift')
      if (!active) return
      if (error) {
        console.error('[featured gift] load failed', error)
        return
      }
      const row = (data || [])[0]
      if (!row) return

      setCycle({
        id: String(row.cycle_id),
        cycle_index: Number(row.cycle_index),
        status: 'active',
        current_gift_id: row.gift_id ? String(row.gift_id) : null,
        started_at: row.started_at,
        ends_at: row.ends_at,
        created_at: null,
        updated_at: null,
      })
      setEndsAt(row.ends_at)
      if (row.gift_id) {
        const { data: giftRow } = await supabase
          .from('gifts_catalog')
          .select('*')
          .eq('id', row.gift_id)
          .maybeSingle()
        if (active && giftRow) {
          setGift(giftRow as FeaturedGiftLadderItem)
        }
      }
    }

    void load()

    const channel = supabase
      .channel('featured-gift-cycle')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'featured_gift_cycles',
      }, () => {
        void load()
      })
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [])

  const remainingMs = useMemo(() => {
    if (!endsAt) return 0
    const diff = new Date(endsAt).getTime() - Date.now()
    return diff > 0 ? diff : 0
  }, [endsAt])

  const isActive = useMemo(() => {
    if (!cycle || cycle.status !== 'active' || !endsAt) return false
    return remainingMs > 0
  }, [cycle, endsAt, remainingMs])

  return {
    cycle,
    gift,
    endsAt,
    remainingMs,
    isActive,
    refresh: async () => {
      const { data } = await supabase.rpc('get_current_featured_gift')
      const row = (data || [])[0]
      if (row) {
        setCycle({
          id: String(row.cycle_id),
          cycle_index: Number(row.cycle_index),
          status: 'active',
          current_gift_id: row.gift_id ? String(row.gift_id) : null,
          started_at: row.started_at,
          ends_at: row.ends_at,
          created_at: null,
          updated_at: null,
        })
        setEndsAt(row.ends_at)
        if (row.gift_id) {
          const { data: giftRow } = await supabase
            .from('gifts_catalog')
            .select('*')
            .eq('id', row.gift_id)
            .maybeSingle()
          if (giftRow) setGift(giftRow as FeaturedGiftLadderItem)
        }
      }
    },
  } as const
}
