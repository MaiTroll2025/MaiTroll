import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  Flame,
  RefreshCw,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react'

const glassPanel =
  'rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 backdrop-blur-2xl shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]'

interface PromotionClaim {
  id: string
  promotion_id: string
  user_id: string
  payout_request_id: string
  qualifying_amount: number
  match_amount: number
  match_coins: number
  winner_number: number | null
  status: string
  review_status: string
  review_reason: string | null
  reviewed_at: string | null
  created_at: string
  issued_at: string | null
  username: string | null
  display_name: string | null
  avatar_url: string | null
  payout_status: string | null
  payout_cash_amount: number | null
}

interface PromotionConfig {
  id: string
  name: string
  enabled: boolean
  max_winners: number
  winners_claimed: number
  max_match_amount: number
  minimum_cashout: number
  match_type: string
  match_percentage: number
  starts_at: string
  ends_at: string
  description: string | null
  terms: string | null
  spots_remaining: number
  is_active: boolean
}

export default function FirstCashoutMatch() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState<string | null>(null)

  const [config, setConfig] = useState<PromotionConfig | null>(null)
  const [claims, setClaims] = useState<PromotionClaim[]>([])
  const [claimsFilter, setClaimsFilter] = useState<string>('all')
  const [claimsSearch, setClaimsSearch] = useState('')
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    enabled: false,
    max_winners: 10,
    max_match_amount: 10,
    minimum_cashout: 10,
    match_type: 'percentage',
    match_percentage: 50,
    starts_at: '',
    ends_at: '',
    description: '',
    terms: '',
  })

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cashout_promotions')
        .select('*')
        .eq('slug', 'first_cashout_match')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data) {
        const spotsRemaining = Math.max((data.max_winners || 10) - (data.winners_claimed || 0), 0)
        const now = new Date()
        const isActive = data.enabled && now >= new Date(data.starts_at) && now <= new Date(data.ends_at) && (data.winners_claimed || 0) < (data.max_winners || 10)
        setConfig({
          ...data,
          spots_remaining: spotsRemaining,
          is_active: isActive,
        } as PromotionConfig)
        setEditForm({
          enabled: data.enabled || false,
          max_winners: data.max_winners || 10,
          max_match_amount: Number(data.max_match_amount) || 10,
          minimum_cashout: Number(data.minimum_cashout) || 10,
          match_type: data.match_type || 'percentage',
          match_percentage: data.match_percentage ?? 50,
          starts_at: data.starts_at ? new Date(data.starts_at).toISOString().slice(0, 16) : '',
          ends_at: data.ends_at ? new Date(data.ends_at).toISOString().slice(0, 16) : '',
          description: data.description || '',
          terms: data.terms || '',
        })
      } else {
        setConfig({
          id: '',
          name: 'First Cashout Match',
          enabled: false,
          max_winners: 10,
          winners_claimed: 0,
          max_match_amount: 10,
          minimum_cashout: 10,
          match_type: 'percentage',
          match_percentage: 50,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          description: '',
          terms: '',
          spots_remaining: 10,
          is_active: false,
        } as PromotionConfig)
      }
    } catch (err: any) {
      console.error('[FirstCashoutMatch] Load config error:', err)
      toast.error(err?.message || 'Failed to load promotion config')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadClaims = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('admin_list_first_cashout_match_claims', {
        p_status: claimsFilter === 'all' ? null : claimsFilter,
        p_limit: 200,
      })

      if (error) throw error
      if (data?.success) {
        setClaims(data.claims || [])
      }
    } catch (err: any) {
      console.error('[FirstCashoutMatch] Load claims error:', err)
    }
  }, [claimsFilter])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (config) {
      loadClaims()
    }
  }, [config, loadClaims, claimsFilter])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('admin_upsert_first_cashout_match_promotion', {
        p_enabled: editForm.enabled,
        p_max_winners: editForm.max_winners,
        p_max_match_amount: editForm.max_match_amount,
        p_minimum_cashout: editForm.minimum_cashout,
        p_starts_at: editForm.starts_at ? new Date(editForm.starts_at).toISOString() : null,
        p_ends_at: editForm.ends_at ? new Date(editForm.ends_at).toISOString() : null,
        p_description: editForm.description,
        p_terms: editForm.terms,
        p_match_type: editForm.match_type,
        p_match_percentage: editForm.match_percentage,
        p_eligible_coin_sources: ['gift_received', 'purchase'],
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('Promotion settings saved')
      await loadConfig()
    } catch (err: any) {
      console.error('[FirstCashoutMatch] Save config error:', err)
      toast.error(err?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReviewClaim = async (claimId: string, action: 'approve' | 'reject' | 'flag', reason?: string) => {
    setActing(claimId)
    try {
      const { data, error } = await supabase.rpc('admin_review_first_cashout_match_claim', {
        p_claim_id: claimId,
        p_action: action,
        p_reason: reason || null,
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success(data.message || `Claim ${action}d`)
      await loadClaims()
      await loadConfig()
    } catch (err: any) {
      console.error('[FirstCashoutMatch] Review claim error:', err)
      toast.error(err?.message || 'Failed to review claim')
    } finally {
      setActing(null)
    }
  }

  const filteredClaims = claims.filter((c) => {
    if (!claimsSearch.trim()) return true
    const q = claimsSearch.toLowerCase()
    return (
      (c.username || '').toLowerCase().includes(q) ||
      (c.display_name || '').toLowerCase().includes(q) ||
      c.user_id.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  })

  const stats = {
    total: claims.length,
    pending: claims.filter((c) => c.status === 'pending').length,
    approved: claims.filter((c) => c.status === 'approved').length,
    issued: claims.filter((c) => c.status === 'issued').length,
    rejected: claims.filter((c) => c.status === 'rejected').length,
    under_review: claims.filter((c) => c.status === 'under_review').length,
    total_match_usd: claims.filter((c) => c.status === 'issued').reduce((s, c) => s + c.match_amount, 0),
    total_match_coins: claims.filter((c) => c.status === 'issued').reduce((s, c) => s + c.match_coins, 0),
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      approved: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      issued: 'bg-green-500/20 text-green-300 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
      under_review: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      reversed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    }
    return map[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }

  if (loading) {
    return (
      <div className={glassPanel}>
        <div className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading First Cashout Match...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={glassPanel}>
      <div className="border-b border-cyan-400/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10">
            <Flame className="h-5 w-5 text-orange-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-white">First Cashout Match</h2>
            <p className="text-sm text-slate-400">
              Manage the limited-time first cashout match promotion for new broadcasters.
            </p>
          </div>
          <button
            onClick={() => { loadConfig(); loadClaims() }}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5 text-cyan-300" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-orange-400/20 bg-orange-400/10 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Winners</p>
            <p className="text-2xl font-black text-white">
              {config?.winners_claimed || 0} <span className="text-slate-500 text-lg">/ {config?.max_winners || 10}</span>
            </p>
            <p className="text-xs text-slate-500">{config?.spots_remaining || 0} spots remaining</p>
          </div>
          <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Issued</p>
            <p className="text-2xl font-black text-green-300">${stats.total_match_usd.toFixed(2)}</p>
            <p className="text-xs text-slate-500">{stats.total_match_coins.toLocaleString()} coins</p>
          </div>
          <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-black text-yellow-300">{stats.pending}</p>
            <p className="text-xs text-slate-500">{stats.under_review} under review</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Max Match</p>
            <p className="text-2xl font-black text-cyan-300">${config?.max_match_amount || 10}</p>
            <p className="text-xs text-slate-500">per broadcaster</p>
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-bold text-white">Promotion Configuration</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
              <div>
                <p className="text-sm font-bold text-white">Promotion Enabled</p>
                <p className="text-xs text-slate-400">Allow new claims while slots remain</p>
              </div>
              <button
                onClick={() => setEditForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editForm.enabled ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editForm.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Winners</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={editForm.max_winners}
                onChange={(e) => setEditForm((f) => ({ ...f, max_winners: parseInt(e.target.value) || 0 }))}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Match Amount ($)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={editForm.max_match_amount}
                onChange={(e) => setEditForm((f) => ({ ...f, max_match_amount: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Minimum Cashout ($)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={editForm.minimum_cashout}
                onChange={(e) => setEditForm((f) => ({ ...f, minimum_cashout: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Starts At</label>
              <input
                type="datetime-local"
                value={editForm.starts_at}
                onChange={(e) => setEditForm((f) => ({ ...f, starts_at: e.target.value }))}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ends At</label>
              <input
                type="datetime-local"
                value={editForm.ends_at}
                onChange={(e) => setEditForm((f) => ({ ...f, ends_at: e.target.value }))}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Terms</label>
            <textarea
              value={editForm.terms}
              onChange={(e) => setEditForm((f) => ({ ...f, terms: e.target.value }))}
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 rounded-xl font-bold text-white transition-colors"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <span className={`text-sm font-bold ${config?.is_active ? 'text-green-400' : 'text-red-400'}`}>
              {config?.is_active ? 'ACTIVE' : config?.enabled ? 'SCHEDULED' : 'DISABLED'}
            </span>
          </div>
        </div>

        {/* Claims Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-400" />
              <h3 className="text-lg font-bold text-white">Claims</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={claimsSearch}
                  onChange={(e) => setClaimsSearch(e.target.value)}
                  placeholder="Search users..."
                  className="bg-black/30 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                />
              </div>
              <select
                value={claimsFilter}
                onChange={(e) => setClaimsFilter(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50"
              >
                <option value="all" className="bg-slate-950">All</option>
                <option value="pending" className="bg-slate-950">Pending</option>
                <option value="approved" className="bg-slate-950">Approved</option>
                <option value="issued" className="bg-slate-950">Issued</option>
                <option value="rejected" className="bg-slate-950">Rejected</option>
                <option value="under_review" className="bg-slate-950">Under Review</option>
              </select>
            </div>
          </div>

          {filteredClaims.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No claims found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-xl border border-white/10 bg-black/20 overflow-hidden"
                >
                  <div
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                  >
                    <div className="flex items-center gap-3">
                      {claim.avatar_url ? (
                        <img src={claim.avatar_url} alt={claim.username || 'User'} className="h-10 w-10 rounded-full" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20">
                          <Users className="h-5 w-5 text-cyan-300" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white">{claim.display_name || claim.username || 'Unknown User'}</p>
                        <p className="text-xs text-slate-500">ID: {claim.user_id.substring(0, 8)}... &middot; Winner #{claim.winner_number || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-400">${claim.match_amount.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">{claim.match_coins.toLocaleString()} coins</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge(claim.status)}`}>
                        {claim.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {expandedClaim === claim.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {expandedClaim === claim.id && (
                    <div className="border-t border-white/10 p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Qualifying Cashout</p>
                          <p className="font-mono text-white">${claim.qualifying_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Match Amount</p>
                          <p className="font-mono text-green-400">${claim.match_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Payout Status</p>
                          <p className="font-mono text-white capitalize">{claim.payout_status || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Claimed</p>
                          <p className="font-mono text-white">{new Date(claim.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {claim.review_reason && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-xs text-blue-300 font-semibold">Review Note:</p>
                          <p className="text-sm text-blue-200">{claim.review_reason}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {claim.status === 'pending' || claim.status === 'approved' ? (
                          <>
                            <button
                              onClick={() => handleReviewClaim(claim.id, 'approve')}
                              disabled={acting === claim.id}
                              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg text-sm font-bold text-white transition-colors"
                            >
                              {acting === claim.id ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Rejection reason:')
                                if (reason !== null) handleReviewClaim(claim.id, 'reject', reason)
                              }}
                              disabled={acting === claim.id}
                              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 rounded-lg text-sm font-bold text-white transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Flag reason:')
                                if (reason !== null) handleReviewClaim(claim.id, 'flag', reason)
                              }}
                              disabled={acting === claim.id}
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 rounded-lg text-sm font-bold text-white transition-colors"
                            >
                              Flag for Review
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
