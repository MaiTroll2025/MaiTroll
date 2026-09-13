import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { 
  DollarSign, User, Coins, Calendar, 
  ChevronRight, CheckCircle, XCircle, 
  Clock, AlertCircle, RefreshCw, Eye, CreditCard
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

interface PayoutRequest {
  id: string
  user_id: string
  coin_amount: number
  cash_amount: number
  bonus_amount: number
  status: string
  created_at: string
  provider_type?: string | null
  provider_username?: string | null
  user_tag?: string | null
  forwarded_to_admin?: boolean
  reviewed_by_assistant_username?: string | null
  id_verification_url?: string | null
  id_verification_uploaded_at?: string | null
  batch_id?: string | null
  requester: {
    username: string
    display_name: string
    role?: string
    troll_coins?: number
  }
}

export default function PayoutsByAssistant() {
  const { user, profile } = useAuthStore()
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PayoutRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const isAssistant = profile?.role === 'ceo_assistant' || profile?.role === 'noah_assistant'
  const isAdmin = profile?.is_admin || profile?.role === 'admin'

  const fetchRequests = useCallback(async () => {
    if (!isAssistant && !isAdmin) return

    setLoading(true)
    try {
      let query = supabase
        .from('payout_requests')
        .select(`
          *,
          requester:user_profiles!payout_requests_user_id_fkey(username, display_name, role, troll_coins)
        `)
        .order('created_at', { ascending: false })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query

      if (error) throw error
      setRequests(data || [])
    } catch (error: any) {
      console.error('Fetch requests error:', error)
      toast.error('Failed to load payout requests')
    } finally {
      setLoading(false)
    }
  }, [isAssistant, isAdmin, filterStatus])

  useEffect(() => {
    if (!user) return

    if (!isAssistant && !isAdmin) {
      toast.error('Access denied. Assistant or Admin only.')
      return
    }

    fetchRequests()

    // Realtime subscription
    const channel = supabase
      .channel('payout_requests_assistant_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
        },
        () => fetchRequests()
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, isAssistant, isAdmin, fetchRequests])

  const processPayPalPayout = async (requestId: string) => {
    if (!window.confirm('Process PayPal payout for this request? This will send real money.')) {
      return
    }

    setProcessing(true)
    const toastId = toast.loading('Processing PayPal payout...')

    try {
      const { data, error } = await supabase.functions.invoke('process-payout-batch', {
        body: { requestId }
      })

      if (error) throw error

      toast.success('PayPal payout processed successfully!', { id: toastId })
      fetchRequests()
    } catch (error: any) {
      console.error('PayPal processing error:', error)
      toast.error(error.message || 'Failed to process PayPal payout', { id: toastId })
    } finally {
      setProcessing(false)
    }
  }

  const updateStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'update_payout_status',
          payoutId: requestId,
          newStatus
        }
      })

      if (error) throw error

      toast.success(`Request marked as ${newStatus}`)
      fetchRequests()
    } catch (error: any) {
      console.error('Update status error:', error)
      toast.error(error.message || 'Failed to update request')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      case 'approved': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'processing': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'completed': return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'paid': return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'rejected': return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'denied': return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'reviewed': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalRequested = requests.reduce((sum, r) => sum + (r.cash_amount || 0), 0)
  const pendingCount = requests.filter(r => r.status === 'pending' || r.status === 'reviewed').length

  if (!isAssistant && !isAdmin) return null

  return (
    <div className="min-h-screen bg-[#050714] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Payouts by Assistant</h1>
            <p className="text-slate-400">Review and process payout requests (PayPal only - sensitive details hidden)</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
              <option value="denied">Denied</option>
            </select>
            <button
              onClick={fetchRequests}
              disabled={loading}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-white',
                loading ? 'bg-gray-600' : 'bg-cyan-600 hover:bg-cyan-500'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/20">
                <DollarSign className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Requested</p>
                <p className="text-2xl font-bold text-white">${totalRequested.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-yellow-500/20">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Pending Review</p>
                <p className="text-2xl font-bold text-white">{pendingCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Coins className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Requests</p>
                <p className="text-2xl font-bold text-white">{requests.length}</p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
              <p className="text-slate-400">Loading requests...</p>
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center">
            <DollarSign className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="text-xl font-bold text-white">No payout requests found</h3>
            <p className="text-slate-400">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-white/10 bg-slate-900/50 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20">
                        <User className="h-5 w-5 text-cyan-300" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{request.requester.display_name}</p>
                        <p className="text-sm text-slate-400">@{request.requester.username}</p>
                      </div>
                      {request.requester.role && (
                        <span className="px-2 py-0.5 text-xs font-bold uppercase bg-purple-500/20 text-purple-300 rounded">
                          {request.requester.role}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                      <div>
                        <p className="text-xs text-slate-500">USD Amount</p>
                        <p className="font-bold text-white">${(request.cash_amount || 0).toFixed(2)}</p>
                      </div>
                      {request.bonus_amount > 0 && (
                        <div>
                          <p className="text-xs text-slate-500">Bonus</p>
                          <p className="font-bold text-troll-green">+${request.bonus_amount.toFixed(2)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500">Coins</p>
                        <p className="font-bold text-yellow-400">
                          {(request.coin_amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Method</p>
                        <p className="font-bold text-cyan-300 capitalize">
                          {request.provider_type?.replace('_', ' ') || 'PayPal'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">User Tag</p>
                        <p className="font-mono text-sm text-white">
                          {request.user_tag || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(request.created_at)}
                      </span>
                      {request.forwarded_to_admin && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Forwarded to Admin
                        </span>
                      )}
                      {request.reviewed_by_assistant_username && (
                        <span className="text-cyan-400 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Reviewed by {request.reviewed_by_assistant_username}
                        </span>
                      )}
                      {request.id_verification_url && (
                        <span className="text-green-400 flex items-center gap-1">
                          <CreditCard className="h-4 w-4" />
                          ID Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'rounded-full border px-3 py-1 text-xs font-bold',
                      getStatusColor(request.status)
                    )}>
                      {request.status.toUpperCase()}
                    </span>

                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="rounded-xl bg-purple-600 px-4 py-2 font-bold text-white hover:bg-purple-500 transition flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Details
                    </button>

                    {(request.status === 'pending' || request.status === 'reviewed') && (
                      <>
                        <button
                          onClick={() => updateStatus(request.id, 'approved')}
                          disabled={processing}
                          className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(request.id, 'rejected')}
                          disabled={processing}
                          className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500 transition"
                        >
                          Deny
                        </button>
                      </>
                    )}

                    {(request.status === 'approved' || request.status === 'reviewed') && (
                      <button
                        onClick={() => processPayPalPayout(request.id)}
                        disabled={processing}
                        className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500 transition flex items-center gap-2"
                      >
                        <CreditCard className="h-4 w-4" />
                        PayPal Payout
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Request Detail Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-purple-700/50 bg-slate-950 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-purple-700/40 px-6 py-4">
                <div>
                  <div className="flex items-center gap-2 text-lg font-bold">
                    <Eye className="w-5 h-5 text-purple-300" />
                    Payout Request Details
                  </div>
                  <div className="text-sm text-slate-400">Request ID: {selectedRequest.id}</div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="rounded-full bg-white/5 p-2 text-slate-300 hover:bg-white/10"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-[#090A12] border border-purple-700/40 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Requester</div>
                    <div className="mt-2 text-white font-semibold">{selectedRequest.requester.display_name}</div>
                    <div className="text-sm text-slate-400">@{selectedRequest.requester.username}</div>
                    <div className="mt-3 text-xs text-slate-500">Role</div>
                    <div className="text-sm text-slate-200">{selectedRequest.requester.role || 'user'}</div>
                    <div className="mt-3 text-xs text-slate-500">User Tag</div>
                    <div className="text-sm text-slate-200 font-mono">{selectedRequest.user_tag || '—'}</div>
                  </div>
                  <div className="rounded-2xl bg-[#090A12] border border-purple-700/40 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Request Details</div>
                    <div className="mt-2 text-sm text-slate-200">Coins: {selectedRequest.coin_amount.toLocaleString()}</div>
                    <div className="text-sm text-slate-200">Cash: ${selectedRequest.cash_amount.toFixed(2)}</div>
                    <div className="text-sm text-slate-200">Bonus: ${selectedRequest.bonus_amount.toFixed(2)}</div>
                    <div className="text-sm text-slate-200">Total: ${(Number(selectedRequest.cash_amount) + Number(selectedRequest.bonus_amount)).toFixed(2)}</div>
                    <div className="text-sm text-slate-200">Status: {selectedRequest.status}</div>
                    <div className="text-sm text-slate-200">Provider: {selectedRequest.provider_type ? `${selectedRequest.provider_type} / ${selectedRequest.provider_username}` : 'PayPal'}</div>
                    <div className="text-sm text-slate-200">
                      ID Verification: {selectedRequest.id_verification_url ? (
                        <div className="space-y-1">
                          <a href={selectedRequest.id_verification_url} target="_blank" rel="noopener noreferrer" className="text-troll-green-neon hover:underline">
                            View uploaded ID
                          </a>
                          {selectedRequest.id_verification_uploaded_at && (
                            <div className="text-xs text-slate-500">
                              Uploaded {new Date(selectedRequest.id_verification_uploaded_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : 'Not uploaded'}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-[#090A12] border border-purple-700/40 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Additional</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-900/80 p-3">
                      <div className="text-xs uppercase text-slate-500">Forwarded</div>
                      <div className="text-sm text-white">{selectedRequest.forwarded_to_admin ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-900/80 p-3">
                      <div className="text-xs uppercase text-slate-500">Created</div>
                      <div className="text-sm text-white">{formatDate(selectedRequest.created_at)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-900/80 p-3">
                      <div className="text-xs uppercase text-slate-500">Batch</div>
                      <div className="text-sm text-white">{selectedRequest.batch_id?.slice(0, 8) + '...' || '—'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Sensitive info notice */}
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold">Sensitive payment details (PayPal email, Venmo, CashApp) are hidden for assistant roles</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">Admins can view full payment details in the main Payout Batches page.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}