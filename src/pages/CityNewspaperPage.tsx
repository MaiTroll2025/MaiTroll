import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/supabaseClient';

type Article = {
  id: string;
  title: string;
  body: string;
  article_type: string;
  published_at: string;
};

export default function CityNewspaperPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('city_newspaper_articles').select('*').order('published_at', { ascending: false }).limit(12);
        if (error) throw error;
        setArticles((data as Article[]) || []);
      } catch (error: any) {
        toast.error(error.message || 'Unable to load newspaper');
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
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">City Newspaper</p>
          <h1 className="text-3xl font-black text-white">The latest from Troll City</h1>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-300">Loading articles…</div>
        ) : (
          <div className="grid gap-4">
            {articles.length === 0 ? <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-300">No articles published yet.</div> : articles.map((article) => (
              <div key={article.id} className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">{article.article_type}</p>
                  <p className="text-xs text-slate-400">{new Date(article.published_at).toLocaleString()}</p>
                </div>
                <h2 className="mt-3 text-xl font-black text-white">{article.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{article.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
