// =============================================================================
// TROLL FAMILIES - OPTIMIZED FAMILY HOME PAGE
// =============================================================================
// Performance optimized version with:
// - Single RPC call instead of 6+ queries
// - Caching layer to prevent refetching
// - Real-time subscriptions for live updates
// - Modular component architecture
// - Optimized members loading (pagination)
// - Role-based UI controls
// - Skeleton loading states

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useCoins } from '../lib/hooks/useCoins';
import { 
  Crown, Users, Trophy, Target, Heart, 
  ChevronRight, Activity, Zap, Gift, MessageSquare,
  TrendingUp, Shield, Music, Video, Clock, AlertTriangle,
  CheckCircle, Lock, Plus, Sparkles, RefreshCw, Eye,
  Settings, LogOut, X
} from 'lucide-react';
import OrgModerationModal from '../components/moderation/OrgModerationModal';

// Types for aggregated family data from RPC
interface FamilyData {
  id: string;
  name: string;
  tag: string;
  slogan?: string;
  crest_url?: string;
  banner_url?: string;
  level: number;
  xp: number;
  legacy_score: number;
  reputation: number;
  member_count?: number;
}

interface FamilyMember {
  id: string;
  user_id: string;
  role: string;
  approval_status?: 'pending' | 'approved' | 'denied';
  username?: string;
  avatar_url?: string;
  display_name?: string;
}

interface FamilyGoal {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: string;
  target_value: number;
  current_value: number;
  status: string;
  reward_coins: number;
  bonus_coins: number;
  expires_at: string;
}

interface FamilyAchievement {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  rarity: string;
  unlocked_at?: string;
}

interface FamilyVault {
  total_coins: number;
  weekly_contribution: number;
  streak_bonus: number;
}

interface FamilyHeartbeat {
  health: string;
  total_members: number;
  active_members: number;
  at_risk_members: number;
  goals_active: number;
  goals_completed: number;
  current_streak: number;
  unread_notifications: number;
}

interface FamilyNotification {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
  notification_type?: string;
  related_user_id?: string;
  related_goal_id?: string;
}

interface FamilyHomeData {
  family: FamilyData | null;
  members: FamilyMember[];
  goals: FamilyGoal[];
  achievements: FamilyAchievement[];
  vault: FamilyVault | null;
  heartbeat: FamilyHeartbeat | null;
  notifications: FamilyNotification[];
  user_role: string | null;
}

// Tab types
type TabType = 'home' | 'goals' | 'achievements' | 'members' | 'vault';

// Cache for family data
const familyCache = new Map<string, { data: FamilyHomeData; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

export default function TrollFamilyHome() {
  const { user } = useAuthStore();
  const { troll_coins: coinsBalance } = useCoins();
  const navigate = useNavigate();
  
  // State management
  const [familyData, setFamilyData] = useState<FamilyHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [leavingFamily, setLeavingFamily] = useState(false);
  
  // Ref for cleanup
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const userCoins = typeof coinsBalance === 'number' ? coinsBalance : 0;

  // Fetch family data using single RPC call
  const fetchFamilyData = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    const cacheKey = user.id;
    const cached = familyCache.get(cacheKey);

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setFamilyData(cached.data);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_family_home_data', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching family data:', error);
        setFamilyData(null);
        return;
      }

      const parsedData = data as FamilyHomeData;
      
      // Cache the result
      familyCache.set(cacheKey, { data: parsedData, timestamp: Date.now() });
      setFamilyData(parsedData);
    } catch (err) {
      console.error('Failed to fetch family data:', err);
      setFamilyData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    fetchFamilyData();
  }, [fetchFamilyData]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user || !familyData?.family?.id) return;

    const familyId = familyData.family.id;

    // Subscribe to family_members changes
    const membersChannel = supabase
      .channel(`family-members-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_members',
          filter: `family_id=eq.${familyId}`
        },
        () => {
          // Invalidate cache and refetch
          familyCache.delete(user.id);
          fetchFamilyData(true);
        }
      )
      .subscribe();

    // Subscribe to family_goals changes
    const goalsChannel = supabase
      .channel(`family-goals-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_goals',
          filter: `family_id=eq.${familyId}`
        },
        () => {
          familyCache.delete(user.id);
          fetchFamilyData(true);
        }
      )
      .subscribe();

    // Subscribe to family_notifications
    const notificationsChannel = supabase
      .channel(`family-notifications-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_notifications',
          filter: `family_id=eq.${familyId}`
        },
        () => {
          familyCache.delete(user.id);
          fetchFamilyData(true);
        }
      )
      .subscribe();

    // Subscribe to troll_families updates (for level changes, etc.)
    const familyChannel = supabase
      .channel(`family-updates-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'troll_families',
          filter: `id=eq.${familyId}`
        },
        () => {
          familyCache.delete(user.id);
          fetchFamilyData(true);
        }
      )
      .subscribe();

    channelsRef.current = [membersChannel, goalsChannel, notificationsChannel, familyChannel];

    return () => {
      channelsRef.current.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user, familyData?.family?.id, fetchFamilyData]);

  // Manual refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    familyCache.delete(user?.id || '');
    fetchFamilyData(true);
  };

  // Handle starting a broadcast - navigate to go live and notify family members
  const handleStartBroadcast = async (familyId: string, broadcasterId: string, broadcasterName: string) => {
    try {
      // Create a notification for all family members
      const { error: notificationError } = await supabase
        .from('family_notifications')
        .insert({
          family_id: familyId,
          title: '🔴 Family Broadcast Live!',
          message: `${broadcasterName} is now live! Click to watch.`,
          severity: 'info',
          is_read: false
        });

      if (notificationError) {
        console.error('Error creating broadcast notification:', notificationError);
      }
    } catch (err) {
      console.error('Error sending broadcast notification:', err);
    }

    // Navigate to go live
    navigate('/live');
  };

  // Handle kicking a member from the family
  const handleKickMember = async (targetUserId: string) => {
    if (!user || !familyData?.family?.id) return;

    const confirmed = window.confirm('Are you sure you want to kick this member from the family?');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.rpc('kick_family_member', {
        p_family_id: familyData.family.id,
        p_target_user_id: targetUserId,
        p_admin_user_id: user.id
      });

      if (error) {
        console.error('Error kicking member:', error);
        alert('Failed to kick member. You may not have permission.');
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (result.success) {
        // Refresh family data
        familyCache.delete(user.id);
        fetchFamilyData(true);
      } else {
        alert(result.error || 'Failed to kick member');
      }
    } catch (err) {
      console.error('Error kicking member:', err);
      alert('Failed to kick member');
    }
  };

  const handleBanMember = async (targetUserId: string) => {
    if (!user || !familyData?.family?.id) return;

    const confirmed = window.confirm('Ban this member from the family? They will not be able to rejoin.');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.rpc('ban_family_member', {
        p_family_id: familyData.family.id,
        p_target_user_id: targetUserId,
        p_admin_user_id: user.id,
        p_reason: 'Banned by family owner'
      });

      if (error) {
        console.error('Error banning member:', error);
        alert('Failed to ban member. You may not have permission.');
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (result.success) {
        familyCache.delete(user.id);
        fetchFamilyData(true);
      } else {
        alert(result.error || 'Failed to ban member');
      }
    } catch (err) {
      console.error('Error banning member:', err);
      alert('Failed to ban member');
    }
  };

  // Handle promoting a member
  const handlePromoteMember = async (targetUserId: string, newRole: string) => {
    if (!user || !familyData?.family?.id) return;

    try {
      const { data, error } = await supabase.rpc('promote_family_member', {
        p_family_id: familyData.family.id,
        p_target_user_id: targetUserId,
        p_new_role: newRole,
        p_admin_user_id: user.id
      });

      if (error) {
        console.error('Error promoting member:', error);
        alert('Failed to promote member. You may not have permission.');
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (result.success) {
        // Refresh family data
        familyCache.delete(user.id);
        fetchFamilyData(true);
      } else {
        alert(result.error || 'Failed to promote member');
      }
    } catch (err) {
      console.error('Error promoting member:', err);
      alert('Failed to promote member');
    }
  };

  // Handle leaving the family
  const handleLeaveFamily = async () => {
    if (!user || !familyData?.family?.id) return;

    const confirmed = window.confirm(
      'Are you sure you want to leave the family? You will need to pay 10% of the family\'s total earnings to leave, which will be distributed to remaining members.'
    );
    
    if (!confirmed) return;

    setLeavingFamily(true);
    try {
      const { data, error } = await supabase.rpc('leave_family', {
        p_user_id: user.id,
        p_family_id: familyData.family.id
      });

      if (error) {
        console.error('Error leaving family:', error);
        alert('Failed to leave family. ' + error.message);
        return;
      }

      const result = data as { success: boolean; error?: string; exit_fee?: number };
      if (result.success) {
        alert(`Successfully left the family. You paid ${result.exit_fee?.toLocaleString() || 0} Troll Coins as exit fee.`);
        // Navigate away from family pages
        navigate('/family/browse');
      } else {
        alert(result.error || 'Failed to leave family');
      }
    } catch (err) {
      console.error('Error leaving family:', err);
      alert('Failed to leave family');
    } finally {
      setLeavingFamily(false);
      setShowSettingsModal(false);
    }
  };

  // Display loading skeleton
  if (loading) {
    return <FamilyHomeSkeleton />;
  }

  // User not in a family - show join/create prompt
  if (!familyData?.family) {
    return (
      <NotInFamilyPrompt 
        userCoins={userCoins} 
        onBrowse={() => navigate('/family/browse')}
        onCreate={() => navigate('/family/create')}
      />
    );
  }

  const { family, members, goals, achievements, vault, heartbeat, notifications, user_role } = familyData;
  const isLeader = user_role === 'leader' || user_role === 'co_leader';
  const displayMembers = showAllMembers ? members : members.slice(0, 10);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040107] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-fuchsia-700/20 blur-[150px]" />
        <div className="absolute -right-48 top-52 h-[38rem] w-[38rem] rounded-full bg-lime-400/10 blur-[170px]" />
        <div className="absolute bottom-[-18rem] left-[35%] h-[40rem] w-[40rem] rounded-full bg-violet-700/15 blur-[180px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1500px] px-4 pb-20 pt-5 sm:px-6 lg:px-8">
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/55 transition hover:border-fuchsia-400/30 hover:bg-fuchsia-500/10 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <FamilyHeader
          family={family}
          memberCount={heartbeat?.total_members || members.length}
          streak={heartbeat?.current_streak || 0}
          vaultCoins={vault?.total_coins || 0}
          onSettings={() => setShowSettingsModal(true)}
        />

        {heartbeat && <FamilyHeartbeatAlert heartbeat={heartbeat} />}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <TabNavigation
              activeTab={activeTab}
              onTabChange={setActiveTab}
              notificationCount={heartbeat?.unread_notifications || 0}
            />

            <div className="mt-5">
              {activeTab === 'home' && (
                <HomeTab
                  goals={goals}
                  notifications={notifications}
                  onViewAllGoals={() => setActiveTab('goals')}
                  onNotificationClick={(notif) => {
                    supabase.from('family_notifications').update({ is_read: true }).eq('id', notif.id).then();
                    if (notif.notification_type === 'member_join' || notif.notification_type === 'member_kick' || notif.notification_type === 'member_promote') {
                      navigate('/family/members');
                    } else if (notif.notification_type === 'goal_completed') {
                      navigate('/family/goals');
                    } else if (notif.notification_type === 'broadcast' || notif.notification_type === 'member_broadcast') {
                      navigate('/live');
                    }
                  }}
                />
              )}

              {activeTab === 'goals' && <GoalsTab goals={goals} isLeader={isLeader} />}
              {activeTab === 'achievements' && <AchievementsTab achievements={achievements} />}
              {activeTab === 'members' && (
                <MembersTab
                  members={displayMembers}
                  totalCount={heartbeat?.total_members || members.length}
                  showAll={showAllMembers}
                  onToggleShowAll={() => setShowAllMembers(!showAllMembers)}
                  isLeader={isLeader}
                  familyId={family.id}
                  onKick={handleKickMember}
                  onPromote={handlePromoteMember}
                  onBan={handleBanMember}
                  onModerated={() => {
                    if (user) familyCache.delete(user.id);
                    fetchFamilyData(true);
                  }}
                />
              )}
              {activeTab === 'vault' && <VaultTab vault={vault} familyLevel={family.level} />}
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
            <QuickActions
              isLeader={isLeader}
              onChat={() => navigate(`/family/chat/${family.id}`)}
               onBroadcast={() => handleStartBroadcast(family.id, user?.id || '', (user as any)?.display_name || 'A member')}
              onInvite={() => navigate('/family/invite')}
            />
            <LeaderboardPreview weeklyContribution={vault?.weekly_contribution || 0} />
            <FamilyStats
              legacyScore={family.legacy_score}
              reputation={family.reputation}
              xp={family.xp}
            />
          </aside>
        </div>
      </main>

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[26px] border border-white/10 bg-[#0a0710] shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Family Control</p>
                <h2 className="mt-1 text-xl font-black">Family Settings</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-red-500/10 p-2.5 text-red-400">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-red-300">Leave Family</h3>
                    <p className="mt-2 text-sm leading-6 text-white/48">
                      Leaving requires paying 10% of the family&apos;s total earnings. The fee is distributed among remaining members.
                    </p>
                    {familyData?.vault?.total_coins && (
                      <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/8 px-3 py-2 text-sm font-black text-amber-300">
                        Exit Fee: {Math.floor(familyData.vault.total_coins * 0.1).toLocaleString()} Troll Coins
                      </div>
                    )}
                    <button
                      onClick={handleLeaveFamily}
                      disabled={leavingFamily}
                      className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {leavingFamily ? 'Leaving...' : 'Leave Family'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MODULAR COMPONENTS
// =============================================================================

// Family Header Component
function FamilyHeader({
  family,
  memberCount,
  streak,
  vaultCoins,
  onSettings
}: {
  family: FamilyData;
  memberCount: number;
  streak: number;
  vaultCoins: number;
  onSettings?: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(31,8,43,0.96),rgba(7,5,13,0.96))] shadow-[0_30px_100px_rgba(0,0,0,0.48)]">
      <div
        className="relative min-h-[240px] bg-cover bg-center"
        style={{ backgroundImage: family.banner_url ? `url(${family.banner_url})` : undefined }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,1,7,0.94),rgba(4,1,7,0.55),rgba(4,1,7,0.82))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(217,70,239,0.24),transparent_34%),radial-gradient(circle_at_82%_30%,rgba(163,230,53,0.12),transparent_28%)]" />

        <div className="relative z-10 flex min-h-[240px] flex-col justify-between gap-8 p-5 sm:p-7 lg:flex-row lg:items-end lg:p-9">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border-4 border-[#09050d] bg-gradient-to-br from-fuchsia-600 to-violet-700 shadow-[0_0_45px_rgba(217,70,239,0.28)]">
              {family.crest_url ? (
                <img src={family.crest_url} alt={family.name} className="h-full w-full object-cover" />
              ) : (
                <Crown className="h-11 w-11 text-amber-300" />
              )}
            </div>

            <div className="min-w-0 pb-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">
                  Level {family.level || 1}
                </span>
                <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">
                  [{family.tag}]
                </span>
              </div>
              <h1 className="truncate text-3xl font-black tracking-[-0.03em] sm:text-4xl lg:text-5xl">{family.name}</h1>
              {family.slogan && <p className="mt-2 max-w-2xl text-sm italic text-white/50 sm:text-base">“{family.slogan}”</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <HeaderStat label="Members" value={memberCount} tone="text-white" />
            <HeaderStat label="Streak" value={streak} tone="text-lime-300" />
            <HeaderStat label="Vault" value={vaultCoins.toLocaleString()} tone="text-amber-300" />
          </div>

          {onSettings && (
            <button
              onClick={onSettings}
              className="absolute right-4 top-4 rounded-xl border border-white/10 bg-black/30 p-2.5 text-white/55 backdrop-blur-xl transition hover:border-fuchsia-400/30 hover:bg-fuchsia-500/10 hover:text-white"
              title="Family Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function HeaderStat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center backdrop-blur-xl">
      <p className={`truncate text-xl font-black sm:text-2xl ${tone}`}>{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
    </div>
  );
}

// Family Heartbeat Alert
function FamilyHeartbeatAlert({ heartbeat }: { heartbeat: FamilyHeartbeat }) {
  const styles = {
    thriving: {
      wrap: 'border-lime-400/20 bg-lime-400/8',
      icon: 'text-lime-300',
      badge: 'bg-lime-400/10 text-lime-300 border-lime-400/20'
    },
    stable: {
      wrap: 'border-amber-400/20 bg-amber-400/8',
      icon: 'text-amber-300',
      badge: 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    },
    struggling: {
      wrap: 'border-red-400/20 bg-red-400/8',
      icon: 'text-red-300',
      badge: 'bg-red-400/10 text-red-300 border-red-400/20'
    },
    unknown: {
      wrap: 'border-white/10 bg-white/[0.035]',
      icon: 'text-white/45',
      badge: 'bg-white/[0.05] text-white/50 border-white/10'
    }
  };

  const theme = styles[heartbeat.health as keyof typeof styles] || styles.unknown;

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${theme.wrap}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border border-white/10 bg-black/20 p-2.5 ${theme.icon}`}>
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black">Family Heartbeat</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${theme.badge}`}>
                {heartbeat.health}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/45">
              {heartbeat.active_members}/{heartbeat.total_members} active members · {heartbeat.goals_completed}/{heartbeat.goals_active} goals complete
            </p>
          </div>
        </div>

        {heartbeat.at_risk_members > 0 && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/8 px-3 py-2 text-xs font-bold text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {heartbeat.at_risk_members} need support
          </div>
        )}
      </div>
    </div>
  );
}

// Tab Navigation
function TabNavigation({
  activeTab,
  onTabChange,
  notificationCount
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  notificationCount: number;
}) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Heart },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'vault', label: 'Vault', icon: Gift },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      <div className="flex min-w-max gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className={`relative inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition ${
                active
                  ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-[0_10px_30px_rgba(168,85,247,0.25)]'
                  : 'text-white/45 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'home' && notificationCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                  {notificationCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Home Tab Content
function HomeTab({ 
  goals, 
  notifications, 
  onViewAllGoals,
  onNotificationClick 
}: { 
  goals: FamilyGoal[];
  notifications: FamilyNotification[];
  onViewAllGoals: () => void;
  onNotificationClick?: (notification: FamilyNotification) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Active Goals Preview */}
      <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Active Goals
          </h2>
          <button 
            onClick={onViewAllGoals}
            className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {goals.slice(0, 3).map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
          {goals.length === 0 && (
            <div className="text-center py-4">
              <Target className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400">Start your first mission!</p>
              <p className="text-gray-500 text-sm mt-1">Check back soon for new goals</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Family Activity
          </h2>
        </div>
        <div className="space-y-3">
          {notifications.slice(0, 3).map(notif => (
            <NotificationItem 
                key={notif.id} 
                notification={notif}
                onClick={() => onNotificationClick?.(notif)}
              />
          ))}
          {notifications.length === 0 && (
            <div className="text-center py-4">
              <Activity className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400">Go live or complete goals to generate activity</p>
              <p className="text-gray-500 text-sm mt-1">Start a broadcast to notify your family!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Goals Tab
function GoalsTab({ goals, isLeader }: { goals: FamilyGoal[]; isLeader: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Family Goals</h2>
        {isLeader && (
          <button className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" />
            Add Goal
          </button>
        )}
      </div>
      {goals.map(goal => (
        <GoalCard key={goal.id} goal={goal} expanded />
      ))}
      {goals.length === 0 && (
        <EmptyState 
          icon={Target}
          title="No active goals"
          description="New goals will appear soon!"
        />
      )}
    </div>
  );
}

// Achievements Tab
function AchievementsTab({ achievements }: { achievements: FamilyAchievement[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Family Achievements</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {achievements.map(achievement => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
      {achievements.length === 0 && (
        <EmptyState 
          icon={Trophy}
          title="No achievements yet"
          description="Complete goals to unlock achievements!"
        />
      )}
    </div>
  );
}

// Members Tab
function MembersTab({ 
  members, 
  totalCount, 
  showAll, 
  onToggleShowAll,
  isLeader,
  familyId,
  onKick,
  onPromote,
  onBan,
  onModerated
}: { 
  members: FamilyMember[];
  totalCount: number;
  showAll: boolean;
  onToggleShowAll: () => void;
  isLeader: boolean;
  familyId: string;
  onKick?: (userId: string) => void;
  onPromote?: (userId: string, newRole: string) => void;
  onBan?: (userId: string) => void;
  onModerated?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          Family Members ({totalCount})
        </h2>
        {totalCount > 10 && (
          <button 
            onClick={onToggleShowAll}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            <Eye className="w-4 h-4" />
            {showAll ? 'Show Less' : `View All (${totalCount})`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {members.map(member => (
          <MemberCard 
            key={member.id} 
            member={member} 
            isLeader={isLeader}
            familyId={familyId}
            onKick={onKick}
            onPromote={onPromote}
            onBan={onBan}
            onModerated={onModerated}
          />
        ))}
      </div>
    </div>
  );
}

// Vault Tab
function VaultTab({ vault, familyLevel }: { vault: FamilyVault | null | undefined; familyLevel: number }) {
  if (!vault) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-white/10 p-6 text-center">
        <p className="text-gray-400">Vault data unavailable</p>
      </div>
    );
  }

  const weeklyCap = 500;
  const weeklyProgress = (vault.weekly_contribution / weeklyCap) * 100;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-xl border border-amber-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-8 h-8 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Family Vault</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total Vault" value={vault.total_coins.toLocaleString()} color="text-yellow-400" />
          <StatCard label="This Week" value={`+${vault.weekly_contribution.toLocaleString()}`} color="text-green-400" />
          <StatCard label="Streak Bonus" value={vault.streak_bonus.toLocaleString()} color="text-orange-400" />
          <StatCard label="Family Level" value={familyLevel.toString()} color="text-purple-400" />
        </div>
      </div>

      <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <h3 className="text-white font-semibold mb-3">Weekly Reward Cap</h3>
        <p className="text-gray-400 text-sm mb-4">
          Families can earn up to {weeklyCap.toLocaleString()} Troll Coins per week from goals and achievements.
        </p>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
            style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
          />
        </div>
        <p className="text-right text-sm text-gray-400 mt-1">
          {vault.weekly_contribution.toLocaleString()} / {weeklyCap.toLocaleString()} weekly cap
        </p>
      </div>
    </div>
  );
}

// Quick Actions Sidebar
function QuickActions({ 
  isLeader, 
  onChat, 
  onBroadcast, 
  onInvite 
}: { 
  isLeader: boolean;
  onChat: () => void;
  onBroadcast: () => void;
  onInvite: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <h3 className="text-white font-semibold mb-3">Quick Actions</h3>
      <div className="space-y-2">
        <ActionButton icon={MessageSquare} label="Family Chat" color="text-purple-400" onClick={onChat} />
        <ActionButton icon={Video} label="Start Broadcast" color="text-pink-400" onClick={onBroadcast} />
        {isLeader && (
          <ActionButton icon={Users} label="Invite Member" color="text-blue-400" onClick={onInvite} />
        )}
      </div>
    </div>
  );
}

// Leaderboard Preview
function LeaderboardPreview({ weeklyContribution }: { weeklyContribution: number }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-green-400" />
        Weekly Competition
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded bg-slate-700/30">
          <span className="text-gray-400">Your Position</span>
          <span className="text-white font-semibold">#--</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-slate-700/30">
          <span className="text-gray-400">Points This Week</span>
          <span className="text-yellow-400 font-semibold">{weeklyContribution.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// Family Stats
function FamilyStats({ legacyScore, reputation, xp }: { legacyScore: number; reputation: number; xp: number }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <h3 className="text-white font-semibold mb-3">Family Stats</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Legacy Score</span>
          <span className="text-white">{legacyScore.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Reputation</span>
          <span className="text-purple-400">{reputation.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Family XP</span>
          <span className="text-blue-400">{xp.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SHARED UI COMPONENTS
// =============================================================================

// Goal Card
function GoalCard({ goal, expanded = false }: { goal: FamilyGoal; expanded?: boolean }) {
  const progress = Math.min((goal.current_value / goal.target_value) * 100, 100);
  const timeLeft = new Date(goal.expires_at).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
  
  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    hard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    elite: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-fuchsia-400/25 hover:bg-fuchsia-500/[0.04]">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-white font-medium">{goal.title}</h4>
          {expanded && goal.description && (
            <p className="text-gray-400 text-sm mt-1">{goal.description}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded border ${difficultyColors[goal.difficulty] || 'bg-gray-500/20 text-gray-400'} capitalize`}>
          {goal.difficulty}
        </span>
      </div>
      
      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{goal.current_value.toLocaleString()} / {goal.target_value.toLocaleString()}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          {hoursLeft > 24 ? `${Math.floor(hoursLeft / 24)}d left` : `${hoursLeft}h left`}
        </div>
        <div className="flex items-center gap-1 text-yellow-400 text-sm font-semibold">
          <Sparkles className="w-3 h-3" />
          {goal.reward_coins.toLocaleString()} TC
        </div>
      </div>
    </div>
  );
}

// Achievement Card
function AchievementCard({ achievement }: { achievement: FamilyAchievement }) {
  const rarityGradients: Record<string, string> = {
    common: 'from-gray-500 to-slate-600',
    uncommon: 'from-green-500 to-emerald-600',
    rare: 'from-blue-500 to-cyan-600',
    epic: 'from-purple-500 to-violet-600',
    legendary: 'from-amber-500 to-orange-600',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-amber-400/25 hover:bg-amber-500/[0.04]">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${rarityGradients[achievement.rarity] || rarityGradients.common} flex items-center justify-center flex-shrink-0`}>
          {achievement.icon ? (
            <span className="text-2xl">{achievement.icon}</span>
          ) : (
            <Trophy className="w-6 h-6 text-white" />
          )}
        </div>
        <div>
          <h4 className="text-white font-medium">{achievement.title}</h4>
          {achievement.description && (
            <p className="text-gray-400 text-sm mt-1">{achievement.description}</p>
          )}
          {achievement.unlocked_at && (
            <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Unlocked
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Member Card
function MemberCard({ member, isLeader, familyId, onKick, onPromote, onBan, onModerated }: { 
  member: FamilyMember; 
  isLeader: boolean;
  familyId: string;
  onKick?: (userId: string) => void;
  onPromote?: (userId: string, newRole: string) => void;
  onBan?: (userId: string) => void;
  onModerated?: () => void;
}) {
  const roleColors: Record<string, string> = {
    leader: 'text-amber-400',
    co_leader: 'text-orange-400',
    scout: 'text-blue-400',
    recruiter: 'text-green-400',
    mentor: 'text-purple-400',
    member: 'text-gray-400',
  };

  const [showMenu, setShowMenu] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showModModal, setShowModModal] = useState(false);

  const handleApprove = async () => {
    if (!isLeader) return;
    setIsApproving(true);
    try {
      const { data: updatedMember, error } = await supabase
        .from('family_members')
        .update({ approval_status: 'approved' })
        .eq('id', member.id)
        .single();
      if (error) throw error;
      if (!updatedMember) throw new Error('Failed to update member approval');
      // Trigger refresh via the parent component
    } catch (err) {
      console.error('Failed to approve member:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeny = async () => {
    if (!isLeader) return;
    setIsApproving(true);
    try {
      const { data: updatedMember, error } = await supabase
        .from('family_members')
        .update({ approval_status: 'denied' })
        .eq('id', member.id)
        .single();
      if (error) throw error;
      if (!updatedMember) throw new Error('Failed to update member approval');
      // Trigger refresh via the parent component
    } catch (err) {
      console.error('Failed to deny member:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const isPending = member.approval_status === 'pending';
  const isDenied = member.approval_status === 'denied';

  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${
      isDenied ? 'bg-red-900/20 border-red-500/30' : isPending ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-700/30 border-white/5'
    }`}>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <Users className="w-5 h-5 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">
          {member.display_name || member.username || 'Unknown'}
        </p>
        <div className="flex items-center gap-2">
          <p className={`text-sm capitalize ${roleColors[member.role] || 'text-gray-400'}`}>
            {member.role?.replace('_', ' ')}
          </p>
          {isPending && (
            <span className="text-xs px-2 py-1 rounded bg-amber-500/30 text-amber-400 border border-amber-500/50">
              Pending Approval
            </span>
          )}
          {isDenied && (
            <span className="text-xs px-2 py-1 rounded bg-red-500/30 text-red-400 border border-red-500/50">
              Denied
            </span>
          )}
        </div>
      </div>
      {isLeader && isPending && (
        <div className="flex items-center gap-2">
          <button 
            onClick={handleApprove}
            disabled={isApproving}
            className="p-2 hover:bg-green-600/50 rounded-lg transition-colors text-green-400 hover:text-green-300 disabled:opacity-50"
            title="Approve"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button 
            onClick={handleDeny}
            disabled={isApproving}
            className="p-2 hover:bg-red-600/50 rounded-lg transition-colors text-red-400 hover:text-red-300 disabled:opacity-50"
            title="Deny"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {isLeader && !isPending && member.role !== 'leader' && (
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <Shield className="w-4 h-4 text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-white/10 rounded-lg overflow-hidden z-10 min-w-[140px]">
              <button
                onClick={() => {
                  onPromote?.(member.user_id, 'co_leader');
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 text-orange-400 flex items-center gap-2"
              >
                <Crown className="w-3 h-3" />
                Promote to Co-Leader
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowModModal(true);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 text-cyan-400 flex items-center gap-2"
              >
                <Shield className="w-3 h-3" />
                Moderate…
              </button>
              <button
                onClick={() => {
                  onKick?.(member.user_id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 text-red-400 flex items-center gap-2"
              >
                <Shield className="w-3 h-3" />
                Remove from Family
              </button>
              <button
                onClick={() => {
                  onBan?.(member.user_id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 text-red-500 flex items-center gap-2"
              >
                <Shield className="w-3 h-3" />
                Ban from Family
              </button>
            </div>
          )}
        </div>
      )}
      {showModModal && (
        <OrgModerationModal
          open={showModModal}
          onClose={() => setShowModModal(false)}
          orgType="family"
          orgId={familyId}
          targetUserId={member.user_id}
          targetName={member.username || member.display_name || undefined}
          onActionComplete={onModerated}
        />
      )}
    </div>
  );
}

// Notification Item
function NotificationItem({ notification, onClick }: { notification: FamilyNotification; onClick?: () => void }) {
  const severityStyles: Record<string, string> = {
    urgent: 'bg-red-500/10 border-red-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    info: 'bg-slate-700/30 border-white/5',
    success: 'bg-green-500/10 border-green-500/30',
  };

  return (
    <div 
      onClick={onClick}
      className={`p-3 rounded-lg border ${severityStyles[notification.severity] || severityStyles.info} ${onClick ? 'cursor-pointer hover:scale-[1.01] transition-transform' : ''}`}
    >
      <p className="text-white font-medium">{notification.title}</p>
      <p className="text-gray-400 text-sm">{notification.message}</p>
    </div>
  );
}

// Action Button
function ActionButton({ 
  icon: Icon, 
  label, 
  color, 
  onClick 
}: { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  onClick: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.045] hover:bg-white/[0.08] text-gray-300 hover:text-white transition-colors"
    >
      <Icon className={`w-4 h-4 ${color}`} />
      {label}
    </button>
  );
}

// Stat Card
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// Empty State
function EmptyState({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-white/10 p-8 text-center">
      <Icon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
      <p className="text-gray-400">{title}</p>
      <p className="text-gray-500 text-sm">{description}</p>
    </div>
  );
}

// Not In Family Prompt
function NotInFamilyPrompt({ 
  userCoins, 
  onBrowse, 
  onCreate 
}: { 
  userCoins: number; 
  onBrowse: () => void; 
  onCreate: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg mb-4">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Troll Families</h1>
          <p className="text-gray-400">Your home away from home in Mai Troll</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 border border-white/10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Join a Family or Create Your Own</h2>
            <p className="text-gray-400">
              Families are your tribe in Mai Troll. Join an existing family or create your own legacy.
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-amber-400 font-semibold">Family Creation Cost: 1,000 Troll Coins</p>
                <p className="text-gray-400 text-sm">Creating a family is a significant commitment - make it count!</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Your Balance:</span>
              <span className="text-2xl font-bold text-yellow-400">{userCoins.toLocaleString()} TC</span>
            </div>
            {userCoins < 1000 && (
              <p className="text-red-400 text-sm mt-2">
                You need 1,000 Troll Coins to create a family. Keep earning to start your own!
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={onBrowse}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-4 px-6 rounded-xl transition-all"
            >
              <Users className="w-5 h-5" />
              Browse Families
            </button>
            <button
              onClick={onCreate}
              disabled={userCoins < 1000}
              className={`flex items-center justify-center gap-2 font-semibold py-4 px-6 rounded-xl transition-all ${
                userCoins >= 1000
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white'
                  : 'bg-slate-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Plus className="w-5 h-5" />
              Create Family
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
            <Target className="w-8 h-8 text-purple-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Family Goals</h3>
            <p className="text-gray-400 text-sm">Work together on daily, weekly, and monthly goals</p>
          </div>
          <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
            <Trophy className="w-8 h-8 text-amber-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Achievements</h3>
            <p className="text-gray-400 text-sm">Unlock rare achievements and earn rewards</p>
          </div>
          <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
            <Heart className="w-8 h-8 text-pink-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Family Heartbeat</h3>
            <p className="text-gray-400 text-sm">Stay connected with your family's pulse</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function FamilyHomeSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur rounded-2xl border border-white/10 overflow-hidden mb-6">
          <div className="h-32 md:h-48 bg-slate-800 animate-pulse" />
          <div className="px-6 pb-6 -mt-16 relative">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="w-24 h-24 bg-slate-700 rounded-xl animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-8 bg-slate-700 rounded w-1/3 animate-pulse" />
                <div className="h-4 bg-slate-700 rounded w-1/4 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Heartbeat Skeleton */}
        <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-slate-700 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-700 rounded w-24 animate-pulse" />
              <div className="h-3 bg-slate-700 rounded w-48 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-20 bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
                <div className="h-6 bg-slate-700 rounded w-32 mb-4 animate-pulse" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
                <div className="h-5 bg-slate-700 rounded w-24 mb-3 animate-pulse" />
                <div className="space-y-2">
                  {[...Array(2)].map((_, j) => (
                    <div key={j} className="h-10 bg-slate-700/50 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}