import { useEffect, useState } from 'react'
import { Building2, Loader2, MapPin, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

type CityIdentity = {
  street_name: string
  zip_code: string
  neighborhood_name: string | null
}

export default function CityIdentityPanel() {
  const [identity, setIdentity] = useState<CityIdentity>({ street_name: '', zip_code: '', neighborhood_name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      if (!sessionData.user) return
      const { data } = await supabase
        .from('city_identities')
        .select('street_name, zip_code, neighborhood_name')
        .eq('user_id', sessionData.user.id)
        .maybeSingle()
      if (active && data) setIdentity(data)
    })().finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('set_city_identity', {
      p_street_name: identity.street_name,
      p_zip_code: identity.zip_code,
      p_neighborhood_name: identity.neighborhood_name || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message || 'Unable to save city identity')
      return
    }
    toast.success('City identity saved')
  }

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_34px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10">
          <Building2 className="h-5 w-5 text-cyan-200" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Your City Identity</h2>
          <p className="text-sm text-slate-400">Establish your place in MaiTroll.</p>
        </div>
      </div>
      {loading ? <p className="text-sm text-cyan-100/60">Loading city identity...</p> : (
        <div className="space-y-3">
          <input aria-label="Street name" value={identity.street_name} onChange={(event) => setIdentity({ ...identity, street_name: event.target.value })} placeholder="Street name" maxLength={80} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40" />
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/60" />
            <input aria-label="ZIP code" value={identity.zip_code} onChange={(event) => setIdentity({ ...identity, zip_code: event.target.value.replace(/[^0-9-]/g, '').slice(0, 10) })} placeholder="ZIP code" className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-300/40" />
          </div>
          <input aria-label="Neighborhood name" value={identity.neighborhood_name || ''} onChange={(event) => setIdentity({ ...identity, neighborhood_name: event.target.value })} placeholder="Neighborhood (optional)" maxLength={80} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40" />
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save City Identity
          </button>
        </div>
      )}
    </section>
  )
}