import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { Crown, Search, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

const glassPanel =
  'rounded-[2rem] border border-amber-400/15 bg-slate-950/75 backdrop-blur-2xl shadow-[0_0_48px_rgba(251,191,36,0.10),inset_0_1px_0_rgba(255,255,255,0.04)]'

interface MaiPayUser {
  id: string
  username: string | null
  display_name: string | null
  email: string | null
  mai_pay_plus: boolean
}

export default function MaiPayPlusManager() {
  const [users, setUsers] = useState<MaiPayUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      // Load all users plus-flagged, plus any search match.
      let query = supabase
        .from('user_profiles')
        .select('id, username, display_name, email, mai_pay_plus')
        .order('mai_pay_plus', { ascending: false })
        .limit(100)

      if (search.trim()) {
        const q = search.trim()
        query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`)
      } else {
        query = query.eq('mai_pay_plus', true)
      }

      const { data, error } = await query
      if (error) throw error
      setUsers((data as MaiPayUser[]) || [])
    } catch (err: any) {
      console.error('[MaiPayPlusManager] Load error:', err)
      toast.error(err?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const setPlus = useCallback(
    async (userId: string, enabled: boolean) => {
      setActing(userId)
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ mai_pay_plus: enabled, updated_at: new Date().toISOString() })
          .eq('id', userId)

        if (error) throw error

        setUsers(prev =>
          prev.map(u => (u.id === userId ? { ...u, mai_pay_plus: enabled } : u))
        )
        toast.success(enabled ? 'MAI Pay Plus enabled' : 'MAI Pay Plus disabled')
      } catch (err: any) {
        console.error('[MaiPayPlusManager] Update error:', err)
        toast.error(err?.message || 'Failed to update user')
      } finally {
        setActing(null)
      }
    },
    []
  )

  const plusCount = users.filter(u => u.mai_pay_plus).length

  return (
    <section className={glassPanel}>
      <div className="border-b border-amber-400/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
            <Crown className="h-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-white">MAI Pay Plus Management</h2>
            <p className="text-sm text-slate-400">
              Enable, disable, and view MAI Pay Plus status. Plus members get 20 rolling cashouts and double coin requirements per tier.
            </p>
          </div>
          <button
            onClick={loadUsers}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-amber-300" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username, display name, or email..."
              className="w-full bg-black/30 border border-amber-400/20 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
            />
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200">
            {plusCount} Plus {plusCount === 1 ? 'member' : 'members'}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-400 py-8">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">
            {search.trim() ? 'No users match your search.' : 'No MAI Pay Plus members yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {u.display_name || u.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    @{u.username || '—'} {u.email ? `· ${u.email}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {u.mai_pay_plus && (
                    <span className="hidden sm:flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300">
                      <Crown className="w-3 h-3" /> PLUS
                    </span>
                  )}
                  <button
                    disabled={acting === u.id}
                    onClick={() => setPlus(u.id, !u.mai_pay_plus)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                      u.mai_pay_plus
                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    }`}
                  >
                    {acting === u.id
                      ? '...'
                      : u.mai_pay_plus
                      ? 'Disable'
                      : 'Enable Plus'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <ShieldCheck className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-emerald-200">
            MAI Pay Plus remains fully enforced server-side. Cashout tiers, rolling limits, and double
            coin requirements are validated by the <code>request_cashout</code> /{' '}
            <code>request_payout</code> RPCs.
          </p>
        </div>
      </div>
    </section>
  )
}
