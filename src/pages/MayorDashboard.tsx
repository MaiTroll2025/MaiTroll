import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/store';
import { supabase } from '@/supabaseClient';

type MayorTerm = {
  id: string;
  user_id: string;
  status: string;
  term_started_at: string;
  term_ended_at: string;
  qualification_coin_total: number;
};

type MayorEligibility = {
  user_id: string;
  qualification_coin_total: number;
  qualification_timestamp: string;
  account_standing: string;
};

type MayorAllowance = {
  id: string;
  allowance_amount: number;
  remaining_allowance: number;
  status: string;
};

type MayorTransaction = {
  id: string;
  amount: number;
  reason: string;
  remaining_allowance: number;
  issued_at: string;
};

export default function MayorDashboard() {
  const { user } = useAuthStore();
  const [term, setTerm] = useState<MayorTerm | null>(null);
  const [eligibility, setEligibility] = useState<MayorEligibility | null>(null);
  const [allowance, setAllowance] = useState<MayorAllowance | null>(null);
  const [transactions, setTransactions] = useState<MayorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('100');
  const [reason, setReason] = useState('community support');
  const [requestNote, setRequestNote] = useState('Launch a city announcement');
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [{ data: termData }, { data: eligibilityData }, { data: allowanceData }, { data: txData }] = await Promise.all([
        supabase.from('mayor_terms').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('mayor_eligibility').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('mayor_coin_allowances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('mayor_coin_transactions').select('*').order('created_at', { ascending: false }).limit(8),
      ]);

      setTerm(termData as MayorTerm | null);
      setEligibility(eligibilityData as MayorEligibility | null);
      setAllowance(allowanceData as MayorAllowance | null);
      setTransactions((txData as MayorTransaction[]) || []);
    } catch (error: any) {
      toast.error(error.message || 'Unable to load mayor dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleActivate = async () => {
    if (!user?.id) return;
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('activate_mayor', { p_user_id: user.id });
      if (error) throw error;
      if (data?.success) {
        toast.success('Mayor term activated');
        await loadData();
      } else {
        toast.error(data?.reason || 'Activation failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Activation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSendCoins = async () => {
    if (!recipientId || !amount) {
      toast.error('Choose a recipient and amount');
      return;
    }

    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('send_mayor_promotional_coins', {
        p_recipient_id: recipientId,
        p_amount: Number(amount),
        p_reason: reason,
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Sent ${amount} promotional coins`);
        setRecipientId('');
        setAmount('100');
        await loadData();
      } else {
        toast.error(data?.reason || 'Unable to send coins');
      }
    } catch (error: any) {
      toast.error(error.message || 'Unable to send coins');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitRequest = async () => {
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('submit_mayor_frontend_request', {
        p_change_type: 'announcement_request',
        p_change_payload: { note: requestNote },
        p_mayor_term_id: term?.id || null,
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Request submitted');
        setRequestNote('');
      } else {
        toast.error(data?.reason || 'Unable to submit request');
      }
    } catch (error: any) {
      toast.error(error.message || 'Unable to submit request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050714] px-4 py-24 text-white md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Mayor Office</p>
              <h1 className="text-3xl font-black text-white">City leadership dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">Track your mayor qualification, remaining promotional allowance, and the pulse of city governance.</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              {term?.status === 'active' ? 'Active mayor term' : 'No active mayor term'}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-300">Loading mayor data…</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
                <h2 className="text-xl font-black text-white">Mayor status</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-cyan-300/10 bg-cyan-400/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Qualification</p>
                    <p className="mt-2 text-2xl font-black text-white">{eligibility?.qualification_coin_total ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/10 bg-cyan-400/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Allowance</p>
                    <p className="mt-2 text-2xl font-black text-white">{allowance?.remaining_allowance ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/10 bg-cyan-400/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Standing</p>
                    <p className="mt-2 text-2xl font-black text-white">{eligibility?.account_standing ?? 'review'}</p>
                  </div>
                </div>
                {!term?.status && (
                  <button
                    onClick={handleActivate}
                    disabled={busy}
                    className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-70"
                  >
                    {busy ? 'Working…' : 'Activate mayor term'}
                  </button>
                )}
              </div>

              <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
                <h2 className="text-xl font-black text-white">Send promotional coins</h2>
                <div className="mt-4 grid gap-3">
                  <input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Recipient user ID" />
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Amount" />
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Reason" />
                  <button onClick={handleSendCoins} disabled={busy} className="rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-70">
                    {busy ? 'Sending…' : 'Send coins'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
                <h2 className="text-xl font-black text-white">Submit a frontend request</h2>
                <textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} className="mt-4 min-h-[100px] w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Describe the change you want the city staff to review" />
                <button onClick={handleSubmitRequest} disabled={busy} className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-70">
                  {busy ? 'Submitting…' : 'Submit request'}
                </button>
              </div>

              <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
                <h2 className="text-xl font-black text-white">Recent allowance activity</h2>
                <div className="mt-4 space-y-3">
                  {transactions.length === 0 ? (
                    <p className="text-sm text-slate-400">No mayor coin transactions yet.</p>
                  ) : transactions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-cyan-300/10 bg-slate-900/70 p-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-white">{item.reason}</span>
                        <span className="text-cyan-300">{item.amount} coins</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">Remaining: {item.remaining_allowance}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
