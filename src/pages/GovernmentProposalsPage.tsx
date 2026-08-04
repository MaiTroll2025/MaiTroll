import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/supabaseClient';

type Proposal = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
};

export default function GovernmentProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('New city initiative');
  const [description, setDescription] = useState('Describe the proposal');
  const [category, setCategory] = useState('general');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('government_proposals').select('*').order('created_at', { ascending: false }).limit(12);
      if (error) throw error;
      setProposals((data as Proposal[]) || []);
    } catch (error: any) {
      toast.error(error.message || 'Unable to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('submit_government_proposal', {
        p_title: title,
        p_description: description,
        p_category: category,
        p_submitter_role: 'mayor',
        p_public_visibility: true,
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Proposal submitted');
        setTitle('');
        setDescription('');
        await load();
      } else {
        toast.error(data?.reason || 'Unable to submit proposal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Unable to submit proposal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050714] px-4 py-24 text-white md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Government Proposals</p>
          <h1 className="text-3xl font-black text-white">Shape the city through public proposals</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
            <h2 className="text-xl font-black text-white">Submit a proposal</h2>
            <div className="mt-4 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Title" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px] w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Description" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white">
                <option value="general">General</option>
                <option value="budget">Budget</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="community">Community</option>
              </select>
              <button onClick={handleSubmit} disabled={busy} className="rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-70">
                {busy ? 'Submitting…' : 'Submit proposal'}
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
            <h2 className="text-xl font-black text-white">Recent proposals</h2>
            {loading ? <p className="mt-4 text-sm text-slate-400">Loading proposals…</p> : proposals.length === 0 ? <p className="mt-4 text-sm text-slate-400">No proposals yet.</p> : <div className="mt-4 space-y-3">{proposals.map((proposal) => <div key={proposal.id} className="rounded-2xl border border-cyan-300/10 bg-slate-900/70 p-3 text-sm text-slate-300"><p className="font-bold text-white">{proposal.title}</p><p className="mt-1 text-xs text-slate-400">{proposal.description.slice(0, 140)}…</p></div>)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
