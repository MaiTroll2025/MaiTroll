import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Building2, Loader2, Users, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface AgencyMember {
  id: string;
  agency_id: string;
  role: string;
  status: string;
  agencies: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    logo_url: string | null;
    status: string;
  } | null;
}

export default function ProfileAgency({ userId }: { userId: string }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<AgencyMember | null>(null);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('agency_members')
          .select(`
            id,
            agency_id,
            role,
            status,
            agencies (
              id,
              name,
              slug,
              bio,
              logo_url,
              status
            )
          `)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (error) throw error;
        if (isMounted) setMembership(data as AgencyMember | null);
      } catch (err) {
        console.error('[ProfileAgency] Error:', err);
        toast.error('Failed to load agency info');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading agency...</span>
      </div>
    );
  }

  if (membership?.agencies) {
    const agency = membership.agencies;
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div className="flex items-center gap-4">
          {agency.logo_url ? (
            <img src={agency.logo_url} alt={agency.name} className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-300">
              <Building2 size={28} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-white truncate">{agency.name}</h3>
            <p className="text-xs text-slate-400 capitalize">{membership.role} • {agency.status}</p>
            {agency.bio && <p className="text-sm text-slate-300 mt-1 line-clamp-2">{agency.bio}</p>}
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => navigate(`/agency/${agency.id}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white hover:bg-purple-500"
          >
            <ExternalLink size={14} /> View Agency
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12 text-white/50">
      <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="mb-4">Not part of an agency yet.</p>
      {user?.id === userId && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/agencies')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            <Users size={14} /> Browse Agencies
          </button>
          <button
            onClick={() => navigate('/agencies/create')}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white hover:bg-purple-500"
          >
            Create Agency
          </button>
        </div>
      )}
    </div>
  );
}
