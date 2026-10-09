import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Play, Calendar, HardDrive, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';
import { useNavigate } from 'react-router-dom';

interface ReplayItem {
  id: string;
  stream_id: string;
  title: string;
  replay_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size: number | null;
  created_at: string;
}

interface ProfileReplaysProps {
  userId: string;
}

export default function ProfileReplays({ userId }: ProfileReplaysProps) {
  const { profile: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [replays, setReplays] = useState<ReplayItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = currentUser?.id === userId;

  const fetchReplays = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('broadcast_replays')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) throw error;
      setReplays(data as ReplayItem[]);
    } catch (err) {
      console.error('[ProfileReplays] Error fetching replays:', err);
      toast.error('Failed to load replays');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchReplays();
  }, [userId, fetchReplays]);

  const handleDelete = async (replayId: string, _streamId: string) => {
    try {
      const { error } = await supabase
        .from('broadcast_replays')
        .delete()
        .eq('id', replayId);

      if (error) throw error;

      setReplays((prev) => prev.filter((r) => r.id !== replayId));
      toast.success('Replay deleted');
    } catch (err) {
      console.error('[ProfileReplays] Error deleting replay:', err);
      toast.error('Failed to delete replay');
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading replays...</span>
      </div>
    );
  }

  if (replays.length === 0) {
    return (
      <div className="text-center py-12 bg-white/[0.035] rounded-xl border border-white/10">
        <div className="text-4xl mb">🎬</div>
        <h3 className="text-lg font-bold text-white mb-2">No Replays Yet</h3>
        <p className="text-gray-400 text-sm">
          {isOwnProfile
            ? 'Enable "Save Replay" before going live to archive your broadcasts.'
            : 'This user has no archived replays.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {replays.map((replay) => (
        <div
          key={replay.id}
          className="bg-white/[0.035] border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group cursor-pointer relative"
          onClick={() => navigate(`/replay/${replay.stream_id}`)}
        >
          <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-blue-900 overflow-hidden">
            {replay.thumbnail_url ? (
              <img
                src={replay.thumbnail_url}
                alt={replay.title || 'Replay'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <Play size={48} />
              </div>
            )}

            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
                <Play className="w-7 h-7 text-white ml-1" />
              </div>
            </div>

            {replay.duration_seconds && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {formatDuration(replay.duration_seconds)}
              </div>
            )}
          </div>

          <div className="p-3">
            <h3 className="font-bold text-white text-sm line-clamp-2 mb-2" title={replay.title}>
              {replay.title || 'Untitled Broadcast'}
            </h3>

            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {new Date(replay.created_at).toLocaleDateString()}
              </span>
              {replay.file_size && (
                <span className="flex items-center gap-1">
                  <HardDrive size={10} />
                  {formatFileSize(replay.file_size)}
                </span>
              )}
            </div>

            {isOwnProfile && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/replay/${replay.stream_id}`);
                  }}
                  className="flex-1 px-2 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 text-xs rounded transition-colors flex items-center justify-center gap-1"
                >
                  <Play size={12} />
                  Watch
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(replay.id, replay.stream_id);
                  }}
                  className="px-2 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded transition-colors flex items-center justify-center"
                  title="Delete replay"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
