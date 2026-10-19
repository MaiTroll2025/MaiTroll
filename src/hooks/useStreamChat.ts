import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { generateUUID } from '../lib/uuid';
import { toast } from 'sonner';
import { useMissionProgress } from './useMissionProgress';
import { useChatBlockStatus } from './useChatBlockStatus';
import { isStaffProfile } from '../lib/staff';
import { getBroadcastChatLockRemainingMs, isBroadcastChatLockActive } from '../lib/broadcastModeration';
import { sendChatThroughGate, type SignedChatEnvelope } from '../lib/sendChatThroughGate';
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
const MAX_TRACKED_MESSAGE_IDS = MAX_MESSAGES * 2;
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

function isSignedChatEnvelope(value: unknown): value is SignedChatEnvelope {
  if (!value || typeof value !== 'object') return false
  const envelope = value as Record<string, unknown>
  return envelope.v === 1 &&
    typeof envelope.stream_id === 'string' &&
    typeof envelope.s === 'string' &&
    typeof envelope.txn_id === 'string' &&
    typeof envelope.message_id === 'string' &&
    typeof envelope.ts === 'number' &&
    !!envelope.d &&
    typeof envelope.d === 'object'
}

function normalizeSignedMessage(envelope: SignedChatEnvelope): Message {
  const data = envelope.d
  const asString = (value: unknown) => typeof value === 'string' ? value : undefined
  const username = asString(data.user_name) || 'Troll Citizen'
  const avatarUrl = asString(data.user_avatar) || ''
  const type: Message['type'] = envelope.t === 'gift'
    ? 'gift'
    : envelope.t === 'sys'
      ? 'system'
      : 'chat'

  return {
    id: envelope.message_id,
    txn_id: envelope.txn_id,
    user_id: envelope.s,
    content: asString(data.content) || asString(data.message) ||
      (type === 'gift'
        ? `GIFT_EVENT:${asString(data.gift_slug) || asString(data.gift_name) || 'gift'}:${Number(data.quantity || 1)}`
        : ''),
    created_at: new Date(envelope.ts).toISOString(),
    type,
    gift_type: asString(data.gift_slug) || asString(data.gift_name),
    gift_amount: Number(data.quantity || data.amount || 1),
    sender_name: username,
    user_name: username,
    user_avatar: avatarUrl,
    user_role: asString(data.user_role),
    user_troll_role: asString(data.user_troll_role),
    user_created_at: asString(data.user_created_at),
    user_rgb_expires_at: asString(data.user_rgb_expires_at),
    user_glowing_username_color: asString(data.user_glowing_username_color),
    user_profiles: {
      username,
      avatar_url: avatarUrl,
      role: asString(data.user_role),
      troll_role: asString(data.user_troll_role),
      created_at: asString(data.user_created_at),
      rgb_username_expires_at: asString(data.user_rgb_expires_at),
      glowing_username_color: asString(data.user_glowing_username_color),
    },
  }
}

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
  const [chatEligibility, setChatEligibility] = useState<{
    key: string
    loading: boolean
    subscriberOnly: boolean
    isSubscriber: boolean
    error: string | null
  }>({ key: '', loading: true, subscriberOnly: false, isSubscriber: false, error: null });
  const eligibilityKey = `${streamId}:${user?.id || 'anonymous'}`
  const eligibilityIsCurrent = chatEligibility.key === eligibilityKey
  const subscriberOnlyChat = eligibilityIsCurrent && chatEligibility.subscriberOnly
  const isSubscriber = eligibilityIsCurrent && chatEligibility.isSubscriber
  const isEligibilityLoading = !eligibilityIsCurrent || chatEligibility.loading
  const eligibilityError = eligibilityIsCurrent ? chatEligibility.error : null
  const isSendingRef = useRef(false)
  const streamIdRef = useRef(streamId)
  const userIdRef = useRef(user?.id)
  streamIdRef.current = streamId
  userIdRef.current = user?.id
  const { trackChatMessage } = useMissionProgress(streamId);

  useEffect(() => {
    let cancelled = false
    setChatEligibility({
      key: eligibilityKey,
      loading: true,
      subscriberOnly: false,
      isSubscriber: false,
      error: null,
    })

    const loadChatEligibility = async () => {
      if (!streamId || !hostId) {
        setChatEligibility({
          key: eligibilityKey,
          loading: false,
          subscriberOnly: false,
          isSubscriber: false,
          error: 'Stream chat settings are unavailable.',
        })
        return
      }

      try {
        const { data: stream, error: streamError } = await supabase
          .from('streams')
          .select('subscriber_only_chat, user_id')
          .eq('id', streamId)
          .maybeSingle()

        if (cancelled) return
        if (streamError || !stream?.user_id) {
          setChatEligibility({
            key: eligibilityKey,
            loading: false,
            subscriberOnly: false,
            isSubscriber: false,
            error: 'Could not verify stream chat settings.',
          })
          return
        }

        const subscriberOnly = Boolean(stream.subscriber_only_chat)
        let subscribed = user?.id === stream.user_id
        if (subscriberOnly && user?.id && !subscribed) {
          const { data: subscription, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('id')
            .eq('subscriber_id', user.id)
            .eq('broadcaster_id', stream.user_id)
            .eq('is_active', true)
            .maybeSingle()

          if (cancelled) return
          if (subscriptionError) {
            setChatEligibility({
              key: eligibilityKey,
              loading: false,
              subscriberOnly,
              isSubscriber: false,
              error: 'Could not verify your subscription.',
            })
            return
          }
          subscribed = Boolean(subscription)
        }

        setChatEligibility({
          key: eligibilityKey,
          loading: false,
          subscriberOnly,
          isSubscriber: subscribed,
          error: null,
        })
      } catch (error) {
        if (cancelled) return
        console.error('[useStreamChat] Chat eligibility check failed:', error)
        setChatEligibility({
          key: eligibilityKey,
          loading: false,
          subscriberOnly: false,
          isSubscriber: false,
          error: 'Could not verify chat access.',
        })
      }
    }

    void loadChatEligibility()
    return () => {
      cancelled = true
    }
  }, [streamId, hostId, user?.id, eligibilityKey])

  const canChat = useMemo(() => {
    if (!user) return false;
    if (isEligibilityLoading || eligibilityError) return false;
    if (isHost) return true;
    if (isStaffProfile(profile)) return true;
    if (subscriberOnlyChat && !isSubscriber) return false;
    return true;
  }, [user, isHost, profile, subscriberOnlyChat, isSubscriber, isEligibilityLoading, eligibilityError]);

  const processedMessageIds = useRef<Set<string>>(new Set());
  const joinedUsersRef = useRef<Set<string>>(new Set());
  const channelsRef = useRef<any[]>([]);
  const chatSendThrottleRef = useRef<{ lastTime: number; count: number }>({ lastTime: 0, count: 0 });
  const rememberMessageIds = useCallback((...ids: Array<string | undefined>) => {
    ids.forEach((id) => {
      if (id) processedMessageIds.current.add(id)
    })
    while (processedMessageIds.current.size > MAX_TRACKED_MESSAGE_IDS) {
      const oldest = processedMessageIds.current.values().next().value
      if (!oldest) break
      processedMessageIds.current.delete(oldest)
    }
  }, [])

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
    cleanupChannels();
    let active = true;
    processedMessageIds.current.clear();
    joinedUsersRef.current.clear();
    setMessages([]);

    if (!streamId) {
      return () => {
        active = false;
      };
    }

    const fetchMessages = async () => {
      const cutoff = new Date(Date.now() - MESSAGE_LIFETIME_MS).toISOString();
      const { data, error } = await supabase
        .from('stream_messages')
        .select('*, user_profiles(username, display_name, email, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color)')
        .eq('stream_id', streamId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!active) return;
      if (error) {
        console.error('[useStreamChat] Failed to load recent chat history:', error);
        return;
      }
      const processedMessages = (data || []).reverse().map((message: any): Message => {
        const userProfile = {
          username: message.user_name || getDisplayName(message.user_profiles),
          display_name: message.user_profiles?.display_name,
          email: message.user_profiles?.email,
          avatar_url: message.user_avatar || message.user_profiles?.avatar_url || '',
          role: message.user_role || message.user_profiles?.role,
          troll_role: message.user_troll_role || message.user_profiles?.troll_role,
          created_at: message.user_created_at || message.user_profiles?.created_at,
          rgb_username_expires_at: message.user_rgb_expires_at || message.user_profiles?.rgb_username_expires_at,
          glowing_username_color: message.user_glowing_username_color || message.user_profiles?.glowing_username_color,
        };
        rememberMessageIds(message.id, message.txn_id);
        return {
          ...message,
          type: message.type === 'gift' ? 'gift' : message.type === 'system' ? 'system' : 'chat',
          user_profiles: userProfile,
        } as Message;
      }).filter((message) =>
        Date.now() - new Date(message.created_at).getTime() < MESSAGE_LIFETIME_MS
      );

      setMessages((prev) => {
        const currentKeys = new Set(prev.flatMap((message) => [message.id, message.txn_id].filter(Boolean)));
        const merged = [
          ...processedMessages.filter((message) =>
            !currentKeys.has(message.id) && (!message.txn_id || !currentKeys.has(message.txn_id))
          ),
          ...prev,
        ];
        return merged
          .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
          .slice(-MAX_MESSAGES);
      });
    };

    const chatChannel = supabase
      .channel(`stream-chat:${streamId}`)
      .on(
        'broadcast',
        { event: 'chat' },
        (payload: any) => {
          if (!active) return;
          const incoming = payload.payload;
          const msg = isSignedChatEnvelope(incoming)
            ? normalizeSignedMessage(incoming)
            : incoming as Message;
          if (!msg?.user_id || !msg.content) return;
          if (msg.user_id === user?.id) return;
          if (msg.txn_id && processedMessageIds.current.has(msg.txn_id)) return;
          if (msg.id && processedMessageIds.current.has(msg.id)) return;
          rememberMessageIds(msg.txn_id, msg.id);

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
        if (!active) return;
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
        if (!active) return;
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void fetchMessages();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[useStreamChat] Realtime subscription failed: ${status}`);
        }
      });

    channelsRef.current = [chatChannel];

    const autoDeleteInterval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => prev.filter(msg => {
        const messageAge = now - new Date(msg.created_at).getTime();
        return messageAge < MESSAGE_LIFETIME_MS;
      }));
    }, AUTO_DELETE_INTERVAL);

    return () => {
      active = false;
      clearInterval(autoDeleteInterval);
      cleanupChannels();
    };
  }, [streamId, user?.id, cleanupChannels, rememberMessageIds]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !profile) {
      toast.error('You must be logged in to send messages.');
      return;
    }
    const normalizedContent = content.trim();
    if (!normalizedContent) return;
    if (isSendingRef.current) {
      toast.info('Please wait for the current message to finish sending.');
      return;
    }

    isSendingRef.current = true;
    setIsSendingMessage(true);
    const sendStreamId = streamId;
    let optimisticId: string | null = null;

    try {
      const now = Date.now();
      const chatThrottle = chatSendThrottleRef.current;
      if (now - chatThrottle.lastTime > 1000) {
        chatThrottle.lastTime = now;
        chatThrottle.count = 0;
      }
      chatThrottle.count += 1;
      if (chatThrottle.count > 8) {
        toast.error('You are sending messages too fast. Please slow down.');
        return;
      }

      if (normalizedContent.length > 280) {
        toast.error('Messages are limited to 280 characters.');
        return;
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
      if (isEligibilityLoading) {
        toast.info('Checking chat access. Please try again shortly.');
        return;
      }
      if (eligibilityError) {
        toast.error(eligibilityError);
        return;
      }
      if (!canChat) {
        toast.error('Subscriber-only chat — subscribe to the broadcaster to chat in this stream.');
        return;
      }

      if (!isHost && !isStaffProfile(profile)) {
        let moderationResult;
        try {
          moderationResult = await moderation.checkContent(user.id, normalizedContent, 'chat');
        } catch (error) {
          console.error('[useStreamChat] Client moderation check failed:', error);
          toast.error('Could not verify this message. Please try again.');
          return;
        }
        if (!moderationResult.allowed) {
          toast.error(moderationResult.message || 'That message violates Mai Troll\'s chat rules and was not sent.');
          return;
        }
      }

      const txnId = generateUUID();
      const optimisticMessage: Message = {
        id: `temp-${txnId}`,
        txn_id: txnId,
        user_id: user.id,
        content: normalizedContent,
        created_at: new Date().toISOString(),
        type: 'chat',
        user_profiles: {
          username: getDisplayName(profile),
          display_name: profile.display_name,
          email: profile.email,
          avatar_url: profile.avatar_url || '',
          role: profile.role,
          troll_role: profile.troll_role,
          created_at: profile.created_at,
          rgb_username_expires_at: profile.rgb_username_expires_at,
          glowing_username_color: profile.glowing_username_color
        }
      };
      optimisticId = optimisticMessage.id;
      rememberMessageIds(txnId);
      setMessages(prev => {
        const updated = [...prev, optimisticMessage];
        if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
        return updated;
      });

      const result = await sendChatThroughGate({
        streamId: sendStreamId,
        content: normalizedContent,
        txnId,
      });
      if (!result.ok || !result.envelope) {
        throw new Error(result.error || 'The chat service did not confirm the message.');
      }

      const canonicalMessage = normalizeSignedMessage(result.envelope);
      if (streamIdRef.current === sendStreamId && userIdRef.current === user.id) {
        rememberMessageIds(canonicalMessage.txn_id, canonicalMessage.id);
        setMessages(prev => prev.map(message =>
          message.id === optimisticId || message.txn_id === txnId
            ? canonicalMessage
            : message
        ));
        trackChatMessage();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errMsg = errorMessage.toLowerCase();
      if (errMsg.includes('rate limit')) {
        toast.error('You are sending messages too fast. Please slow down.');
      } else if (errMsg.includes('currently disabled') || (errMsg.includes('chat') && errMsg.includes('disabled'))) {
        toast.error('Your chat is currently disabled.');
      } else {
        toast.error(`Failed to send message: ${errorMessage}`);
      }
      if (optimisticId && streamIdRef.current === sendStreamId) {
        setMessages(prev => prev.filter(message => message.id !== optimisticId));
      }
    } finally {
      isSendingRef.current = false;
      setIsSendingMessage(false);
    }
  }, [
    user,
    profile,
    hostChatDisabledByOfficer,
    userChatDisabled,
    canChat,
    isHost,
    hostChatDisableRemainingMs,
    chatDisabledRemainingMinutes,
    isEligibilityLoading,
    eligibilityError,
    streamId,
    trackChatMessage,
    rememberMessageIds,
  ]);

  return {
    messages: messages.filter(msg => {
      return msg.type === 'chat' || msg.type === 'system' || msg.type === 'gift';
    }),
    sendMessage,
    hostChatDisabledByOfficer,
    userChatDisabled,
    chatDisabledRemainingMinutes,
    isSendingMessage,
    subscriberOnlyChat,
    isSubscriber,
    isEligibilityLoading,
    canChat,
  };
};
