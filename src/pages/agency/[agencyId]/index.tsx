import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { isUuid } from '../../../lib/validators';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { Loader } from '../../../components/ui/loader';
import { Badge } from '../../../components/ui/badge';

type Agency = {
  id: string;
  owner_id: string;
  name: string;
  slug?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  status: string;
  default_split_percent?: number | null;
  created_at?: string;
};

type AgencyMember = {
  id?: string;
  agency_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'recruiter' | 'creator' | 'agency_leader' | string;
  status: string;
  user_profiles?: {
    username?: string | null;
    avatar_url?: string | null;
    rgb_username_expires_at?: string | null;
  } | null;
};

type AgencyGoal = {
  id: string;
  agency_id: string;
  title: string;
  description?: string | null;
  status: string;
  target_value: number;
  progress_value?: number | null;
  created_at?: string;
};

type AgencyStats = {
  liveHours: number;
  giftEarnings: number;
  battleCount: number;
  creatorCount: number;
};

const getGoalPercent = (goal: AgencyGoal) => {
  const target = Number(goal.target_value || 0);
  const progress = Number(goal.progress_value || 0);

  if (!target || target <= 0) return 0;

  return Math.min((progress / target) * 100, 100);
};

export default function AgencyProfilePage() {
  const { agencyIdOrSlug } = useParams<{ agencyIdOrSlug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [agency, setAgency] = useState<Agency | null>(null);
  const [ownerUsername, setOwnerUsername] = useState<string>('Unknown');
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [topCreators, setTopCreators] = useState<AgencyMember[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<AgencyStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<AgencyStats | null>(null);
  const [goals, setGoals] = useState<AgencyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'creator' | 'agency_leader' | null>(null);

  async function resolveAgencyId(ref: string): Promise<Agency | null> {
    if (!ref) return null

    if (isUuid(ref)) {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', ref)
        .eq('status', 'approved')
        .maybeSingle()

      if (error) throw error
      return data
    }

    const { data: slugData, error: slugError } = await supabase
      .from('agencies')
      .select('*')
      .eq('slug', ref)
      .eq('status', 'approved')
      .maybeSingle()
    if (slugError) throw slugError
    if (slugData) return slugData

    const { data: publicSlugData, error: publicSlugError } = await supabase
      .from('agencies')
      .select('*')
      .eq('public_slug', ref)
      .eq('status', 'approved')
      .maybeSingle()
    if (publicSlugData) return publicSlugData
    if (publicSlugError) throw publicSlugError

    const { data: codeData, error: codeError } = await supabase
      .from('agencies')
      .select('*')
      .eq('agency_code', ref)
      .eq('status', 'approved')
      .maybeSingle()
    if (codeError) throw codeError
    if (codeData) return codeData

    const { data: publicIdData, error: publicIdError } = await supabase
      .from('agencies')
      .select('*')
      .eq('public_id', ref)
      .eq('status', 'approved')
      .maybeSingle()
    if (publicIdError) throw publicIdError
    return publicIdData
  }

    const activeSection = useMemo(() => {
     if (!isMember) return 'overview';
     if (location.pathname.includes('/roster')) return 'roster';
     if (location.pathname.includes('/goals')) return 'goals';
     return 'overview';
   }, [location.pathname, isMember]);

  useEffect(() => {
    void fetchAgencyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyIdOrSlug, user?.id]);

   const fetchAgencyData = async () => {
     if (!agencyIdOrSlug) {
       setError('Missing agency id or slug.');
       setLoading(false);
       return;
     }

     try {
       setLoading(true);
       setError(null);
       setIsMember(false);
       setUserRole(null);
       setAgency(null) // Reset agency data

       // Resolve the agency reference to an agency record
       const agencyData = await resolveAgencyId(agencyIdOrSlug)
       if (!agencyData) {
         setError('Agency not found or not approved yet.')
         setLoading(false)
         return
       }

       setAgency(agencyData as Agency)

       const { data: ownerData, error: ownerError } = await supabase
         .from('user_profiles')
         .select('username')
         .eq('id', agencyData.owner_id)
         .maybeSingle()

       if (!ownerError && ownerData?.username) {
         setOwnerUsername(ownerData.username)
       } else {
         setOwnerUsername('Unknown')
       }

       const { data: membersData, error: membersError } = await supabase
         .from('agency_members')
         .select(
           `
           *,
           user_profiles:user_id (
             username,
             avatar_url,
             rgb_username_expires_at
           )
         `,
         )
         .eq('agency_id', agencyData.id) // Use the resolved agency UUID
         .eq('status', 'active')

       if (membersError) throw membersError

       const typedMembers = (membersData || []) as AgencyMember[]
       setMembers(typedMembers)

       if (user) {
         const currentMember = typedMembers.find((member) => member.user_id === user.id)

         if (currentMember) {
           setIsMember(true)

           if (
             currentMember.role === 'owner' ||
             currentMember.role === 'manager' ||
             currentMember.role === 'creator' ||
             currentMember.role === 'agency_leader'
           ) {
             setUserRole(currentMember.role)
           }
         }
       }

       const creators = typedMembers.filter((member) => member.role === 'creator')

       setTopCreators(creators.slice(0, 3))

       setWeeklyStats({
         liveHours: 0,
         giftEarnings: 0,
         battleCount: 0,
         creatorCount: creators.length,
       })

       setMonthlyStats({
         liveHours: 0,
         giftEarnings: 0,
         battleCount: 0,
         creatorCount: creators.length,
       })

       const { data: goalsData, error: goalsError } = await supabase
         .from('agency_goals')
         .select('*')
         .eq('agency_id', agencyData.id) // Use the resolved agency UUID
         .in('status', ['active', 'completed'])
         .order('created_at', { ascending: false })

       if (!goalsError && goalsData) {
         setGoals(goalsData as AgencyGoal[])
       } else {
         setGoals([])
       }
     } catch (err: any) {
       console.error('Error loading agency profile:', err)
       setError(err?.message || 'Failed to load agency profile.')
     } finally {
       setLoading(false)
     }
   };

  const canManageAgency = ['owner', 'manager', 'agency_leader'].includes(userRole || '')

  const handleJoin = () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    navigate(`/agency-apply/${agencyIdOrSlug}`);
  };

  const handleManageMembership = () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (canManageAgency) {
      navigate('/agency-dashboard');
      return;
    }

    navigate(`/agency/${agencyIdOrSlug}`);
  };

  if (loading) return <Loader />;

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-4 py-8 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-4 py-8 text-center text-white">
        Loading agency...
      </div>
    );
  }

  const creatorCount = members.filter((member) => member.role === 'creator').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black py-8 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-900/70 shadow-[0_0_40px_rgba(34,211,238,0.10)] backdrop-blur-xl">
          {agency.banner_url ? (
            <div
              className="h-48 bg-cover bg-center"
              style={{ backgroundImage: `url(${agency.banner_url})` }}
            />
          ) : (
            <div className="h-48 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_35%),linear-gradient(135deg,rgba(15,23,42,1),rgba(88,28,135,0.45),rgba(15,23,42,1))]" />
          )}

          <div className="p-6">
            <div className="mb-4 flex items-center gap-4">
              {agency.logo_url ? (
                <img
                  src={agency.logo_url}
                  alt={`${agency.name} logo`}
                  className="h-16 w-16 rounded-full border-2 border-cyan-500/40 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-500/40 bg-slate-800">
                  <span className="text-2xl font-black text-cyan-300">
                    {agency.name.charAt(0)}
                  </span>
                </div>
              )}

              <div>
                <h2 className="text-2xl font-black text-white">{agency.name}</h2>
                <p className="text-sm text-slate-400">
                  Owner: <span className="text-cyan-300">@{ownerUsername}</span>
                </p>
              </div>
            </div>

            {agency.bio && <p className="mb-4 max-w-4xl text-slate-300">{agency.bio}</p>}

            <div className="mb-4 flex flex-wrap gap-4">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                👥 {creatorCount} Creators
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                ⏰ {weeklyStats?.liveHours ?? 0} hrs/wk
              </Badge>
              <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                🎁 {(weeklyStats?.giftEarnings ?? 0).toLocaleString()} coins/wk
              </Badge>
              <Badge variant="outline" className="border-pink-500/30 text-pink-300">
                ⚔️ {weeklyStats?.battleCount ?? 0} battles/wk
              </Badge>
            </div>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Agency Rank:</span>
                <span className="text-sm font-bold text-cyan-300">Coming soon</span>
              </div>

              {!user ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700/70"
                  onClick={() => navigate('/auth')}
                >
                  Log In to Apply
                </Button>
              ) : isMember ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-cyan-500/30 bg-transparent text-cyan-200 hover:bg-cyan-500/10"
                  onClick={handleManageMembership}
                >
                  {canManageAgency ? 'Manage Membership' : 'View Agency'}
                </Button>
              ) : (
                <Button type="button" variant="primary" onClick={handleJoin}>
                  Apply to Join
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
           <div className="mb-4 flex flex-wrap border-b border-slate-700/50">
             <button
               type="button"
               className={`px-4 py-2 text-sm font-bold ${
                 activeSection === 'overview'
                   ? 'border-b-2 border-cyan-500 text-cyan-300'
                   : 'text-slate-400 hover:text-white'
               }`}
               onClick={() => navigate(`/agency/${agencyIdOrSlug}`)}
             >
               Overview
             </button>

             {isMember && (
               <>
                 <button
                   type="button"
                   className={`px-4 py-2 text-sm font-bold ${
                     activeSection === 'roster'
                       ? 'border-b-2 border-cyan-500 text-cyan-300'
                       : 'text-slate-400 hover:text-white'
                   }`}
                   onClick={() => navigate(`/agency/${agencyIdOrSlug}/roster`)}
                 >
                   Roster
                 </button>

                 <button
                   type="button"
                   className={`px-4 py-2 text-sm font-bold ${
                     activeSection === 'goals'
                       ? 'border-b-2 border-cyan-500 text-cyan-300'
                       : 'text-slate-400 hover:text-white'
                   }`}
                   onClick={() => navigate(`/agency/${agencyIdOrSlug}/goals`)}
                 >
                   Goals
                 </button>
               </>
             )}
           </div>
        </div>

        {activeSection === 'roster' && (
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-bold text-cyan-300">Agency Roster</h3>

            {members.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                  <Link
                    key={member.user_id}
                     to={`/profile/${member.user_profiles?.username}`}
                    className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4 transition hover:border-cyan-400/40"
                  >
                    <div className="flex items-center gap-3">
                      {member.user_profiles?.avatar_url ? (
                        <img
                          src={member.user_profiles.avatar_url}
                          alt={`${member.user_profiles?.username || 'Member'} avatar`}
                          className="h-10 w-10 rounded-full border-2 border-cyan-500/30 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-slate-800">
                          <span className="font-bold text-cyan-300">
                            {member.user_profiles?.username?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}

                      <div>
                        <h4 className="font-bold text-white">
                          {member.user_profiles?.username || 'Unknown Member'}
                        </h4>
                        <p className="text-xs uppercase tracking-wide text-slate-400">{member.role}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-slate-400">No agency members yet.</p>
            )}
          </div>
        )}

        {activeSection === 'goals' && (
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-bold text-cyan-300">Current Goals</h3>

            {goals.length > 0 ? (
              <div className="space-y-3">
                {goals.map((goal) => {
                  const percent = getGoalPercent(goal);

                  return (
                    <div
                      key={goal.id}
                      className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <h4 className="font-bold text-white">{goal.title}</h4>

                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            goal.status === 'active'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : goal.status === 'completed'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-slate-500/20 text-slate-300'
                          }`}
                        >
                          {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                        </span>
                      </div>

                      {goal.description && (
                        <p className="mb-2 line-clamp-2 text-slate-300">{goal.description}</p>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <span className="text-xs text-slate-500">Target: </span>
                          <span className="text-xs font-bold text-cyan-300">
                            {goal.target_value}
                          </span>
                        </div>

                        <div className="w-20 text-right">
                          <span className="text-xs font-bold text-cyan-300">
                            {percent.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 h-1.5 w-full rounded bg-slate-700/50">
                        <div
                          className="h-1.5 rounded bg-cyan-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-slate-400">No active goals.</p>
            )}
          </div>
        )}

        {activeSection === 'overview' && (
          <>
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-bold text-cyan-300">Top Creators</h3>

              {topCreators.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {topCreators.map((creator) => (
                    <Link
                      key={creator.user_id}
                       to={`/profile/${creator.user_profiles?.username}`}
                      className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4 transition hover:border-cyan-400/40"
                    >
                      <div className="flex items-center gap-3">
                        {creator.user_profiles?.avatar_url ? (
                          <img
                            src={creator.user_profiles.avatar_url}
                            alt={`${creator.user_profiles?.username || 'Creator'} avatar`}
                            className="h-10 w-10 rounded-full border-2 border-cyan-500/30 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-slate-800">
                            <span className="font-bold text-cyan-300">
                              {creator.user_profiles?.username?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}

                        <div>
                          <h4 className="text-lg font-bold text-white">
                            {creator.user_profiles?.username || 'Unknown Creator'}
                          </h4>
                          <p className="text-sm text-slate-400">Top Performer</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-slate-400">No creators yet.</p>
              )}
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-lg font-bold text-cyan-300">Weekly Stats</h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-cyan-300">⏰</span>
                    <span className="text-sm text-slate-400">Live Hours</span>
                  </div>
                  <p className="text-2xl font-black text-white">{weeklyStats?.liveHours ?? 0}</p>
                  <p className="text-xs text-slate-500">This week</p>
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-purple-300">🎁</span>
                    <span className="text-sm text-slate-400">Gift Earnings</span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {(weeklyStats?.giftEarnings ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">This week</p>
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-pink-300">⚔️</span>
                    <span className="text-sm text-slate-400">Battles</span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {weeklyStats?.battleCount ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">This week</p>
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-blue-300">👥</span>
                    <span className="text-sm text-slate-400">Creators</span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {weeklyStats?.creatorCount ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">Active creators</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-lg font-bold text-cyan-300">Monthly Stats</h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Monthly Live Hours</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {monthlyStats?.liveHours ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Monthly Gift Earnings</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {(monthlyStats?.giftEarnings ?? 0).toLocaleString()}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Monthly Battles</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {monthlyStats?.battleCount ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Monthly Creators</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {monthlyStats?.creatorCount ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}