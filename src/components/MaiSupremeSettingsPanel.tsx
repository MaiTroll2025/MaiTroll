import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { clearProfileCache } from '@/lib/profileCache'
import { clearPublicProfileIdentityCache } from '@/hooks/usePublicProfileIdentity'

interface MaiSupremeEntitlement {
  starts_at: string
  expires_at: string
}

function isActive(entitlement: MaiSupremeEntitlement | null, now: number) {
  if (!entitlement) return false
  return new Date(entitlement.starts_at).getTime() <= now
    && new Date(entitlement.expires_at).getTime() > now
}

export default function MaiSupremeSettingsPanel() {
  const user = useAuthStore((state) => state.user)
  const [entitlement, setEntitlement] = useState<MaiSupremeEntitlement | null>(null)
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
      .from('mai_supreme_entitlements')
      .select('starts_at, expires_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[MaiSupremeSettingsPanel] Failed to load entitlement:', error)
      toast.error('Could not load Mai Supreme status.')
      setEntitlement(null)
      setLoadError(true)
      setLoading(false)
      return
    }

    setEntitlement(data)
    setLoadError(false)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadEntitlement()
  }, [loadEntitlement])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(interval)
  }, [])

  const buyMembership = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('buy_mai_supreme')
      if (error) throw error
      clearProfileCache()
      clearPublicProfileIdentityCache()
      await loadEntitlement()
      toast.success('Mai Supreme activated for one month.')
    } catch (error) {
      console.error('[MaiSupremeSettingsPanel] Purchase failed:', error)
      toast.error(error instanceof Error ? error.message : 'Mai Supreme purchase failed.')
    } finally {
      setBusy(false)
    }
  }

  const active = isActive(entitlement, now)

  return (
    <section className="rounded-2xl border border-cyan-400/30 bg-slate-950/80 p-5 text-white shadow-[0_0_30px_rgba(34,211,238,0.12)]">
      <h2 className="text-xl font-bold">Mai Supreme</h2>
      <p className="mt-1 text-sm text-slate-300">
        {loading
          ? 'Checking your membership...'
          : active
            ? 'Mai Supreme Active'
            : entitlement
              ? 'Mai Supreme membership expired'
              : 'Monthly membership with identity-visibility and platform benefits.'}
      </p>
      {active && entitlement && (
        <p className="mt-1 text-xs text-slate-400">
          Expires {new Date(entitlement.expires_at).toLocaleString()}
        </p>
      )}
      {loadError && (
        <button
          type="button"
          onClick={() => void loadEntitlement()}
          className="mt-2 text-xs font-semibold text-rose-300 underline"
        >
          Could not verify membership. Retry.
        </button>
      )}
      <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-slate-300">
        <li>View Ghost Mode identities while membership is active.</li>
        <li>Join Town Meetings and receive meeting notifications.</li>
        <li>Create law proposals through approved channels.</li>
        <li>Save 5% on coin-pack prices. Active Ghost Mode Supreme gives the 10% Supreme discount instead.</li>
        <li>Creator subscriptions keep their listed coin price; Mai Supreme waives the 20% platform fee.</li>
      </ul>
      <button
        type="button"
        disabled={loading || loadError || busy}
        onClick={() => void buyMembership()}
        className="mt-5 rounded-lg bg-gradient-to-r from-cyan-700 to-blue-600 px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
      >
        {active ? 'Extend Mai Supreme - 2,200 Troll coins / month' : 'Join Mai Supreme - 2,200 Troll coins / month'}
      </button>
    </section>
  )
}
