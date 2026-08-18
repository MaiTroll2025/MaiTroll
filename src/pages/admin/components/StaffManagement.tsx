import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Users, BadgeCheck, Shield, Crown, Star } from 'lucide-react';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  troll_role: string | null;
  is_troll_officer: boolean;
  is_lead_officer: boolean;
  is_admin: boolean;
  is_secretary: boolean;
  is_ceo: boolean;
  is_pastor: boolean;
  is_prosecutor: boolean;
  is_auctioneer: boolean;
  is_moderator: boolean; // kept for DB select but column may not exist
  is_attorney: boolean;
  is_judge: boolean;
  is_troller: boolean;
  is_ceo_assistant: boolean;
  is_noah_assistant: boolean;
  officer_level: number;
  officer_role: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  ceo: 'CEO',
  secretary: 'Secretary',
  executive_secretary: 'Executive Secretary',
  troll_city_secretary: 'MaiTroll Secretary',
  lead_troll_officer: 'Lead Officer',
  troll_officer: 'Troll Officer',
  pastor: 'Pastor',
  prosecutor: 'Prosecutor',
  attorney: 'Attorney',
  judge: 'Judge',
  auctioneer: 'Auctioneer',
  moderator: 'Moderator',
  troller: 'Troller',
  ceo_assistant: 'CEO Assistant',
  noah_assistant: 'Noah Assistant',
  president: 'President',
  vice_president: 'Vice President',
  troll_family: 'Troll Family',
  user: 'User',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-900/50 text-red-300 border-red-500/30',
  ceo: 'bg-amber-900/50 text-amber-300 border-amber-500/30',
  secretary: 'bg-purple-900/50 text-purple-300 border-purple-500/30',
  executive_secretary: 'bg-purple-900/50 text-purple-300 border-purple-500/30',
  troll_city_secretary: 'bg-purple-900/50 text-purple-300 border-purple-500/30',
  lead_troll_officer: 'bg-blue-900/50 text-blue-300 border-blue-500/30',
  troll_officer: 'bg-cyan-900/50 text-cyan-300 border-cyan-500/30',
  pastor: 'bg-green-900/50 text-green-300 border-green-500/30',
  prosecutor: 'bg-orange-900/50 text-orange-300 border-orange-500/30',
  attorney: 'bg-indigo-900/50 text-indigo-300 border-indigo-500/30',
  judge: 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30',
  auctioneer: 'bg-pink-900/50 text-pink-300 border-pink-500/30',
  moderator: 'bg-teal-900/50 text-teal-300 border-teal-500/30',
  troller: 'bg-lime-900/50 text-lime-300 border-lime-500/30',
  ceo_assistant: 'bg-amber-900/50 text-amber-300 border-amber-500/30',
  noah_assistant: 'bg-amber-900/50 text-amber-300 border-amber-500/30',
  president: 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30',
  vice_president: 'bg-yellow-900/50 text-yellow-200 border-yellow-500/30',
  troll_family: 'bg-emerald-900/50 text-emerald-300 border-emerald-500/30',
  user: 'bg-gray-900/50 text-gray-300 border-gray-500/30',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Shield className="w-3 h-3" />,
  ceo: <Crown className="w-3 h-3" />,
  secretary: <Star className="w-3 h-3" />,
  executive_secretary: <Star className="w-3 h-3" />,
  troll_city_secretary: <Star className="w-3 h-3" />,
  lead_troll_officer: <BadgeCheck className="w-3 h-3" />,
  troll_officer: <Shield className="w-3 h-3" />,
};

// Roles that are considered "staff" and should appear in management
const STAFF_ROLES = [
  'admin', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary',
  'lead_troll_officer', 'troll_officer', 'pastor', 'prosecutor', 'attorney',
  'judge', 'auctioneer', 'moderator', 'troller', 'ceo_assistant', 'noah_assistant',
  'president', 'vice_president',
];

// Roles that can be promoted to lead officer by secretary
const PROMOTABLE_ROLES = ['troll_officer', 'moderator', 'troller'];

export default function StaffManagement() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(
          'id, username, avatar_url, role, troll_role, is_troll_officer, is_lead_officer, is_admin, is_secretary, is_ceo, is_pastor, is_prosecutor, is_auctioneer, is_attorney, is_judge, is_troller, is_ceo_assistant, is_noah_assistant, officer_level, officer_role'
        )
        .order('username');

      if (error) throw error;

      // Filter to only staff roles - read from the real `role` column
      const staffMembers = (data || []).filter((member: StaffMember) => {
        const effectiveRole = member.role || member.troll_role || 'user';
        return STAFF_ROLES.includes(effectiveRole) ||
          member.is_troll_officer ||
          member.is_lead_officer ||
          member.is_admin ||
          member.is_secretary ||
          member.is_ceo ||
          member.is_pastor ||
          member.is_prosecutor ||
          member.is_auctioneer ||
          // is_moderator removed - column does not exist
          member.is_attorney ||
          member.is_judge ||
          member.is_troller ||
          member.is_ceo_assistant ||
          member.is_noah_assistant;
      });

      staffMembers.sort((a, b) => {
        const aRole = a.role || a.troll_role || 'user';
        const bRole = b.role || b.troll_role || 'user';
        if (aRole === 'admin' && bRole !== 'admin') return -1;
        if (bRole === 'admin' && aRole !== 'admin') return 1;
        return a.username.localeCompare(b.username);
      });

      setStaff(staffMembers);
    } catch (err) {
      console.error('Error loading staff:', err);
      toast.error('Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveRole = (member: StaffMember): string => {
    // Read from the real `role` column first, then fall back to troll_role
    return member.role || member.troll_role || 'user';
  };

  const toggleLeadRole = async (memberId: string, currentStatus: boolean) => {
    try {
      const newRole = currentStatus ? 'troll_officer' : 'lead_troll_officer';

      const { error } = await supabase.rpc('set_user_role', {
        target_user: memberId,
        new_role: newRole,
        reason: currentStatus ? 'Demoted from Lead Officer' : 'Promoted to Lead Officer',
      });

      if (error) throw error;

      toast.success(`Role updated to ${newRole}`);

      setStaff((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, is_lead_officer: !currentStatus, role: newRole }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error updating role:', err);
      toast.error('Failed to update role: ' + err.message);
    }
  };

  const _changeRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase.rpc('set_user_role', {
        target_user: memberId,
        new_role: newRole,
        reason: `Role changed to ${newRole} via Staff Management`,
      });

      if (error) throw error;

      toast.success(`Role changed to ${ROLE_LABELS[newRole] || newRole}`);

      setStaff((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, role: newRole }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error changing role:', err);
      toast.error('Failed to change role: ' + err.message);
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch = !searchQuery ||
      member.username.toLowerCase().includes(searchQuery.toLowerCase());
    const effectiveRole = getEffectiveRole(member);
    const matchesRole = filterRole === 'all' || effectiveRole === filterRole;
    return matchesSearch && matchesRole;
  });

  const availableRoles = Array.from(new Set(staff.map((m) => getEffectiveRole(m)).filter(Boolean)));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="text-purple-400" />
          Staff Management
        </h2>
        <div className="text-sm text-gray-400">
          Manage roles and assignments from real role data
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search staff..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="bg-zinc-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Roles</option>
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role] || role}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="bg-white/5 text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Staff Member</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Lead Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center">Loading staff...</td></tr>
            ) : filteredStaff.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center">No staff found</td></tr>
            ) : (
              filteredStaff.map((member) => {
                const effectiveRole = getEffectiveRole(member);
                const roleColor = ROLE_COLORS[effectiveRole] || ROLE_COLORS['user'];
                const roleIcon = ROLE_ICONS[effectiveRole] || <Users className="w-3 h-3" />;
                const canPromote = PROMOTABLE_ROLES.includes(effectiveRole) || member.is_lead_officer || effectiveRole === 'lead_troll_officer';

                return (
                  <tr key={member.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                              {member.username.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{member.username}</div>
                          <div className="text-xs text-gray-500">ID: {member.id.substring(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${roleColor}`}>
                        {roleIcon}
                        {ROLE_LABELS[effectiveRole] || effectiveRole}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {member.is_lead_officer || effectiveRole === 'lead_troll_officer' ? (
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <BadgeCheck className="w-4 h-4" /> Lead Officer
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">Standard</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {canPromote && (
                          <button
                            onClick={() => toggleLeadRole(member.id, member.is_lead_officer || effectiveRole === 'lead_troll_officer')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                              member.is_lead_officer || effectiveRole === 'lead_troll_officer'
                                ? 'bg-red-900/20 border-red-500/30 text-red-400 hover:bg-red-900/40'
                                : 'bg-green-900/20 border-green-500/30 text-green-400 hover:bg-green-900/40'
                            }`}
                          >
                            {member.is_lead_officer || effectiveRole === 'lead_troll_officer' ? 'Remove Lead' : 'Promote to Lead'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
