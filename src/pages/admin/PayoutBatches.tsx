import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Layers, Clock, DollarSign, User, Calendar, ArrowRight, Eye, X } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';

interface PayoutBatch {
  id: string;
  week_end: string;
  payout_date: string;
  status: 'open' | 'locked' | 'processing' | 'completed' | 'cancelled';
  total_requests: number;
  total_usd: number;
  created_at: string;
  reviewed_by_assistant_username?: string;
}

interface PayoutRequest {
  id: string;
  user_id: string;
  coin_amount: number;
  cash_amount: number;
  bonus_amount: number;
  status: string;
  created_at: string;
  provider_type?: string | null;
  provider_username?: string | null;
  user_tag?: string | null;
  forwarded_to_admin?: boolean;
  reviewed_by_assistant_username?: string | null;
  id_verification_url?: string | null;
  id_verification_uploaded_at?: string | null;
  requester: {
    username: string;
    display_name: string;
    payout_paypal_email: string;
    role?: string;
    troll_coins?: number;
  };
}

const PayoutBatches = () => {
  const _navigate = useNavigate();
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PayoutRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const isAdminUser = Boolean(profile?.is_admin || profile?.role === 'admin' || profile?.is_superadmin);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      // Query to get batches with counts and sums
      const { data: batchesData, error } = await supabase
        .from('payout_batches')
        .select('*')
        .order('week_end', { ascending: false });

      if (error) throw error;

      // Augment with stats
      const augmentedBatches = await Promise.all((batchesData || []).map(async (batch) => {
        const { data: stats, error: _statsError } = await supabase
          .from('payout_requests')
          .select('cash_amount, bonus_amount', { count: 'exact' })
          .eq('batch_id', batch.id);
        
        const total_usd = (stats || []).reduce((sum, r) => sum + Number(r.cash_amount) + Number(r.bonus_amount), 0);
        return {
          ...batch,
          total_requests: stats?.length || 0,
          total_usd
        };
      }));

      setBatches(augmentedBatches);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const fetchBatchRequests = async (batchId: string) => {
    setRequestsLoading(true);
    setSelectedBatch(batchId);
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*, requester:user_profiles!payout_requests_user_id_fkey(username, display_name, payout_paypal_email, role, troll_coins)')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRequestsLoading(false);
    }
  };

  const updateBatchStatus = async (batchId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('payout_batches')
        .update({ status: newStatus })
        .eq('id', batchId);

      if (error) throw error;

      // If marking as completed, we should also update the requests
      if (newStatus === 'completed') {
        const { error: reqError } = await supabase
          .from('payout_requests')
          .update({ status: 'paid' })
          .eq('batch_id', batchId)
          .eq('status', 'processing');
        
        if (reqError) console.error('Error updating requests to paid:', reqError);
      }

      toast.success(`Batch marked as ${newStatus}`);
      fetchBatches();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const processPayPalPayout = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to trigger the PayPal Payout API for this entire batch? This will send real money.')) {
      return;
    }

    setProcessing(true);
    const toastId = toast.loading('Sending payouts via PayPal...');

    try {
      const { data, error } = await supabase.functions.invoke('process-payout-batch', {
        body: { batchId }
      });

      if (error) throw error;

      toast.success(`Successfully sent ${data.processedCount} payouts via PayPal!`, { id: toastId });
      fetchBatches();
      fetchBatchRequests(batchId);
    } catch (error: any) {
      console.error('PayPal processing error:', error);
      toast.error(error.message || 'Failed to process PayPal payouts', { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const openAndRunPayouts = async (batchId: string) => {
    // Only allow admins to perform this action
    if (!(profile?.is_admin || profile?.role === 'admin' || profile?.is_superadmin)) {
      toast.error('Only admins can run live payouts');
      return;
    }

    if (!window.confirm('This will OPEN the batch and immediately trigger live PayPal payouts. Continue?')) return;

    try {
      // mark batch as open first
      const { error: updError } = await supabase
        .from('payout_batches')
        .update({ status: 'open' })
        .eq('id', batchId);
      if (updError) throw updError;

      // small delay to ensure DB state consistency
      await new Promise((r) => setTimeout(r, 600));

      // then run the live payout
      await processPayPalPayout(batchId);
    } catch (err: any) {
      console.error('Open & Run payouts error:', err);
      toast.error(err?.message || 'Failed to open and run payouts');
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading Payout Batches...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center gap-3 mb-8">
        <Layers className="w-8 h-8 text-troll-green" />
        <h1 className="text-3xl font-bold">Payout Batches</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Batches List */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Weekly Batches</h2>
          {batches.map(batch => (
            <div 
              key={batch.id} 
              onClick={() => fetchBatchRequests(batch.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedBatch === batch.id 
                  ? 'border-troll-green bg-troll-green/10 ring-1 ring-troll-green' 
                  : 'border-purple-700/50 bg-black/40 hover:border-purple-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span className="font-bold">Week Ending {new Date(batch.week_end).toLocaleDateString()}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  batch.status === 'completed' ? 'bg-troll-green text-black' :
                  batch.status === 'processing' ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-black'
                }`}>
                  {batch.status}
                </span>
              </div>
              
              <div className="flex justify-between text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {batch.total_requests} requests
                </div>
                <div className="flex items-center gap-1 text-troll-gold font-bold">
                  <DollarSign className="w-3 h-3" /> {batch.total_usd.toFixed(2)}
                </div>
              </div>
              {batch.reviewed_by_assistant_username && (
                <div className="mt-2 text-[10px] text-cyan-400 font-bold uppercase">
                  ✓ Reviewed by {batch.reviewed_by_assistant_username}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Batch Details */}
        <div className="lg:col-span-8">
          {selectedBatch ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Batch Details
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400 text-sm font-normal">
                    {batches.find(b => b.id === selectedBatch)?.id.slice(0, 8)}...
                  </span>
                </h2>
                <div className="flex gap-2">
                  {isAdminUser && (
                    <button
                      onClick={() => openAndRunPayouts(selectedBatch!)}
                      disabled={processing}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-sm font-bold flex items-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      {batches.find(b => b.id === selectedBatch)?.status === 'open'
                        ? 'Run Live PayPal Payouts'
                        : 'Open & Run Payouts (Admin Live Test)'}
                    </button>
                  )}
                  <button 
                    onClick={() => updateBatchStatus(selectedBatch, 'processing')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold"
                  >
                    Mark Processing
                  </button>
                  <button 
                    onClick={() => updateBatchStatus(selectedBatch, 'completed')}
                    className="bg-troll-green hover:bg-troll-green-dark text-black px-3 py-1 rounded text-sm font-bold"
                  >
                    Mark Paid
                  </button>
                </div>
              </div>

              {requestsLoading ? (
                <div className="p-12 text-center text-gray-500">Loading requests...</div>
              ) : (
                <div className="bg-black/40 rounded-lg border border-purple-700/50 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-purple-900/30 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Payout Provider</th>
                        <th className="px-4 py-3">User Tag</th>
                        <th className="px-4 py-3">Coins</th>
                        <th className="px-4 py-3">Cash</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {requests.map(req => (
                        <tr key={req.id} className="border-t border-purple-700/30">
                          <td className="px-4 py-3">
                            <div className="font-bold">{req.requester?.display_name}</div>
                            <div className="text-xs text-gray-500">@{req.requester?.username}</div>
                            {req.requester?.role && (
                              <div className="text-[10px] font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-300/20 px-2 py-0.5 rounded mt-1 inline-block">{req.requester.role}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {req.provider_type && req.provider_username ? (
                                <>
                                  <span className="text-xs font-bold text-cyan-300 uppercase">{req.provider_type}</span>
                                  <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded">
                                    {req.provider_username}
                                  </span>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded">
                                    {req.requester?.payout_paypal_email || 'NOT SET'}
                                  </span>
                                  {req.requester?.payout_paypal_email && (
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(req.requester.payout_paypal_email);
                                        toast.success('Email copied');
                                      }}
                                      className="text-[10px] text-purple-400 hover:text-white"
                                    >
                                      Copy
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono text-amber-300 bg-amber-500/10 px-2 py-1 rounded">
                              {req.user_tag || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">{req.coin_amount.toLocaleString()}</td>
                          <td className="px-4 py-3">${req.cash_amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-troll-green">
                            {req.bonus_amount > 0 ? `+$${req.bonus_amount.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 font-bold text-troll-gold">
                            ${(Number(req.cash_amount) + Number(req.bonus_amount)).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold uppercase text-gray-400">{req.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRequest(req);
                              }}
                              className="inline-flex items-center gap-2 rounded bg-purple-600 px-3 py-1 text-xs font-bold text-white hover:bg-purple-500 transition"
                            >
                              <Eye className="w-3 h-3" />
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                      {requests.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No requests in this batch</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                  <div className="w-full max-w-3xl rounded-2xl border border-purple-700/50 bg-slate-950 text-white shadow-2xl">
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
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-4 px-6 py-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-[#090A12] border border-purple-700/40 p-4">
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Requester</div>
                          <div className="mt-2 text-white font-semibold">{selectedRequest.requester.display_name}</div>
                          <div className="text-sm text-slate-400">@{selectedRequest.requester.username}</div>
                          <div className="mt-3 text-xs text-slate-500">PayPal Email</div>
                          <div className="text-sm text-slate-200 break-all">{selectedRequest.requester.payout_paypal_email || 'N/A'}</div>
                        </div>
                        <div className="rounded-2xl bg-[#090A12] border border-purple-700/40 p-4">
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Request Details</div>
                          <div className="mt-2 text-sm text-slate-200">Coins: {selectedRequest.coin_amount.toLocaleString()}</div>
                          <div className="text-sm text-slate-200">Cash: ${selectedRequest.cash_amount.toFixed(2)}</div>
                          <div className="text-sm text-slate-200">Bonus: ${selectedRequest.bonus_amount.toFixed(2)}</div>
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
                            <div className="text-xs uppercase text-slate-500">User Tag</div>
                            <div className="text-sm text-white">{selectedRequest.user_tag || '—'}</div>
                          </div>
                          <div className="rounded-2xl bg-slate-900/80 p-3">
                            <div className="text-xs uppercase text-slate-500">Forwarded</div>
                            <div className="text-sm text-white">{selectedRequest.forwarded_to_admin ? 'Yes' : 'No'}</div>
                          </div>
                          <div className="rounded-2xl bg-slate-900/80 p-3">
                            <div className="text-xs uppercase text-slate-500">Created</div>
                            <div className="text-sm text-white">{new Date(selectedRequest.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-black/20 rounded-xl border border-dashed border-purple-700/50 text-gray-500">
              <Clock className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a batch from the left to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayoutBatches;
