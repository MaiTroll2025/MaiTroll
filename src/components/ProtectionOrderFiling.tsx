import { useEffect, useState } from 'react'
import { Calendar, CheckCircle, Search, Shield, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

interface Respondent {
  id: string
  username: string
  avatar_url?: string | null
}

interface ProtectionOrderFilingProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const BASE_FEE = 100
const ADDITIONAL_FEE = 10

export default function ProtectionOrderFiling({ isOpen, onClose, onSuccess }: ProtectionOrderFilingProps) {
  const { user, profile } = useAuthStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Respondent[]>([])
  const [respondents, setRespondents] = useState<Respondent[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expedited, setExpedited] = useState(false)

  const total = respondents.length ? BASE_FEE + (respondents.length - 1) * ADDITIONAL_FEE : 0
  const balance = Number(profile?.troll_coins || 0)

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setResults([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      const { data, error } = await supabase.rpc('search_protection_order_users', {
        p_username: query.trim(),
      })
      if (!cancelled) {
        if (error) toast.error(error.message)
        setResults((data || []) as Respondent[])
        setSearching(false)
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isOpen, query])

  const addRespondent = (respondent: Respondent) => {
    if (respondent.id === user?.id) {
      toast.error('You cannot file a protection order against yourself.')
      return
    }
    setRespondents((current) => current.some((item) => item.id === respondent.id) ? current : [...current, respondent])
    setQuery('')
    setResults([])
  }

  const removeRespondent = (id: string) => setRespondents((current) => current.filter((item) => item.id !== id))

  const submit = async () => {
    if (!user?.id || respondents.length === 0 || submitting) return
    if (balance < total) {
      toast.error(`You need ${total} Troll Coins. Your balance is ${balance}.`)
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('file_protection_order', {
      p_respondent_ids: respondents.map((respondent) => respondent.id),
      p_idempotency_key: crypto.randomUUID(),
      p_expedited: expedited,
    })

    if (error || !data?.success) {
      toast.error(error?.message || data?.message || 'Protection order filing failed.')
      setSubmitting(false)
      return
    }

    toast.success(`Protection order filed. Hearing: ${new Date(data.hearing_date).toLocaleDateString()}`)
    setRespondents([])
    setQuery('')
    setExpedited(false)
    setSubmitting(false)
    onSuccess?.()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="protection-order-title">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-amber-300/20 bg-[#140b09] p-5 text-amber-50 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3"><Shield className="h-6 w-6 text-amber-200" /></div>
            <div>
              <h2 id="protection-order-title" className="text-xl font-black sm:text-2xl">File Protection Order</h2>
              <p className="mt-1 text-sm leading-5 text-amber-100/65">A Protection Order lasts 6 months after it is granted by a Troll Court judge.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-amber-100/60 hover:bg-white/10"><X size={20} /></button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-300/15 bg-black/20 p-4 text-sm text-amber-100/75">
          Filing fee: 100 Troll Coins for the first respondent and 10 Troll Coins for each additional respondent. The fee is charged once when this filing is submitted.
        </div>

        <label className="mt-5 block text-sm font-bold" htmlFor="protection-respondent-search">Search username</label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-amber-100/40" />
          <input id="protection-respondent-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter current or recent username" className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-base outline-none focus:border-amber-300/50" />
          {searching && <span className="absolute right-3 top-3 text-xs text-amber-100/50">Searching...</span>}
          {results.length > 0 && (
            <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#21100d] shadow-xl">
              {results.map((result) => <button key={result.id} type="button" onClick={() => addRespondent(result)} className="flex min-h-12 w-full items-center px-4 text-left text-sm hover:bg-amber-400/10">@{result.username}</button>)}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100/50">Protected From</p>
          {respondents.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-amber-100/45">Add at least one respondent to continue.</p> : respondents.map((respondent) => <div key={respondent.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span>@{respondent.username}</span><button type="button" onClick={() => removeRespondent(respondent.id)} aria-label={`Remove @${respondent.username}`} className="rounded-lg p-2 text-amber-100/50 hover:bg-white/10"><X size={16} /></button></div>)}
        </div>

        <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm"><input type="checkbox" checked={expedited} onChange={(event) => setExpedited(event.target.checked)} className="h-5 w-5 accent-amber-400" />Request expedited hearing review</label>

        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
          <div className="flex items-center justify-between text-sm"><span>Respondents</span><strong>{respondents.length}</strong></div>
          <div className="mt-2 flex items-center justify-between text-sm"><span>Base fee</span><strong>{respondents.length ? BASE_FEE : 0} Troll Coins</strong></div>
          <div className="mt-2 flex items-center justify-between text-sm"><span>Additional respondents</span><strong>{Math.max(0, respondents.length - 1) * ADDITIONAL_FEE} Troll Coins</strong></div>
          <div className="mt-3 flex items-center justify-between border-t border-amber-100/15 pt-3 text-lg font-black"><span>Total</span><span>{total} Troll Coins</span></div>
          <p className="mt-2 text-xs text-amber-100/60">Your balance: {balance} Troll Coins</p>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-12 rounded-2xl border border-white/10 px-5 font-bold text-amber-100/70 hover:bg-white/10">Keep Reviewing</button>
          <button type="button" onClick={submit} disabled={submitting || respondents.length === 0} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-red-700 px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle size={18} />{submitting ? 'Filing...' : 'Confirm & File'}</button>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-amber-100/50"><Calendar size={14} /> Hearings normally follow Tuesday and Thursday court dates.</p>
      </div>
    </div>
  )
}
