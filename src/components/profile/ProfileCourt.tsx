import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Scale, Loader2, Calendar, Gavel, User } from 'lucide-react';

interface CourtCase {
  id: string;
  case_type: string;
  status: string;
  created_at: string;
  court_date?: string | null;
  defendant: { username: string } | null;
  plaintiff: { username: string } | null;
}

interface Docket {
  id: string;
  court_date: string;
  status: string;
  cases_count?: number;
}

export default function ProfileCourt({ userId }: { userId: string }) {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [dockets, setDockets] = useState<Docket[]>([]);
  const [showDocket, setShowDocket] = useState(false);

  const isAdmin = profile?.is_admin === true ||
    ['admin', 'lead_troll_officer', 'troll_officer', 'secretary'].includes(String(profile?.role || '')) ||
    ['admin', 'lead_troll_officer', 'troll_officer', 'secretary'].includes(String(profile?.troll_role || ''));

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const [casesRes, docketsRes] = await Promise.all([
          supabase
            .from('court_cases')
            .select(`
              id,
              case_type,
              status,
              created_at,
              court_date,
              defendant:defendant_id(username),
              plaintiff:plaintiff_id(username)
            `)
            .or(`plaintiff_id.eq.${userId},defendant_id.eq.${userId}`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          isAdmin
            ? supabase
                .from('court_dockets')
                .select('id, court_date, status, cases_count')
                .order('court_date', { ascending: true })
                .limit(20)
            : { data: null as Docket[] | null, error: null }
        ]);

        if (isMounted) {
          setCases((casesRes.data || []) as CourtCase[]);
          if (isAdmin) setDockets((docketsRes.data || []) as Docket[]);
        }
      } catch (err) {
        console.error('[ProfileCourt] Error:', err);
        toast.error('Failed to load court cases');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId, isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading court cases...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-amber-200 flex items-center gap-2">
              <Calendar size={16} /> Court Docket
            </h4>
            <button
              onClick={() => setShowDocket(!showDocket)}
              className="text-xs text-amber-300 hover:text-amber-200"
            >
              {showDocket ? 'Hide' : 'Show'}
            </button>
          </div>
          {showDocket && (
            <div className="space-y-2 mt-3">
              {dockets.length === 0 ? (
                <p className="text-sm text-white/50">No upcoming dockets.</p>
              ) : (
                dockets.map(docket => (
                  <div key={docket.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3">
                    <div>
                      <p className="font-bold text-white">{new Date(docket.court_date).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-400 capitalize">{docket.status} • {docket.cases_count || 0} cases</p>
                    </div>
                    <Scale size={16} className="text-amber-300" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Gavel size={18} className="text-purple-400" /> My Court Cases
        </h3>
        {cases.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No court cases found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-red-500/10 flex items-center justify-center text-red-300">
                  <User size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-sm truncate">{c.case_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400">
                    vs {c.defendant?.username || c.plaintiff?.username || 'Unknown'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-slate-300 capitalize">
                    {c.status}
                  </span>
                  {c.court_date && (
                    <p className="text-[10px] text-slate-500 mt-1">{new Date(c.court_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
