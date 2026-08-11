/**
 * BattleSwipeCard - Full-screen battle stream card for TikTok-style swipe interface
 * Displays battle streams with duel visuals, scores, and competitor info
  */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Stream } from '../../types/broadcast';
import { toast } from 'sonner';
import { Eye, Heart, MessageCircle, Gift, Share2, Users, Sword, Shield, Trophy, Coins } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Room, RoomEvent, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { getLiveKitRoomName } from '../../lib/liveUtils';
import ShareModal from './ShareModal';

interface BattleSwipeCardProps {
  stream: Stream & {
    broadcaster?: {
      username: string;
      avatar_url: string | null;
      level?: number;
    };
  };
  isActive: boolean;
  isMuted: boolean;
  onClose: () => void;
  broadcasterCoins?: number;
}

interface BattleData {
  id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_score: number;
  opponent_score: number;
  status: string;
  challenger_stream_id: string;
  opponent_stream_id: string;
  challenger?: {
    username: string;
    avatar_url: string | null;
  };
  opponent?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function BattleSwipeCard({ stream, isActive, isMuted, onClose, broadcasterCoins }: BattleSwipeCardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [viewerCount, setViewerCount] = useState(stream.current_viewers || stream.viewer_count || 0);
  const [likeCount, setLikeCount] = useState(stream.total_likes || (stream as any).like_count || 0);
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const roomRef = useRef<Room | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const clickTimesRef = useRef<number[]>([]);
  const blockedUntilRef = useRef<number | null>(null);
  const pendingLikesRef = useRef(0);
  const flushInProgressRef = useRef(false);
  
  // Stable viewer identity. Signed-in users use their id; anonymous guests get
  // a persistent per-session guest id so they can watch without logging in.
  const viewerIdentity = useMemo(() => {
    if (user?.id) return user.id;
    if (typeof window === 'undefined') {
      return `guest-${Math.random().toString(36).slice(2, 10)}`;
    }
    try {
      const storageKey = `swipe-guest:${stream.id}`;
      let guestId = sessionStorage.getItem(storageKey);
      if (!guestId) {
        const rand = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        guestId = `guest-${rand}`;
        sessionStorage.setItem(storageKey, guestId);
      }
      return guestId;
    } catch {
      return `guest-${Math.random().toString(36).slice(2, 10)}`;
    }
  }, [user?.id, stream.id]);
  
  // Fetch battle data
  useEffect(() => {
    const fetchBattleData = async () => {
      if (!stream.battle_id) return;
      
      const { data, error } = await supabase
        .from('battles')
        .select(`
          *,
          challenger:user_profiles!battles_challenger_id_fkey(
            username,
            avatar_url
          ),
          opponent:user_profiles!battles_opponent_id_fkey(
            username,
            avatar_url
          )
        `)
        .eq('id', stream.battle_id)
        .maybeSingle();
      
      if (data) {
        setBattleData({
          ...data,
          challenger: Array.isArray(data.challenger) ? data.challenger[0] : data.challenger,
          opponent: Array.isArray(data.opponent) ? data.opponent[0] : data.opponent
        });
      }
    };
    
    if (stream.battle_id) {
      fetchBattleData();
    }
  }, [stream.battle_id]);
  
  // Join LiveKit channel when card becomes active
  const joinStream = useCallback(async () => {
    if (!isActive || hasJoinedRef.current) return;

    hasJoinedRef.current = true;
    setIsJoining(true);

    try {
      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) {
        console.warn('VITE_LIVEKIT_URL not configured');
        hasJoinedRef.current = false;
        setIsJoining(false);
        return;
      }

      const roomName = getLiveKitRoomName(stream as any, stream.id) || stream.id;

      // Get viewer token from livekit-token function (anonymous guests allowed)
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          roomName,
          identity: viewerIdentity,
          userId: viewerIdentity,
          name: (user as any)?.username || 'Viewer',
          role: 'audience',
          mode: 'audience',
        }
      });
      
      if (tokenError || !tokenData?.token) {
        console.error('Token error:', tokenError);
        hasJoinedRef.current = false;
        setIsJoining(false);
        return;
      }
      
      // Create LiveKit room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });
      
      roomRef.current = room;
      
      // Handle participant connected
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Participant connected:', participant.identity);
        setRemoteUsers(prev => {
          if (prev.find(p => p.identity === participant.identity)) return prev;
          return [...prev, participant];
        });
      });
      
      // Handle participant disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Participant disconnected:', participant.identity);
        setRemoteUsers(prev => prev.filter(p => p.identity !== participant.identity));
      });
      
      // Handle track subscribed
      room.on(RoomEvent.TrackSubscribed, (track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Track subscribed:', track.kind, 'from', participant.identity);
        // Force re-render so the video track attaches
        setRemoteUsers(prev => [...prev]);
      });
      
      // Handle track unsubscribed
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Track unsubscribed:', track.kind, 'from', participant.identity);
        setRemoteUsers(prev => [...prev]);
      });
      
      // Connect to room (identity is carried by the token)
      await room.connect(livekitUrl, tokenData.token, {
        autoSubscribe: true,
      });

      // Apply current mute state to remote audio playback.
      try { (room as any).setAudioVolume?.(isMuted ? 0 : 100); } catch { /* noop */ }

       // Get existing participants
       const existingParticipants = Array.from(room.remoteParticipants?.values() || []);
       setRemoteUsers(existingParticipants);
      
      console.log('[BattleSwipeCard] Joined stream:', stream.id);
      
    } catch (error) {
      console.error('Error joining stream:', error);
      hasJoinedRef.current = false;
    } finally {
      setIsJoining(false);
    }
  }, [isActive, stream, viewerIdentity, isMuted, user]);
  
  // Join/leave based on active state
  useEffect(() => {
    if (isActive) {
      joinStream();
    }
    
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
        hasJoinedRef.current = false;
      }
    };
  }, [isActive]);
  
   // Handle like
   const handleLike = async () => {
     if (!user) {
       navigate('/auth?mode=signup');
       return;
     }

     const now = Date.now();
     if (blockedUntilRef.current && now < blockedUntilRef.current) {
       const secondsLeft = Math.ceil((blockedUntilRef.current - now) / 1000);
       toast.error(`You're temporarily blocked from liking (${secondsLeft}s)`);
       return;
     }

     const times = clickTimesRef.current;
     times.push(now);
     const cutoff = now - 1000;
     while (times.length && times[0] < cutoff) times.shift();

     const tapsPerSec = times.length;
     if (tapsPerSec >= 20) {
       blockedUntilRef.current = now + 60 * 1000;
       clickTimesRef.current = [];
       toast.error('Rate limited for 1 minute due to suspected auto-clicking');
       return;
     }

     const likeIncrement = 2;
     setLikeCount((prev) => Number(prev || 0) + likeIncrement);

      pendingLikesRef.current += 2;
      if (pendingLikesRef.current >= 25) {
       flushLikes();
     }
   };

   const flushLikes = useCallback(async () => {
     if (flushInProgressRef.current) return;
     const batch = pendingLikesRef.current;
     if (batch <= 0 || !stream?.id) return;

     pendingLikesRef.current = 0;
     flushInProgressRef.current = true;

     try {
       const { data, error } = await supabase.rpc('increment_stream_likes', {
         p_stream_id: stream.id,
         p_like_count: batch,
       });

       if (error) throw error;

       if (typeof data === 'number') {
         setLikeCount(data);
       }
     } catch (error) {
       pendingLikesRef.current += batch;
       console.error('Failed to flush likes:', error);
     } finally {
       flushInProgressRef.current = false;
     }
   }, [stream?.id]);

   useEffect(() => {
     const interval = window.setInterval(() => {
       flushLikes();
     }, 2500);

     const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
         void flushLikes();
       }
     };

     document.addEventListener('visibilitychange', handleVisibilityChange);

     return () => {
       window.clearInterval(interval);
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       void flushLikes();
     };
   }, [flushLikes]);
   
   // Handle tap to view full stream
  const handleTap = () => {
    const isGaming = stream.agora_channel || stream.category === 'gaming';
    navigate(isGaming ? `/gaming/watch/${stream.id}?from=swipe&battle=true` : `/watch/${stream.id}?from=swipe&battle=true`);
  };
  
  const broadcaster = stream.broadcaster;
  const isHost = user?.id === stream.user_id;

  useEffect(() => {
    const updatedLikes = stream.total_likes ?? (stream as any).like_count;
    if (typeof updatedLikes === 'number') {
      setLikeCount(updatedLikes);
    }
  }, [stream.total_likes, (stream as any).like_count]);
  
  // Calculate scores
  const challengerScore = battleData?.challenger_score || 0;
  const opponentScore = battleData?.opponent_score || 0;
  const totalScore = challengerScore + opponentScore;
  const challengerPercent = totalScore > 0 ? (challengerScore / totalScore) * 100 : 50;
  
  // Get video track from participant
  const getVideoTrack = (participant: RemoteParticipant): RemoteVideoTrack | undefined => {
    const trackPublications = Array.from(participant.videoTrackPublications.values());
    const videoPub = trackPublications.find(p => p.track?.kind === 'video');
    return videoPub?.track as RemoteVideoTrack | undefined;
  };
  
  return (
    <div className="w-full h-full relative bg-black overflow-hidden" style={{ touchAction: 'none' }}>
      {/* Video/Stream Container */}
      <div 
        ref={videoContainerRef}
        className="absolute inset-0"
        onClick={(e) => { e.stopPropagation(); handleLike(); }}
      >
        {remoteUsers.length > 0 ? (
          <div className={cn(
            "w-full h-full grid",
            remoteUsers.length === 1 ? "grid-cols-1" :
            remoteUsers.length === 2 ? "grid-cols-2" :
            "grid-cols-2 gap-0.5"
          )}>
            {remoteUsers.map((remoteUser) => {
              const videoTrack = getVideoTrack(remoteUser);
              return (
                <div key={remoteUser.identity} className="relative bg-black">
                  {videoTrack ? (
                    <div 
                      ref={(el) => {
                        if (el && videoTrack) {
                          const attached = videoTrack.attach() as HTMLVideoElement;
                          // Required for reliable autoplay on mobile / PWA (iOS Safari):
                          attached.muted = true;
                          attached.autoplay = true;
                          attached.playsInline = true;
                          attached.setAttribute('playsinline', '');
                          attached.setAttribute('webkit-playsinline', '');
                          attached.className = 'w-full h-full object-cover';
                          el.innerHTML = '';
                          el.appendChild(attached);
                          attached.play?.().catch(() => {});
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                      <Users className="w-12 h-12 text-zinc-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Placeholder when no video */
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-900 via-purple-900 to-blue-900">
            <div className="flex items-center gap-4 mb-4">
              {/* Challenger avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 p-0.5">
                <div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center">
                  {battleData?.challenger?.avatar_url ? (
                    <img 
                      src={battleData.challenger.avatar_url} 
                      alt={battleData.challenger.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Sword className="w-8 h-8 text-yellow-500" />
                  )}
                </div>
              </div>
              
              {/* VS indicator */}
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                <span className="font-bold text-white text-lg">VS</span>
              </div>
              
              {/* Opponent avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-0.5">
                <div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center">
                  {battleData?.opponent?.avatar_url ? (
                    <img 
                      src={battleData.opponent.avatar_url} 
                      alt={battleData.opponent.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Shield className="w-8 h-8 text-blue-500" />
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-white/60 text-sm">Battle in progress...</p>
          </div>
        )}
      </div>
      
      {/* Battle score bar */}
      {battleData && (
        <div className="absolute top-24 left-3 right-3 z-10 sm:left-4 sm:right-4">
          <div className="bg-black/60 backdrop-blur-md rounded-full h-7 overflow-hidden flex sm:h-8">
            {/* Challenger score */}
            <div 
              className="h-full bg-gradient-to-r from-yellow-600 to-orange-500 flex items-center justify-start pl-3"
              style={{ width: `${challengerPercent}%` }}
            >
              <span className="text-white font-bold text-xs sm:text-sm">{challengerScore.toLocaleString()}</span>
            </div>
            
            {/* Opponent score */}
            <div 
              className="h-full bg-gradient-to-l from-blue-600 to-purple-500 flex items-center justify-end pr-3"
              style={{ width: `${100 - challengerPercent}%` }}
            >
              <span className="text-white font-bold text-xs sm:text-sm">{opponentScore.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Names */}
          <div className="flex justify-between mt-1 px-1 gap-3">
            <span className="text-yellow-400 text-[11px] font-medium truncate">{battleData.challenger?.username || 'Challenger'}</span>
            <span className="text-blue-400 text-[11px] font-medium truncate">{battleData.opponent?.username || 'Opponent'}</span>
          </div>
        </div>
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
      
      {/* Battle badge */}
      <div className="absolute top-20 left-3 z-10 flex items-center gap-2 sm:left-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-600 to-purple-600 rounded-full">
          <Sword className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-xs uppercase">Battle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur-md">
            <Eye className="w-3.5 h-3.5 text-white/80" />
            <span className="text-xs font-medium text-white">{viewerCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur-md">
            <Heart className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-xs font-medium text-white">{likeCount.toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      {/* Stream info overlay - Bottom left */}
      <div className="absolute bottom-16 left-3 right-16 z-10 sm:bottom-20 sm:left-4 sm:right-20">
{/* Title */}
        <h3 className="text-white font-medium text-base line-clamp-2 mb-1 sm:text-lg sm:mb-2">
          {stream.title || 'Battle Arena'}
        </h3>
        
        <div className="flex items-center gap-3">
          {broadcasterCoins !== undefined && broadcasterCoins > 0 && (
            <div className="flex items-center gap-1 text-amber-400 text-xs sm:text-sm">
              <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="font-bold">{broadcasterCoins.toLocaleString()}</span>
            </div>
          )}
          {battleData && (
            <span className="text-red-400 text-xs sm:text-sm flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {totalScore.toLocaleString()} votes
            </span>
          )}
        </div>
      </div>
      
      {/* Action buttons - Bottom right */}
      <div className="absolute bottom-16 right-3 z-10 flex flex-col items-center gap-3 sm:bottom-20 sm:right-4 sm:gap-4">
        {/* Like button removed - use tap on video to like */}
        
        {/* Comment button */}
        <button
          onClick={(e) => { e.stopPropagation(); const g = stream.agora_channel || stream.category === 'gaming'; navigate(g ? `/gaming/watch/${stream.id}?from=swipe` : `/watch/${stream.id}?from=swipe`); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors sm:w-12 sm:h-12">
            <MessageCircle className="w-5 h-5 text-white sm:w-6 sm:h-6" />
          </div>
        </button>
        
        {/* Gift button */}
        <button
          onClick={(e) => { e.stopPropagation(); const g = stream.agora_channel || stream.category === 'gaming'; navigate(g ? `/gaming/watch/${stream.id}?from=swipe` : `/watch/${stream.id}?from=swipe`); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors sm:w-12 sm:h-12">
            <Gift className="w-5 h-5 text-pink-400 sm:w-6 sm:h-6" />
          </div>
        </button>
        
        {/* Share button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsShareModalOpen(true); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors sm:w-12 sm:h-12">
            <Share2 className="w-5 h-5 text-white sm:w-6 sm:h-6" />
          </div>
        </button>
      </div>
      
      {/* Loading indicator */}
      {isJoining && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">Joining battle...</span>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        streamTitle={stream.title}
        streamUrl={`${window.location.origin}/watch/${stream.id}`}
        broadcasterName={stream.broadcaster?.username}
      />
    </div>
  );
}
