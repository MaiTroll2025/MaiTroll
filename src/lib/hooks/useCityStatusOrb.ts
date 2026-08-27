import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import {
  getSubTierFromScore,
  getSubTierProgress,
  getNextSubTier,
  getScoreForNextSubTier,
  getLeagueLevel,
  getNextLeagueLevel,
  getLeagueLevelProgress,
  getSubTierColor,
  TLeagueTier,
} from '../../config/T_LEAGUE_CONFIG';

export interface CityStatusOrbData {
  // User profile data
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  next_level_xp: number | null;
  hype_coins: number;
  blockers: number;
  license_plate: string | null;
  license_status: string | null;
  drivers_license_expiry: string | null;
  homeowners_insurance_expiry: string | null;
  car_insurance_expiry: string | null;
  house_id: string | null;
  vehicle_id: string | null;
  role: string | null;
  is_admin: boolean | null;
  is_troll_officer: boolean | null;

  // T League data
  league_tier: string;
  league_sub_tier: string;
  league_score: number;
  gift_coins_received: number;
  total_live_minutes: number;
  season_key: string;
  league_level: number;
  total_gifts_sent: number;

  // Computed
  tLeagueTier: TLeagueTier;
  leagueProgress: number;
  nextTier?: TLeagueTier | null;
  coinsToNextLeague?: number;
  subTierColor: string;
  activeMissions?: Array<{ id: string; title: string; progress: number; goal: number; reward: number }>;
  recentlyRaided: boolean;
}

export interface CityStatusOrbOptions {
  userId: string;
  /** If provided, broadcaster context for role-based actions */
  broadcasterId?: string;
  /** If provided, whether the viewer is in a seat */
  isSeatHolder?: boolean;
  /** If provided, whether the current user is a broadcaster */
  isBroadcaster?: boolean;
  /** If provided, whether the current user is a BroadOfficer */
  isBroadOfficer?: boolean;
}

export function useCityStatusOrb(options: CityStatusOrbOptions) {
  const { user, profile } = useAuthStore();
  const [data, setData] = useState<CityStatusOrbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!options.userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch user stats (authoritative XP/level)
      const { data: statsData } = await supabase
        .from('user_stats')
        .select('xp_total, level, xp_to_next_level')
        .eq('user_id', options.userId)
        .maybeSingle();

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          username,
          display_name,
          avatar_url,
          hype_coins,
          blockers,
          license_plate,
          license_status,
          drivers_license_expiry,
          homeowners_insurance_expiry,
          car_insurance_expiry,
          house_id,
          vehicle_id,
          role,
          is_admin,
          is_troll_officer
        `)
        .eq('id', options.userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Use user_stats as authoritative source for level/XP
      const authoritativeLevel = statsData?.level ?? (profileData as any)?.level ?? 1;
      const authoritativeXp = statsData?.xp_total ?? (profileData as any)?.xp ?? 0;
      const authoritativeNextXp = statsData?.xp_to_next_level ?? (profileData as any)?.next_level_xp ?? null;

      // Check for recent raids on this user's house or broadcast
      let recentlyRaided = false;
      if (profileData?.house_id) {
        const { data: recentHouseRaid } = await supabase
          .from('house_raids')
          .select('id')
          .eq('house_id', profileData.house_id)
          .gte('raided_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        recentlyRaided = !!recentHouseRaid;
      }

      if (!recentlyRaided && options.isBroadcaster) {
        const { data: recentBroadcastRaid } = await supabase
          .from('broadcast_raids')
          .select('id')
          .eq('broadcaster_id', options.userId)
          .eq('repaired', false)
          .gte('raided_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        recentlyRaided = !!recentBroadcastRaid;
      }

      // Fetch broadcast league stats (current season)
      const seasonKey = new Date().toISOString().slice(0, 7); // YYYY-MM
      const { data: leagueData } = await supabase
        .from('broadcast_league_stats')
        .select('league_tier, sub_tier, league_score, gift_coins_received, total_live_minutes, season_key, league_level, total_gifts_sent, total_xp')
        .eq('broadcaster_id', options.userId)
        .eq('season_key', seasonKey)
        .maybeSingle();

      const leagueScore = leagueData
        ? Number(leagueData.total_xp) || 0
        : 0;

      const subInfo = getSubTierFromScore(leagueScore);
      const tLeagueTier = subInfo.tier;
      const leagueLevelInfo = getLeagueLevel(Number(leagueData?.total_gifts_sent) || 0);

      const orbData: CityStatusOrbData = {
        id: profileData?.id || options.userId,
        username: profileData?.username || 'Unknown',
        display_name: profileData?.display_name || null,
        avatar_url: profileData?.avatar_url || null,
        level: authoritativeLevel,
        xp: authoritativeXp,
        next_level_xp: authoritativeNextXp,
        hype_coins: profileData?.hype_coins || 0,
        blockers: profileData?.blockers || 0,
        license_plate: profileData?.license_plate || null,
        license_status: profileData?.license_status || null,
        drivers_license_expiry: profileData?.drivers_license_expiry || null,
        homeowners_insurance_expiry: profileData?.homeowners_insurance_expiry || null,
        car_insurance_expiry: profileData?.car_insurance_expiry || null,
        house_id: profileData?.house_id || null,
        vehicle_id: profileData?.vehicle_id || null,
        role: profileData?.role || null,
        is_admin: profileData?.is_admin || null,
        is_troll_officer: profileData?.is_troll_officer || null,

        league_tier: leagueData?.league_tier || tLeagueTier.tier,
        league_sub_tier: leagueData?.sub_tier || subInfo.sub,
        league_score: leagueScore,
        gift_coins_received: Number(leagueData?.gift_coins_received) || 0,
        total_live_minutes: Number(leagueData?.total_live_minutes) || 0,
        season_key: leagueData?.season_key || seasonKey,
        league_level: Number(leagueData?.league_level) || leagueLevelInfo.level,
        total_gifts_sent: Number(leagueData?.total_gifts_sent) || 0,

        tLeagueTier,
        leagueProgress: getSubTierProgress(leagueScore),
        subTierColor: getSubTierColor(tLeagueTier.tier, subInfo.sub),
        recentlyRaided,
      };

      // Calculate progress within sub-tier
      const nextSub = getNextSubTier(tLeagueTier, subInfo.sub);
      orbData.nextTier = nextSub ? {
        tier: nextSub.tier.tier,
        minScore: nextSub.tier.minScore,
        label: nextSub.tier.label,
        color: nextSub.tier.color,
        badgeColor: nextSub.tier.badgeColor,
        textColor: nextSub.tier.textColor,
        icon: nextSub.tier.icon,
        subTiers: nextSub.tier.subTiers,
      } : null;
      orbData.coinsToNextLeague = orbData.nextTier
        ? Math.max(0, orbData.nextTier.minScore - leagueScore)
        : 0;

      // Fetch active missions/goals (graceful if table doesn't exist yet)
      try {
        const { data: missionsData } = await supabase
          .from('broadcast_missions')
          .select('id, title, description, target_type, target_value, current_progress, reward_coins, status')
          .eq('broadcaster_id', options.userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5);
        orbData.activeMissions = (missionsData || []).map((m: any) => ({
          id: m.id,
          title: m.title || m.description || 'Mission',
          progress: Number(m.current_progress) || 0,
          goal: Number(m.target_value) || 1,
          reward: Number(m.reward_coins) || 0,
        }));
      } catch {
        orbData.activeMissions = [];
      }

      if (isMountedRef.current) {
        setData(orbData);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[useCityStatusOrb] Error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load user status');
        setLoading(false);
      }
    }
  }, [options.userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime subscription for raids on this user's house
  useEffect(() => {
    if (!options.userId || !profile?.house_id) return;

    const channel = supabase
      .channel(`city_status_orb_raids_${options.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'house_raids',
          filter: `house_id=eq.${profile.house_id}`,
        },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.userId, profile?.house_id, fetchStatus]);

  // Realtime subscription for broadcast raids
  useEffect(() => {
    if (!options.userId || !options.isBroadcaster) return;

    const channel = supabase
      .channel(`city_status_orb_broadcast_raids_${options.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcast_raids',
          filter: `broadcaster_id=eq.${options.userId}`,
        },
        () => {
          fetchStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'broadcast_raids',
          filter: `broadcaster_id=eq.${options.userId}`,
        },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.userId, options.isBroadcaster, fetchStatus]);

  // Determine role-based permissions
  const currentUserId = user?.id;
  const isSelf = currentUserId === options.userId;
  const isAdmin = profile?.is_admin === true || profile?.role === 'admin';
  const isCEO = profile?.role === 'ceo' || profile?.is_ceo === true;
  const isOfficer = profile?.is_troll_officer === true;
  const isBroadcasterContext = options.isBroadcaster === true;
  const isBroadOfficer = options.isBroadOfficer === true;
  const isSeatHolder = options.isSeatHolder === true;

  // Can view license/plate/insurance details
  const canCheckLicense = isBroadcasterContext || isBroadOfficer || isAdmin || isCEO || isOfficer;

  // Can raid: anyone in broadcast (viewer, seat holder, broadcaster) if not self and target has house or is broadcaster
  const canRaid =
    !isSelf &&
    (data?.house_id != null || isBroadcasterContext);

  // Can repair: anyone (self or other viewers) when recently raided
  const canRepair = !!data?.recentlyRaided && (isSelf || isBroadcasterContext || isSeatHolder || options.broadcasterId != null);

  // Can use enforcement: BroadOfficer, Admin, CEO, officer roles
  const canEnforce = isBroadOfficer || isAdmin || isCEO || isOfficer;

  // Can remove from seat: broadcaster or BroadOfficer
  const canRemoveFromSeat = isBroadcasterContext || isBroadOfficer || isAdmin;

  // Can access all actions: admin/CEO/career roles
  const canAccessAll = isAdmin || isCEO || isOfficer;

  return {
    data,
    loading,
    error,
    refetch: fetchStatus,
    permissions: {
      isSelf,
      canCheckLicense,
      canRaid,
      canRepair,
      canEnforce,
      canRemoveFromSeat,
      canAccessAll,
    },
  };
}
