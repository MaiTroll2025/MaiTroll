import React, { useState } from 'react';
import { Shield, AlertTriangle, UserX, Lock, Ban, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';

export default function JailTab(props: any) {
  const roleLevel = props.roleLevel || 'citizen';
  const canEnforce = ['officer', 'lead', 'secretary', 'president', 'admin'].includes(roleLevel);
  const userId = props.userId;

  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [searchUsername, setSearchUsername] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string }>>([]);
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const actions = [
    {
      id: 'warn',
      label: 'Warning',
      icon: AlertTriangle,
      color: 'yellow',
      description: 'Issue an official warning to a user',
      bgClass: 'bg-yellow-500/20',
      textClass: 'text-yellow-400',
      borderClass: 'border-yellow-500/30',
      btnClass: 'bg-yellow-600 hover:bg-yellow-500',
    },
    {
      id: 'jail',
      label: 'Jail',
      icon: Lock,
      color: 'orange',
      description: 'Put a user in jail for a set duration',
      bgClass: 'bg-orange-500/20',
      textClass: 'text-orange-400',
      borderClass: 'border-orange-500/30',
      btnClass: 'bg-orange-600 hover:bg-orange-500',
    },
    {
      id: 'ban',
      label: 'Permanent Ban',
      icon: Ban,
      color: 'red',
      description: 'Permanently ban a user from the city',
      bgClass: 'bg-red-500/20',
      textClass: 'text-red-400',
      borderClass: 'border-red-500/30',
      btnClass: 'bg-red-600 hover:bg-red-500',
    },
    {
      id: 'mute',
      label: 'Chat Mute',
      icon: UserX,
      color: 'purple',
      description: 'Mute a user from chat for a set duration',
      bgClass: 'bg-purple-500/20',
      textClass: 'text-purple-400',
      borderClass: 'border-purple-500/30',
      btnClass: 'bg-purple-600 hover:bg-purple-500',
    },
  ];

  const durationOptions = [
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: '6 hours', value: 360 },
    { label: '12 hours', value: 720 },
    { label: '24 hours', value: 1440 },
  ];

  const searchUser = async () => {
    if (!searchUsername.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username')
        .ilike('username', `%${searchUsername.trim()}%`)
        .limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (_err) {
      toast.error('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleAction = async () => {
    if (!selectedUser) {
      toast.error('Please select a user first');
      return;
    }
    if (!reason.trim() && activeAction !== 'warn') {
      toast.error('Please provide a reason');
      return;
    }
    if (selectedUser.id === userId) {
      toast.error('You cannot take action against yourself');
      return;
    }

    setSubmitting(true);
    try {
      if (activeAction === 'warn') {
        await supabase.from('notifications').insert([{
          user_id: selectedUser.id,
          type: 'government_warning',
          title: 'Official Warning',
          message: reason.trim() || 'You have received an official warning from city officers.',
          from_user_id: userId,
        }]);
        toast.success(`Warning issued to @${selectedUser.username}`);
      } else if (activeAction === 'mute') {
        const { error: muteError } = await supabase.rpc('mute_user', {
          p_user_id: selectedUser.id,
          p_duration_minutes: duration,
          p_reason: reason.trim(),
          p_officer_id: userId,
        });
        if (muteError) {
          await supabase.from('user_mutes').insert([{
            user_id: selectedUser.id,
            muted_by: userId,
            reason: reason.trim(),
            expires_at: new Date(Date.now() + duration * 60000).toISOString(),
          }]);
        }
        toast.success(`@${selectedUser.username} muted for ${durationOptions.find(d => d.value === duration)?.label || duration + ' minutes'}`);
      } else if (activeAction === 'jail') {
        const { error: jailError } = await supabase.rpc('jail_user', {
          p_user_id: selectedUser.id,
          p_duration_minutes: duration,
          p_reason: reason.trim(),
          p_officer_id: userId,
        });
        if (jailError) {
          await supabase.from('user_jails').insert([{
            user_id: selectedUser.id,
            jailed_by: userId,
            reason: reason.trim(),
            expires_at: new Date(Date.now() + duration * 60000).toISOString(),
          }]);
        }
        toast.success(`@${selectedUser.username} jailed for ${durationOptions.find(d => d.value === duration)?.label || duration + ' minutes'}`);
      } else if (activeAction === 'ban') {
        const { error: banError } = await supabase.from('user_bans').insert([{
          user_id: selectedUser.id,
          banned_by: userId,
          reason: reason.trim(),
        }]);
        if (banError) {
          await supabase
            .from('user_profiles')
            .update({ is_banned: true, banned_at: new Date().toISOString(), ban_reason: reason.trim() })
            .eq('id', selectedUser.id);
        }
        toast.success(`@${selectedUser.username} has been permanently banned`);
      }

      try {
        await supabase.rpc('log_government_action', {
          p_event_type: `action_${activeAction}`,
          p_actor_id: userId,
          p_target_id: selectedUser.id,
          p_description: `${activeAction.toUpperCase()} on @${selectedUser.username}: ${reason.trim()}`,
        });
      } catch (__) { /* noop */ }

      setActiveAction(null);
      setSelectedUser(null);
      setSearchUsername('');
      setSearchResults([]);
      setReason('');
      setDuration(60);
    } catch (err: any) {
      try {
        await supabase.rpc('log_government_action', {
          p_event_type: `action_${activeAction}`,
          p_actor_id: userId,
          p_target_id: selectedUser.id,
          p_description: `${activeAction.toUpperCase()} on @${selectedUser.username}: ${reason.trim()}`,
        });
      } catch (__) { /* noop */ }
      toast.error(err?.message || `Failed to ${activeAction} user`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEnforce) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Lock className="text-red-400" />
            Jail Center
          </h2>
          <p className="text-slate-400 mt-1">Moderation and law enforcement tools</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">Access Restricted</h3>
          <p className="text-slate-400 mb-4">Only officers and above can access jail & enforcement tools.</p>
          <p className="text-xs text-slate-600">Want to help enforce city laws? Apply to become an officer at /officer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Shield className="text-green-400" />
          Enforcement Center
        </h2>
        <p className="text-slate-400 mt-1">Issue warnings, jail sentences, mutes, and bans</p>
      </div>

      {/* Action type selector */}
      {!activeAction && (
        <div className="grid md:grid-cols-2 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => setActiveAction(action.id)}
                className={`border ${action.borderClass} rounded-xl p-6 text-left transition-all hover:scale-[1.02] ${action.bgClass}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${action.bgClass} ${action.borderClass} border`}>
                    <Icon className={action.textClass} size={24} />
                  </div>
                  <h3 className="font-bold text-lg text-white">{action.label}</h3>
                </div>
                <p className="text-slate-400 text-sm">{action.description}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Action form */}
      {activeAction && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              {(() => {
                const action = actions.find(a => a.id === activeAction);
                if (!action) return null;
                const Icon = action.icon;
                return <><Icon className={action.textClass} /> {action.label} a User</>;
              })()}
            </h3>
            <button
              onClick={() => { setActiveAction(null); setSelectedUser(null); setSearchUsername(''); setSearchResults([]); setReason(''); }}
              className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>

          {/* User search */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Search User *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUser()}
                  placeholder="Enter username..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
                />
              </div>
              <button
                onClick={searchUser}
                disabled={searching}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                {searching ? (
                  <div className="h-5 w-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                ) : 'Search'}
              </button>
            </div>

            {/* Selected user */}
            {selectedUser && (
              <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-green-300 font-medium">@{selectedUser.username}</span>
                <button onClick={() => { setSelectedUser(null); setSearchResults([]); }} className="text-green-400 hover:text-green-300">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Search results */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => { setSelectedUser(user); setSearchResults([]); }}
                    className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                  >
                    @{user.username}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duration selector (not for warn or ban) */}
          {activeAction !== 'warn' && activeAction !== 'ban' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Duration *</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
              >
                {durationOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Reason {activeAction !== 'warn' && '*'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Why are you ${activeAction === 'warn' ? 'warning' : activeAction === 'ban' ? 'banning' : activeAction === 'jail' ? 'jailing' : 'muting'} this user?`}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              onClick={() => { setActiveAction(null); setSelectedUser(null); setSearchUsername(''); setSearchResults([]); setReason(''); }}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAction}
              disabled={submitting || !selectedUser}
              className={`flex-1 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                actions.find(a => a.id === activeAction)?.btnClass || 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {(() => {
                    const Icon = actions.find(a => a.id === activeAction)?.icon || AlertTriangle;
                    return <Icon size={16} />;
                  })()}
                  {activeAction === 'warn' ? 'Issue Warning' :
                   activeAction === 'ban' ? 'Ban User' :
                   activeAction === 'jail' ? 'Jail User' : 'Mute User'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
