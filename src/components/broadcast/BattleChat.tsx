import React, { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { isStaffProfile } from '../../lib/staff';
import useTrollFamilyActivity from '../../hooks/useTrollFamilyActivity';
import ModActionsPopup from './ModActionsPopup';
import { toast } from 'sonner';

import { Send, Swords, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { moderation } from '@/services/maitrollModeration';
import MaiVoiceComposerActions from './MaiVoiceComposerActions';
import MaiVoiceMessageStrip from './MaiVoiceMessageStrip';
import MaiVoicePlayer from './MaiVoicePlayer';
import MaiVoiceSettingsPanel from './MaiVoiceSettingsPanel';
import { useMaiVoiceRoom } from '../../hooks/useMaiVoiceRoom';
import { useMaiVoicePublisher } from '../../hooks/useMaiVoicePublisher';
import { maiVoiceInvoke, moderateMaiVoiceMessage } from '../../lib/maiVoice';

interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  avatar_url?: string;
}

interface StreamInfo {
  id: string;
  title: string;
  user_id: string;
}

interface BattleChatProps {
  battleId: string;
  challengerStream: StreamInfo;
  opponentStream: StreamInfo;
  currentStreamId: string;
  currentUserId?: string;
  participantRole?: string | null;
}

export default function BattleChat({ 
  battleId, 
  challengerStream, 
  opponentStream, 
  currentStreamId,
  currentUserId,
  participantRole: _participantRole 
}: BattleChatProps) {
   const [messages, setMessages] = useState<ChatMessage[]>([]);
   const [nowMs, setNowMs] = useState(Date.now());
   const [newMessage, setNewMessage] = useState('');
   const { profile } = useAuthStore();
   const { recordChatMessage } = useTrollFamilyActivity();
   const isOfficer = isStaffProfile(profile);
   const [showModActions, setShowModActions] = useState(false);
   const [modActionTargetUser, setModActionTargetUser] = useState<{ id: string; username: string; avatar_url?: string; role?: string; troll_role?: string } | null>(null);
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const channelRef = useRef<any>(null);
   const [sending, setSending] = useState(false);

   // Mai Voice — both battle sides share one room, so everyone hears the same
   // spoken chat and the same recorded voice messages.
  const maiVoice = useMaiVoiceRoom({
    roomKind: 'battle',
    roomId: battleId,
  });
  const [showMaiVoiceSettings, setShowMaiVoiceSettings] = useState(false);
  // Both sides own the battle room, the server accepts either broadcaster.
  const canManageMaiVoiceRoom = Boolean(
    currentUserId &&
      (challengerStream.user_id === currentUserId || opponentStream.user_id === currentUserId),
  );

   // The battle broadcaster publishes the generated speech into the battle room.
   useMaiVoicePublisher({
     roomKind: 'battle',
     roomId: battleId,
     livekitRoomName: maiVoice.livekitRoomName,
     userId: currentUserId || null,
     enabled: maiVoice.canPublishVoice && (maiVoice.ttsEnabled || maiVoice.voiceChatEnabled),
   });

   const handleReportVoiceMessage = useCallback(async (messageId: string) => {
     const result = await moderateMaiVoiceMessage(messageId, 'report', 'Inappropriate voice message');
     if (!result.ok) {
       toast.error(result.error);
       return;
     }
     toast.success('Thanks — the voice message was reported for review.');
   }, []);
   const profileUsername =
     (profile as any)?.username?.trim() ||
     (profile as any)?.display_name?.trim() ||
     null;
    const profileCacheRef = useRef<Record<string, any>>({});
   // Determine which team the current user is on
   const getUserTeam = (userId: string) => {
     if (userId === challengerStream.user_id) return 'challenger';
     if (userId === opponentStream.user_id) return 'opponent';
     return 'viewer';
   };

   const normalizeMessage = useCallback((raw: any, profiles: Record<string, any>): ChatMessage => {
    const profile = profiles[raw.user_id];
    const rawUsername = raw.username || profile?.username || '';
    const isPlaceholder = rawUsername === 'You' || rawUsername === 'Unknown';
    const resolvedUsername =
      rawUsername && !isPlaceholder
        ? rawUsername
        : (raw.user_id === currentUserId && profileUsername)
          ? profileUsername
          : rawUsername || 'Troll Citizen';

    return {
      id: raw.id,
      stream_id: raw.stream_id,
      user_id: raw.user_id,
      username: resolvedUsername,
      content: raw.content,
      created_at: raw.created_at,
      avatar_url: raw.avatar_url || profile?.avatar_url || undefined,
    };
  }, [currentUserId, profileUsername]);

  const openUserActions = async (targetUserId: string, targetUsername: string) => {
    if (!isOfficer || !targetUserId) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('username, avatar_url, role, troll_role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('[BattleChat] Failed to fetch user profile for actions:', error);
      setModActionTargetUser({ id: targetUserId, username: targetUsername || 'User' });
    } else {
      setModActionTargetUser({
        id: targetUserId,
        username: data?.username || targetUsername || 'User',
        avatar_url: data?.avatar_url || undefined,
        role: data?.role || undefined,
        troll_role: data?.troll_role || undefined,
      });
    }

    setShowModActions(true);
  };

  // Fetch existing messages from challenger stream only (shared battle chat)
  useEffect(() => {
    const fetchMessages = async () => {
      // First, fetch messages only (no join)
      const { data: messages, error } = await supabase
        .from('stream_chat')
        .select('id, stream_id, user_id, username, content, created_at, avatar_url')
        .eq('stream_id', challengerStream.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching battle chat:', error);
        return;
      }

      if (!messages || messages.length === 0) {
        setMessages([]);
        return;
      }

      // Extract unique user IDs
      const userIds = Array.from(new Set((messages as any[]).map((m: any) => m.user_id).filter(Boolean)));

      // Fetch user profiles separately
      let profiles: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        if (profileData) {
          profiles = profileData.reduce((acc, p: any) => {
            acc[p.id] = p;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Update profile cache ref
      profileCacheRef.current = { ...profileCacheRef.current, ...profiles };

      // Hydrate messages with profile data
      const hydratedMessages = (messages as any[]).map((msg: any) => normalizeMessage(msg, profiles));
      setMessages(hydratedMessages.reverse());
    };

    fetchMessages();
  }, [challengerStream.id, normalizeMessage]);

// Subscribe to the shared battle chat stream and its low-latency broadcast.
  useEffect(() => {
    // Use challenger stream as the primary chat stream (both sides share this)
    const primaryStreamId = challengerStream.id;
    
    channelRef.current = supabase
      .channel(`battle-chat:${battleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_chat',
          filter: `stream_id=eq.${primaryStreamId}`,
        },
        async (payload) => {
          if (import.meta.env.DEV) {
            console.log('[BattleChat] Received postgres chat message:', payload);
          }
          
          const newMsgRaw = payload.new;
          
          // Try to get profile from cache, or fetch if missing
          let profile = profileCacheRef.current[newMsgRaw.user_id];
          if (!profile && newMsgRaw.user_id) {
            try {
              const { data } = await supabase
                .from('user_profiles')
                .select('id, username, avatar_url')
                .eq('id', newMsgRaw.user_id)
                .maybeSingle();
              if (data) {
                profileCacheRef.current = { ...profileCacheRef.current, [data.id]: data };
                profile = data;
              }
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn('[BattleChat] Failed to fetch profile for new message:', e);
              }
            }
          }
          
          const newMsg = normalizeMessage(newMsgRaw, profile ? { [newMsgRaw.user_id]: profile } : {});
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev.slice(-49), newMsg];
          });
        }
      )
      // Also listen for broadcast chat events (for real-time delivery)
      .on('broadcast', { event: 'chat_message' }, async (payload) => {
        if (import.meta.env.DEV) {
          console.log('[BattleChat] Received broadcast chat message:', payload);
        }
        
        const newMsgRaw = payload.payload;
        
        // Try to get profile from cache, or fetch if missing
        let profile = profileCacheRef.current[newMsgRaw.user_id];
        if (!profile && newMsgRaw.user_id) {
          try {
            const { data } = await supabase
              .from('user_profiles')
              .select('id, username, avatar_url')
              .eq('id', newMsgRaw.user_id)
              .maybeSingle();
            if (data) {
              profileCacheRef.current = { ...profileCacheRef.current, [data.id]: data };
              profile = data;
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn('[BattleChat] Failed to fetch profile for broadcast message:', e);
            }
          }
        }
        
        const newMsg = normalizeMessage(newMsgRaw, profile ? { [newMsgRaw.user_id]: profile } : {});
        if (newMsg && newMsg.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev.slice(-49), newMsg];
          });
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [battleId, challengerStream.id, normalizeMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-hide older chat bubbles (battle overlay style like live chat).
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !currentUserId || sending) return;
    setSending(true);

    try {
      if (!isOfficer) {
        const modResult = await moderation.checkContent(currentUserId, content, 'battle_chat');
        if (!modResult.allowed) {
          toast.error(modResult.message || 'That message violates Mai Troll\'s chat rules and was not sent.');
          return;
        }
      }

      const existingMessage = messages.find(m => m.user_id === currentUserId);
      const existingUsername =
        existingMessage?.username && existingMessage.username !== 'You' && existingMessage.username !== 'Unknown'
          ? existingMessage.username
          : null;
      const senderUsername = profileUsername || existingUsername || 'Troll Citizen';

      const { data: inserted, error } = await supabase
        .from('stream_chat')
        .insert({
          stream_id: challengerStream.id,
          user_id: currentUserId,
          username: senderUsername,
          content,
        })
        .select('id, stream_id, user_id, username, content, created_at, avatar_url')
        .single();

      if (error) throw error;

      const message = normalizeMessage(inserted, {});
      setMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev.slice(-49), message]
      );
      setNewMessage('');
      try {
        const broadcastStatus = await channelRef.current?.send({
          type: 'broadcast',
          event: 'chat_message',
          payload: inserted,
        });
        if (broadcastStatus && broadcastStatus !== 'ok') {
          console.warn('[BattleChat] Realtime broadcast failed; message is saved:', broadcastStatus);
        }
      } catch (broadcastError) {
        console.warn('[BattleChat] Realtime broadcast failed; message is saved:', broadcastError);
      }

      void maiVoiceInvoke({
        action: 'enqueue-tts',
        roomKind: 'battle',
        roomId: battleId,
        sourceMessageId: inserted.id,
        text: content,
        presentation: 'chat',
      }).catch(() => undefined);

      try {
        await recordChatMessage(content.length, battleId);
      } catch (activityError) {
        console.error('[BattleChat] Failed to record chat activity:', activityError);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const visibleMessages = messages.filter((msg) => {
    const ts = new Date(msg.created_at).getTime();
    return Number.isFinite(ts) && nowMs - ts < 12000;
  });

  return (
    <div className="h-full flex flex-col bg-gradient-to-t from-black/90 via-black/70 to-transparent">
      {/* Battle Chat Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/60 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <Swords size={14} className="text-amber-500" />
          <span className="text-xs font-bold text-white">Battle Chat</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-purple-400">{challengerStream.title}</span>
          <span className="text-zinc-500">vs</span>
          <span className="text-emerald-400">{opponentStream.title}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => {
            const team = getUserTeam(msg.user_id);
            const isCurrentUser = msg.user_id === currentUserId;
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                    isCurrentUser
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-br-sm'
                      : team === 'opponent'
                      ? 'bg-gradient-to-r from-emerald-600/80 to-emerald-500/80 text-white rounded-bl-sm'
                      : 'bg-gradient-to-r from-purple-600/80 to-purple-500/80 text-white rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {isOfficer ? (
                      <button
                        type="button"
                        onClick={() => openUserActions(msg.user_id, msg.username)}
                        className="text-[10px] font-bold opacity-90 underline decoration-amber-400/50 hover:text-amber-300 transition-colors"
                      >
                        {msg.username}
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold opacity-90">{msg.username}</span>
                    )}
                    {team === 'challenger' && (
                      <span className="text-[8px] bg-purple-500/50 px-1 rounded">A</span>
                    )}
                    {team === 'opponent' && (
                      <span className="text-[8px] bg-emerald-500/50 px-1 rounded">B</span>
                    )}
                  </div>
                  <p className="text-sm leading-tight">{msg.content}</p>
                </div>
                <span className="text-[9px] text-zinc-500 mt-0.5 px-1">
                  {formatTime(msg.created_at)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ModActionsPopup
        isOpen={showModActions}
        onClose={() => {
          setShowModActions(false);
          setModActionTargetUser(null);
        }}
        targetUser={modActionTargetUser as any}
        targetUsername={modActionTargetUser?.username || ''}
        targetUserId={modActionTargetUser?.id || ''}
        streamId={currentStreamId}
        hostId={currentStreamId === challengerStream.id ? challengerStream.user_id : opponentStream.user_id}
        currentUserId={currentUserId}
      />

      <form onSubmit={sendMessage} className="p-2 bg-black/60 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-2 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black transition"
          >
            <Send size={18} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MaiVoiceComposerActions
            roomKind="battle"
            roomId={battleId}
            myOptIn={maiVoice.myOptIn}
            onToggleOptIn={maiVoice.setMyOptIn}
            voiceChatEnabled={maiVoice.voiceChatEnabled}
            ttsEnabled={maiVoice.ttsEnabled}
            canManageRoom={canManageMaiVoiceRoom}
            onOpenRoomControls={() => setShowMaiVoiceSettings(true)}
          />
          {canManageMaiVoiceRoom && (
            <button
              type="button"
              onClick={() => setShowMaiVoiceSettings(true)}
              title="Mai Voice controls for this battle"
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:text-yellow-300 hover:bg-white/5"
            >
              <SlidersHorizontal size={13} />
              Mai Voice
            </button>
          )}
        </div>
      </form>

      <MaiVoiceMessageStrip
        messages={maiVoice.voiceMessages}
        removedMessageIds={maiVoice.removedMessageIds}
        onReport={handleReportVoiceMessage}
      />

      <MaiVoicePlayer
        pendingClips={maiVoice.pendingClips}
        activeClip={maiVoice.activeClip}
        volume={maiVoice.settings?.playback_volume ?? 1}
        paused={maiVoice.playbackPaused}
        onBegin={maiVoice.beginClip}
        onComplete={maiVoice.completeClip}
      />

      {showMaiVoiceSettings && (
        <MaiVoiceSettingsPanel
          roomKind="battle"
          roomId={battleId}
          settings={maiVoice.settings}
          onClose={() => setShowMaiVoiceSettings(false)}
          onChanged={() => void maiVoice.refresh()}
        />
      )}
    </div>
  );
}
