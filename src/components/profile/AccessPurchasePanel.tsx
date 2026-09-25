import { useEffect, useState } from 'react'
import { Coins, Loader2, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

type AccessType = 'broadcast_access' | 'profile_access' | 'mail_access'
type AccessProduct = { access_type: AccessType; enabled: boolean; price_coins: number }

const labels: Record<AccessType, string> = {
  broadcast_access: 'Broadcast access',
  profile_access: 'Profile access',
  mail_access: 'UTroMail access',
}

function idempotencyKey() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function AccessPurchasePanel({ recipientId }: { recipientId: string }) {
  const [products, setProducts] = useState<AccessProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<AccessType | null>(null)

  useEffect(() => {
    let active = true
    void supabase
      .from('access_products')
      .select('access_type, enabled, price_coins')
      .eq('owner_id', recipientId)
      .eq('enabled', true)
      .gt('price_coins', 0)
      .then(({ data }) => {
        if (active) setProducts((data || []) as AccessProduct[])
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [recipientId])

  const purchase = async (product: AccessProduct) => {
    setPurchasing(product.access_type)
    const { data, error } = await supabase.rpc('purchase_access', {
      p_recipient_id: recipientId,
      p_access_type: product.access_type,
      p_idempotency_key: idempotencyKey(),
    })
    setPurchasing(null)
    if (error || !data?.success) {
      toast.error(error?.message || 'Unable to purchase access')
      return
    }
    toast.success(`${labels[product.access_type]} granted`)
  }

  if (loading || products.length === 0) return null

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_34px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <LockKeyhole className="h-5 w-5 text-cyan-200" />
        <div>
          <h2 className="text-lg font-black text-white">Paid Access</h2>
          <p className="text-xs text-slate-400">One-time access, secured by Troll Coins.</p>
        </div>
      </div>
      <div className="space-y-2">
        {products.map((product) => (
          <button key={product.access_type} type="button" onClick={() => void purchase(product)} disabled={purchasing === product.access_type} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.06] disabled:opacity-50">
            <span className="font-bold text-white">{labels[product.access_type]}</span>
            <span className="inline-flex items-center gap-1 text-sm font-black text-cyan-200">
              {purchasing === product.access_type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              {product.price_coins.toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
