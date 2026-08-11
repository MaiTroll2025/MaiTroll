import { useEffect, useRef } from 'react';
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
  const setOnlineCount = usePresenceStore(state => state.setOnlineCount);
  const setOnlineUserIds = usePresenceStore(state => state.setOnlineUserIds);
  const isVisibleRef = useRef<boolean>(!document.hidden);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id || !profile?.id) return;

    // Use a single global presence channel — Supabase Presence handles
    // join/leave/sync without any DB writes.
    const channel = supabase.channel('global-presence-tracker', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    // On sync, derive online users from presence state — zero DB queries
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const userIds = Object.keys(state);
      setOnlineCount(userIds.length);
      setOnlineUserIds(userIds);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track this user as online — no DB write needed
        await channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
        });

        // Set initial DB online status (one-time write on connect)
        try {
          await supabase
            .from('user_profiles')
            .update({
              is_online: true,
              last_active: new Date().toISOString()
            })
            .eq('id', user.id);
        } catch {
          // Silently fail — presence tracking is non-critical
        }
      }
    });

    // Handle visibility changes — update DB is_online only on transitions
    const handleVisibilityChange = async () => {
      const isVisible = !document.hidden;
      isVisibleRef.current = isVisible;

      if (!isVisible) {
        // Mark offline in DB (single write on hide)
        try {
          await supabase
            .from('user_profiles')
            .update({
              is_online: false,
              last_active: new Date().toISOString()
            })
            .eq('id', user.id);
        } catch {
          // Silently fail
        }
        return;
      }

      // Mark online in DB (single write on show)
      try {
        await supabase
          .from('user_profiles')
          .update({
            is_online: true,
            last_active: new Date().toISOString()
          })
          .eq('id', user.id);
      } catch {
        // Silently fail
      }
    };

    // Handle beforeunload — mark as offline
    const handleBeforeUnload = () => {
      if (user?.id) {
        const payload = JSON.stringify({
          is_online: false,
          last_active: new Date().toISOString()
        });
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}`,
          payload
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Untrack presence and remove channel
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Mark as offline on unmount
      if (user?.id) {
        supabase
          .from('user_profiles')
          .update({
            is_online: false,
            last_active: new Date().toISOString()
          })
          .eq('id', user.id)
           .then(() => {})
           .then(undefined, () => {});
      }
    };
  }, [user?.id, profile?.id, setOnlineCount, setOnlineUserIds]);

  return null;
}
