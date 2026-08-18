import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  DollarSign,
  Coins,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  FileText,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { isAdminOrSecretary } from '../../lib/supabase';

const RECEIPT_BUCKET = 'receipts';

interface PayoutDetails {
  id: string;
  user_id: string;
  username: string;
  email: string;
  coin_amount: number;
  cash_amount: number;
  net_amount: number;
  status: string;
  provider_type: string;
  provider_username: string;
  user_tag: string | null;
  id_verification_url: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  rejection_reason: string | null;
  notes: string | null;
  troll_coins: number;
}

export default function AdminCashoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PayoutDetails | null>(null);
  const [processing, setProcessing] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [denialReason, setDenialReason] = useState('');
  const [showDenialModal, setShowDenialModal] = useState(false);

  const isAuthorized = profile && isAdminOrSecretary(profile);

  const loadDetails = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payout_requests')
        .select(`
          *,
          user_profiles!inner(username, email, troll_coins)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const d = data as any;
        setDetails({
          id: d.id,
          user_id: d.user_id,
          username: d.user_profiles?.username || 'Unknown',
          email: d.user_profiles?.email || '',
          coin_amount: d.coin_amount || 0,
          cash_amount: d.cash_amount || 0,
          net_amount: d.net_amount || 0,
          status: d.status,
          provider_type: d.provider_type || '',
          provider_username: d.provider_username || '',
          user_tag: d.user_tag,
          id_verification_url: d.id_verification_url,
          created_at: d.created_at,
          approved_at: d.approved_at,
          approved_by: d.approved_by,
          paid_at: d.paid_at,
          payment_reference: d.payment_reference,
          rejection_reason: d.rejection_reason,
          notes: d.notes,
          troll_coins: d.user_profiles?.troll_coins || 0,
        });
      } else {
        toast.error('Payout request not found');
      }
    } catch (err: any) {
      console.error('Error loading payout details:', err);
      toast.error('Failed to load payout details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();

    const channel = supabase
      .channel(`admin_payout_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
          filter: `id=eq.${id}`,
        },
        () => loadDetails()
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id, loadDetails]);

  const handleApprove = async () => {
    if (!id || !profile) return;
    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'approve_payout', requestId: id },
      })
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Payout approved');
      await loadDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handlePay = async () => {
    if (!id || !profile) return;
    const ref = window.prompt('Enter payment reference (optional)') || null;
    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'update_payout_status', payoutId: id, newStatus: 'paid', paymentReference: ref },
      })
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Payout marked as paid');
      await loadDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as paid');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!id || !profile || !denialReason.trim()) {
      toast.error('Please provide a reason for denial');
      return;
    }
    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'reject_payout', requestId: id, reason: denialReason },
      })
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Payout denied - coins returned to user');
      setShowDenialModal(false);
      await loadDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to deny');
    } finally {
      setProcessing(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile || !id) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, WebP, or PDF files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }

    try {
      setReceiptUploading(true);
      const fileName = `receipts/${id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('payout_requests')
        .update({ receipt_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;

      toast.success('Receipt uploaded');
      await loadDetails();
    } catch (err: any) {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    } finally {
      setReceiptUploading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
          <p className="text-slate-400">Only administrators and secretaries can access this page.</p>
          <Link to="/admin" className="text-cyan-400 hover:underline mt-4 inline-block">Back to Admin Dashboard</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-t-troll-gold border-r-transparent" />
          <p className="mt-4 text-slate-400">Loading payout details...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Request Not Found</h1>
          <Link to="/admin/cashout-manager" className="text-cyan-400 hover:underline">Back to Cashout Manager</Link>
        </div>
      </div>
    );
  }

  const feeCoins = 0;
  const payoutCoins = details.coin_amount;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-troll-gold" />
              Payout Request Details
            </h1>
            <p className="text-slate-400 mt-1">Request #{details.id.slice(0, 8)} • {new Date(details.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-3">
            {(details.status === 'pending' || details.status === 'reviewed') && (
              <>
                <button onClick={handleApprove} disabled={processing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white font-bold rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => setShowDenialModal(true)} disabled={processing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white font-bold rounded-lg flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Deny
                </button>
              </>
            )}
            {details.status === 'approved' && (
              <>
                <button onClick={handlePay} disabled={processing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-bold rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Mark Paid
                </button>
                <button onClick={() => document.getElementById('receipt-upload')?.click()}
                  disabled={receiptUploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-2">
                  <Upload className="w-4 h-4" /> {receiptUploading ? 'Uploading...' : 'Upload Receipt'}
                </button>
                <input id="receipt-upload" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden" onChange={handleReceiptUpload} disabled={receiptUploading} />
              </>
            )}
          </div>
        </div>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${
          details.status === 'pending' ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700' :
          details.status === 'reviewed' ? 'bg-blue-900/30 text-blue-300 border border-blue-700' :
          details.status === 'approved' ? 'bg-green-900/30 text-green-300 border border-green-700' :
          details.status === 'paid' ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700' :
          'bg-red-900/30 text-red-300 border border-red-700'
        }`}>
          <Clock className="w-4 h-4" /> STATUS: {details.status.toUpperCase()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" /> Request Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-sm text-slate-400">User</p><p className="font-bold text-white">{details.username}</p></div>
                <div><p className="text-sm text-slate-400">Payout Coins</p><p className="font-bold text-troll-gold">{payoutCoins.toLocaleString()}</p></div>
                <div><p className="text-sm text-slate-400">Fee (0%)</p><p className="font-bold text-red-300">-{feeCoins.toLocaleString()}</p></div>
                <div><p className="text-sm text-slate-400">Cash Amount</p><p className="font-bold text-white">${details.cash_amount?.toFixed(2)}</p></div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-sm text-slate-400">Method</p><p className="font-mono text-white capitalize">{details.provider_type?.replace('_', ' ') || 'N/A'}</p></div>
                <div><p className="text-sm text-slate-400">Provider Account</p><p className="font-mono text-white text-sm">{details.provider_username || 'N/A'}</p></div>
                <div><p className="text-sm text-slate-400">ID Uploaded</p>
                  <p className="font-mono text-white">
                    {details.id_verification_url ? (
                      <a href={details.id_verification_url} target="_blank" rel="noopener noreferrer" className="text-troll-green-neon hover:underline">View ID</a>
                    ) : 'Not uploaded'}
                  </p>
                </div>
                <div><p className="text-sm text-slate-400">Total Reserved</p><p className="font-mono text-white">{details.coin_amount?.toLocaleString()}</p></div>
              </div>
              {details.rejection_reason && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-300"><strong>Denial Reason:</strong> {details.rejection_reason}</p>
                </div>
              )}
              {details.notes && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-300"><strong>Admin Notes:</strong> {details.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <UserIcon className="w-5 h-5" /> User Information
              </h3>
              <div className="space-y-2 text-sm">
                <div><p className="text-slate-400">Username</p><p className="text-white font-medium">{details.username}</p></div>
                <div><p className="text-slate-400">User ID</p><p className="font-mono text-slate-300">{details.user_id}</p></div>
                <div><p className="text-slate-400">Cashout Eligible Balance</p><p className="text-white">{details.troll_coins?.toLocaleString()} coins</p></div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-3">Timeline</h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                  <div><p className="text-white">Requested</p><p className="text-slate-400">{new Date(details.created_at).toLocaleString()}</p></div>
                </div>
                {details.approved_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <div><p className="text-white">Approved</p><p className="text-slate-400">{new Date(details.approved_at).toLocaleString()}</p></div>
                  </div>
                )}
                {details.paid_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                    <div><p className="text-white">Paid</p><p className="text-slate-400">{new Date(details.paid_at).toLocaleString()}</p></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDenialModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" /> Deny Payout Request
              </h3>
              <button onClick={() => setShowDenialModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg">
              <p className="text-sm text-red-200">This will deny the payout and refund coins (including fee) to the user's escrow.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Reason for Denial</label>
              <textarea value={denialReason} onChange={(e) => setDenialReason(e.target.value)}
                placeholder="Reason..." className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white h-24 resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDenialModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-gray-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleDeny} disabled={processing || !denialReason.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50">Confirm Denial</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
