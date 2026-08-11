import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
// import { getUserEntranceEffect } from '../lib/entranceEffects'
import { usePresenceStore } from '../lib/presenceStore'
import { logStreamAnalyticsEvent } from '../lib/streamAnalytics'

const isValidUUID = (id: any): id is string => 
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Tracks viewer presence using Supabase Realtime.
 * - Viewers join the 'room:{streamId}' channel.
 * - Scalability: Aggregates counts and batches updates.
 * - Removes per-user join/leave chat spam.
 */
export function useViewerTracking(streamId: string | null, isHost: boolean = false, customUser: any = null) {
  const { user, profile } = useAuthStore()
  const setRoomViewerCount = usePresenceStore(state => state.setRoomViewerCount)
  const lastDbUpdate = useRef<number>(0)
  const pendingCountRef = useRef<number | null>(null)
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Use customUser if provided (e.g. for Guests)
  const effectiveUser = user || customUser;

  useEffect(() => {
    if (!streamId || !effectiveUser) return

    // Check if user is banned from this stream
    const checkBanStatus = async () => {
      if (!user?.id) return; // Skip for guests/custom users

      const { data } = await supabase
        .from('stream_bans')
        .select('expires_at')
        .eq('stream_id', streamId)
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (data) {
        // User is banned, redirect to kick fee page
        window.location.href = `/kick-fee/${streamId}`;
        return;
      }
    };

    checkBanStatus();

    // Only the Host and Officers track their presence to avoid roster explosion at 10k users.
    // Viewers just "listen" to the count updated by the host/officers in the DB.
    const isStaff = profile?.role === 'admin' || profile?.role === 'troll_officer' || profile?.is_troll_officer || profile?.is_admin;

    // Everyone tracks their presence now to populate the "Active Users" list.
    // For scalability at 10k+ users, we might need to throttle or limit this in the future.
    const shouldTrack = true;
    const isUpdateAuthorized = isHost || isStaff;

    const channel = supabase.channel(`room:${streamId}`, {
      config: {
        presence: {
          key: effectiveUser.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        
        // Count unique keys (user_ids)
        let count = Object.keys(state).length;

        // If we are tracking ourselves but not yet in the sync state, 
        // ensure we count ourselves (at least 1)
        if (shouldTrack && count === 0) {
          count = 1;
        }
        
        // Scalability: Batch presence updates to 2 seconds
        pendingCountRef.current = count;
        if (!updateTimerRef.current) {
          updateTimerRef.current = setTimeout(() => {
            if (pendingCountRef.current !== null) {
              setRoomViewerCount(streamId, pendingCountRef.current);
              pendingCountRef.current = null;
            }
            updateTimerRef.current = null;
          }, 2000);
        }

        // Only Host OR Officer/Admin updates the DB count
        // Reduced from 10s to 30s to reduce disk I/O
        if (isUpdateAuthorized) {
          const now = Date.now()
          if (now - lastDbUpdate.current > 30000) { // Throttled to 30s
            lastDbUpdate.current = now
            supabase.rpc('update_stream_viewer_count', { p_stream_id: streamId, p_count: count });
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Everyone tracks themselves
          await channel.track({
            user_id: effectiveUser.id,
            username: profile?.username || effectiveUser.username || 'Guest',
            avatar_url: profile?.avatar_url || null,
            role: profile?.role || effectiveUser.role,
            troll_role: profile?.troll_role,
            joined_at: new Date().toISOString(),
          })

          // Also heartbeat into stream_viewers table for the "Active" list
          // Only for authenticated users (UUID required)
          if (isValidUUID(user?.id)) {
            const { error: viewerError } = await supabase
              .from('stream_viewers')
              .upsert(
                {
                  stream_id: streamId,
                  user_id: user.id,
                  last_seen: new Date().toISOString(),
                },
                { onConflict: 'stream_id,user_id' }
              );

            if (viewerError?.code === '42P10') {
              await supabase
                .from('stream_viewers')
                .update({ last_seen: new Date().toISOString() })
                .eq('stream_id', streamId)
                .eq('user_id', user.id);
            }

            void logStreamAnalyticsEvent(streamId, user.id, 'join');

          }
        }
      })

    // REPLACED: 60s DB heartbeat interval removed.
    // Supabase Realtime Presence (channel.track/untrack) already handles viewer
    // join/leave via WebSocket. The stream_viewers table is only written to on
    // initial join (above) and cleanup (below) — no periodic upsert needed.
    // This eliminates N × 1 DB write per minute across all viewers.

    return () => {
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
      
      // Try to remove from stream_viewers on leave
      if (streamId && isValidUUID(user?.id)) {
        void logStreamAnalyticsEvent(streamId, user.id, 'leave');
        supabase.from('stream_viewers').delete().match({ stream_id: streamId, user_id: user.id });
      }
    }
  }, [streamId, user, isHost, profile, effectiveUser, setRoomViewerCount])

  // Get count from store instead of local state for consistency
  const storeCount = usePresenceStore(state => state.roomViewerCounts[streamId || ''] || 0)
  
  // For the broadcaster/host, ensure we show at least 1 viewer (themselves)
  // This provides immediate feedback before presence syncs.
  const viewerCount = (isHost && storeCount === 0) ? 1 : storeCount;

  return { viewerCount }
}

/**
 * Hook to get live viewer count for a stream.
 * Used for listing pages (Home, Sidebar) where we don't need real-time presence.
 *
 * REPLACED: Previous version polled streams table every 30s. Now uses a Supabase
 * Realtime postgres_changes subscription — viewer count updates are pushed
 * instantly when the host updates it, with zero polling.
 */
export function useLiveViewerCount(streamId: string | null) {
  const [viewerCount, setViewerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!streamId) {
      setViewerCount(0)
      setLoading(false)
      return
    }

    let mounted = true

    // Initial fetch
    const getCount = async () => {
      // Thundering Herd Prevention: Jitter on fetch (0-500ms)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

      const { data } = await supabase
        .from('streams')
        .select('current_viewers')
        .eq('id', streamId)
        .single()

      if (mounted && data) {
        setViewerCount(data.current_viewers || 0)
        setLoading(false)
      }
    }
    getCount()

    // Subscribe to realtime updates on the streams table — no polling needed.
    // The host updates current_viewers via update_stream_viewer_count RPC,
    // and this subscription receives the change instantly.
    const channel = supabase
      .channel(`stream-viewer-count:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          if (mounted && payload.new) {
            setViewerCount((payload.new as any).current_viewers || 0)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [streamId])

  return { viewerCount, loading }
}
