import { useEffect, useState } from 'react'
import { Coins, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

type AccessType = 'broadcast_access' | 'profile_access' | 'mail_access'

type AccessProduct = {
  access_type: AccessType
  enabled: boolean
  price_coins: number
}

const PRODUCTS: { type: AccessType; label: string }[] = [
  { type: 'broadcast_access', label: 'Broadcast' },
  { type: 'profile_access', label: 'Profile' },
  { type: 'mail_access', label: 'UTroMail' },
]

export default function MaiSubPanel() {
  const [products, setProducts] = useState<Record<AccessType, AccessProduct>>({
    broadcast_access: { access_type: 'broadcast_access', enabled: false, price_coins: 0 },
    profile_access: { access_type: 'profile_access', enabled: false, price_coins: 0 },
    mail_access: { access_type: 'mail_access', enabled: false, price_coins: 0 },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<AccessType | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      if (!sessionData.user) return
      const { data, error } = await supabase
        .from('access_products')
        .select('access_type, enabled, price_coins')
        .eq('owner_id', sessionData.user.id)
      if (!active || error) return
        const next = { ...products }
        for (const product of (data || []) as AccessProduct[]) next[product.access_type] = product
        setProducts(next)
    })()
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [products])

  const update = (type: AccessType, patch: Partial<AccessProduct>) => {
    setProducts((current) => ({ ...current, [type]: { ...current[type], ...patch } }))
  }

  const save = async (type: AccessType) => {
    setSaving(type)
    const product = products[type]
    const { error } = await supabase.rpc('configure_access_product', {
      p_access_type: type,
      p_enabled: product.enabled,
      p_price_coins: product.enabled ? product.price_coins : 0,
    })
    setSaving(null)
    if (error) {
      toast.error(error.message || 'Unable to save MaiSub settings')
      return
    }
    toast.success(`${PRODUCTS.find((item) => item.type === type)?.label} access updated`)
  }

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_34px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10">
          <Coins className="h-5 w-5 text-cyan-200" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">MaiSub</h2>
          <p className="text-sm text-slate-400">Choose which access products you offer.</p>
        </div>
      </div>
      {loading ? <p className="text-sm text-cyan-100/60">Loading access settings...</p> : (
        <div className="space-y-3">
          {PRODUCTS.map(({ type, label }) => {
            const product = products[type]
            return (
              <div key={type} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-white">{label}</p>
                  <p className="text-xs text-slate-400">{product.enabled ? `${product.price_coins.toLocaleString()} Troll Coins` : 'Free access'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => update(type, { enabled: !product.enabled })} className={`rounded-xl border px-3 py-2 text-xs font-bold ${product.enabled ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                    {product.enabled ? 'Paid' : 'Free'}
                  </button>
                  <input aria-label={`${label} price`} type="number" min={0} max={1000} value={product.price_coins} disabled={!product.enabled} onChange={(event) => update(type, { price_coins: Math.max(0, Math.min(1000, Number(event.target.value) || 0)) })} className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white disabled:opacity-40" />
                  <button type="button" title={`Save ${label} access`} onClick={() => void save(type)} disabled={saving === type} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-2 text-cyan-100 disabled:opacity-50">
                    {saving === type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}