import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarClock, Search, ShieldCheck, Ticket, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getTromocodeProductLabel, getTromocodePromotionLabel } from '@/lib/tromocode'

const statusFor = (item: any) => {
  const now = Date.now()
  if (!item?.is_active) return 'Inactive'
  if (item?.expires_at && new Date(item.expires_at).getTime() < now) return 'Expired'
  return 'Active'
}

const emptyForm = {
  code: '',
  description: '',
  promotion_type: 'percentage_discount',
  promotion_value: '50',
  applies_to: 'verified_badge',
  max_uses: '100',
  starts_at: new Date(Date.now() - 60000).toISOString().slice(0, 16),
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 16),
  is_active: true,
}

export default function TromocodeAdmin() {
  const [codes, setCodes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'expired' | 'maxed_out'>('all')
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const loadCodes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('tromocodes').select('*').order('created_at', { ascending: false })
      if (error) {
        console.error('Failed to load TromoCodes', error)
        setCodes([])
        return
      }
      setCodes(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCodes()
  }, [])

  const handleCreateTromocode = async () => {
    setError('')
    if (!form.code.trim()) {
      setError('Code is required.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const createdBy = userData?.user?.id ?? null

    try {
      setSaving(true)
      const payload = {
        p_code: form.code,
        p_description: form.description || '',
        p_promotion_type: form.promotion_type,
        p_promotion_value: Number(form.promotion_value),
        p_applies_to: form.applies_to,
        p_max_uses: form.max_uses ? Number(form.max_uses) : null,
        p_starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date(Date.now() - 60000).toISOString(),
        p_expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        p_is_active: form.is_active,
        p_created_by: createdBy,
      }

      const { data, error } = await supabase.rpc('create_tromocode', payload)
      if (error) throw error

      await loadCodes()
      setShowCreateModal(false)
      setForm(emptyForm)
    } catch (submitError: any) {
      setError(submitError?.message || 'Unable to create TromoCode.')
    } finally {
      setSaving(false)
    }
  }

  const filteredCodes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return codes.filter((item) => {
      const matchesSearch = !query || [item.code, item.description, item.applies_to, item.promotion_type].some((value) => String(value || '').toLowerCase().includes(query))
      const currentStatus = statusFor(item)
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && currentStatus === 'Active') ||
        (filter === 'inactive' && currentStatus === 'Inactive') ||
        (filter === 'expired' && currentStatus === 'Expired') ||
        (filter === 'maxed_out' && item.max_uses !== null && item.usage_count >= item.max_uses)

      return matchesSearch && matchesFilter
    })
  }, [codes, search, filter])

  const summary = useMemo(() => {
    const active = codes.filter((item) => statusFor(item) === 'Active').length
    const expired = codes.filter((item) => statusFor(item) === 'Expired').length
    const inactive = codes.filter((item) => statusFor(item) === 'Inactive').length
    const totalRedemptions = codes.reduce((sum, item) => sum + Number(item.usage_count || 0), 0)
    return { active, expired, inactive, totalRedemptions }
  }, [codes])

  return (
    <div className="space-y-6 p-6 text-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Admin</p>
          <h1 className="mt-1 text-3xl font-black text-white">TromoCodes</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2 font-bold text-white shadow-lg shadow-cyan-500/20"
        >
          Create TromoCode
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: 'Active Codes', value: summary.active, icon: ShieldCheck, tone: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300' },
          { title: 'Total Redemptions', value: summary.totalRedemptions.toLocaleString(), icon: TrendingUp, tone: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300' },
          { title: 'Expired Codes', value: summary.expired, icon: CalendarClock, tone: 'from-amber-500/20 to-amber-500/5 text-amber-300' },
          { title: 'Inactive Codes', value: summary.inactive, icon: Activity, tone: 'from-rose-500/20 to-rose-500/5 text-rose-300' },
        ].map(({ title, value, icon: Icon, tone }) => (
          <div key={title} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${tone} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{title}</p>
                <p className="mt-3 text-3xl font-black text-white">{value}</p>
              </div>
              <Icon className="h-8 w-8 opacity-80" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b0d14] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code, keyword, or product"
              className="w-full rounded-xl border border-white/10 bg-[#111827] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="flex gap-2">
            {['all', 'active', 'inactive', 'expired', 'maxed_out'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${filter === option ? 'bg-cyan-500 text-white' : 'bg-white/5 text-zinc-300'}`}
              >
                {option.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          {loading ? (
            <div className="p-6 text-sm text-zinc-400">Loading TromoCodes…</div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-bold">Code</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Applies To</th>
                  <th className="px-4 py-3 font-bold">Uses</th>
                  <th className="px-4 py-3 font-bold">Starts</th>
                  <th className="px-4 py-3 font-bold">Expires</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map((code) => {
                  const currentStatus = statusFor(code)
                  return (
                    <tr key={code.id} className="border-t border-white/10 bg-[#0f172a]/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-bold text-cyan-200">
                          <Ticket className="h-4 w-4 text-cyan-400" />
                          {code.code}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">{code.description}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{getTromocodePromotionLabel(code.promotion_type, code.promotion_value)}</td>
                      <td className="px-4 py-3 text-zinc-300">{getTromocodeProductLabel(code.applies_to)}</td>
                      <td className="px-4 py-3 text-zinc-300">{code.usage_count} / {code.max_uses ?? 'Unlimited'}</td>
                      <td className="px-4 py-3 text-zinc-300">{code.starts_at ? new Date(code.starts_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-zinc-300">{code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${currentStatus === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : currentStatus === 'Expired' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-300'}`}>
                          {currentStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b0d14] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Admin</p>
                <h2 className="mt-1 text-2xl font-black text-white">Create TromoCode</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-zinc-300">Code</span>
                <input
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                  placeholder="TROMO50"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-zinc-300">Description</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                  placeholder="Summer promotion"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Promotion Type</span>
                <select
                  value={form.promotion_type}
                  onChange={(event) => setForm((prev) => ({ ...prev, promotion_type: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                >
                  <option value="percentage_discount">Percentage Discount</option>
                  <option value="fixed_coin_discount">Fixed Coin Discount</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Promotion Value</span>
                <input
                  type="number"
                  value={form.promotion_value}
                  onChange={(event) => setForm((prev) => ({ ...prev, promotion_value: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Applies To</span>
                <select
                  value={form.applies_to}
                  onChange={(event) => setForm((prev) => ({ ...prev, applies_to: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                >
                  <option value="verified_badge">Verified Badge</option>
                  <option value="profile_frame">Profile Frame</option>
                  <option value="insurance_plan">Insurance Plan</option>
                  <option value="perk">Perk</option>
                  <option value="all_eligible">All Eligible</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Maximum Uses</span>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={(event) => setForm((prev) => ({ ...prev, max_uses: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Starts</span>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Expires</span>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-white"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 md:col-span-2">
                <span className="text-sm font-semibold text-zinc-300">Status</span>
                <select
                  value={String(form.is_active)}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value === 'true' }))}
                  className="rounded-lg border border-white/10 bg-[#0b0d14] px-2 py-1.5 text-white"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateTromocode()}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create TromoCode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
