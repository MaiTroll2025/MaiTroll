import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Video, Loader2, ExternalLink, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Stream {
  id: string;
  title: string;
  status: string;
  created_at: string;
  ended_at: string | null;
}

export default function ProfileBroadcasts({ userId }: { userId: string }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<Stream[]>([]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('id, title, status, created_at, ended_at')
          .or(`broadcaster_id.eq.${userId},user_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        if (isMounted) setStreams((data || []) as Stream[]);
      } catch (err) {
        console.error('[ProfileBroadcasts] Error:', err);
        toast.error('Failed to load broadcasts');
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
        <span className="ml-2 text-gray-400">Loading broadcasts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Broadcasts</h3>
        {user?.id === userId && (
          <button
            onClick={() => navigate('/broadcast/setup')}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white hover:bg-purple-500"
          >
            <Plus size={14} /> Go Live
          </button>
        )}
      </div>
      {streams.length === 0 ? (
        <div className="text-center py-12 text-white/50">
          <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No broadcasts yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map(stream => (
            <div key={stream.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-300">
                  <Video size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white truncate">{stream.title || 'Untitled Broadcast'}</p>
                  <p className="text-xs text-slate-400 capitalize">{stream.status} • {new Date(stream.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {stream.status === 'live' && (
                <a
                  href={`/live/${userId}`}
                  className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200 font-bold"
                >
                  <ExternalLink size={12} /> Watch Live
                </a>
              )}
              {stream.status === 'ended' && stream.ended_at && (
                <p className="text-xs text-slate-500">Ended {new Date(stream.ended_at).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
