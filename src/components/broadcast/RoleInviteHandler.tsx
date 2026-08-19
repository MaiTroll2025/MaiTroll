import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, XCircle, Crown, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';

interface RoleInvite {
  id: string;
  inviter_id: string;
  inviter_username: string;
  inviter_avatar_url: string | null;
  role: string;
  created_at: string;
}

export function RoleInviteHandler() {
  const [invites, setInvites] = useState<RoleInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const fetchPendingInvites = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .rpc('get_pending_role_invites', { p_user_id: user.id });

      if (error) throw error;
      setInvites(data || []);
    } catch (err) {
      console.error('Error fetching role invites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchPendingInvites();

    const channel = supabase
      .channel(`role-invites:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'role_invites',
          filter: `invitee_id=eq.${user.id}`
        },
        () => {
          fetchPendingInvites();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'role_invites',
          filter: `invitee_id=eq.${user.id}`
        },
        () => {
          fetchPendingInvites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAccept = async (inviteId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('respond_role_invite', {
          p_invite_id: inviteId,
          p_status: 'accepted'
        });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success(`You are now ${result.new_role || 'a new role'}!`);
        setInvites(prev => prev.filter(i => i.id !== inviteId));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept invite');
    }
  };

  const handleDecline = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .rpc('respond_role_invite', {
          p_invite_id: inviteId,
          p_status: 'declined'
        });

      if (error) throw error;
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to decline invite');
    }
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3">
      <AnimatePresence>
        {invites.map((invite) => (
          <motion.div
            key={invite.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950/98 shadow-2xl backdrop-blur-xl"
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 text-white">
                  {invite.inviter_avatar_url ? (
                    <img src={invite.inviter_avatar_url} alt={invite.inviter_username} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <Crown className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Role Invitation</span>
                    <Crown className="h-3.5 w-3.5 text-yellow-400" />
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    @{invite.inviter_username} invited you to become <span className="font-bold text-cyan-300">{invite.role}</span>
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {new Date(invite.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAccept(invite.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(invite.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Decline
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
