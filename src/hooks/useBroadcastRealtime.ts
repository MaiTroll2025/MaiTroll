import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { generateUUID } from '../lib/uuid';
import type { GiftRarity } from '../types/gifts';

export async function hydrateRealtimeGift(rawGift: any): Promise<BroadcastGift> {
  let giftItem: any = null

  if (rawGift?.gift_id) {
    const { data } = await supabase
      .from('gift_items')
      .select(
        'id,name,gift_slug,slug,animation_url,animation_type,animation_duration_ms,sound_url,tray_visual_url,icon,metadata'
      )
      .eq('id', rawGift.gift_id)
      .maybeSingle()

    giftItem = data
  }

  return {
    ...rawGift,

    gift_name:
      rawGift?.gift_name ??
      giftItem?.name ??
      'Gift',

    gift_slug:
      rawGift?.gift_slug ??
      giftItem?.gift_slug ??
      giftItem?.slug ??
      null,

    animation_url:
      rawGift?.animation_url ??
      giftItem?.animation_url ??
      null,

    animation_type:
      rawGift?.animation_type ??
      giftItem?.animation_type ??
      null,

    animation_duration_ms:
      rawGift?.animation_duration_ms ??
      giftItem?.animation_duration_ms ??
      null,

    sound_url:
      rawGift?.sound_url ??
      giftItem?.sound_url ??
      null,

    tray_visual_url:
      rawGift?.tray_visual_url ??
      giftItem?.tray_visual_url ??
      null,

    gift_icon:
      rawGift?.gift_icon ??
      giftItem?.icon ??
      null,

    metadata: {
      ...(giftItem?.metadata ?? {}),
      ...(rawGift?.metadata ?? {}),
    },
  }
}

export interface BroadcastRealtimeState {
  stream: any | null;
  totalLikes: number;
  boxCount: number;
  viewerCount: number;
  messages: BroadcastMessage[];
  recentGifts: BroadcastGift[];
  participants: Participant[];
  isLive: boolean;
  hasEnded: boolean;
  isLoading: boolean;
}

export interface BroadcastMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type: 'chat' | 'system';
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  user_troll_role?: string;
}

export interface BroadcastGift {
  [x: string]: any;
  id: string;
  gift_id: string;
  gift_name: string;
  gift_icon: string;
  gift_slug?: string;
  animation_key?: string;
  animation_type?: string;
  animation_url?: string;
  video_url?: string;
  animation_duration_ms?: number;
  sound_url?: string;
  is_fullscreen?: boolean;
  rarity?: GiftRarity | string;
  tray_visual_url?: string;
  tray_gradient?: string;
  amount: number;
  quantity?: number;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  receiver_name?: string;
  created_at: string;
}

export interface Participant {
  user_id: string;
  username: string;
  avatar_url: string;
  joined_at: string;
  is_host?: boolean;
}

interface UseBroadcastRealtimeOptions {
  streamId: string;
  userId?: string;
  initialStream?: any;
  onStreamEnd?: () => void;
  onGiftReceived?: (gift: BroadcastGift) => void;
  onMessageReceived?: (message: BroadcastMessage) => void;
  onParticipantJoin?: (participant: Participant) => void;
  onParticipantLeave?: (participant: Participant) => void;
}

export function useBroadcastRealtime({
  streamId,
  userId,
  initialStream,
  onStreamEnd,
  onGiftReceived,
  onMessageReceived,
  onParticipantJoin,
  onParticipantLeave,
}: UseBroadcastRealtimeOptions) {
  const [state, setState] = useState<BroadcastRealtimeState>({
    stream: initialStream || null,
    totalLikes: initialStream?.total_likes || 0,
    boxCount: initialStream?.box_count || 1,
    viewerCount: 0,
    messages: [],
    recentGifts: [],
    participants: [],
    isLive: initialStream?.status === 'live',
    hasEnded: initialStream?.status === 'ended',
    isLoading: !initialStream,
  });

  const channelsRef = useRef<any[]>([]);
  const messageBufferRef = useRef<BroadcastMessage[]>([]);
  const MAX_MESSAGES = 100;
  const FLUSH_INTERVAL = 100;

  const onGiftReceivedRef = useRef(onGiftReceived)
  onGiftReceivedRef.current = onGiftReceived

  const onStreamEndRef = useRef(onStreamEnd)
  onStreamEndRef.current = onStreamEnd

  const onMessageReceivedRef = useRef(onMessageReceived)
  onMessageReceivedRef.current = onMessageReceived

  const onParticipantJoinRef = useRef(onParticipantJoin)
  onParticipantJoinRef.current = onParticipantJoin

  const onParticipantLeaveRef = useRef(onParticipantLeave)
  onParticipantLeaveRef.current = onParticipantLeave

  const cleanup = useCallback(() => {
    channelsRef.current.forEach(channel => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    });
    channelsRef.current = [];
  }, []);

  useEffect(() => {
    if (!streamId) return;

    cleanup();

    const channels: any[] = [];

    // ============================================
    // 1. UNIFIED STREAM CHANNEL: postgres_changes for stream data + broadcast for chat/gifts/likes
    // ============================================
    const streamChannel = supabase
      .channel(`broadcast-stream-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          setState(prev => {
            if (newData.status === 'ended' || newData.is_live === false) {
              if (!prev.hasEnded) {
                onStreamEndRef.current?.();
              }
              return {
                ...prev,
                stream: newData,
                hasEnded: true,
                isLive: false,
              };
            }

            return {
              ...prev,
              stream: newData,
              totalLikes: newData.total_likes ?? prev.totalLikes,
              boxCount: newData.box_count ?? prev.boxCount,
              viewerCount: newData.current_viewers ?? prev.viewerCount,
              isLive: newData.status === 'live',
            };
          });
        }
      )
      .on(
        'broadcast',
        { event: 'message' },
        (payload) => {
          const envelope = payload.payload;
          if (envelope.v !== 1 || envelope.stream_id !== streamId) return;

          const newMessage: BroadcastMessage = {
            id: envelope.txn_id || `msg-${Date.now()}`,
            user_id: envelope.s,
            content: envelope.d.content,
            created_at: new Date(envelope.ts).toISOString(),
            type: 'chat',
            user_name: envelope.d.user_name,
            user_avatar: envelope.d.user_avatar,
            user_role: envelope.d.user_role,
            user_troll_role: envelope.d.user_troll_role,
          };

          messageBufferRef.current.push(newMessage);
          onMessageReceivedRef.current?.(newMessage);
        }
      )
      .on(
        'broadcast',
        { event: 'gift_sent' },
        async (payload) => {
          const envelope = payload.payload;
          if (envelope.v !== 1 || envelope.stream_id !== streamId) return;

          const rawGift = envelope.d;
          if (!rawGift) return;

          const hydratedGift = await hydrateRealtimeGift(rawGift)

          const newGift: BroadcastGift = {
            id: hydratedGift.id || rawGift.id,
            gift_id: hydratedGift.gift_id || rawGift.gift_id,
            gift_name: hydratedGift.gift_name || rawGift.gift_name || 'Gift',
            gift_icon: hydratedGift.gift_icon || rawGift.gift_icon || '🎁',
            gift_slug: hydratedGift.gift_slug || rawGift.gift_slug || null,
            animation_type: hydratedGift.animation_type || rawGift.animation_type || null,
            animation_url: hydratedGift.animation_url || rawGift.animation_url || null,
            animation_duration_ms: hydratedGift.animation_duration_ms || rawGift.animation_duration_ms || null,
            sound_url: hydratedGift.sound_url || rawGift.sound_url || null,
            amount: hydratedGift.amount || rawGift.amount || 0,
            quantity: hydratedGift.quantity || rawGift.quantity || 1,
            sender_id: hydratedGift.sender_id || rawGift.sender_id,
            sender_name: hydratedGift.sender_name || rawGift.sender_name || 'Someone',
            receiver_id: hydratedGift.receiver_id || rawGift.receiver_id,
            receiver_name: hydratedGift.receiver_name || rawGift.receiver_name || null,
            created_at: hydratedGift.created_at || rawGift.timestamp || new Date().toISOString(),
          };

          setState(prev => ({
            ...prev,
            recentGifts: [...prev.recentGifts.slice(-19), newGift],
          }));

          onGiftReceivedRef.current?.(newGift);
        }
      )
      .on(
        'broadcast',
        { event: 'like_sent' },
        (payload) => {
          const likeData = payload.payload;

          if (likeData.total_likes !== undefined) {
            setState(prev => ({
              ...prev,
              totalLikes: likeData.total_likes,
            }));
          } else {
             setState(prev => ({
               ...prev,
               totalLikes: prev.totalLikes + 2,
             }));
          }
        }
      )
      .subscribe();

    channels.push(streamChannel);

    // ============================================
    // 2. PARTICIPANTS (Presence) — single presence channel
    // ============================================
    const presenceChannel = supabase
      .channel(`broadcast-presence-${streamId}`)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          const participant: Participant = {
            user_id: p.user_id,
            username: p.username || 'Guest',
            avatar_url: p.avatar_url || '',
            joined_at: p.joined_at || new Date().toISOString(),
          };

          setState(prev => {
            const exists = prev.participants.some(pa => pa.user_id === participant.user_id);
            if (!exists) {
              return {
                ...prev,
                participants: [...prev.participants, participant],
              };
            }
            return prev;
          });

          onParticipantJoinRef.current?.(participant);
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          const participant: Participant = {
            user_id: p.user_id,
            username: p.username || 'Guest',
            avatar_url: p.avatar_url || '',
            joined_at: p.joined_at || new Date().toISOString(),
          };

          setState(prev => ({
            ...prev,
            participants: prev.participants.filter(pa => pa.user_id !== participant.user_id),
          }));

          onParticipantLeaveRef.current?.(participant);
        });
      })
      .subscribe();

    if (userId) {
      presenceChannel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    }

    channels.push(presenceChannel);

    channelsRef.current = channels;

    const flushInterval = setInterval(() => {
      if (messageBufferRef.current.length === 0) return;

      const newMessages = [...messageBufferRef.current];
      messageBufferRef.current = [];

      setState(prev => {
        const updated = [...prev.messages, ...newMessages];
        if (updated.length > MAX_MESSAGES) {
          return {
            ...prev,
            messages: updated.slice(-MAX_MESSAGES),
          };
        }
        return {
          ...prev,
          messages: updated,
        };
      });
    }, FLUSH_INTERVAL);

    return () => {
      clearInterval(flushInterval);
      cleanup();
    };
  }, [streamId, userId, cleanup]);

  const sendMessage = useCallback(async (content: string, userProfile: any) => {
    if (!userId || !content.trim()) return;

    const txnId = generateUUID();

    const optimisticMessage: BroadcastMessage = {
      id: txnId,
      user_id: userId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      type: 'chat',
      user_name: userProfile?.username,
      user_avatar: userProfile?.avatar_url,
      user_role: userProfile?.role,
      user_troll_role: userProfile?.troll_role,
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, optimisticMessage],
    }));

    const channel = channelsRef.current[0];
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: {
          v: 1,
          txn_id: txnId,
          s: userId,
          ts: Date.now(),
          stream_id: streamId,
          d: {
            content: content.trim(),
            user_name: userProfile?.username,
            user_avatar: userProfile?.avatar_url,
            user_role: userProfile?.role,
            user_troll_role: userProfile?.troll_role,
            user_created_at: userProfile?.created_at,
            user_rgb_expires_at: userProfile?.rgb_username_expires_at,
            user_glowing_username_color: userProfile?.glowing_username_color,
          },
        },
      });
    }
  }, [streamId, userId]);

  const sendLike = useCallback(async () => {
    if (!userId) return;

    const channel = channelsRef.current[0];
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'like_sent',
        payload: {
          user_id: userId,
          stream_id: streamId,
          timestamp: Date.now(),
        },
      });
    }

    setState(prev => ({
      ...prev,
      totalLikes: prev.totalLikes + 2,
    }));
  }, [streamId, userId]);

  const clearGiftAnimation = useCallback((giftId: string) => {
    setState(prev => ({
      ...prev,
      recentGifts: prev.recentGifts.filter(g => g.id !== giftId),
    }));
  }, []);

  return {
    ...state,
    sendMessage,
    sendLike,
    clearGiftAnimation,
  };
}
