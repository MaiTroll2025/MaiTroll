import { useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { usePresenceStore } from '../lib/presenceStore';

/**
 * GlobalPresenceTracker - tracks user presence using Supabase Realtime Presence.
 *
 * REPLACED: Previous version used 30s REST polling (upsert to user_presence table
 * + SELECT count) which caused O(N²) broadcast storm. Now uses Supabase Realtime
 * Presence channels which are WebSocket-based and scale without DB writes.
 *
 * - Tracks user online/offline via presence sync (no DB writes for heartbeat)
 * - Fetches online count via presence state (no DB query for count)
 * - Falls back to DB only for initial online status and visibility changes
 * - Does NOT log out users — just tracks presence
 */
export default function GlobalPresenceTracker() {
  const { user, profile } = useAuthStore();
  const setOnlineUserIds = usePresenceStore(state => state.setOnlineUserIds);
  const setTotalUserCount = usePresenceStore(state => state.setTotalUserCount);

  useEffect(() => {
    let cancelled = false;

    const fetchTotalUserCount = async () => {
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true });

      if (!cancelled) {
        if (error) {
          console.error('[GlobalPresenceTracker] Failed to fetch total user count:', error);
          setTotalUserCount(null);
        } else {
          setTotalUserCount(count ?? 0);
        }
      }
    };

    void fetchTotalUserCount();

    const accountChannel = supabase
      .channel('global-user-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_profiles' }, () => {
        void fetchTotalUserCount();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'user_profiles' }, () => {
        void fetchTotalUserCount();
      })
      .subscribe();

    const refreshTimer = window.setInterval(() => {
      void fetchTotalUserCount();
    }, 60000);

    if (!user?.id || !profile?.id) {
      setOnlineUserIds([]);
      return () => {
        cancelled = true;
        window.clearInterval(refreshTimer);
        void supabase.removeChannel(accountChannel);
      };
    }

    // Use a single global presence channel — Supabase Presence handles
    // join/leave/sync without any DB writes.
    const channel = supabase.channel('global-presence-tracker', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Presence keys are user IDs, so multiple tabs for one account count once.
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const userIds = [...new Set(
        Object.values(state).flatMap((metas: any[]) =>
          metas.map((m: any) => m?.user_id).filter(Boolean)
        )
      )];
      setOnlineUserIds(userIds);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      void channel.untrack();
      void supabase.removeChannel(channel);
      void supabase.removeChannel(accountChannel);
      setOnlineUserIds([]);
    };
  }, [user?.id, profile?.id, setOnlineUserIds, setTotalUserCount]);

  return null;
}
