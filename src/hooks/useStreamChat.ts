import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { generateUUID } from '../lib/uuid';
import { toast } from 'sonner';
import { useMissionProgress } from './useMissionProgress';
import { useChatBlockStatus } from './useChatBlockStatus';
import { isStaffProfile } from '../lib/staff';
import { getBroadcastChatLockRemainingMs, isBroadcastChatLockActive } from '../lib/broadcastModeration';
import { sendChatThroughGate } from '../lib/sendChatThroughGate';
import { moderation } from '@/services/maitrollModeration';

export interface Message {
  id: string;
  txn_id?: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system' | 'gift';
  gift_type?: string;
  gift_amount?: number;
  sender_name?: string;
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  user_troll_role?: string;
  user_created_at?: string;
  user_rgb_expires_at?: string;
  user_glowing_username_color?: string;
  user_profiles?: {
    username: string;
    display_name?: string;
    email?: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
  } | null;
}

interface UseStreamChatProps {
  streamId: string;
  hostId: string;
  isHost: boolean;
}

const MAX_MESSAGES = 200;
const AUTO_DELETE_INTERVAL = 15000;
const MESSAGE_LIFETIME_MS = 30000;

const getDisplayName = (profileLike: any): string => {
  const emailPrefix = typeof profileLike?.email === 'string'
    ? profileLike.email.split('@')[0]
    : '';

  return (
    profileLike?.username ||
    profileLike?.display_name ||
    emailPrefix ||
    'Troll Citizen'
  );
};

export const useStreamChat = ({ streamId, hostId, isHost }: UseStreamChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hostChatDisabledByOfficerState, setHostChatDisabledByOfficerState] = useState(false);
  const [hostChatDisabledUntil, setHostChatDisabledUntil] = useState<string | null>(null);
  const [hostChatDisabledStreamId, setHostChatDisabledStreamId] = useState<string | null>(null);
  const [hostChatDisableRemainingMs, setHostChatDisableRemainingMs] = useState(0);

  const hostChatDisabledByOfficer = useMemo(
    () => isBroadcastChatLockActive({
      disabled: hostChatDisabledByOfficerState,
      until: hostChatDisabledUntil,
      streamId,
      lockedStreamId: hostChatDisabledStreamId,
    }),
    [hostChatDisabledByOfficerState, hostChatDisabledUntil, hostChatDisabledStreamId, streamId],
  );
  const { user, profile } = useAuthStore();
  const { userChatDisabled, chatDisabledRemainingMinutes } = useChatBlockStatus(user?.id, streamId);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [subscriberOnlyChat, setSubscriberOnlyChat] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const { trackChatMessage } = useMissionProgress(streamId);

  // Check if stream has subscriber-only chat enabled and if user is subscribed
  useEffect(() => {
    if (!streamId || !hostId) return;
    supabase
      .from('streams')
      .select('subscriber_only_chat, user_id')
      .eq('id', streamId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setSubscriberOnlyChat(!!data.subscriber_only_chat);
        // Check if current user is subscribed to the broadcaster
        if (user?.id && data.user_id !== user.id) {
          supabase
            .from('user_subscriptions')
            .select('id')
            .eq('subscriber_id', user.id)
            .eq('broadcaster_id', data.user_id)
            .eq('is_active', true)
            .maybeSingle()
            .then(({ data: sub }) => {
              setIsSubscriber(!!sub);
            });
        } else {
          setIsSubscriber(true); // broadcaster themselves
        }
      });
  }, [streamId, hostId, user?.id]);

  const canChat = useMemo(() => {
    if (!user) return false;
    if (isHost) return true;
    if (isStaffProfile(profile)) return true;
    if (subscriberOnlyChat && !isSubscriber) return false;
    return true;
  }, [user, isHost, profile, subscriberOnlyChat, isSubscriber]);

  const processedMessageIds = useRef<Set<string>>(new Set());
  const joinedUsersRef = useRef<Set<string>>(new Set());
  const channelsRef = useRef<any[]>([]);
  const chatSendThrottleRef = useRef<{ lastTime: number; count: number }>({ lastTime: 0, count: 0 });

  const cleanupChannels = useCallback(() => {
    channelsRef.current.forEach(ch => { if (ch) supabase.removeChannel(ch) })
    channelsRef.current = [];
  }, []);

  useEffect(() => {
    if (!hostId) return;

    let mounted = true;
    const fetchHostModerationState = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('broadcast_chat_disabled, broadcast_chat_disabled_until, broadcast_chat_disabled_stream_id')
        .eq('id', hostId)
        .maybeSingle();

      if (mounted) {
        setHostChatDisabledByOfficerState(!!data?.broadcast_chat_disabled);
        setHostChatDisabledUntil(data?.broadcast_chat_disabled_until ?? null);
        setHostChatDisabledStreamId(data?.broadcast_chat_disabled_stream_id ?? null);
      }
    };

    fetchHostModerationState();

    const moderationChannel = supabase
      .channel(`host-chat-lock:${hostId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${hostId}`
        },
        (payload: any) => {
          setHostChatDisabledByOfficerState(!!payload?.new?.broadcast_chat_disabled);
          setHostChatDisabledUntil(payload?.new?.broadcast_chat_disabled_until ?? null);
          setHostChatDisabledStreamId(payload?.new?.broadcast_chat_disabled_stream_id ?? null);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (moderationChannel) {
        supabase.removeChannel(moderationChannel);
      }
    };
  }, [hostId]);

  useEffect(() => {
    const updateRemaining = () => {
      setHostChatDisableRemainingMs(getBroadcastChatLockRemainingMs(hostChatDisabledUntil));
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [hostChatDisabledUntil]);

  useEffect(() => {
    if (!streamId) return;

    cleanupChannels();

    const fetchMessages = async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400));

      const { data } = await supabase
        .from('stream_messages')
        .select('*, user_profiles(username, display_name, email, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color)')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const processedMessages = data.reverse().map((m: any) => {
          const uProfile = {
            username: m.user_name || getDisplayName(m.user_profiles),
            display_name: m.user_profiles?.display_name,
            email: m.user_profiles?.email,
            avatar_url: m.user_avatar || m.user_profiles?.avatar_url || '',
            role: m.user_role || m.user_profiles?.role,
            troll_role: m.user_troll_role || m.user_profiles?.troll_role,
            created_at: m.user_created_at || m.user_profiles?.created_at,
            rgb_username_expires_at: m.user_rgb_expires_at || m.user_profiles?.rgb_username_expires_at,
            glowing_username_color: m.user_glowing_username_color || m.user_profiles?.glowing_username_color
          };
          if (m.id) processedMessageIds.current.add(m.id);
          return { ...m, type: 'chat', user_profiles: uProfile } as Message;
        });

        setMessages(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newHistory = processedMessages.filter(m => !existingIds.has(m.id));
          return [...newHistory, ...prev];
        });
      }
    };
    fetchMessages();

    const chatChannel = supabase
      .channel(`stream-chat:${streamId}`)
      .on(
        'broadcast',
        { event: 'chat' },
        (payload: any) => {
          const msg = payload.payload as Message;
          if (msg.user_id === user?.id) return;
          if (msg.txn_id && processedMessageIds.current.has(msg.txn_id)) return;
          if (msg.id && processedMessageIds.current.has(msg.id)) return;
          if (msg.txn_id) processedMessageIds.current.add(msg.txn_id);
          if (msg.id) processedMessageIds.current.add(msg.id);

          setMessages(prev => {
            if (msg.txn_id && prev.some(m => m.txn_id === msg.txn_id)) return prev;
            if (msg.id && prev.some(m => m.id === msg.id)) return prev;
            const updated = [...prev, msg];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
          });
        }
      )
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          if (p.user_id === user?.id) return;
          if (joinedUsersRef.current.has(p.user_id)) return;
          joinedUsersRef.current.add(p.user_id);

          const systemMsg: Message = {
            id: `sys-join-${p.user_id}-${Date.now()}`,
            user_id: p.user_id,
            content: 'joined the broadcast',
            created_at: new Date().toISOString(),
            type: 'system',
            user_profiles: {
              username: p.username || 'Guest',
              avatar_url: p.avatar_url || '',
              created_at: p.joined_at,
              role: p.role,
              troll_role: p.troll_role
            }
          };
          setMessages(prev => {
            const updated = [...prev, systemMsg];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
          });
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          if (p.user_id === user?.id) return;
          if (!joinedUsersRef.current.has(p.user_id)) return;
          joinedUsersRef.current.delete(p.user_id);

          const systemMsg: Message = {
            id: `sys-leave-${p.user_id}-${Date.now()}`,
            user_id: p.user_id,
            content: 'left the broadcast',
            created_at: new Date().toISOString(),
            type: 'system',
            user_profiles: {
              username: p.username || 'Guest',
              avatar_url: p.avatar_url || '',
              created_at: p.joined_at,
              role: p.role,
              troll_role: p.troll_role
            }
          };
          setMessages(prev => {
            const updated = [...prev, systemMsg];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
          });
        });
      })
      .subscribe();

    channelsRef.current = [chatChannel];

    const autoDeleteInterval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => prev.filter(msg => {
        const messageAge = now - new Date(msg.created_at).getTime();
        return messageAge < MESSAGE_LIFETIME_MS;
      }));
    }, AUTO_DELETE_INTERVAL);

    return () => {
      clearInterval(autoDeleteInterval);
      cleanupChannels();
    };
  }, [streamId, user?.id, cleanupChannels]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !profile) {
      toast.error('You must be logged in to send messages.');
      return;
    }
    if (!content.trim()) return;

    const now = Date.now()
    const chatThrottle = chatSendThrottleRef.current
    if (now - chatThrottle.lastTime > 1000) {
      chatThrottle.lastTime = now
      chatThrottle.count = 0
    }
    chatThrottle.count += 1
    if (chatThrottle.count > 8) {
      toast.error('You are sending messages too fast. Please slow down.')
      return
    }

    if (hostChatDisabledByOfficer) {
      toast.error(
        hostChatDisableRemainingMs
          ? `Chat is disabled for this broadcaster by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
          : 'Chat is disabled for this broadcaster by officer control'
      );
      return;
    }
    if (userChatDisabled) {
      toast.error(`Your chat is disabled.${chatDisabledRemainingMinutes ? ` Try again in ${chatDisabledRemainingMinutes} minute(s).` : ''}`);
      return;
    }

    // Subscriber-only chat enforcement
    if (!canChat) {
      toast.error('Subscriber-only chat — subscribe to the broadcaster to chat in this stream.');
      return;
    }

    const canBypassModeration = isHost || isStaffProfile(profile);
    if (!canBypassModeration) {
      // Canonical moderation check
      const modResult = await moderation.checkContent(user.id, content, 'chat');
      if (!modResult.allowed) {
        toast.error(modResult.message || 'That message violates Mai Troll\'s chat rules and was not sent.');
        return;
      }
    }

    setIsSendingMessage(true);

    const txnId = generateUUID();
    const optimisticMessage: Message = {
      id: `temp-${txnId}`,
      user_id: user.id,
      content,
      created_at: new Date().toISOString(),
      type: 'chat',
      user_profiles: {
        username: getDisplayName(profile),
        display_name: (profile as any).display_name,
        email: (profile as any).email,
        avatar_url: profile.avatar_url,
        role: profile.role,
        troll_role: profile.troll_role,
        created_at: profile.created_at,
        rgb_username_expires_at: profile.rgb_username_expires_at,
        glowing_username_color: profile.glowing_username_color
      }
    };

    setMessages(prev => {
      const updated = [...prev, optimisticMessage];
      if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
      return updated;
    });

    processedMessageIds.current.add(txnId);

    let parsedBody: any;
    try {
      const result = await sendChatThroughGate({ streamId, content })
      parsedBody = result.envelope
      if (!result.ok) {
        throw new Error(result.error || 'Failed to send message')
      }

      const chatChannel = channelsRef.current[0];
      if (chatChannel) {
        chatChannel.send({
          type: 'broadcast',
          event: 'chat',
          payload: optimisticMessage
        }).catch(err => {
          console.warn('[useStreamChat] Broadcast send failed:', err);
        });
      }

      trackChatMessage();

      } catch (err: any) {
      console.error('Error sending message:', err);
      const errMsg = String(err.message || '').toLowerCase();
      if (errMsg.includes('rate limit')) {
        toast.error('You are sending messages too fast. Please slow down.');
      } else if (errMsg.includes('currently disabled') || (errMsg.includes('chat') && errMsg.includes('disabled'))) {
        toast.error('Your chat is currently disabled.');
      } else if (parsedBody?.error) {
        toast.error(parsedBody.error);
      } else {
        toast.error('Failed to send message: ' + err.message);
      }
      setMessages(prev => prev.filter(m => m.id !== `temp-${txnId}`));
    } finally {
      setIsSendingMessage(false);
    }
  }, [user, profile, streamId, hostChatDisabledByOfficer, hostChatDisableRemainingMs, userChatDisabled, chatDisabledRemainingMinutes]);

  return {
    messages: messages.filter(msg => {
      return msg.type === 'chat' || msg.type === 'system';
    }),
    sendMessage,
    hostChatDisabledByOfficer,
    userChatDisabled,
    chatDisabledRemainingMinutes,
    streamMods: [],
    isSendingMessage,
    subscriberOnlyChat,
    isSubscriber,
    canChat,
  };
};
