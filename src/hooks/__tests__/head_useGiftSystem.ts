import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, getSystemSettings } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { generateUUID } from '../lib/uuid';
import { OFFICIAL_GIFTS } from '../lib/giftConstants';
import { notifyGiftReceived } from '../lib/notifications';
import { useMissionProgress } from './useMissionProgress';
import useTrollFamilyActivity from './useTrollFamilyActivity';
import { TROLLMOND_CASHBACK_ENABLED } from '../config/featureFlags';
import { createCityActivityEvent } from '../lib/events/createCityActivityEvent';
import { queueSideEffect } from '../lib/events/queueSideEffects';
import { isBroadcastChatLockActive } from '../lib/broadcastModeration';
import { unlockGiftAudio } from '../components/broadcast/GiftVideoOverlay';

type GiftBroadcastChannel = ReturnType<typeof supabase.channel>;

type GiftChannelEntry = {
  giftChannel: GiftBroadcastChannel;
  chatChannel: GiftBroadcastChannel;
  refs: number;
  subscribed: boolean;
};

const stableEmptyGiftState = Object.freeze({
  sendGift: async () => false,
  isSending: false,
});

const giftChannelManager = {
  streams: new Map<string, GiftChannelEntry>(),

  acquire(streamId: string) {
    const existing = this.streams.get(streamId);
    if (existing) {
      existing.refs += 1;
      return existing;
    }

    const entry: GiftChannelEntry = {
      giftChannel: supabase.channel(`stream-gifts:${streamId}`, {
        config: { presence: { key: null } },
      }),
      chatChannel: supabase.channel(`stream:${streamId}`),
      refs: 1,
      subscribed: false,
    };

    entry.giftChannel.subscribe();
    entry.chatChannel.subscribe();
    entry.subscribed = true;
    this.streams.set(streamId, entry);

    if (import.meta.env.DEV) {
      const debugCounters = (window as any).DEBUG_COUNTERS;
      if (debugCounters) {
        debugCounters.supabaseChannelCreatedCount = (debugCounters.supabaseChannelCreatedCount || 0) + 2;
        debugCounters.supabaseChannelActiveCount = (debugCounters.supabaseChannelActiveCount || 0) + 2;
        debugCounters.supabaseChannelCreatedMap?.set?.(`stream-gifts:${streamId}`, (debugCounters.supabaseChannelCreatedMap.get(`stream-gifts:${streamId}`) || 0) + 1);
        debugCounters.supabaseChannelCreatedMap?.set?.(`stream:${streamId}`, (debugCounters.supabaseChannelCreatedMap.get(`stream:${streamId}`) || 0) + 1);
      }
      console.debug('[GiftSystem] Created singleton gift channels', { streamId });
    }

    return entry;
  },

  release(streamId: string) {
    const entry = this.streams.get(streamId);
    if (!entry) return;

    entry.refs -= 1;
    if (entry.refs > 0) return;

    this.streams.delete(streamId);
    if (entry.giftChannel) {
      supabase.removeChannel(entry.giftChannel);
    }
    if (entry.chatChannel) {
      supabase.removeChannel(entry.chatChannel);
    }

    if (import.meta.env.DEV) {
      const debugCounters = (window as any).DEBUG_COUNTERS;
      if (debugCounters) {
        debugCounters.supabaseChannelRemovedCount = (debugCounters.supabaseChannelRemovedCount || 0) + 2;
        debugCounters.supabaseChannelActiveCount = Math.max(0, (debugCounters.supabaseChannelActiveCount || 0) - 2);
        debugCounters.supabaseChannelCleanupMap?.set?.(`stream-gifts:${streamId}`, (debugCounters.supabaseChannelCleanupMap.get(`stream-gifts:${streamId}`) || 0) + 1);
        debugCounters.supabaseChannelCleanupMap?.set?.(`stream:${streamId}`, (debugCounters.supabaseChannelCleanupMap.get(`stream:${streamId}`) || 0) + 1);
      }
      console.debug('[GiftSystem] Released singleton gift channels', { streamId });
    }
  },
};

export async function quietRefreshGiftProfile(userId: string) {
  const authStore = useAuthStore.getState();
  const currentProfile = authStore.profile;

  try {
    const [{ data: profileRow }, { data: levelRow }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_stats').select('level, xp_total, xp_to_next_level').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileRow) {
      authStore.setProfile({
        ...currentProfile,
        ...profileRow,
        level: levelRow?.level ?? profileRow.level ?? currentProfile?.level ?? 1,
        xp: levelRow?.xp_total ?? profileRow.xp ?? currentProfile?.xp ?? 0,
        total_xp: levelRow?.xp_total ?? profileRow.total_xp ?? currentProfile?.total_xp ?? 0,
        next_level_xp: levelRow?.xp_to_next_level ?? profileRow.next_level_xp ?? currentProfile?.next_level_xp,
      } as any);
    }
  } catch (err) {
    console.warn('[GiftSystem] Quiet profile refresh failed:', err);
  }
}

// Calculate discount based on trollmonds balance
// 10% discount per 100 trollmonds (e.g., 200 trollmonds = 20% off)
export function getTrollmondDiscount(trollmonds: number): number {
  // Every 100 trollmonds gives 10% discount
  const discountPercent = Math.floor(trollmonds / 100) * 10;
  // Cap at 100%
  return Math.min(discountPercent, 100);
}

// Calculate how many trollmonds will be deducted per gift
export function getTrollmondDeduction(trollmonds: number): number {
  // 100 trollmonds deducted per gift sent (regardless of gift size)
  return trollmonds >= 100 ? 100 : 0;
}

// Calculate discounted price
export function getDiscountedPrice(basePrice: number, discountPercent: number): number {
  return Math.floor(basePrice * (1 - discountPercent / 100));
}

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  coinCost: number;
  type: 'paid' | 'free';
  slug: string;
  animationKey?: string;
  animationType?: string;
  animationUrl?: string;
  animationDurationMs?: number;
  soundUrl?: string;
  isFullscreen?: boolean;
  rarity?: string;
  trayVisualUrl?: string;
  trayGradient?: string;
  description?: string;
}

export function useGiftSystem(
  recipientId: string, 
  streamId: string, 
  _battleId?: string | null,
  _targetUserId?: string,
  sharedChannel?: any,  // Optional shared channel for broadcasting
) {
  const hasStreamId = !!streamId;

  const [isSending, setIsSending] = useState(false);
  const [giftsDisabled, setGiftsDisabled] = useState(false);
  const [giftsDisabledReason, setGiftsDisabledReason] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { trackGiftSent } = useMissionProgress(streamId || '');
  const { recordGiftSent, recordGiftEarned } = useTrollFamilyActivity();

  // Simple client-side circuit breaker
  const circuitRef = useRef<{ openUntil: number }>({ openUntil: 0 });
  const initLoggedStreamRef = useRef<string | null>(null);
  
  const giftChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!hasStreamId || !import.meta.env.DEV || initLoggedStreamRef.current === streamId) return;

    initLoggedStreamRef.current = streamId;
    const debugCounters = (window as any).DEBUG_COUNTERS;
    if (debugCounters) {
      debugCounters.useGiftSystemInitCount = (debugCounters.useGiftSystemInitCount || 0) + 1;
    }
    console.log('[GiftSystem] useGiftSystem initialized', { hasSharedChannel: !!sharedChannel, streamId });
  }, [hasStreamId, sharedChannel, streamId]);

  useEffect(() => {
    if (!streamId) return;

    if (sharedChannel) {
      giftChannelRef.current = sharedChannel;
      chatChannelRef.current = sharedChannel;
      return () => {
        if (giftChannelRef.current === sharedChannel) giftChannelRef.current = null;
        if (chatChannelRef.current === sharedChannel) chatChannelRef.current = null;
      };
    }

    const streamChannels = giftChannelManager.acquire(streamId);
    const giftChannel = streamChannels.giftChannel;
    const chatChannel = streamChannels.chatChannel;

    giftChannelRef.current = giftChannel;
    chatChannelRef.current = chatChannel;

    return () => {
      if (giftChannelRef.current === giftChannel) giftChannelRef.current = null;
      if (chatChannelRef.current === chatChannel) chatChannelRef.current = null;
      giftChannelManager.release(streamId);
    };
  }, [streamId, sharedChannel]);

  useEffect(() => {
    getSystemSettings()
      .then((settings) => {
        setGiftsDisabled(!!settings?.gifts_disabled);
        setGiftsDisabledReason(settings?.gifts_disabled_reason || null);
      })
      .catch(() => {
        // ignore - don't block gifting on fetch failure
      });
  }, []);

interface SendGiftOptions {
  receiverId?: string;
  quantity?: number;
  battleId?: string | null;
}

const sendGift = useCallback(async (gift: GiftItem, options?: SendGiftOptions): Promise<boolean> => {
  const now = Date.now();
  const targetIdOverride = options?.receiverId;
  const quantity = options?.quantity ?? 1;
  const finalRecipientId = targetIdOverride || recipientId;
  const effectiveBattleId = options?.battleId ?? _battleId;

  await unlockGiftAudio();

  if (import.meta.env.DEV) {
    console.log('[GiftSystem] sendGift invoked', {
      senderId: user?.id || null,
      finalRecipientId,
      streamId,
      giftId: gift?.id,
      quantity,
      giftsDisabled,
      circuitOpen: circuitRef.current.openUntil > now,
    });
  }

    if (circuitRef.current.openUntil > now) {
      console.warn('[GiftSystem] sendGift blocked: circuit open');
      toast.error('Gifting is temporarily paused. Please try again shortly.');
      return false;
    }

    if (giftsDisabled) {
      console.warn('[GiftSystem] sendGift blocked: gifts disabled', { reason: giftsDisabledReason });
      toast.error(giftsDisabledReason || 'Gifting is temporarily disabled.');
      return false;
    }

    if (!user) {
      console.warn('[GiftSystem] sendGift blocked: no authenticated user');
      toast.error("You must be logged in to send gifts");
      return false;
    }

    // For logged-in users, check if sending to themselves
    // For guests (no user), they can't send gifts anyway, but we check to be safe
    if (user && user.id === finalRecipientId) {
      console.warn('[GiftSystem] sendGift blocked: self-send attempted', {
        userId: user.id,
        finalRecipientId,
        streamId,
      });
      toast.error("You cannot send gifts to yourself");
      return false;
    }

    // ── Chat-disabled guards – mirror BroadcastChat.tsx ──────────────────
    // Only applies in a live-stream context (has streamId)
    if (streamId && user) {
      // 1. Moderator block on the current user
      const { data: blocked } = await supabase.rpc('is_user_chat_blocked', {
        p_user_id: user.id,
        p_stream_id: streamId,
      });
      if (blocked) {
        console.warn('[GiftSystem] sendGift blocked: user chat-blocked by moderation');
        toast.error('Your chat is disabled by moderation action.');
        return false;
      }

// 2. Host officer-level broadcast_chat_disabled
       // Note: The streams table uses user_id as the broadcaster/owner column
       const { data: streamRow } = await supabase
         .from('streams')
         .select('user_id')
         .eq('id', streamId)
         .maybeSingle();

       const hostId = streamRow?.user_id;
      if (hostId && user.id !== hostId) {
         const { data: hostProfile } = await supabase
           .from('user_profiles')
           .select('broadcast_chat_disabled, broadcast_chat_disabled_until, broadcast_chat_disabled_stream_id')
           .eq('id', hostId)
           .maybeSingle();

         if (isBroadcastChatLockActive({
           disabled: hostProfile?.broadcast_chat_disabled,
           until: hostProfile?.broadcast_chat_disabled_until,
           streamId,
           lockedStreamId: hostProfile?.broadcast_chat_disabled_stream_id,
         })) {
          console.warn('[GiftSystem] sendGift blocked: hostChatDisabledByOfficer', { hostId, streamId });
          toast.error('Chat is disabled for this broadcaster by officer control');
          return false;
        }
      }
    }

    // Guests cannot send gifts - they need to be logged in
    if (!user) {
      console.warn('[GiftSystem] sendGift blocked: no user after recipient resolution');
      toast.error("You must be logged in to send gifts");
      return false;
    }

    setIsSending(true);

    try {
      const txnKey = `${user.id}_${streamId}_${gift.id}_${Date.now()}`;
      
      if (import.meta.env.DEV) console.log('[GiftDebugger-2] Sending gift...', {
        sender: user.id,
        receiver: finalRecipientId,
        streamId: streamId || null,
        giftId: gift.id,
        cost: gift.coinCost,
        quantity,
        txnKey
      });

       // Now send the gift via the appropriate RPC
       
       const totalGiftAmount = gift.coinCost * quantity;

       if (import.meta.env.DEV) console.log('[useGiftSystem] About to call send_gift_in_stream RPC', {
         p_sender_id: user.id,
         p_receiver_id: finalRecipientId,
         p_stream_id: streamId || null,
         p_gift_id: gift.id,
         p_quantity: quantity,
         p_metadata: { txn_key: txnKey, trollmond_coins_back_enabled: TROLLMOND_CASHBACK_ENABLED },
         finalGiftCoinAmount: totalGiftAmount
       });

        console.log('[GiftSystem] RPC call:', {
          p_sender_id: user.id,
          p_receiver_id: finalRecipientId,
          p_stream_id: streamId || null,
          p_battle_id: effectiveBattleId || undefined,
        });
       // conditional trollmond deduction (>= 100 coin gifts deduct 100 trollmonds per gift)
        const result = await supabase.rpc('send_gift_in_stream', {
          p_sender_id: user.id,
          p_receiver_id: finalRecipientId,
          p_stream_id: streamId || null,
          p_gift_id: gift.id,
          p_quantity: quantity,
          p_metadata: { txn_key: txnKey, trollmond_coins_back_enabled: TROLLMOND_CASHBACK_ENABLED, battle_id: effectiveBattleId || undefined }
        });
        const { data, error } = result;

       console.log('[GiftDebugger-2] RPC Result:', { data, error });

      if (error) throw error;

      if (data && data.success) {
        // Record family activity for gift sent/earned
        const giftCoins = gift.coinCost * quantity;
        try {
          // Record gift sent by the sender
          await recordGiftSent(giftCoins, finalRecipientId, streamId || undefined, gift.id);
          
          // Record gift earned by the receiver (only if not self-send)
          if (finalRecipientId !== user?.id) {
            await recordGiftEarned(giftCoins, streamId || undefined, gift.id, user?.id);
          }
        } catch (recordErr) {
          console.warn('[GiftSystem] Failed to record family activity:', recordErr);
          // Don't fail the gift transaction if recording fails
        }

        // ── Battle score realtime broadcast ────────────────────────────────
        // When a gift is sent during a battle, the RPC updates the battle score
        // in the database. We broadcast a score_update on the battle channel so
        // all participants get the new score immediately — no DB round-trip.
        if (effectiveBattleId && data?.success) {
          try {
            // Determine which team this gift was sent to so we can
            // optimistically increment the correct side without a DB read.
            // streamId maps to the team the gift was sent to.
            const senderName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Someone';

            // Fetch current scores once, then compute optimistically
            const { data: battleData } = await supabase
              .from('battles')
              .select('score_challenger, score_opponent')
              .eq('id', effectiveBattleId)
              .maybeSingle();

            if (battleData) {
              const newChallenger = battleData.score_challenger ?? 0;
              const newOpponent = battleData.score_opponent ?? 0;

              // 1) Broadcast to all viewers on the battle channel
              const battleCh = supabase.channel(`battle-all:${effectiveBattleId}`);
              await battleCh.subscribe();
              await battleCh.send({
                type: 'broadcast',
                event: 'score_update',
                payload: {
                  score_challenger: newChallenger,
                  score_opponent: newOpponent,
                  lastGift: {
                    username: senderName,
                    amount: totalGiftAmount,
                    team: streamId || '',
                  },
                },
              });
               setTimeout(() => { if (battleCh) supabase.removeChannel(battleCh) }, 1000);

              // 2) Dispatch a local event so the SENDER's own UI updates
              // instantly without waiting for the 3-second poll.
              window.dispatchEvent(new CustomEvent('battle-score-optimistic', {
                detail: {
                  battleId: effectiveBattleId,
                  score_challenger: newChallenger,
                  score_opponent: newOpponent,
                  lastGift: {
                    username: senderName,
                    amount: totalGiftAmount,
                    team: streamId || '',
                  },
                },
              }));
            }
          } catch (battleBroadcastErr) {
            console.warn('[GiftSystem] Failed to broadcast battle score update:', battleBroadcastErr);
          }
        }

        // Get sender's profile for username
        let senderName = 'Someone';
        try {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('username, display_name, email')
            .eq('id', user.id)
            .maybeSingle();
          senderName = profileData?.username || profileData?.display_name || profileData?.email?.split('@')?.[0] || senderName;
        } catch (profileErr) {
          console.warn('[GiftSystem] Could not fetch sender profile:', profileErr);
        }
        
        // Get gift icon - try multiple lookups to find the correct icon
        let giftIcon = '🎁';
        const officialGiftById = OFFICIAL_GIFTS.find(g => g.id === gift.id);
        const officialGiftBySlug = OFFICIAL_GIFTS.find(g => 
          g.id.toLowerCase().replace(/_/g, '-') === gift.slug?.toLowerCase() ||
          g.id.toLowerCase() === gift.slug?.toLowerCase().replace(/-/g, '_')
        );
        const officialGift = officialGiftById || officialGiftBySlug;
        if (officialGift) {
          giftIcon = officialGift.icon;
        } else if (gift.icon) {
          giftIcon = gift.icon;
        }
        
        // Broadcast event for animations via Supabase realtime channel
        if (import.meta.env.DEV) {
          console.log('[GiftSystem] Broadcasting gift event');
        }
        try {
          if (streamId) {
            const payload = {
              id: data.transaction_id || generateUUID(),
              gift_id: gift.id,
              gift_slug: gift.slug,
              gift_name: gift.name,
              gift_icon: giftIcon,
              animation_type: gift.animationType,
              amount: gift.coinCost * quantity,
              quantity: quantity,
              currency_used: data.currency_used,
              trollmonds_spent: data.trollmonds_spent || 0,
              trollmonds_transferred: data.trollmonds_transferred || 0,
              coins_back: data.coins_back || 0,
              sender_id: user.id,
              sender_name: senderName,
              receiver_id: finalRecipientId,
              timestamp: new Date().toISOString(),
              streamId: streamId,
              stream_id: streamId
            };
            
            await giftChannelRef.current?.send({
              type: 'broadcast',
              event: 'gift_sent',
              payload
            });

            window.dispatchEvent(new CustomEvent('broadcast-gift-level', {
              detail: {
                giftId: payload.id,
                broadcasterId: recipientId,
                receiverId: finalRecipientId,
                streamId,
                amount: payload.amount,
                timestamp: Date.now(),
              }
            }));

          }
        } catch (broadcastErr) {
          console.warn('[GiftSystem] Could not broadcast gift event:', broadcastErr);
        }
        
        // Also send a chat message via Supabase broadcast
        if (import.meta.env.DEV) {
          console.log('[GiftSystem] Gift chat broadcast', { streamId, hasSharedChannel: !!sharedChannel });
        }
        
        try {
          if (streamId) {
            const txnId = generateUUID();
            // Get recipient username for display in chat
            let receiverName = 'user';
            try {
              const { data: receiverProfile } = await supabase
                .from('user_profiles')
                .select('username, display_name, email')
                .eq('id', finalRecipientId)
                .maybeSingle();
              receiverName = receiverProfile?.username || receiverProfile?.display_name || receiverProfile?.email?.split('@')?.[0] || receiverName;
            } catch (recErr) {
              console.warn('[GiftSystem] Could not fetch receiver profile:', recErr);
            }
            
            // Use shared channel if available, otherwise create new one
            // This ensures the message goes to BroadcastChat
            const chatPayload = {
              id: txnId,
              txn_id: txnId,
              user_id: user.id,
              content: `GIFT_EVENT:${gift.slug}:${quantity}`,
              created_at: new Date().toISOString(),
              type: 'gift',
              gift_type: gift.slug,
              gift_amount: quantity,
              gift_value: data.gift_value || gift.coinCost * quantity,
              currency_used: data.currency_used,
              trollmonds_spent: data.trollmonds_spent || 0,
              trollmonds_transferred: data.trollmonds_transferred || 0,
              coins_back: data.coins_back || 0,
              sender_name: senderName,
              receiver_id: finalRecipientId,
              receiver_name: receiverName,
              user_profiles: {
                username: senderName,
                avatar_url: null
              }
            };
            
            const chatSender = sharedChannel || chatChannelRef.current
            await chatSender?.send({
              type: 'broadcast',
              event: 'chat-message',
              payload: chatPayload
            });
          }
        } catch (chatErr) {
          console.warn('[GiftSystem] Could not send chat message:', chatErr);
        }
        
        // Create notification for the receiver (if not sending to self)
        const totalCoins = gift.coinCost * quantity;
        if (finalRecipientId !== user.id) {
          queueSideEffect('gift-notification', () =>
            notifyGiftReceived(
              finalRecipientId,
              user.id,
              totalCoins,
              streamId || undefined
            )
          );
        }

        queueSideEffect('gift-city-event', () =>
          createCityActivityEvent({
            type: 'gift',
            title: `${senderName} sent ${gift.name}`,
            icon: 'GIFT',
            priority: totalCoins >= 10_000 ? 3 : totalCoins >= 2_000 ? 2 : 1,
            metadata: {
              stream_id: streamId || null,
              sender_id: user.id,
              receiver_id: finalRecipientId,
              gift_id: gift.id,
              gift_slug: gift.slug,
              amount: totalCoins,
              quantity,
              dedupe_key: `gift:${streamId || 'no-stream'}:${user.id}:${finalRecipientId}:${gift.id}:${data?.transaction_id || data?.id || Date.now()}`,
            },
          })
        );
        
        if (data.transaction_id) {
          queueSideEffect('gift-xp', async () => {
            await quietRefreshGiftProfile(user.id);
          });
        } else {
          void quietRefreshGiftProfile(user.id);
        }

        // NO manual insert into stream_gifts.
        // The ledger processor will handle history and stats.

        // Track mission progress
        if (streamId) {
          queueSideEffect('gift-mission-progress', () => trackGiftSent(totalCoins));
        }

        return true;
      } else {
        toast.error(data?.message || "Failed to send gift");
        return false;
      }

    } catch (err: any) {
      console.error("Gift error:", err);
      const msg = err?.message || "Transaction failed";
      if (String(msg).toLowerCase().includes('rate limit')) {
        toast.error('You are sending gifts too fast. Please slow down.');
      } else {
        toast.error(msg);
      }

      if (
        String(msg).toLowerCase().includes('timeout') ||
        String(msg).toLowerCase().includes('deadlock') ||
        String(msg).toLowerCase().includes('could not obtain lock')
      ) {
        circuitRef.current.openUntil = Date.now() + 60_000; // 60s cooldown
      }
      return false;
    } finally {
      setIsSending(false);
    }
  }, [
    giftsDisabled,
    giftsDisabledReason,
    recipientId,
    sharedChannel,
    streamId,
    trackGiftSent,
    user,
    recordGiftSent,
    recordGiftEarned,
  ]);

  if (!hasStreamId) {
    return stableEmptyGiftState;
  }

  return {
    sendGift,
    isSending
  };
}

