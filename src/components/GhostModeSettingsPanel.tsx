import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import GhostModeAvatar, { type GhostModeTier } from '@/components/GhostModeAvatar'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { clearProfileCache } from '@/lib/profileCache'
import { clearPublicProfileIdentityCache } from '@/hooks/usePublicProfileIdentity'

interface GhostEntitlement {
  tier: GhostModeTier
  starts_at: string
  expires_at: string | null
}

function isActive(entitlement: GhostEntitlement | null, now: number) {
  if (!entitlement || new Date(entitlement.starts_at).getTime() > now) return false
  return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() > now
}

export default function GhostModeSettingsPanel() {
  const user = useAuthStore((state) => state.user)
  const [entitlement, setEntitlement] = useState<GhostEntitlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [now, setNow] = useState(Date.now())

  const loadEntitlement = useCallback(async () => {
    if (!user) {
      setEntitlement(null)
      setLoadError(false)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('ghost_mode_entitlements')
      .select('tier, starts_at, expires_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('[GhostModeSettingsPanel] Failed to load entitlement:', error)
      toast.error('Could not load Ghost Mode status.')
      setEntitlement(null)
      setLoadError(true)
      setLoading(false)
      return
    }
    setLoadError(false)
    if (data && (data.tier === 'basic' || data.tier === 'supreme')) {
      setEntitlement(data as GhostEntitlement)
    } else {
      setEntitlement(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadEntitlement()
  }, [loadEntitlement])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(interval)
  }, [])

  const runAction = async (
    rpc: 'activate_basic_ghost_mode' | 'buy_ghost_mode_supreme' | 'deactivate_ghost_mode',
  ) => {
    setBusy(true)
    try {
      const { error } = await supabase.rpc(rpc)
      if (error) throw error
      if (user) {
        clearProfileCache(user.id)
        clearPublicProfileIdentityCache(user.id)
      }
      await loadEntitlement()
      toast.success(
        rpc === 'deactivate_ghost_mode'
          ? 'Ghost Mode turned off.'
          : rpc === 'buy_ghost_mode_supreme'
            ? 'Ghost Mode Supreme activated for 30 days.'
            : 'Basic Ghost Mode activated for 1 day.',
      )
    } catch (error) {
      console.error(`[GhostModeSettingsPanel] ${rpc} failed:`, error)
      toast.error(error instanceof Error ? error.message : 'Ghost Mode update failed.')
    } finally {
      setBusy(false)
    }
  }

  const active = isActive(entitlement, now)
  const selectedTier: GhostModeTier = entitlement?.tier || 'basic'

  return (
    <section className="rounded-2xl border border-emerald-400/30 bg-slate-950/80 p-5 text-white shadow-[0_0_30px_rgba(34,197,94,0.12)]">
      <div className="flex items-center gap-4">
        <GhostModeAvatar tier={selectedTier} size={64} className="shrink-0" />
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Ghost Mode</h2>
          <p className="text-sm text-slate-300">
            {loading
              ? 'Checking your status…'
              : active
                ? `${entitlement!.tier === 'supreme' ? 'Ghost Mode Supreme' : 'Ghost Mode'} Active`
                : entitlement
                  ? 'Ghost Mode entitlement expired'
                  : 'Hide your public username and profile photo.'}
          </p>
          {loadError && (
            <button
              type="button"
              onClick={() => void loadEntitlement()}
              className="mt-1 text-xs font-semibold text-rose-300 underline"
            >
              Could not verify status. Retry.
            </button>
          )}
          {active && entitlement?.expires_at && (
            <p className="mt-1 text-xs text-slate-400">
              Expires {new Date(entitlement.expires_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-300">
        Basic costs 200 Troll coins per day. Supreme costs 5,000 Troll coins for 30 days and adds
        broadcaster-only private chat, selected-user wall posts, 10% coin-pack discounts, and no
        cashout fees for 30 days.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {!active && (
          <button
            type="button"
            disabled={loading || loadError || busy}
            onClick={() => void runAction('activate_basic_ghost_mode')}
            className="rounded-lg border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
          >
            Basic Ghost Mode - 200 Troll coins / day
          </button>
        )}
        <button
          type="button"
          disabled={loading || loadError || busy}
          onClick={() => void runAction('buy_ghost_mode_supreme')}
          className="rounded-lg bg-gradient-to-r from-purple-700 to-fuchsia-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(192,38,211,0.35)] hover:brightness-110 disabled:opacity-50"
        >
          {active && entitlement?.tier === 'supreme'
            ? 'Extend Supreme - 5,000 Troll coins'
            : 'Ghost Mode Supreme · 5,000 Troll coins / 30 days'}
        </button>
        {active && (
          <button
            type="button"
            disabled={loadError || busy}
            onClick={() => void runAction('deactivate_ghost_mode')}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Turn Ghost Mode Off
          </button>
        )}
      </div>
    </section>
  )
}
