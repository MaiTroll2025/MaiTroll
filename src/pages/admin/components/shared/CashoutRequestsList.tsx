import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { toast } from 'sonner'
import { DollarSign, Check, X, Eye } from 'lucide-react'
import { useAuthStore } from '../../../../lib/store'
import { useNavigate } from 'react-router-dom'

interface PayoutRequest {
  id: string
  user_id: string
  coin_amount: number
  cash_amount: number
  net_amount: number
  status: string
  provider_type: string
  provider_username: string
  user_tag: string | null
  id_verification_url: string | null
  created_at: string
  approved_at: string | null
  paid_at: string | null
  rejection_reason: string | null
  user_profile?: {
    username: string
    email?: string
  }
}

interface CashoutRequestsListProps {
  viewMode: 'admin' | 'secretary'
}

export default function CashoutRequestsList({ viewMode: _viewMode }: CashoutRequestsListProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('pending')
  const [filterUser, setFilterUser] = useState<string>('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('payout_requests')
        .select(`
          *,
          user_profiles!inner(username, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query
      if (error) throw error

      const formatted = (data || []).map((req: any) => ({
        ...req,
        user_profile: req.user_profiles ? {
          username: req.user_profiles.username,
          email: req.user_profiles.email,
        } : undefined,
      }))

      setRequests(formatted)
    } catch (error) {
      console.error('Error fetching payouts:', error)
      toast.error('Failed to load payout requests')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    fetchRequests()

    const interval = setInterval(fetchRequests, 30000)
    return () => clearInterval(interval)
  }, [fetchRequests])

  const handleApprove = async (id: string) => {
    if (!user) return
    try {
      const { data, error } = await supabase.rpc('admin_process_payout', {
        p_payout_id: id,
        p_admin_id: user.id,
        p_action: 'approve',
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to approve')
      toast.success('Request approved')
      fetchRequests()
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve')
    }
  }

  const handleReject = async (id: string) => {
    if (!user) return
    const reason = window.prompt('Rejection reason:')
    if (!reason) return
    try {
      const { data, error } = await supabase.rpc('admin_process_payout', {
        p_payout_id: id,
        p_admin_id: user.id,
        p_action: 'reject',
        p_rejection_reason: reason,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to reject')
      toast.success('Request rejected')
      fetchRequests()
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject')
    }
  }

  const filteredRequests = requests.filter(req => {
    if (!filterUser.trim()) return true
    const q = filterUser.toLowerCase()
    return (
      req.user_profile?.username?.toLowerCase().includes(q) ||
      req.user_profile?.email?.toLowerCase().includes(q) ||
      req.user_id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 relative">
      <div className="mb-6 bg-blue-900/20 border border-blue-800 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900/50 p-2 rounded-full">
            <DollarSign className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-200">Fast Pay / MAI Pay Payouts</h4>
            <p className="text-xs text-blue-300/80">
              Level 1-499: On request • Level 500-999: Every 24hrs • Level 1000+: Every 30min
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center gap-4 mb-6 flex-wrap">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Payout Requests
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white placeholder:text-slate-500"
            placeholder="Filter by user, email, or ID"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          />
          <select
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Method</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
            ) : filteredRequests.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center">No requests found</td></tr>
            ) : (
              filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-700/30">
                  <td className="p-3">
                    <div className="font-medium text-white">{req.user_profile?.username || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{req.user_id.slice(0, 8)}...</div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-green-400">${req.cash_amount?.toFixed(2) || '0.00'}</div>
                    <div className="text-xs text-slate-500">{req.coin_amount?.toLocaleString()} coins (incl. fee)</div>
                  </td>
                  <td className="p-3 capitalize">{req.provider_type?.replace('_', ' ') || 'N/A'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      req.status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' :
                      req.status === 'reviewed' ? 'bg-blue-900/50 text-blue-300' :
                      req.status === 'approved' ? 'bg-green-900/50 text-green-300' :
                      req.status === 'paid' ? 'bg-emerald-900/50 text-emerald-300' :
                      'bg-red-900/50 text-red-300'
                    }`}>
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{new Date(req.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/cashout/${req.id}`)}
                        className="p-1 text-blue-400 hover:text-blue-300"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {(req.status === 'pending' || req.status === 'reviewed') && (
                        <>
                          <button
                            onClick={() => handleApprove(req.id)}
                            className="p-1 text-green-400 hover:text-green-300"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="p-1 text-red-400 hover:text-red-300"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
