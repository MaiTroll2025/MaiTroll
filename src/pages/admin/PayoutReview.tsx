import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  DollarSign, User, Coins, Calendar, 
  ChevronRight, CheckCircle, XCircle, 
  Clock, AlertCircle, RefreshCw 
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import type { CashoutRequest, CashoutStatus } from '../../types/cashout'

interface CashoutWithUser extends CashoutRequest {
  username?: string
  avatar_url?: string
}

const statusColors: Record<CashoutStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  submitted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  processing: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  denied: 'bg-red-500/20 text-red-300 border-red-500/30',
  reviewed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

export default function PayoutReview() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<CashoutWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const isAdmin = profile?.is_admin || profile?.role === 'admin'

  const fetchRequests = useCallback(async () => {
    if (!isAdmin) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select(`
          *,
          user_profiles!inner(username, avatar_url)
        `)
        .in('status', ['pending', 'reviewed'])
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = (data || []).map((req: any) => ({
        ...req,
        username: req.user_profiles?.username,
        avatar_url: req.user_profiles?.avatar_url,
      }))

      setRequests(formatted)
    } catch (error: any) {
      console.error('Fetch requests error:', error)
      toast.error('Failed to load payout requests')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    if (!isAdmin) {
      toast.error('Access denied. Admin only.')
      navigate('/')
      return
    }

    fetchRequests()

    // Realtime subscription
    const channel = supabase
      .channel('payout_requests_realtime')
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
  }, [user, isAdmin, navigate, fetchRequests])

  const updateStatus = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(requestId)
    try {
      // Use the unified admin_process_payout RPC
      const { data, error } = await supabase.rpc('admin_process_payout', {
        p_payout_id: requestId,
        p_admin_id: user?.id,
        p_action: action,
        p_rejection_reason: reason || null,
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to process payout')

      toast.success(data.message || `Request ${action}d`)
      fetchRequests()
    } catch (error: any) {
      console.error('Update status error:', error)
      toast.error(error.message || 'Failed to update request')
    } finally {
      setProcessingId(null)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-[#050714] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Payout Review</h1>
            <p className="text-slate-400">Review and process cashout requests</p>
          </div>
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
        </header>

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
            <h3 className="text-xl font-bold text-white">No pending requests</h3>
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
                      {request.avatar_url ? (
                        <img
                          src={request.avatar_url}
                          alt={request.username || 'User'}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20">
                          <User className="h-5 w-5 text-cyan-300" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white">{request.username || 'Unknown User'}</p>
                        <p className="text-sm text-slate-400">ID: {request.user_id.substring(0, 8)}...</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">USD Amount</p>
                        <p className="font-bold text-white">
                          ${(request.cash_amount || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Coins (incl. fee)</p>
                        <p className="font-bold text-yellow-400">
                          {(request.coin_amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Method</p>
                        <p className="font-bold text-cyan-300 capitalize">
                          {request.provider_type?.replace('_', ' ') || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Handle/Email</p>
                        <p className="font-mono text-sm text-white">
                          {request.provider_username || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                      {request.opened_at && (
                        <span className="text-cyan-400">
                          Opened: {new Date(request.opened_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'rounded-full border px-3 py-1 text-xs font-bold',
                      statusColors[request.status]
                    )}>
                      {request.status.toUpperCase()}
                    </span>

                    {request.status === 'pending' || request.status === 'reviewed' ? (
                      <>
                        <button
                          onClick={() => updateStatus(request.id, 'approve')}
                          disabled={processingId === request.id}
                          className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500"
                        >
                          {processingId === request.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Rejection reason:');
                            if (reason) updateStatus(request.id, 'reject', reason);
                          }}
                          disabled={processingId === request.id}
                          className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500"
                        >
                          Deny
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}