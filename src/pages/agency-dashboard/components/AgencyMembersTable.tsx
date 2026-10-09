import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Loader } from '../../../components/ui/loader';
import OrgModerationModal from '../../../components/moderation/OrgModerationModal';

type AgencyMembersTableProps = {
  agencyId?: string;
  currentUserId?: string;
  canManage?: boolean;
};

type AgencyMemberRow = {
  id: string;
  agency_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  removed_at: string | null;
  created_at: string;
  user_profiles?: {
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

const statusStyles: Record<string, string> = {
  active: 'border-emerald-500/50 text-emerald-300',
  suspended: 'border-amber-500/50 text-amber-300',
  removed: 'border-rose-500/50 text-rose-300',
  left: 'border-slate-500/50 text-slate-300',
};

const AgencyMembersTable: React.FC<AgencyMembersTableProps> = ({
  agencyId,
  currentUserId,
  canManage = false,
}) => {
  const [members, setMembers] = useState<AgencyMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modTarget, setModTarget] = useState<AgencyMemberRow | null>(null);

  const activeCount = useMemo(
    () => members.filter((member) => member.status === 'active').length,
    [members],
  );

  const fetchMembers = useCallback(async () => {
    if (!agencyId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('agency_members')
        .select(`*, user_profiles:user_id(username, avatar_url)`)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setMembers((data as AgencyMemberRow[]) || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void fetchMembers();
  }, [agencyId, fetchMembers]);

  const manageMember = async (memberId: string, action: 'suspend' | 'remove' | 'restore') => {
    if (!currentUserId || !canManage) {
      return;
    }

    try {
      setActionLoading(memberId);
      const { error } = await supabase.rpc('manage_agency_member', {
        p_member_id: memberId,
        p_actor_id: currentUserId,
        p_action: action,
        p_reason: `${action.charAt(0).toUpperCase() + action.slice(1)}d from agency enforcement panel`,
      });

      if (error) {
        throw error;
      }

      await fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Failed to update member.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-cyan-400">Agency Members</h3>
          <p className="text-sm text-slate-400">
            Suspend, remove, or restore members with the same server-side audit trail as applications.
          </p>
        </div>
        <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
          {activeCount} active
        </Badge>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700/60 px-4 py-8 text-center text-slate-400">
          No members are currently assigned to this agency.
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => {
            const canAct = canManage && member.role !== 'owner' && member.user_id !== currentUserId;
            const statusBadge = statusStyles[member.status] || 'border-slate-500/50 text-slate-300';

            return (
              <div
                key={member.id}
                className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">
                        @{member.user_profiles?.username || 'unknown'}
                      </span>
                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                        {member.role}
                      </Badge>
                      <Badge variant="outline" className={statusBadge}>
                        {member.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-400">
                      Joined {new Date(member.joined_at).toLocaleDateString()} · Created {new Date(member.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {canAct ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
                        onClick={() => setModTarget(member)}
                      >
                        Moderate
                      </Button>
                      {member.status === 'active' ? (
                        <>
                          <Button
                            variant="outline"
                            className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                            onClick={() => manageMember(member.id, 'suspend')}
                            disabled={actionLoading === member.id}
                          >
                            {actionLoading === member.id ? 'Processing...' : 'Suspend'}
                          </Button>
                          <Button
                            variant="outline"
                            className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                            onClick={() => manageMember(member.id, 'remove')}
                            disabled={actionLoading === member.id}
                          >
                            {actionLoading === member.id ? 'Processing...' : 'Remove'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                          onClick={() => manageMember(member.id, 'restore')}
                          disabled={actionLoading === member.id}
                        >
                          {actionLoading === member.id ? 'Processing...' : 'Restore'}
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modTarget && agencyId ? (
        <OrgModerationModal
          open={!!modTarget}
          onClose={() => setModTarget(null)}
          orgType="agency"
          orgId={agencyId}
          targetUserId={modTarget.user_id}
          targetName={modTarget.user_profiles?.username || undefined}
          onActionComplete={() => {
            void fetchMembers();
          }}
        />
      ) : null}
    </div>
  );
};

export default AgencyMembersTable;