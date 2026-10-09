import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, FileSignature, Loader2, ScrollText } from 'lucide-react';

export default function HytroGamingContract() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [contract, setContract] = useState<any>(null);

  const [signatureName, setSignatureName] = useState('');
  const [signatureNote, setSignatureNote] = useState('');
  const [agreed, setAgreed] = useState(false);

  const loadContract = useCallback(async () => {
    if (!id || !user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('agency_contracts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Contract not found or you do not have access');
        navigate('/hytrogaming');
        return;
      }
      setContract(data);
      setSignatureName(profile?.display_name || profile?.username || '');
    } catch (err: any) {
      console.error('Failed to load contract:', err);
      toast.error('Failed to load contract');
    } finally {
      setLoading(false);
    }
  }, [id, user, profile, navigate]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleSign = async () => {
    if (!contract || !user) return;

    if (!agreed) {
      toast.error('You must agree to the contract terms before signing');
      return;
    }
    if (!signatureName.trim()) {
      toast.error('Enter your signature name');
      return;
    }

    setSigning(true);
    try {
      const signedAt = new Date().toISOString();
      const { error } = await supabase
        .from('agency_contracts')
        .update({
          status: 'signed',
          signed_at: signedAt,
          signed_by: user.id,
          signature_name: signatureName.trim(),
          signature_note: signatureNote.trim() || null,
          signed_terms_accepted_at: signedAt,
          updated_at: signedAt,
        })
        .eq('id', contract.id);

      if (error) throw error;

      toast.success('Contract signed successfully!');
      navigate('/hytrogaming');
    } catch (err: any) {
      console.error('Contract signing error:', err);
      toast.error(err.message || 'Failed to sign contract');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!contract) return null;

  const contractBody = contract.contract_body || contract.body || 'No contract body provided.';
  const isAlreadySigned = ['signed', 'active'].includes(contract.status);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(168,85,247,0.10),transparent_32%)]" />

      <main className="relative mx-auto max-w-3xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate('/hytrogaming')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to HytroGaming
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <FileSignature className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Agency Contract</h1>
              <p className="text-sm text-slate-400">Review and sign your HytroGaming agency agreement</p>
            </div>
          </div>

          {isAlreadySigned ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
              <h2 className="text-xl font-black text-emerald-300">Contract Already Signed</h2>
              <p className="mt-2 text-sm text-slate-400">
                You signed this contract on {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : 'N/A'}.
              </p>
              <button
                onClick={() => navigate('/agency-dashboard')}
                className="mt-4 rounded-xl bg-cyan-500/20 px-6 py-3 font-bold text-cyan-50 hover:bg-cyan-500/30"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ScrollText className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-lg font-black text-white">{contract.title || 'Agency Contract'}</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Fee / Split</p>
                    <p className="mt-1 text-sm font-black text-white">
                      {contract.fee_percentage ?? contract.split_percent ?? 'Unknown'}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Effective</p>
                    <p className="mt-1 text-sm font-black text-white">
                      {contract.effective_date ? new Date(contract.effective_date).toLocaleDateString() : 'Immediate'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Expires</p>
                    <p className="mt-1 text-sm font-black text-white">
                      {contract.expiration_date ? new Date(contract.expiration_date).toLocaleDateString() : 'No expiry'}
                    </p>
                  </div>
                </div>

                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/40 p-4 text-xs leading-6 text-slate-300">
                  {contractBody}
                </pre>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Full Name (Signature) *</label>
                  <input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Enter your full legal name"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Note (optional)</label>
                  <textarea
                    value={signatureNote}
                    onChange={(e) => setSignatureNote(e.target.value)}
                    placeholder="Any notes or comments about this contract"
                    rows={2}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-400"
                  />
                  <span className="text-sm text-slate-300">
                    I have read and agree to the terms and conditions of this agency contract. I understand this agreement is legally binding.
                  </span>
                </label>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={signing || !agreed || !signatureName.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] disabled:opacity-50"
                >
                  {signing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSignature className="h-4 w-4" />
                  )}
                  {signing ? 'Signing...' : 'Sign Contract'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
