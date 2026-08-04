import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

type Opening = {
  id: string;
  title: string;
  department: string;
  description: string;
  status: string;
};

type Article = {
  id: string;
  title: string;
  body: string;
  article_type: string;
};

export default function CityGovernmentPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [{ data: proposalData }, { data: openingData }, { data: articleData }] = await Promise.all([
          supabase.from('government_proposals').select('*').order('created_at', { ascending: false }).limit(8),
          supabase.from('city_openings').select('*').order('created_at', { ascending: false }).limit(6),
          supabase.from('city_newspaper_articles').select('*').order('published_at', { ascending: false }).limit(6),
        ]);
        setProposals((proposalData as Proposal[]) || []);
        setOpenings((openingData as Opening[]) || []);
        setArticles((articleData as Article[]) || []);
      } catch (error: any) {
        toast.error(error.message || 'Unable to load city government content');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#050714] px-4 py-24 text-white md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">City Government</p>
          <h1 className="text-3xl font-black text-white">Public office, proposals, openings, and newsroom</h1>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-300">Loading city government information…</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Proposals</h2>
                <Link to="/government/proposals" className="text-sm font-bold text-cyan-300">Open</Link>
              </div>
              <div className="mt-4 space-y-3">
                {proposals.length === 0 ? <p className="text-sm text-slate-400">No proposals yet.</p> : proposals.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-cyan-300/10 bg-slate-900/70 p-3 text-sm text-slate-300">
                    <p className="font-bold text-white">{p.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{p.category} • {p.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Openings</h2>
                <Link to="/government/openings" className="text-sm font-bold text-cyan-300">Open</Link>
              </div>
              <div className="mt-4 space-y-3">
                {openings.length === 0 ? <p className="text-sm text-slate-400">No openings yet.</p> : openings.map((opening) => (
                  <div key={opening.id} className="rounded-2xl border border-cyan-300/10 bg-slate-900/70 p-3 text-sm text-slate-300">
                    <p className="font-bold text-white">{opening.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{opening.department} • {opening.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">City Newspaper</h2>
                <Link to="/government/newspaper" className="text-sm font-bold text-cyan-300">Open</Link>
              </div>
              <div className="mt-4 space-y-3">
                {articles.length === 0 ? <p className="text-sm text-slate-400">No articles yet.</p> : articles.map((article) => (
                  <div key={article.id} className="rounded-2xl border border-cyan-300/10 bg-slate-900/70 p-3 text-sm text-slate-300">
                    <p className="font-bold text-white">{article.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{article.body.slice(0, 120)}…</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
