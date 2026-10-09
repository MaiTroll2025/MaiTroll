import { useState } from 'react';
import { useAdminAgencyMembers } from '@/hooks/useAdminAgency';
import { TIER_CONFIG } from '@/types/agency';
import type { AgencyMemberRole } from '@/types/agency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Users, Shield, Loader2, UserX, X, Crown, Award, Star } from 'lucide-react';

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: AgencyMemberRole;
  current_tier: string;
  total_points: number;
  lifetime_points: number;
  joined_at: string;
  username?: string;
  avatar_url?: string;
  display_name?: string;
  is_active: boolean;
  promoted_at?: string | null;
  last_active_at?: string | null;
}

function MemberDetailPanel({
  member,
  onClose,
  onUpdateRole,
  onDeactivate,
}: {
  member: MemberWithProfile;
  onClose: () => void;
  onUpdateRole: (memberId: string, role: AgencyMemberRole) => Promise<void>;
  onDeactivate: (memberId: string) => Promise<void>;
}) {
  const [selectedRole, setSelectedRole] = useState<AgencyMemberRole>(member.role);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const tierConfig = TIER_CONFIG[member.current_tier as keyof typeof TIER_CONFIG];

  const handleSaveRole = async () => {
    if (selectedRole === member.role) {
      toast.info('No role change detected');
      return;
    }
    setSaving(true);
    try {
      await onUpdateRole(member.id, selectedRole);
      toast.success(`Role updated to ${selectedRole}`);
    } catch (_err) {
      toast.error('Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`Deactivate @${member.username}? This will remove them from the agency.`)) return;
    setDeactivating(true);
    try {
      await onDeactivate(member.id);
      toast.success('Member deactivated');
      onClose();
    } catch (_err) {
      toast.error('Failed to deactivate member');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#070b19]/95 p-6 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <img
              src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`}
              alt={member.username}
              className="w-14 h-14 rounded-full border border-white/10 bg-black/40"
            />
            <div>
              <h3 className="text-lg font-black text-white">@{member.username || 'Unknown'}</h3>
              {member.display_name && (
                <p className="text-sm text-slate-400">{member.display_name}</p>
              )}
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider mt-1',
                tierConfig?.borderColor,
                tierConfig?.bgColor,
                tierConfig?.color,
              )}>
                {tierConfig?.icon} {tierConfig?.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Total Points</p>
            <p className="text-xl font-black text-white">{member.total_points.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Lifetime Points</p>
            <p className="text-xl font-black text-cyan-300">{member.lifetime_points.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Joined</p>
            <p className="text-sm font-bold text-white">{new Date(member.joined_at).toLocaleDateString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Last Active</p>
            <p className="text-sm font-bold text-white">
              {member.last_active_at ? new Date(member.last_active_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Role</label>
            <div className="flex gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AgencyMemberRole)}
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
              >
                <option value="creator">Creator</option>
                <option value="leader">Leader</option>
                <option value="manager">Manager</option>
              </select>
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={saving || selectedRole === member.role}
                className="flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/15 px-4 py-2.5 text-sm font-black text-purple-200 transition-colors hover:bg-purple-500/25 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDeactivate}
            disabled={deactivating}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-black text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            Deactivate Member
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgencyMembersPanel() {
  const { members, loading, error, refresh, updateRole, deactivate } = useAdminAgencyMembers();
  const [selectedMember, setSelectedMember] = useState<MemberWithProfile | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const handleQuickRoleChange = async (memberId: string, role: AgencyMemberRole) => {
    setRoleUpdatingId(memberId);
    try {
      await updateRole(memberId, role);
      toast.success(`Role updated to ${role}`);
    } catch (_err) {
      toast.error('Failed to update role');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleQuickDeactivate = async (memberId: string, username?: string) => {
    if (!window.confirm(`Deactivate @${username || 'this member'}?`)) return;
    setDeactivatingId(memberId);
    try {
      await deactivate(memberId);
      toast.success('Member deactivated');
    } catch (_err) {
      toast.error('Failed to deactivate member');
    } finally {
      setDeactivatingId(null);
    }
  };

  const _getRoleIcon = (role: AgencyMemberRole) => {
    switch (role) {
      case 'creator': return <Crown className="w-3.5 h-3.5" />;
      case 'leader': return <Star className="w-3.5 h-3.5" />;
      case 'manager': return <Award className="w-3.5 h-3.5" />;
    }
  };

  const getRoleColor = (role: AgencyMemberRole) => {
    switch (role) {
      case 'creator': return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
      case 'leader': return 'border-purple-400/30 bg-purple-500/10 text-purple-200';
      case 'manager': return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/20 p-2.5">
            <Users className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Agency Members</h2>
            <p className="text-sm text-slate-400">Manage agency members, roles, and status</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <Loader2 className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Total Members</p>
          <p className="text-2xl font-black text-white mt-1">{members.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Total Points</p>
          <p className="text-2xl font-black text-cyan-300 mt-1">
            {members.reduce((sum, m) => sum + m.total_points, 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Lifetime Points</p>
          <p className="text-2xl font-black text-purple-300 mt-1">
            {members.reduce((sum, m) => sum + m.lifetime_points, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {loading && !members.length ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-300">
          <p className="font-bold">Error loading members</p>
          <p className="mt-1 text-sm text-red-400">{error}</p>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center backdrop-blur-xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No members found</h3>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3.5 text-left text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Member</th>
                  <th className="px-5 py-3.5 text-left text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Tier</th>
                  <th className="px-5 py-3.5 text-right text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Total Points</th>
                  <th className="px-5 py-3.5 text-right text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Lifetime</th>
                  <th className="px-5 py-3.5 text-left text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Role</th>
                  <th className="px-5 py-3.5 text-left text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Joined</th>
                  <th className="px-5 py-3.5 text-right text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const tierConfig = TIER_CONFIG[member.current_tier as keyof typeof TIER_CONFIG];
                  const isRoleUpdating = roleUpdatingId === member.id;
                  const isDeactivating = deactivatingId === member.id;

                  return (
                    <tr
                      key={member.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => setSelectedMember(member as MemberWithProfile)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`}
                            alt={member.username}
                            className="w-9 h-9 rounded-full border border-white/10 bg-black/40"
                          />
                          <div>
                            <p className="text-sm font-bold text-white">@{member.username || 'Unknown'}</p>
                            {member.display_name && (
                              <p className="text-xs text-slate-500">{member.display_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {tierConfig && (
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider',
                            tierConfig.borderColor,
                            tierConfig.bgColor,
                            tierConfig.color,
                          )}>
                            {tierConfig.icon} {tierConfig.label}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-black text-white">{member.total_points.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-slate-400">{member.lifetime_points.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleQuickRoleChange(member.id, e.target.value as AgencyMemberRole)}
                            disabled={isRoleUpdating}
                            className={cn(
                              'rounded-lg border px-2.5 py-1 text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50',
                              getRoleColor(member.role),
                            )}
                          >
                            <option value="creator">Creator</option>
                            <option value="leader">Leader</option>
                            <option value="manager">Manager</option>
                          </select>
                          {isRoleUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-500">{new Date(member.joined_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleQuickDeactivate(member.id, member.username)}
                          disabled={isDeactivating}
                          className="rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {isDeactivating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Deactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedMember && (
        <MemberDetailPanel
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onUpdateRole={async (memberId, role) => {
            await updateRole(memberId, role);
            setSelectedMember((prev) => prev ? { ...prev, role } : null);
          }}
          onDeactivate={async (memberId) => {
            await deactivate(memberId);
            setSelectedMember(null);
          }}
        />
      )}
    </div>
  );
}
