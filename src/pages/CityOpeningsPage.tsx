import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/supabaseClient';

type Opening = {
  id: string;
  title: string;
  department: string;
  description: string;
  status: string;
};

export default function CityOpeningsPage() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('city_openings').select('*').order('created_at', { ascending: false }).limit(12);
        if (error) throw error;
        setOpenings((data as Opening[]) || []);
      } catch (error: any) {
        toast.error(error.message || 'Unable to load openings');
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
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">City Openings</p>
          <h1 className="text-3xl font-black text-white">Current opportunities in the city</h1>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-300">Loading openings…</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {openings.length === 0 ? <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-300">No openings available right now.</div> : openings.map((opening) => (
              <div key={opening.id} className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">{opening.department}</p>
                <h2 className="mt-2 text-xl font-black text-white">{opening.title}</h2>
                <p className="mt-3 text-sm text-slate-300">{opening.description}</p>
                <div className="mt-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">{opening.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
