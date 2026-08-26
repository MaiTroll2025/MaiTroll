/**
 * MKey wallet hook.
 *
 * Reads the server-authoritative available / held balance and keeps it fresh
 * when MKeys move (a send holds them, a claim consumes one, an expiry returns
 * one). The client never derives a balance locally — it re-reads the server.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { fetchMKeyWallet, sweepExpiredMKeys, type MKeyWallet } from '../lib/mkeys'

const EMPTY: MKeyWallet = {
  available: 0,
  held: 0,
  total: 0,
  lifetimeSent: 0,
  lifetimeClaimed: 0,
  lifetimeReturned: 0,
  inviteExpirySeconds: 300,
  maxAmountPerSend: 500,
}

export function useMKeyWallet(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false
  const { user } = useAuthStore()
  const userId = user?.id ?? null

  const [wallet, setWallet] = useState<MKeyWallet>(EMPTY)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!userId || !enabled) {
      setWallet(EMPTY)
      return EMPTY
    }
    setLoading(true)
    const next = await fetchMKeyWallet()
    if (mountedRef.current) {
      setWallet(next)
      setLoading(false)
    }
    return next
  }, [userId, enabled])

  useEffect(() => {
    if (!userId || !enabled) return
    void refresh()
  }, [userId, enabled, refresh])

  // Re-read whenever one of this user's MKeys changes state server-side.
  useEffect(() => {
    if (!userId || !enabled) return

    const channel = supabase
      .channel(`mkey-wallet:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mkey_transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, enabled, refresh])

  // Belt and braces: nudge the expiry sweep so held MKeys can never be
  // stranded if the scheduled sweep is unavailable.
  useEffect(() => {
    if (!userId || !enabled) return
    if (wallet.held <= 0) return

    let cancelled = false
    const tick = async () => {
      await sweepExpiredMKeys()
      if (!cancelled) await refresh()
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void tick()
    }, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [userId, enabled, wallet.held, refresh])

  return { wallet, loading, refresh }
}
