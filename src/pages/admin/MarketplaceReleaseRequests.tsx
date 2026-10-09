import React, { useState } from 'react';
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  Package,
  ExternalLink,
  Check,
  X,
  Truck,
  Shield,
} from 'lucide-react'

interface ReleaseRequest {
  id: string
  order_id: string
  seller_id: string
  tracking_number: string
  tracking_url: string | null
  carrier: string
  seller_notes: string | null
  completed_sales_count: number
  has_open_appeals: boolean
  status: string
  reviewed_at: string | null
  admin_notes: string | null
  rejection_reason: string | null
  created_at: string
  seller_profile?: { username: string | null }
  order?: {
    marketplace_items?: { title: string; type?: string } | null
    price_paid: number
    seller_earnings: number
    platform_fee: number | null
  }
}

export default function MarketplaceReleaseRequests() {
  const [requests, setRequests] = useState<ReleaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [_showDetail, _setShowDetail] = React.useState<ReleaseRequest | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('marketplace_payout_release_requests')
        .select(`
          *,
          seller_profile:user_profiles!seller_id(username),
          order:marketplace_purchases!inner(
            price_paid,
            seller_earnings,
            platform_fee,
            marketplace_items:marketplace_items(id, title, type)
          )
        `)
        .order('created_at', { ascending: true })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query

      if (error) throw error
      setRequests((data || []) as ReleaseRequest[])
    } catch (error) {
      console.error('Error fetching release requests:', error)
      toast.error('Failed to load release requests')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 30000)
    return () => clearInterval(interval)
  }, [filterStatus])

  const handleApprove = async (request: ReleaseRequest) => {
    setProcessing(request.id)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user?.id) {
        throw new Error('Unable to determine current admin user')
      }

      const { data: _data, error } = await supabase.rpc('admin_approve_marketplace_release', {
        p_request_id: request.id,
        p_admin_id: authData.user.id,
        p_admin_notes: adminNotes[request.id] || null,
      })

      if (error) throw error
      toast.success('Payout release approved — seller paid')
      await fetchRequests()
    } catch (error: any) {
      console.error('Error approving request:', error)
      toast.error(error?.message || 'Failed to approve request')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (request: ReleaseRequest) => {
    if (!adminNotes[request.id]?.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    setProcessing(request.id)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user?.id) {
        throw new Error('Unable to determine current admin user')
      }

      const { data: _data, error } = await supabase.rpc('admin_reject_marketplace_release', {
        p_request_id: request.id,
        p_admin_id: authData.user.id,
        p_rejection_reason: adminNotes[request.id] || null,
      })

      if (error) throw error
      toast.success('Release request rejected')
      await fetchRequests()
    } catch (error: any) {
      console.error('Error rejecting request:', error)
      toast.error(error?.message || 'Failed to reject request')
    } finally {
      setProcessing(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Truck className="w-8 h-8 text-cyan-400" />
              Marketplace Payout Release Requests
            </h1>
            <p className="text-slate-400 mt-1">
              Failed at 2026-06-21T11:20:23-06:00
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  filterStatus === status
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {status === 'all'
                  ? 'All'
                  : status === 'pending'
                  ? `Pending (${pendingCount})`
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-slate-500 mb-3" />
            <p className="text-slate-400 text-lg font-semibold">No release requests found</p>
            <p className="text-slate-500 text-sm mt-1">Pending seller payout requests will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => {
              const itemTitle = request.order?.marketplace_items?.title || 'Unknown'
              const salePrice = request.order?.price_paid || 0
              const sellerEarnings = request.order?.seller_earnings || 0
              const platformFee = request.order?.platform_fee || 0

              return (
                <div
                  key={request.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-cyan-400/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-400">Order:</span>
                        <code className="text-xs bg-white/10 px-2 py-0.5 rounded text-white">
                          {request.order_id.slice(0, 8)}
                        </code>
                        <span
                          className={`text-xs px-2 py-1 rounded font-bold ${
                            request.status === 'pending'
                              ? 'bg-amber-400/10 text-amber-300'
                              : request.status === 'approved'
                              ? 'bg-emerald-400/10 text-emerald-300'
                              : request.status === 'rejected'
                              ? 'bg-red-400/10 text-red-300'
                              : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <p className="text-white font-bold">{itemTitle}</p>

                      <div className="text-sm text-slate-400 space-y-1">
                        <p>Seller: {request.seller_profile?.username || request.seller_id.slice(0, 8)}</p>
                        <p>
                          Sale: <span className="text-white font-bold">{salePrice.toLocaleString()} coins</span>
                          {platformFee > 0 && (
                            <span className="ml-2 text-slate-500">
                              (Fee: {platformFee.toLocaleString()} — Seller net: {sellerEarnings.toLocaleString()})
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-1">
                          Carrier: {request.carrier.toUpperCase()}{' '}
                          <code className="bg-white/10 px-2 py-0.5 rounded text-xs text-white">
                            {request.tracking_number}
                          </code>
                        </p>
                        {request.tracking_url && (
                          <a
                            href={request.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs"
                          >
                            <ExternalLink className="w-3 h-3" /> View tracking ({request.carrier})
                          </a>
                        )}
                        <p>Completed sales: {request.completed_sales_count}</p>
                        {request.has_open_appeals && (
                          <p className="text-amber-400 flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Open appeals/lawsuits detected
                          </p>
                        )}
                        {request.seller_notes && (
                          <p className="text-slate-300 italic">Note: {request.seller_notes}</p>
                        )}
                        <p className="text-xs text-slate-500">
                          Requested: {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <input
                          type="text"
                          placeholder="Admin notes (optional)"
                          value={adminNotes[request.id] || ''}
                          onChange={(e) => setAdminNotes({ ...adminNotes, [request.id]: e.target.value })}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none"
                        />
                        <button
                          onClick={() => handleApprove(request)}
                          disabled={processing === request.id}
                          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                        >
                          <Check className="w-4 h-4" /> Release
                        </button>
                        <button
                          onClick={() => handleReject(request)}
                          disabled={processing === request.id}
                          className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}

                    {request.status !== 'pending' && (
                      <div className="text-sm text-slate-400 min-w-[200px]">
                        {request.reviewed_at && (
                          <p>Reviewed: {new Date(request.reviewed_at).toLocaleString()}</p>
                        )}
                        {request.admin_notes && <p>Notes: {request.admin_notes}</p>}
                        {request.rejection_reason && <p>Reason: {request.rejection_reason}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
