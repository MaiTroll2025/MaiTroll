import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../../../../lib/store'
import { Gift, Save } from 'lucide-react'

interface GiftCardFulfillmentListProps {
  viewMode: 'admin' | 'secretary'
}

type PayoutRequest = {
  id: string
  user_id: string
  coin_amount: number
  cash_amount: number
  net_amount: number
  status: 'pending' | 'reviewed' | 'approved' | 'paid' | 'rejected'
  provider_type: string
  provider_username: string
  payment_reference: string | null
  created_at: string
  approved_at: string | null
  paid_at: string | null
  rejection_reason: string | null
}

export default function GiftCardFulfillmentList({ viewMode: _viewMode }: GiftCardFulfillmentListProps) {
  const { user: _user } = useAuthStore()
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [paymentRef, setPaymentRef] = useState<string>('')

  const fetchPayouts = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .in('status', ['approved', 'paid'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setPayouts((data as any) || [])
    } catch (error) {
      console.error('Error fetching payouts:', error)
      toast.error('Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  const handleMarkPaid = async (id: string) => {
    try {
      if (!paymentRef || paymentRef.trim().length < 3) {
        toast.error('Enter a valid payment reference')
        return
      }
      const { data, error } = await supabase.rpc('admin_process_payout', {
        p_payout_id: id,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id,
        p_action: 'pay',
        p_payment_reference: paymentRef.trim(),
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to mark as paid')
      toast.success('Payout marked as paid')
      setEditingId(null)
      setPaymentRef('')
      fetchPayouts()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to mark as paid')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const reason = window.prompt('Enter rejection reason (optional):') || null
      const { data, error } = await supabase.rpc('admin_process_payout', {
        p_payout_id: id,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id,
        p_action: 'reject',
        p_rejection_reason: reason,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to reject')
      toast.success('Payout rejected')
      fetchPayouts()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to reject')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-400" />
          Fast Pay Payouts
          <span className="text-xs text-slate-400 ml-2">Level 1000+: 30min • Level 500-999: 24hr • Level 1-499: On request</span>
        </h2>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-slate-400">Loading...</div>
        ) : payouts.length === 0 ? (
          <div className="text-center text-slate-400">No payouts to fulfill</div>
        ) : (
          payouts.map(item => (
            <div key={item.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              {editingId === item.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">Payment Reference</label>
                    <input
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="Enter payment reference / transaction ID"
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => { setEditingId(null); setPaymentRef('') }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleMarkPaid(item.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Mark Paid
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white">${item.cash_amount?.toFixed(2)} • {item.coin_amount?.toLocaleString()} coins</h3>
                    <p className="text-sm text-slate-400">
                      User: {item.user_id} • {item.provider_type} → {item.provider_username}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === 'paid' ? 'bg-green-500/20 text-green-300' :
                        item.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                        item.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                      {item.payment_reference && (
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                          Ref: {item.payment_reference}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'approved' && (
                      <button
                        onClick={() => { setEditingId(item.id); setPaymentRef(item.payment_reference || '') }}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded"
                      >
                        Mark Paid
                      </button>
                    )}
                    {item.status !== 'paid' && item.status !== 'rejected' && (
                      <button
                        onClick={() => handleReject(item.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
