import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

interface ChatBlockStatus {
  blocked: boolean;
  expiresAt: string | null;
  isPermanent: boolean;
}

export function useChatBlockStatus(userId?: string | null, streamId?: string | null) {
  const [status, setStatus] = useState<ChatBlockStatus>({ blocked: false, expiresAt: null, isPermanent: false });
  const expiryTimerRef = useRef<number | null>(null);
  const profileMutedUntilRef = useRef<string | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const applyResolvedStatus = useCallback((blocked: boolean, expiresAt: string | null, isPermanent: boolean = false) => {
    setStatus({ blocked, expiresAt, isPermanent });
  }, []);

  const refresh = useCallback(async () => {
    clearExpiryTimer();

    if (!userId) {
      applyResolvedStatus(false, null, false);
      return;
    }

    const { data: unifiedRestriction } = await supabase.rpc('check_user_chat_restriction', {
      p_user_id: userId,
      p_stream_id: streamId || null,
    });
    if (unifiedRestriction?.restricted) {
      const restriction = unifiedRestriction.restriction
        || unifiedRestriction.jail
        || unifiedRestriction.chat_block
        || unifiedRestriction.mute
        || unifiedRestriction.broadcast_restriction
        || {};
      const expiresAt = restriction.expires_at || restriction.scheduled_release_at || null;
      const permanent = Boolean(restriction.is_permanent) || !expiresAt;
      applyResolvedStatus(true, expiresAt, permanent);
      if (expiresAt) {
        const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now()) + 250;
        expiryTimerRef.current = window.setTimeout(() => { void refresh() }, delay);
      }
      return;
    }

    let highestBlocked = false;
    let highestExpiresAt: string | null = null;
    let highestIsPermanent = false;

    // 1 ── stream-specific / global block from chat_blocks
    const activeFilter = `is_permanent.eq.true,expires_at.gt.${new Date().toISOString()}`;

    const streamQuery = streamId
      ? supabase
          .from('chat_blocks')
          .select('expires_at, is_permanent')
          .eq('user_id', userId)
          .eq('stream_id', streamId)
          .or(activeFilter)
          .order('is_permanent', { ascending: false })
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as any });

    const globalQuery = supabase
      .from('chat_blocks')
      .select('expires_at, is_permanent')
      .eq('user_id', userId)
      .is('stream_id', null)
      .or(activeFilter)
      .order('is_permanent', { ascending: false })
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const [{ data: streamBlock }, { data: globalBlock }] = await Promise.all([streamQuery, globalQuery])

    const bestBlock = [streamBlock, globalBlock].find((b) => b?.expires_at) as { expires_at: string; is_permanent: boolean } | undefined

    if (bestBlock?.expires_at) {
      highestBlocked = true
      if (bestBlock.is_permanent) {
        highestIsPermanent = true
        highestExpiresAt = null
      } else {
        highestExpiresAt = bestBlock.expires_at
      }
    }

    // 2 ── broadcast restriction via user_broadcast_restrictions
    let restrictionQuery = supabase
      .from('user_broadcast_restrictions')
      .select('expires_at, chat_disabled, status')
      .eq('user_id', userId)
      .eq('chat_disabled', true)
      .eq('status', 'active')
      .or(`expires_at.gt.${new Date().toISOString()}`)
      .order('expires_at', { ascending: false })
      .limit(1);

    if (streamId) {
      restrictionQuery = restrictionQuery.or(`stream_id.eq.${streamId},stream_id.is.null`);
    }

    const { data: restriction } = await restrictionQuery.maybeSingle();
    if (restriction?.expires_at) {
      highestBlocked = true;
      highestExpiresAt = restriction.expires_at;
      highestIsPermanent = !restriction.expires_at;
    }

    // 3 ── global moderator block via user_profiles.muted_until
    const mutedUntil = profileMutedUntilRef.current;

    if (mutedUntil) {
      const mutedExpiry = new Date(mutedUntil).getTime();
      const now = Date.now();

      if (mutedExpiry > now) {
        if (!highestBlocked || mutedExpiry > new Date(highestExpiresAt!).getTime()) {
          highestBlocked = true;
          highestExpiresAt = mutedUntil;
        }
      }
    }

    applyResolvedStatus(highestBlocked, highestExpiresAt, highestIsPermanent);

    if (highestExpiresAt) {
      const delay = Math.max(0, new Date(highestExpiresAt).getTime() - Date.now()) + 250;
      expiryTimerRef.current = window.setTimeout(() => {
        applyResolvedStatus(false, null, false);
      }, delay);
    }
  }, [clearExpiryTimer, streamId, userId, applyResolvedStatus]);

  // Seed muted_until from the local auth store on mount / userId change.
  // setupProfileRealtime() in store.ts keeps the auth-store profile fresh;
  // this snapshot feeds the muted_until leg of the resolved block check.
  useEffect(() => {
    if (!userId) {
      profileMutedUntilRef.current = null;
      return;
    }

    const profile = useAuthStore.getState().profile;
    profileMutedUntilRef.current = profile?.muted_until ?? null;
    void refresh();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Poll the auth store for muted_until changes on the same cadence as
  // setupProfileRealtime refreshes (≈30 s) while the hook is mounted.
  // This avoids a hard realtime-setup dependency (no new Supabase channel required)
  // while still providing sub-30 s reaction time for global moderator blocks.
  useEffect(() => {
    if (!userId) return;

    const intervalId = window.setInterval(() => {
      const profile = useAuthStore.getState().profile;
      const currentMutedUntil = profile?.muted_until ?? null;

      if (currentMutedUntil !== profileMutedUntilRef.current) {
        profileMutedUntilRef.current = currentMutedUntil;
        void refresh();
      }
    }, 15_000); // 15 s poll – fast enough, cheap enough

    return () => {
      window.clearInterval(intervalId);
    };
  }, [userId, refresh]);

  useEffect(() => {
    void refresh();
    if (!userId) return;

    const channel = supabase
      .channel(`chat-block-status:${userId}:${streamId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_blocks',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_broadcast_restrictions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_restrictions',
          filter: `target_user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    return () => {
      clearExpiryTimer();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [clearExpiryTimer, refresh, streamId, userId]);

  const remainingMinutes = status.expiresAt
    ? Math.max(1, Math.ceil((new Date(status.expiresAt).getTime() - Date.now()) / 60000))
    : null;

  return {
    userChatDisabled: status.blocked,
    chatDisabledUntil: status.expiresAt,
    chatDisabledRemainingMinutes: remainingMinutes,
    chatDisabledPermanently: status.isPermanent,
    refreshChatBlockStatus: refresh,
  };
}
