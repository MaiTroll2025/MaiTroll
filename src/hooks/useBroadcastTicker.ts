// src/hooks/useBroadcastTicker.ts
// Hook for fetching and updating the per-broadcast ticker data
// (announcement + wishlist_url) stored on the `streams` table.
// Uses realtime so viewers see updates instantly when the broadcaster
// changes their announcement or wishlist URL.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStreamRealtime } from './useStreamRealtime'

export interface BroadcastTickerData {
  announcement: string | null
  wishlistUrl: string | null
  streamId: string | null
}

interface StreamTickerRow {
  id: string
  announcement: string | null
  wishlist_url: string | null
}

/**
 * Subscribe to a single stream's ticker fields with realtime updates.
 * Returns the current ticker data and a setter for the broadcaster to update it.
 */
export function useBroadcastTicker(streamId?: string | null) {
  const [data, setData] = useState<BroadcastTickerData>({
    announcement: null,
    wishlistUrl: null,
    streamId: streamId || null,
  })

  // Initial fetch
  useEffect(() => {
    if (!streamId) {
      setData({ announcement: null, wishlistUrl: null, streamId: null })
      return
    }

    let cancelled = false
    ;(async () => {
      const { data: row, error } = await supabase
        .from('streams')
        .select('id, announcement, wishlist_url')
        .eq('id', streamId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.warn('[useBroadcastTicker] initial fetch failed:', error)
        return
      }

      if (row) {
        setData({
          announcement: row.announcement || null,
          wishlistUrl: row.wishlist_url || null,
          streamId: row.id,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [streamId])

  // Realtime: watch for changes to the streams row (announcement / wishlist_url)
  useStreamRealtime(
    streamId,
    {
      onStream: (event) => {
        const row = event.new as StreamTickerRow | null
        if (!row) return
        setData({
          announcement: row.announcement || null,
          wishlistUrl: row.wishlist_url || null,
          streamId: row.id,
        })
      },
    }
  )

  /**
   * Update the broadcaster's announcement and/or wishlist URL.
   * Returns `{ success, error }`.
   */
  const updateTicker = async (opts: {
    announcement?: string | null
    wishlistUrl?: string | null
  }): Promise<{ success: boolean; error?: string }> => {
    if (!streamId) return { success: false, error: 'No stream ID' }

    const payload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (opts.announcement !== undefined) payload.announcement = opts.announcement
    if (opts.wishlistUrl !== undefined) payload.wishlist_url = opts.wishlistUrl

    const { error } = await supabase
      .from('streams')
      .update(payload)
      .eq('id', streamId)

    if (error) {
      console.error('[useBroadcastTicker] update failed:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  return { data, updateTicker }
}