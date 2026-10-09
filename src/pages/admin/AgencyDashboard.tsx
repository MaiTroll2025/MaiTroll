import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { isAdminEmail } from '../../lib/supabase';
import { Loader } from '../../components/ui/loader';
import AgencyApplicationsPanel from './components/AgencyApplicationsPanel';
import AgencyMembersPanel from './components/AgencyMembersPanel';
import AgencyLeaderboardPanel from './components/AgencyLeaderboardPanel';
import AgencyPointAdjustmentPanel from './components/AgencyPointAdjustmentPanel';
import AgencyRewardDistributionPanel from './components/AgencyRewardDistributionPanel';
import AgencyAuditLogPanel from './components/AgencyAuditLogPanel';
import { useAdminAgencyApplications } from '../../hooks/useAdminAgency';
import { useAdminAgencyMembers } from '../../hooks/useAdminAgency';
import { useAdminAgencyLeaderboard } from '../../hooks/useAdminAgency';
import { Users, FileText, Trophy, SlidersHorizontal, Gift, ScrollText } from 'lucide-react';

type TabId = 'applications' | 'members' | 'leaderboard' | 'adjustments' | 'rewards' | 'audit';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'applications', label: 'Applications', icon: <FileText className="h-4 w-4" /> },
  { id: 'members', label: 'Members', icon: <Users className="h-4 w-4" /> },
  { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-4 w-4" /> },
  { id: 'adjustments', label: 'Point Adjust', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { id: 'rewards', label: 'Rewards', icon: <Gift className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit Log', icon: <ScrollText className="h-4 w-4" /> },
];

export default function AgencyDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('applications');
  const { applications } = useAdminAgencyApplications();
  const { members } = useAdminAgencyMembers();
  const { leaderboard: _leaderboard } = useAdminAgencyLeaderboard();

  useEffect(() => {
    if (!user || !profile) return;
    if (!isAdminEmail(user.email) && !profile.is_admin) {
      navigate('/admin');
    }
  }, [user, profile, navigate]);

  if (!user || !profile) return <Loader />;
  if (!isAdminEmail(user.email) && !profile.is_admin) return null;

  const totalPoints = members.reduce((sum, m) => sum + m.total_points, 0);
  const pendingCount = applications.length;
  const memberCount = members.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Agency Management
          </h1>
          <p className="text-slate-400 mt-1">Manage applications, members, points, and rewards</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-500/10 p-2.5">
                <Users className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Members</p>
                <p className="text-2xl font-black text-white">{memberCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-yellow-500/10 p-2.5">
                <FileText className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Pending Applications</p>
                <p className="text-2xl font-black text-white">{pendingCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-500/10 p-2.5">
                <Trophy className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Points</p>
                <p className="text-2xl font-black text-white">{totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-1.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600/80 to-blue-600/80 text-white shadow-[0_0_20px_rgba(147,51,234,0.2)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'applications' && pendingCount > 0 && (
                <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-300">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div>
          {activeTab === 'applications' && <AgencyApplicationsPanel />}
          {activeTab === 'members' && <AgencyMembersPanel />}
          {activeTab === 'leaderboard' && <AgencyLeaderboardPanel />}
          {activeTab === 'adjustments' && <AgencyPointAdjustmentPanel />}
          {activeTab === 'rewards' && <AgencyRewardDistributionPanel />}
          {activeTab === 'audit' && <AgencyAuditLogPanel />}
        </div>
      </div>
    </div>
  );
}
