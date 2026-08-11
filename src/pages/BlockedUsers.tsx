import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban, Search, UserX, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

interface BlockedUser {
  id: string;
  blocked_id: string;
  blocked_username: string;
  blocked_display_name: string | null;
  blocked_avatar_url: string | null;
  created_at: string;
}

export default function BlockedUsers() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: blocks, error: blocksError } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (blocksError) throw blocksError;

      const blockedIds = (blocks || []).map((row: any) => row.blocked_id).filter(Boolean);
      let profiles: any[] = [];
      if (blockedIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', blockedIds);

        if (profilesError) throw profilesError;
        profiles = profilesData || [];
      }

      const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

      const mapped: BlockedUser[] = (blocks || []).map((row: any) => {
        const profile = profileMap.get(row.blocked_id) || {};
        return {
          id: row.id,
          blocked_id: row.blocked_id,
          blocked_username: profile.username || `user${row.blocked_id.slice(0, 6)}`,
          blocked_display_name: profile.display_name || null,
          blocked_avatar_url: profile.avatar_url || null,
          created_at: row.created_at,
        };
      });

      setBlockedUsers(mapped);
    } catch (err) {
      console.error('Error fetching blocked users:', err);
      toast.error('Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleUnblock = async (blockedUserId: string, username: string) => {
    if (!user?.id) return;

    if (!confirm(`Are you sure you want to unblock @${username}?`)) return;

    setUnblockingId(blockedUserId);
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedUserId);

      if (error) throw error;

      toast.success(`Unblocked @${username}`);
      setBlockedUsers((prev) => prev.filter((u) => u.blocked_id !== blockedUserId));
    } catch (err) {
      console.error('Error unblocking user:', err);
      toast.error('Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  const filteredUsers = blockedUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.blocked_username.toLowerCase().includes(q) ||
      (u.blocked_display_name && u.blocked_display_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20 relative overflow-y-auto overflow-x-hidden md:overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.15),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.10),transparent_46%)]" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10">
              <Ban className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Blocked Users</h1>
              <p className="text-sm text-zinc-400">
                {blockedUsers.length} blocked user{blockedUsers.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search blocked users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <UserX className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
            <h3 className="text-lg font-bold text-zinc-300">
              {searchQuery ? 'No matching blocked users' : 'No blocked users'}
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              {searchQuery
                ? 'Try a different search term.'
                : "You haven't blocked anyone yet. When you block users, they'll appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((blockedUser) => (
              <div
                key={blockedUser.id}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
              >
                {/* Avatar */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold overflow-hidden">
                  {blockedUser.blocked_avatar_url ? (
                    <img
                      src={blockedUser.blocked_avatar_url}
                      alt={blockedUser.blocked_username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-zinc-400">
                      {blockedUser.blocked_username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">
                    {blockedUser.blocked_display_name || blockedUser.blocked_username}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    @{blockedUser.blocked_username}
                  </p>
                </div>

                {/* Unblock button */}
                <button
                  type="button"
                  onClick={() => handleUnblock(blockedUser.blocked_id, blockedUser.blocked_username)}
                  disabled={unblockingId === blockedUser.blocked_id}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4 rotate-180" />
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info footer */}
        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="text-sm text-amber-200/80">
              <p className="font-bold text-amber-200">About Blocking</p>
              <p className="mt-1">
                When you block someone, they can&apos;t see your posts, profile, or chat messages.
                You won&apos;t see their content either. Blocking is private — the other user is not notified.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
