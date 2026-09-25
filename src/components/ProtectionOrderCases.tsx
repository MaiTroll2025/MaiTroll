import { useCallback, useEffect, useState } from 'react'
import { Calendar, CheckCircle, Gavel, Shield, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

interface ProtectionOrderCasesProps { compact?: boolean }

export default function ProtectionOrderCases({ compact = false }: ProtectionOrderCasesProps) {
  const { user, profile } = useAuthStore()
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const canDecide = profile?.is_admin === true || profile?.is_judge === true || ['admin', 'judge', 'lead_troll_officer'].includes(String(profile?.role || '')) || ['admin', 'judge', 'lead_troll_officer'].includes(String(profile?.troll_role || ''))

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const query = supabase.from('protection_orders').select('*, protection_order_respondents(respondent_uuid, username_at_filing)').order('filed_at', { ascending: false }).limit(20)
    const { data, error } = canDecide ? await query : await query.eq('petitioner_uuid', user.id)
    if (error) toast.error(error.message)
    setCases(data || [])
    setLoading(false)
  }, [canDecide, user?.id])

  useEffect(() => { load() }, [load])
  if (!user?.id || loading || cases.length === 0) return null

  const decide = async (id: string, grant: boolean) => {
    const { data, error } = await supabase.rpc('decide_protection_order', { p_order_id: id, p_grant: grant })
    if (error || !data?.success) toast.error(error?.message || data?.message || 'Decision could not be recorded.')
    else { toast.success(grant ? 'Protection Order is active.' : 'Protection Order denied.'); load() }
  }

  return (
    <section className="rounded-3xl border border-amber-300/15 bg-[#120b08]/80 p-5 text-amber-50 shadow-xl sm:p-6">
      <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-amber-300" /><div><h2 className="text-lg font-black">Protection Orders</h2><p className="text-xs text-amber-100/55">{canDecide ? 'Judge review queue and court records' : 'Your court records'}</p></div></div>
      <div className="mt-4 space-y-3">
        {cases.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.case_number}</strong><span className="rounded-full border border-amber-300/20 px-2 py-1 text-[10px] font-black uppercase text-amber-200">{item.status}</span></div>
            <div className="mt-3 grid gap-2 text-xs text-amber-100/65 sm:grid-cols-3"><span>Filed {new Date(item.filed_at).toLocaleDateString()}</span><span className="flex items-center gap-1"><Calendar size={13} /> Hearing {new Date(item.hearing_date).toLocaleDateString()}</span><span>Respondents {item.protection_order_respondents?.length || 0}</span></div>
            {item.granted_at && <p className="mt-2 text-xs text-emerald-200/75">Active through {new Date(item.expires_at).toLocaleDateString()}</p>}
            {canDecide && item.status === 'PENDING_HEARING' && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => decide(item.id, true)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600/80 px-3 text-xs font-black text-white"><CheckCircle size={15} /> Grant</button><button type="button" onClick={() => decide(item.id, false)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700/80 px-3 text-xs font-black text-white"><XCircle size={15} /> Deny</button></div>}
          </article>
        ))}
      </div>
      {!compact && <p className="mt-4 flex items-center gap-2 text-xs text-amber-100/45"><Gavel size={14} /> Protection Orders cannot be cancelled by petitioners after a grant.</p>}
    </section>
  )
}
