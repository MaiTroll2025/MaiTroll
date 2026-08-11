/**
 * CourtViewerPage - Public Court Session Viewer
 *
 * Uses Agora to watch live Troll Court sessions.
 * Viewers see the same courtroom background and studio tiles.
 */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import {
  Scale,
  Eye,
  Heart,
  MessageSquare,
  X,
  Send,
  User,
  ArrowLeft,
  Volume2,
} from 'lucide-react';
import { generateUUID } from '@/lib/uuid';

interface CourtSession {
  id: string;
  status: string;
  judge_id?: string;
  defendant_id?: string;
  started_at?: string;
  created_at?: string;
  title?: string;
}

interface CourtParticipant {
  id: string;
  court_session_id: string;
  user_id: string;
  role: string;
  user_profiles?: { username: string; avatar_url: string } | Array<{ username: string; avatar_url: string }>;
}

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  content: string;
  created_at: string;
  type: 'chat' | 'system';
}

interface AgoraTrackUser {
  uid: string;
  videoTrack: IRemoteVideoTrack | null;
  audioTrack: IRemoteAudioTrack | null;
  username: string;
  role: string;
  isLocal: boolean;
}

const COURT_ROLES = [
  { key: 'judge', label: 'Judge' },
  { key: 'prosecutor', label: 'Prosecutor' },
  { key: 'attorney', label: 'Attorney' },
  { key: 'witness', label: 'Witness' },
  { key: 'defendant', label: 'Defendant' },
] as const;

type CourtRoleKey = (typeof COURT_ROLES)[number]['key'];

async function getAgoraCourtToken({
  channelName,
  uid,
  role,
}: {
  channelName: string
  uid: string
  role: 'publisher' | 'audience'
}): Promise<any> {
  const payload = {
    channelName,
    channel: channelName,
    uid,
    role,
    roomType: 'court',
  };

  const candidates = ['agora-token', 'agora-rtc-token', 'rtc-token'];

  for (const functionName of candidates) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      if (error) continue;

      if (data?.appId || import.meta.env.VITE_AGORA_APP_ID) {
        return {
          appId: data?.appId || import.meta.env.VITE_AGORA_APP_ID,
          token: data?.token ?? null,
          channel: data?.channel || data?.channelName || channelName,
          channelName: data?.channelName || data?.channel || channelName,
          uid: data?.uid || uid,
          role,
        };
      }
    } catch {
      // no-op
    }
  }

  const fallbackAppId = import.meta.env.VITE_AGORA_APP_ID;

  if (fallbackAppId) {
    return {
      appId: fallbackAppId,
      token: null,
      channel: channelName,
      channelName,
      uid,
      role,
    };
  }

  throw new Error('Agora app ID is missing. Check VITE_AGORA_APP_ID.');
}

export default function CourtViewerPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const [courtSession, setCourtSession] = useState<CourtSession | null>(null);
  const [participants, setParticipants] = useState<CourtParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [isClickBlocked, setIsClickBlocked] = useState(false);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const clickHistoryRef = useRef<number[]>([]);

  const cleanSessionId = sessionId?.replace(/^court-/, '') || sessionId;
  const agoraChannel = `troll-court-${cleanSessionId}`;

  const loadSession = useCallback(async () => {
    if (!cleanSessionId) {
      navigate('/troll-court');
      return;
    }

    const { data, error } = await supabase
      .from('court_sessions')
      .select('id, status, judge_id, defendant_id, started_at, created_at, title')
      .eq('id', cleanSessionId)
      .maybeSingle();

    if (error || !data) {
      console.error('Court session not found:', error);
      navigate('/troll-court');
      return;
    }

    if (!['active', 'live'].includes(data.status)) {
      toast.info('This court session is not currently live');
      navigate('/troll-court');
      return;
    }

    setCourtSession(data);
    setIsLoading(false);
  }, [cleanSessionId, navigate]);

  const loadParticipants = useCallback(async () => {
    if (!cleanSessionId) return;

    const { data, error } = await supabase
      .from('court_participants')
      .select('id, court_session_id, user_id, role, user_profiles(username, avatar_url)')
      .eq('court_session_id', cleanSessionId);

    if (!error && data) {
      setParticipants(data as CourtParticipant[]);
    }
  }, [cleanSessionId]);

  useEffect(() => {
    loadSession();
    loadParticipants();
  }, [loadSession, loadParticipants]);

  useEffect(() => {
    if (!courtSession?.id || !agoraChannel) return;

    const client = AgoraRTC.createClient({
      mode: 'live',
      codec: 'vp8',
    });

    clientRef.current = client;

    client.on('user-published', async (remoteUser, mediaType) => {
      try {
        await client.subscribe(remoteUser, mediaType);
        setRemoteUsers((prev) => {
          const exists = prev.some((u) => String(u.uid) === String(remoteUser.uid));
          if (exists) {
            return prev.map((u) => (String(u.uid) === String(remoteUser.uid) ? remoteUser : u));
          }
          return [...prev, remoteUser];
        });

        if (mediaType === 'audio') {
          remoteUser.audioTrack?.play();
        }
      } catch (error) {
        console.error('[CourtViewer] subscribe failed', error);
      }
    });

    client.on('user-unpublished', (remoteUser) => {
      setRemoteUsers((prev) =>
        prev.map((u) => (String(u.uid) === String(remoteUser.uid) ? remoteUser : u)),
      );
    });

    client.on('user-left', (remoteUser) => {
      setRemoteUsers((prev) => prev.filter((u) => String(u.uid) !== String(remoteUser.uid)));
    });

    const joinChannel = async () => {
      try {
        if (!user?.id) {
          toast.error('Please sign in to watch court sessions');
          navigate('/auth?mode=login');
          return;
        }

        const tokenResponse = await getAgoraCourtToken({
          channelName: agoraChannel,
          uid: user.id,
          role: 'audience',
        });

        await client.join(
          tokenResponse.appId,
          tokenResponse.channelName || agoraChannel,
          tokenResponse.token,
          user.id
        );

        setIsConnected(true);
      } catch (error) {
        console.error('[CourtViewer] Agora join failed', error);
        toast.error('Failed to connect to courtroom stream');
      }
    };

    joinChannel();

    return () => {
      try {
        client.leave();
      } catch {
        // no-op
      }
      clientRef.current = null;
      setIsConnected(false);
      setRemoteUsers([]);
    };
  }, [courtSession?.id, agoraChannel, user?.id]);

  useEffect(() => {
    if (!cleanSessionId || !user) return;

    const channel = supabase
      .channel(`court_session_chat_${cleanSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_events',
          filter: `court_case_id=eq.${cleanSessionId}`,
        },
        (payload) => {
          if (payload.new) {
            const event = payload.new as any;
            if (event.event_type === 'chat_message') {
              const message: ChatMessage = {
                id: event.id,
                user_id: event.user_id || 'system',
                username: (event.event_data as any)?.username || 'Anonymous',
                avatar_url: (event.event_data as any)?.avatar_url,
                content: (event.event_data as any)?.message || event.content || '',
                created_at: event.created_at,
                type: 'chat',
              };
              setMessages((prev) => [...prev.slice(-49), message]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cleanSessionId, user]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const findRemoteUser = (uid?: string | null) => {
    if (!uid) return undefined;
    return remoteUsers.find((u) => String(u.uid) === String(uid));
  };

  const findParticipantByRole = (role: CourtRoleKey) => {
    return participants.find((p) => String(p.role || '').toLowerCase() === role);
  };

  const spotUsers = useMemo(() => {
    const result: Record<CourtRoleKey, AgoraTrackUser | undefined> = {
      judge: undefined,
      prosecutor: undefined,
      attorney: undefined,
      witness: undefined,
      defendant: undefined,
    };

    for (const role of COURT_ROLES) {
      const participant = findParticipantByRole(role.key);
      const userId = participant?.user_id;

      if (!userId) continue;

      const remote = findRemoteUser(userId);

      result[role.key] = {
        uid: userId,
        videoTrack: remote?.videoTrack || null,
        audioTrack: remote?.audioTrack || null,
        username: (participant?.user_profiles as any)?.username || role.label,
        role: role.key,
        isLocal: false,
      };
    }

    return result;
  }, [participants, remoteUsers]);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !user || !profile) return;

    try {
      const { error } = await supabase
        .from('court_events')
        .insert({
          court_case_id: cleanSessionId,
          user_id: user.id,
          event_type: 'chat_message',
          event_data: {
            username: profile.username,
            avatar_url: profile.avatar_url,
            message: chatInput,
          },
        });

      if (error) throw error;
      setChatInput('');
    } catch (err) {
      console.error('[CourtViewer] Chat error:', err);
    }
  }, [chatInput, user, profile, cleanSessionId]);

  const handleLike = useCallback(async () => {
    if (!user || isClickBlocked) return;

    const now = Date.now();
    clickHistoryRef.current = clickHistoryRef.current.filter((time) => now - time < 10000);
    if (clickHistoryRef.current.length >= 5) {
      setIsClickBlocked(true);
      setTimeout(() => setIsClickBlocked(false), 10000);
      return;
    }
    clickHistoryRef.current.push(now);

    try {
      await supabase
        .from('court_events')
        .insert({
          court_case_id: cleanSessionId,
          user_id: user.id,
          event_type: 'like',
          event_data: {
            username: profile?.username,
            avatar_url: profile?.avatar_url,
          },
        });

      setTotalLikes((prev) => prev + 1);
    } catch (err) {
      console.error('[CourtViewer] Like error:', err);
    }
  }, [user, profile, cleanSessionId, isClickBlocked]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/50">Loading Court Session...</p>
        </div>
      </div>
    );
  }

  if (!courtSession) return null;

  return (
    <div className="relative h-screen w-full overflow-y-auto overflow-x-hidden md:overflow-hidden bg-black text-white">
      {/* Courtroom Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/troll-court-studio.png')",
        }}
      />
      <div className="absolute inset-0 bg-black/15" />

      {/* Studio Tiles */}
      <div className="absolute inset-0 z-10 p-4 pt-20">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 h-full">
          {COURT_ROLES.map((role) => {
            const trackUser = spotUsers[role.key];

            if (trackUser?.videoTrack || trackUser?.audioTrack) {
              return (
                <div
                  key={role.key}
                  className="relative flex items-center justify-center bg-black/40 border border-white/10 rounded-xl overflow-hidden"
                >
                  <VideoTrackContainer trackUser={trackUser} />
                  <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    <div className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs font-bold text-white">
                      {trackUser.username || role.label}
                    </div>
                    {trackUser.audioTrack && (
                      <div className="p-1 bg-black/60 backdrop-blur-sm rounded">
                        <Volume2 className="w-3 h-3 text-green-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={role.key}
                className="relative flex items-center justify-center bg-black/40 border border-white/10 rounded-xl"
              >
                <div className="flex flex-col items-center justify-center">
                  <User className="w-12 h-12 text-white/20 mb-2" />
                  <span className="text-sm text-white/40 font-bold">{role.label}</span>
                  <span className="text-xs text-white/20 mt-1">Waiting...</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/troll-court')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-amber-400">TROLL COURT</span>
              {isConnected && (
                <div className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                  LIVE
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="w-4 h-4" />
              <span>{viewerCount}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Heart className="w-4 h-4" />
              <span>{totalLikes}</span>
            </div>
            <button
              onClick={() => setChatOpen((prev) => !prev)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Court Info */}
      <div className="absolute top-16 left-4 right-4 z-20 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4 max-w-md">
          <h2 className="text-lg font-bold text-amber-300 mb-2">⚖ Court in Session</h2>
          <p className="text-sm text-gray-300">{courtSession.title}</p>
          <div className="mt-2 text-xs text-gray-400">
            All court proceedings are recorded for transparency
          </div>
        </div>
      </div>

      {/* Like Button */}
      <div className="absolute bottom-24 right-4 z-30">
        <button
          onClick={handleLike}
          disabled={isClickBlocked}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-full font-bold transition-all transform hover:scale-105"
        >
          <Heart className="w-5 h-5" />
          <span className="text-sm">{totalLikes}</span>
        </button>
      </div>

      {/* Chat Panel */}
      {chatOpen && (
        <div className="absolute bottom-28 right-4 z-40 w-80 h-64 overflow-hidden rounded-2xl border border-amber-300/25 bg-black/80 p-3 shadow-[0_0_34px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Court Chat
            </h3>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-32">
            {messages.map((msg) => (
              <div key={msg.id} className="text-sm">
                <span className="font-bold text-amber-300">{msg.username}:</span> {msg.content}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-1 bg-white/10 border border-white/20 rounded text-sm focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleSendChat}
                className="p-1 bg-amber-600 hover:bg-amber-700 rounded transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-white/50">Connecting to courtroom...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoTrackContainer({ trackUser }: { trackUser: AgoraTrackUser }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const track = trackUser.videoTrack;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (!track) return;

    try {
      track.play(container);

      requestAnimationFrame(() => {
        const videoElements = container.querySelectorAll('video');
        videoElements.forEach((video) => {
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'cover';
          video.style.borderRadius = '9999px';
          video.playsInline = true;
          video.autoplay = true;
          video.muted = true;
        });

        const wrapperElements = container.querySelectorAll('div');
        wrapperElements.forEach((element) => {
          element.style.width = '100%';
          element.style.height = '100%';
          element.style.borderRadius = '9999px';
          element.style.overflow = 'hidden';
        });
      });
    } catch (err) {
      console.error('[CourtViewer] failed to play video track', err);
    }

    return () => {
      try {
        track.stop();
      } catch {
        // no-op
      }
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [track]);

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <User className="w-12 h-12 text-white/30 mb-2" />
        <span className="text-xs text-white/50">{trackUser.username}</span>
      </div>
    );
  }

  return <div ref={containerRef} className="absolute inset-0" />;
}
