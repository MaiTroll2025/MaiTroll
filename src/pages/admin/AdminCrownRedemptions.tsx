import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Crown,
  Gift,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RedemptionRecord {
  id: string
  user_id: string
  reward_type: 'troll_coins' | 'gift_card'
  crowns_redeemed: number
  reward_value: string
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled'
  email_sent: boolean
  fulfilled_by: string | null
  fulfilled_at: string | null
  notes: string | null
  giftcard_code: string | null
  created_at: string
  updated_at: string
  user_profiles?: {
    user_id: string
    username: string
    display_name: string | null
    email: string | null
    crowns: number
  } | null
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled'

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminCrownRedemptions() {
  const { user } = useAuthStore()

  // State
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRedemption, setSelectedRedemption] = useState<RedemptionRecord | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [giftcardCode, setGiftcardCode] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)

  // ── Fetch redemptions ────────────────────────────────────────────────────

  const fetchRedemptions = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('crown_redemptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query
      if (error) throw error

      let results: RedemptionRecord[] = data || []

      if (results.length > 0) {
        const userIds = [...new Set(results.map((r) => r.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, username, display_name, email, crowns')
            .in('user_id', userIds)
          if (profiles) {
            const profileMap = new Map(profiles.map((p) => [p.user_id, p]))
            results = results.map((r) => ({
              ...r,
              user_profiles: profileMap.get(r.user_id) ?? null,
            }))
          }
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        results = results.filter((r) =>
          r.user_profiles?.username?.toLowerCase().includes(q) ||
          r.user_profiles?.display_name?.toLowerCase().includes(q) ||
          r.reward_value?.toLowerCase().includes(q) ||
          r.id?.toLowerCase().includes(q)
        )
      }

      setRedemptions(results)
    } catch (err) {
      console.error('[AdminCrownRedemptions] Fetch error:', err)
      toast.error('Failed to load redemptions')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, searchQuery])

  useEffect(() => {
    fetchRedemptions()
  }, [fetchRedemptions])

  // ── Admin actions ────────────────────────────────────────────────────────

  const handleApprove = useCallback(async (redemption: RedemptionRecord) => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_approve_redemption', {
        p_redemption_id: redemption.id,
        p_admin_id: user!.id,
      })
      if (error) throw error
      if (data?.success) {
        toast.success('Redemption approved')
        setShowDetailModal(false)
        fetchRedemptions()
      } else {
        toast.error(data?.error || 'Failed to approve')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve')
    } finally {
      setActionLoading(false)
    }
  }, [user, fetchRedemptions])

  const handleFulfill = useCallback(async (redemption: RedemptionRecord) => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_fulfill_redemption', {
        p_redemption_id: redemption.id,
        p_admin_id: user!.id,
        p_notes: notes || null,
        p_giftcard_code: giftcardCode || null,
      })
      if (error) throw error
      if (data?.success) {
        toast.success('Redemption marked as fulfilled. User has been notified.')
        setShowDetailModal(false)
        setNotes('')
        setGiftcardCode('')
        fetchRedemptions()
      } else {
        toast.error(data?.error || 'Failed to fulfill')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fulfill')
    } finally {
      setActionLoading(false)
    }
  }, [user, notes, giftcardCode, fetchRedemptions])

  const handleReject = useCallback(async (redemption: RedemptionRecord) => {
    setActionLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_reject_redemption', {
        p_redemption_id: redemption.id,
        p_admin_id: user!.id,
        p_notes: notes || 'Rejected by admin',
      })
      if (error) throw error
      if (data?.success) {
        toast.success(`Redemption rejected. ${data.crowns_refunded} crowns refunded.`)
        setShowDetailModal(false)
        setNotes('')
        fetchRedemptions()
      } else {
        toast.error(data?.error || 'Failed to reject')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject')
    } finally {
      setActionLoading(false)
    }
  }, [user, notes, fetchRedemptions])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fulfilled': return 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
      case 'approved': return 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10'
      case 'pending': return 'text-amber-300 border-amber-400/30 bg-amber-500/10'
      case 'rejected': return 'text-red-300 border-red-400/30 bg-red-500/10'
      case 'cancelled': return 'text-slate-400 border-slate-400/30 bg-slate-500/10'
      default: return 'text-slate-400 border-slate-400/30 bg-slate-500/10'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fulfilled': return <CheckCircle2 className="h-3.5 w-3.5" />
      case 'approved': return <Clock className="h-3.5 w-3.5" />
      case 'pending': return <Loader2 className="h-3.5 w-3.5 animate-spin" />
      case 'rejected': return <XCircle className="h-3.5 w-3.5" />
      case 'cancelled': return <X className="h-3.5 w-3.5" />
      default: return null
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  const statusCounts = {
    all: redemptions.length,
    pending: redemptions.filter((r) => r.status === 'pending').length,
    approved: redemptions.filter((r) => r.status === 'approved').length,
    fulfilled: redemptions.filter((r) => r.status === 'fulfilled').length,
    rejected: redemptions.filter((r) => r.status === 'rejected').length,
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const filters: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'pending', label: 'Pending', count: statusCounts.pending },
    { key: 'approved', label: 'Approved', count: statusCounts.approved },
    { key: 'fulfilled', label: 'Fulfilled', count: statusCounts.fulfilled },
    { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/25 bg-amber-400/10">
            <Crown className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Crown Redemptions</h2>
            <p className="text-xs text-slate-400">Review and manage crown redemption requests</p>
          </div>
        </div>
        <button
          onClick={fetchRedemptions}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/20"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username, reward, or ID..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/40"
        />
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition',
              filterStatus === f.key
                ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-200'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
            )}
          >
            {f.label}
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Redemptions list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : redemptions.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
          <Crown className="mx-auto mb-3 h-12 w-12 text-slate-600" />
          <p className="font-bold text-slate-300">No redemptions found</p>
          <p className="mt-1 text-xs text-slate-500">Redemption requests will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {redemptions.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelectedRedemption(r); setShowDetailModal(true); setNotes(''); setGiftcardCode('') }}
              className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"
            >
              <div className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                r.reward_type === 'troll_coins' ? 'bg-cyan-400/10' : 'bg-purple-400/10',
              )}>
                {r.reward_type === 'troll_coins'
                  ? <Coins className="h-5 w-5 text-cyan-300" />
                  : <Gift className="h-5 w-5 text-purple-300" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">
                    {r.user_profiles?.display_name || r.user_profiles?.username || 'Unknown'}
                  </p>
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                    getStatusColor(r.status),
                  )}>
                    {getStatusIcon(r.status)}
                    {r.status}
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-500">
                  {r.crowns_redeemed} crowns &rarr; {r.reward_value} &bull; {formatDate(r.created_at)}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-slate-500" />
            </button>
          ))}
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {showDetailModal && selectedRedemption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-cyan-300/20 bg-[#0b1628] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">Redemption Details</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User info */}
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-400/10">
                  <Crown className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {selectedRedemption.user_profiles?.display_name || selectedRedemption.user_profiles?.username || 'Unknown User'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {selectedRedemption.user_profiles?.email || 'No email on file'}
                  </p>
                </div>
              </div>
            </div>

            {/* Redemption details */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs text-slate-400">Type</span>
                <span className="text-xs font-bold">
                  {selectedRedemption.reward_type === 'troll_coins' ? 'Troll Coins' : 'Gift Card'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs text-slate-400">Crowns Redeemed</span>
                <span className="text-xs font-bold text-amber-300">{selectedRedemption.crowns_redeemed}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs text-slate-400">Reward</span>
                <span className="text-xs font-bold text-cyan-300">{selectedRedemption.reward_value}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs text-slate-400">Status</span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  getStatusColor(selectedRedemption.status),
                )}>
                  {getStatusIcon(selectedRedemption.status)}
                  {selectedRedemption.status}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-xs text-slate-400">Created</span>
                <span className="text-xs font-bold">{formatDate(selectedRedemption.created_at)}</span>
              </div>
              {selectedRedemption.fulfilled_at && (
                <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="text-xs text-slate-400">Fulfilled</span>
                  <span className="text-xs font-bold">{formatDate(selectedRedemption.fulfilled_at)}</span>
                </div>
              )}
              {selectedRedemption.email_sent && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2">
                  <span className="text-xs text-emerald-300">Notification Sent</span>
                  <Mail className="h-3.5 w-3.5 text-emerald-300" />
                </div>
              )}
              {selectedRedemption.giftcard_code && (
                <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="h-3 w-3 text-amber-400" />
                    <span className="text-xs text-slate-400">Gift Card Code</span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs font-bold text-emerald-300">{selectedRedemption.giftcard_code}</p>
                </div>
              )}
              {selectedRedemption.notes && (
                <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="text-xs text-slate-400">Notes</span>
                  <p className="mt-0.5 text-xs">{selectedRedemption.notes}</p>
                </div>
              )}
            </div>

            {/* Admin notes input */}
            {(selectedRedemption.status === 'pending' || selectedRedemption.status === 'approved') && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-400">Admin Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add fulfillment notes..."
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/40"
                  />
                </div>
                {selectedRedemption.reward_type === 'gift_card' && selectedRedemption.status === 'approved' && (
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-400">
                      <KeyRound className="mr-1 inline h-3 w-3" />
                      Gift Card Code
                    </label>
                    <input
                      type="text"
                      value={giftcardCode}
                      onChange={(e) => setGiftcardCode(e.target.value)}
                      placeholder="Enter the gift card code to send to user..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/40"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      This code will be sent to the user via in-app notification when you mark as fulfilled.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {selectedRedemption.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleApprove(selectedRedemption)}
                    disabled={actionLoading}
                    className="flex-1 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(selectedRedemption)}
                    disabled={actionLoading}
                    className="flex-1 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Reject & Refund
                  </button>
                </>
              )}
              {selectedRedemption.status === 'approved' && (
                <>
                  <button
                    onClick={() => handleFulfill(selectedRedemption)}
                    disabled={actionLoading}
                    className="flex-1 rounded-xl border border-emerald-200/40 bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-200 disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Mark Fulfilled'}
                  </button>
                  <button
                    onClick={() => handleReject(selectedRedemption)}
                    disabled={actionLoading}
                    className="flex-1 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Reject & Refund
                  </button>
                </>
              )}
              {(selectedRedemption.status === 'fulfilled' || selectedRedemption.status === 'rejected' || selectedRedemption.status === 'cancelled') && (
                <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-xs text-slate-400">
                  No further actions available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
