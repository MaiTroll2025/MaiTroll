import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import type {
  TMMatch,
  TMProfileView,
  TMInterest,
  TMGender,
  TMPreference,
  TMMessagePricing,
  TMAllUser,
} from '../types/trollMatch';

type MatchCacheKey = string;

const MATCH_CACHE_DURATION = 30_000;
const ALL_USERS_CACHE_DURATION = 10_000;
const NEW_USER_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

const matchesCache = new Map<MatchCacheKey, { data: TMMatch[]; timestamp: number }>();

let allUsersCache: {
  data: TMAllUser[];
  newUserIds: Set<string>;
  timestamp: number;
} | null = null;

function getMatchCacheKey(userId: string, dating: boolean, limit: number) {
  return `${userId}:${dating ? 'dating' : 'friends'}:${limit}`;
}

function isFresh(timestamp: number, duration: number) {
  return timestamp > Date.now() - duration;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function getStreamUserId(stream: any): string | null {
  return stream?.user_id || stream?.broadcaster_id || null;
}

function normalizeAllUser(
  profile: any,
  activeSessionsMap: Map<string, { isActive: boolean; lastActive: string }>,
  liveStreamsMap: Map<string, { stream_id: string; current_viewers: number }>,
  _now: Date
): TMAllUser {
  const streamInfo = liveStreamsMap.get(profile.id);
  const sessionInfo = activeSessionsMap.get(profile.id);

  return {
    user_id: profile.id,
    username: profile.username || 'Unknown',
    avatar_url: profile.avatar_url,
    interests: safeArray(profile.interests) as TMInterest[],
    is_online: sessionInfo?.isActive === true || profile.is_online === true,
    last_active: sessionInfo?.lastActive || profile.last_active,
    created_at: profile.created_at,
    is_live: !!streamInfo,
    stream_id: streamInfo?.stream_id || null,
    current_viewers: streamInfo?.current_viewers || 0,
  };
}

function isNewUser(profile: any, now = new Date()) {
  const createdAt = new Date(profile?.created_at || profile?.last_active || now);
  return now.getTime() - createdAt.getTime() < NEW_USER_THRESHOLD;
}

function mergeUserUnique(prev: TMAllUser[], nextUser: TMAllUser) {
  const exists = prev.some((u) => u.user_id === nextUser.user_id);
  if (exists) {
    return prev.map((u) => (u.user_id === nextUser.user_id ? { ...u, ...nextUser } : u));
  }
  return [nextUser, ...prev];
}

function clearUserCaches() {
  matchesCache.clear();
  allUsersCache = null;
}

export function useTMMatches(dating: boolean = false, limit: number = 20) {
  const { user, profile } = useAuthStore();
  const [matches, setMatches] = useState<TMMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(
    async (useCache = true) => {
      if (!user?.id || !profile) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const cacheKey = getMatchCacheKey(user.id, dating, limit);
      const cached = matchesCache.get(cacheKey);

      if (useCache && cached && isFresh(cached.timestamp, MATCH_CACHE_DURATION)) {
        setMatches(cached.data.slice(0, limit));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc('get_tm_matches', {
          p_user_id: user.id,
          p_dating: dating,
          p_limit: limit,
        });

        if (rpcError) throw rpcError;

        const safeMatches = safeArray<TMMatch>(data);
        const userIds = safeMatches.map((m) => m.user_id).filter(Boolean);

        let pricesMap = new Map<string, number>();

        if (userIds.length > 0) {
          const { data: priceData, error: priceError } = await supabase
            .from('user_profiles')
            .select('id, message_price')
            .in('id', userIds);

          if (priceError) throw priceError;

          pricesMap = new Map(
            safeArray<{ id: string; message_price: number }>(priceData).map((p) => [
              p.id,
              p.message_price || 0,
            ])
          );
        }

        const matchesWithPrices = safeMatches.map((m) => ({
          ...m,
          message_price: pricesMap.get(m.user_id) || 0,
        }));

        matchesCache.set(cacheKey, {
          data: matchesWithPrices,
          timestamp: Date.now(),
        });

        setMatches(matchesWithPrices.slice(0, limit));
      } catch (err: any) {
        console.error('Error fetching TM matches:', err);
        setError(err?.message || 'Failed to fetch matches');
      } finally {
        setLoading(false);
      }
    },
    [user?.id, profile, dating, limit]
  );

  useEffect(() => {
    fetchMatches(true);
  }, [fetchMatches]);

  const refetch = useCallback(() => {
    if (user?.id) {
      matchesCache.delete(getMatchCacheKey(user.id, dating, limit));
    }
    fetchMatches(false);
  }, [fetchMatches, user?.id, dating, limit]);

  return { matches, loading, error, refetch };
}

export function useTMViewedMe(limit: number = 50) {
  const { user } = useAuthStore();
  const [viewers, setViewers] = useState<TMProfileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchViewers = useCallback(async () => {
    if (!user?.id) {
      setViewers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_viewed_me_users', {
        p_user_id: user.id,
        p_limit: limit,
      });

      if (rpcError) throw rpcError;

      const seen = new Set<string>();
      const deduped = safeArray<TMProfileView>(data).filter((view) => {
        if (!view.viewer_id || seen.has(view.viewer_id)) return false;
        seen.add(view.viewer_id);
        return true;
      });

      setViewers(deduped);
    } catch (err: any) {
      console.error('Error fetching viewed me:', err);
      setError(err?.message || 'Failed to fetch viewers');
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => {
    fetchViewers();
  }, [fetchViewers]);

  const refetch = useCallback(() => {
    fetchViewers();
  }, [fetchViewers]);

  return { viewers, loading, error, refetch };
}

export function useTMRecordView() {
  const { user } = useAuthStore();

  const recordView = useCallback(
    async (viewedUserId: string) => {
      if (!user?.id || !viewedUserId || user.id === viewedUserId) return;

      try {
        await supabase.rpc('record_profile_view', {
          p_viewer_id: user.id,
          p_viewed_user_id: viewedUserId,
        });
      } catch (err) {
        console.error('Error recording profile view:', err);
      }
    },
    [user?.id]
  );

  return { recordView };
}

export function useTMUpdateProfile() {
  const { user } = useAuthStore();

  const updateProfile = useCallback(
    async (params: {
      interests?: TMInterest[];
      datingEnabled?: boolean;
      gender?: TMGender | null;
      preference?: TMPreference[];
      messagePrice?: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            interests: params.interests,
            dating_enabled: params.datingEnabled,
            gender: params.gender,
            preference: params.preference,
            message_price: params.messagePrice,
            last_active: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (error) throw error;

        clearUserCaches();
      } catch (err) {
        console.error('Error updating TM profile:', err);
        throw err;
      }
    },
    [user?.id]
  );

  return { updateProfile };
}

export function useTMSendMessage() {
  const { user } = useAuthStore();

  const sendMessage = useCallback(
    async (receiverId: string, message: string, price: number = 0) => {
      if (!user?.id) {
        throw new Error('Must be logged in to send messages');
      }

      if (!receiverId) {
        throw new Error('Missing receiver');
      }

      if (!message.trim()) {
        throw new Error('Message cannot be empty');
      }

      if (price < 0) {
        throw new Error('Invalid message price');
      }

      try {
        /*
          SECURITY NOTE:
          This should be a database RPC transaction that:
          1. validates sender balance
          2. deducts sender coins
          3. credits receiver if applicable
          4. writes coin ledger rows
          5. sends the Utromail/Troll Match message

          Do not directly update user_profiles.troll_coins from the frontend.
        */
        const { data, error } = await supabase.rpc('send_tm_message', {
          p_sender_id: user.id,
          p_receiver_id: receiverId,
          p_message: message.trim(),
          p_price_paid: price,
        });

        if (error) throw error;

        clearUserCaches();
        return data;
      } catch (err: any) {
        console.error('Error sending TM message:', err);
        throw err;
      }
    },
    [user?.id]
  );

  return { sendMessage };
}

export function useTMMessagePricing(userId: string) {
  const [pricing, setPricing] = useState<TMMessagePricing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPricing = async () => {
      if (!userId) {
        if (isMounted) {
          setPricing(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, message_price')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;

        if (isMounted) {
          setPricing(
            data
              ? {
                  userId: data.id,
                  price: data.message_price || 0,
                  username: data.username,
                }
              : null
          );
        }
      } catch (err) {
        console.error('Error fetching message pricing:', err);
        if (isMounted) setPricing(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPricing();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return { pricing, loading };
}

export function useTMNeedsOnboarding() {
  const { profile } = useAuthStore();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setNeedsOnboarding(false);
      setLoading(false);
      return;
    }

    const hasInterests = Array.isArray(profile.interests) && profile.interests.length > 0;

    setNeedsOnboarding(!hasInterests);
    setLoading(false);
  }, [profile?.id, profile?.interests]);

  return { needsOnboarding, loading };
}

export function useTMProfile() {
  const { profile } = useAuthStore();

  return {
    interests: safeArray(profile?.interests) as TMInterest[],
    datingEnabled: profile?.dating_enabled || false,
    gender: (profile?.gender || null) as TMGender | null,
    preference: safeArray(profile?.preference) as TMPreference[],
    messagePrice: profile?.message_price || 0,
  };
}

export function useTMFamilyInvites() {
  const { user } = useAuthStore();

  const createInvite = useCallback(
    async (inviteeId: string, familyId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      if (!inviteeId || !familyId) throw new Error('Missing invite details');

      try {
        const { data, error } = await supabase.rpc('create_family_invite', {
          p_inviter_id: user.id,
          p_invitee_id: inviteeId,
          p_family_id: familyId,
        });

        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error creating family invite:', err);
        throw err;
      }
    },
    [user?.id]
  );

  const respondToInvite = useCallback(async (inviteId: string, status: 'accepted' | 'declined') => {
    if (!inviteId) throw new Error('Missing invite ID');

    try {
      const { error } = await supabase.rpc('respond_family_invite', {
        p_invite_id: inviteId,
        p_status: status,
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error responding to family invite:', err);
      throw err;
    }
  }, []);

  return { createInvite, respondToInvite };
}

export function useTMAllUsers(limit: number = 100) {
  const [users, setUsers] = useState<TMAllUser[]>(() =>
    allUsersCache && isFresh(allUsersCache.timestamp, ALL_USERS_CACHE_DURATION)
      ? allUsersCache.data
      : []
  );

  const [loading, setLoading] = useState(() =>
    !(allUsersCache && isFresh(allUsersCache.timestamp, ALL_USERS_CACHE_DURATION))
  );

  const [error, setError] = useState<string | null>(null);

  const [newUserIds, setNewUserIds] = useState<Set<string>>(() =>
    allUsersCache && isFresh(allUsersCache.timestamp, ALL_USERS_CACHE_DURATION)
      ? allUsersCache.newUserIds
      : new Set()
  );

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUsers = useCallback(
    async (useCache: boolean = true) => {
      if (useCache && allUsersCache && isFresh(allUsersCache.timestamp, ALL_USERS_CACHE_DURATION)) {
        setUsers(allUsersCache.data);
        setNewUserIds(new Set(allUsersCache.newUserIds));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, interests, is_online, last_active, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (profilesError) throw profilesError;

        const [{ data: activeSessionsData, error: sessionsError }, { data: liveStreamsData, error: streamsError }] =
          await Promise.all([
            supabase
              .from('active_sessions')
              .select('user_id, is_active, last_active')
              .eq('is_active', true),
            supabase
              .from('streams')
              .select('id, user_id, broadcaster_id, current_viewers, is_live, status')
              .eq('is_live', true)
              .eq('status', 'live'),
          ]);

        if (sessionsError) console.warn('Active sessions fetch warning:', sessionsError);
        if (streamsError) throw streamsError;

        const activeSessionsMap = new Map<string, { isActive: boolean; lastActive: string }>();
        safeArray<any>(activeSessionsData).forEach((session) => {
          if (!session.user_id) return;
          activeSessionsMap.set(session.user_id, {
            isActive: session.is_active === true,
            lastActive: session.last_active,
          });
        });

        const liveStreamsMap = new Map<string, { stream_id: string; current_viewers: number }>();
        safeArray<any>(liveStreamsData).forEach((stream) => {
          const streamUserId = getStreamUserId(stream);
          if (!streamUserId) return;

          liveStreamsMap.set(streamUserId, {
            stream_id: stream.id,
            current_viewers: stream.current_viewers || 0,
          });
        });

        const now = new Date();
        const nextNewUserIds = new Set<string>();

        const allUsers = safeArray<any>(profilesData).map((profile) => {
          if (isNewUser(profile, now)) nextNewUserIds.add(profile.id);
          return normalizeAllUser(profile, activeSessionsMap, liveStreamsMap, now);
        });

        allUsersCache = {
          data: allUsers,
          newUserIds: nextNewUserIds,
          timestamp: Date.now(),
        };

        setUsers(allUsers);
        setNewUserIds(nextNewUserIds);
      } catch (err: any) {
        console.error('Error fetching all users:', err);
        setError(err?.message || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchUsers(true);

    const channel = supabase
      .channel('tm-all-users-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          const newProfile = payload.new as any;
          const now = new Date();

          const tmUser = normalizeAllUser(
            newProfile,
            new Map(),
            new Map(),
            now
          );

          setUsers((prev) => {
            const next = mergeUserUnique(prev, tmUser).slice(0, limit);
            allUsersCache = {
              data: next,
              newUserIds: allUsersCache?.newUserIds || new Set(),
              timestamp: Date.now(),
            };
            return next;
          });

          if (isNewUser(newProfile, now)) {
            setNewUserIds((prev) => {
              const next = new Set(prev);
              next.add(newProfile.id);
              if (allUsersCache) allUsersCache.newUserIds = next;
              return next;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          const updatedProfile = payload.new as any;

          setUsers((prev) => {
            const next = prev.map((u) =>
              u.user_id === updatedProfile.id
                ? {
                    ...u,
                    username: updatedProfile.username || u.username,
                    avatar_url: updatedProfile.avatar_url ?? u.avatar_url,
                    interests: safeArray(updatedProfile.interests) as TMInterest[],
                    is_online: updatedProfile.is_online ?? u.is_online,
                    last_active: updatedProfile.last_active ?? u.last_active,
                  }
                : u
            );

            if (allUsersCache) {
              allUsersCache = {
                ...allUsersCache,
                data: next,
                timestamp: Date.now(),
              };
            }

            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
        },
        (payload) => {
          const stream = (payload.new || payload.old) as any;
          const streamUserId = getStreamUserId(stream);
          if (!streamUserId) return;

          const isLive = payload.eventType !== 'DELETE' && payload.new?.is_live === true && payload.new?.status === 'live';

          setUsers((prev) => {
            const next = prev.map((u) =>
              u.user_id === streamUserId
                ? {
                    ...u,
                    is_live: isLive,
                    stream_id: isLive ? payload.new?.id || null : null,
                    current_viewers: isLive ? payload.new?.current_viewers || 0 : 0,
                  }
                : u
            );

            if (allUsersCache) {
              allUsersCache = {
                ...allUsersCache,
                data: next,
                timestamp: Date.now(),
              };
            }

            return next;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    intervalRef.current = setInterval(() => {
      fetchUsers(false);
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      intervalRef.current = null;
      channelRef.current = null;
    };
  }, [fetchUsers, limit]);

  const refetch = useCallback(() => {
    allUsersCache = null;
    fetchUsers(false);
  }, [fetchUsers]);

  const prefetch = useCallback(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  return { users, loading, error, refetch, newUserIds, prefetch };
}

export async function prefetchTMUsers() {
  if (allUsersCache && isFresh(allUsersCache.timestamp, ALL_USERS_CACHE_DURATION)) {
    return;
  }

  try {
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url, interests, is_online, last_active, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (profilesError) throw profilesError;

    const [{ data: activeSessionsData }, { data: liveStreamsData }] = await Promise.all([
      supabase
        .from('active_sessions')
        .select('user_id, is_active, last_active')
        .eq('is_active', true),
      supabase
        .from('streams')
        .select('id, user_id, broadcaster_id, current_viewers, is_live, status')
        .eq('is_live', true)
        .eq('status', 'live'),
    ]);

    const activeSessionsMap = new Map<string, { isActive: boolean; lastActive: string }>();
    safeArray<any>(activeSessionsData).forEach((session) => {
      if (!session.user_id) return;
      activeSessionsMap.set(session.user_id, {
        isActive: session.is_active === true,
        lastActive: session.last_active,
      });
    });

    const liveStreamsMap = new Map<string, { stream_id: string; current_viewers: number }>();
    safeArray<any>(liveStreamsData).forEach((stream) => {
      const streamUserId = getStreamUserId(stream);
      if (!streamUserId) return;

      liveStreamsMap.set(streamUserId, {
        stream_id: stream.id,
        current_viewers: stream.current_viewers || 0,
      });
    });

    const now = new Date();
    const nextNewUserIds = new Set<string>();

    const allUsers = safeArray<any>(profilesData).map((profile) => {
      if (isNewUser(profile, now)) nextNewUserIds.add(profile.id);
      return normalizeAllUser(profile, activeSessionsMap, liveStreamsMap, now);
    });

    allUsersCache = {
      data: allUsers,
      newUserIds: nextNewUserIds,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('Error prefetching TM users:', err);
  }
}