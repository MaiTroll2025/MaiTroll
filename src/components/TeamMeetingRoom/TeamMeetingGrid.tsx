import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, VideoOff, Mic, Video, Lock, Unlock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface ParticipantProfile {
  uid: string;
  username: string;
  role: string;
  isAdmin: boolean;
  isCEO: boolean;
}

interface TeamParticipant {
  uid: string | number;
  username: string;
  role: string;
  isAdmin: boolean;
  isCEO: boolean;
  isLocal: boolean;
  videoTrack?: ICameraVideoTrack;
  audioTrack?: IMicrophoneAudioTrack;
  remoteUser?: IAgoraRTCRemoteUser;
  isSpeaking: boolean;
}

interface GridPosition {
  row: number;
  col: number;
  index: number;
}

interface TeamMeetingGridProps {
  localUserId: string;
  remoteUsers: IAgoraRTCRemoteUser[];
  localVideoTrack?: ICameraVideoTrack;
  localAudioTrack?: IMicrophoneAudioTrack;
  localUsername: string;
  localRole: string;
  meetingId: string;
}

const GRID_SIZE = 3;
const MAX_VISIBLE = GRID_SIZE * GRID_SIZE;

const fetchUserProfile = async (userId: string | number): Promise<ParticipantProfile | null> => {
  try {
    const uid = userId.toString();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, role, is_admin, is_ceo')
      .eq('id', uid)
      .maybeSingle();

    if (error || !data) return null;

    return {
      uid: data.id,
      username: data.username || 'User',
      role: data.role || 'user',
      isAdmin: data.is_admin || false,
      isCEO: data.is_ceo || false
    };
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
};

const ParticipantTile: React.FC<{
  participant: TeamParticipant;
  position: GridPosition;
  isFocused: boolean;
  isHeld: boolean;
  onToggleHold: () => void;
  isLocal: boolean;
}> = ({
  participant,
  position,
  isFocused,
  isHeld,
  onToggleHold,
  isLocal
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!videoRef.current) return;

    const attachTrack = async () => {
      try {
        if (isLocal && participant.videoTrack) {
          await participant.videoTrack.play(videoRef.current!);
          attachedRef.current = true;
        } else if (!isLocal && participant.remoteUser?.videoTrack) {
          await participant.remoteUser.videoTrack.play(videoRef.current!);
          attachedRef.current = true;
        }
      } catch (err) {
        console.error('Error attaching video track:', err);
      }
    };

    if (!attachedRef.current) {
      attachTrack();
    }

    return () => {
      attachedRef.current = false;
    };
  }, [participant.videoTrack, participant.remoteUser?.videoTrack, isLocal]);

  useEffect(() => {
    if (isLocal || !participant.remoteUser?.audioTrack) return;

    try {
      participant.remoteUser.audioTrack.play();
    } catch (err) {
      console.error('Error playing audio track:', err);
    }

    return () => {
      try {
        if (participant.remoteUser?.audioTrack) {
          participant.remoteUser.audioTrack.stop();
        }
      } catch (e) {}
    };
  }, [participant.remoteUser?.audioTrack, isLocal]);

  const isMicOn = isLocal 
    ? participant.audioTrack?.enabled ?? true 
    : (participant.remoteUser?.audioTrack as any)?.enabled ?? false;
  const isCamOn = isLocal 
    ? participant.videoTrack?.enabled ?? true 
    : (participant.remoteUser?.videoTrack as any)?.enabled ?? false;
  const hasVideo = isCamOn && (isLocal ? participant.videoTrack : participant.remoteUser?.videoTrack);

  return (
    <motion.div
      layout
      layoutId={`participant-${participant.uid}`}
      className={cn(
        'relative rounded-lg overflow-hidden bg-gray-900 aspect-video',
        'border-2 transition-colors',
        isFocused ? 'border-blue-500 shadow-lg shadow-blue-500/50' : 'border-gray-700',
        isHeld && 'border-yellow-400 border-dashed',
        participant.isSpeaking && !isFocused && 'border-green-500',
        'group'
      )}
    >
      <div
        ref={videoRef}
        className="w-full h-full bg-black"
        style={{
          display: hasVideo ? 'block' : 'none'
        }}
      />

      {!hasVideo && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-white text-xs">{participant.username}</p>
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
        <div className="font-semibold">{participant.username}</div>
        <div className="text-gray-300 text-xs capitalize">{participant.role}</div>
        {participant.isCEO && <div className="text-yellow-400 text-xs font-bold">CEO</div>}
        {participant.isAdmin && !participant.isCEO && (
          <div className="text-blue-400 text-xs font-bold">ADMIN</div>
        )}
      </div>

      {participant.isSpeaking && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="absolute top-2 right-2 bg-green-500 px-2 py-1 rounded text-xs text-white font-semibold flex items-center gap-1"
        >
          <Mic className="w-3 h-3" />
          Speaking
        </motion.div>
      )}

      <div className="absolute bottom-2 left-2 flex gap-1 bg-black/70 px-2 py-1 rounded backdrop-blur-sm">
        {isMicOn ? (
          <Mic className="w-4 h-4 text-green-400" />
        ) : (
          <MicOff className="w-4 h-4 text-red-400" />
        )}
        {isCamOn ? (
          <Video className="w-4 h-4 text-green-400" />
        ) : (
          <VideoOff className="w-4 h-4 text-red-400" />
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggleHold}
        className={cn(
          'absolute bottom-2 right-2 p-2 rounded bg-black/50 hover:bg-black/70 transition-colors',
          isHeld ? 'text-yellow-400' : 'text-gray-400 hover:text-white'
        )}
        title={isHeld ? 'Unhold box' : 'Hold box position'}
      >
        {isHeld ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
      </motion.button>

      {isHeld && (
        <div className="absolute inset-0 border-2 border-dashed border-yellow-400 rounded-lg pointer-events-none" />
      )}
    </motion.div>
  );
};

export const TeamMeetingGrid: React.FC<TeamMeetingGridProps> = ({
  localUserId,
  remoteUsers,
  localVideoTrack,
  localAudioTrack,
  localUsername,
  localRole,
  meetingId
}) => {
  const [profiles, setProfiles] = useState<Map<string | number, ParticipantProfile>>(new Map());
  const [heldPositions, setHeldPositions] = useState<Set<string | number>>(new Set());
  const [speakingUsers, setSpeakingUsers] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    const fetchProfiles = async () => {
      const newProfiles = new Map(profiles);
      const userIds: (string | number)[] = [
        localUserId,
        ...remoteUsers.map(u => u.uid)
      ];

      for (const userId of userIds) {
        if (!newProfiles.has(userId) && userId) {
          const profile = await fetchUserProfile(userId);
          if (profile) {
            newProfiles.set(userId, profile);
          }
        }
      }

      setProfiles(newProfiles);
    };

    fetchProfiles();
  }, [remoteUsers.length, localUserId]);

  useEffect(() => {
    const newSpeakingUsers = new Set<string | number>();

    if (localAudioTrack?.enabled) {
      newSpeakingUsers.add(localUserId);
    }

    remoteUsers.forEach(user => {
      if ((user.audioTrack as any)?.enabled) {
        newSpeakingUsers.add(user.uid);
      }
    });

    setSpeakingUsers(newSpeakingUsers);
  }, [remoteUsers, localAudioTrack?.enabled, localUserId]);

  const allParticipants = useMemo(() => {
    const participants: TeamParticipant[] = [];

    const localProfile = profiles.get(localUserId) || {
      uid: localUserId,
      username: localUsername,
      role: localRole,
      isAdmin: false,
      isCEO: false
    };

    participants.push({
      uid: localUserId,
      username: localProfile.username,
      role: localProfile.role,
      isAdmin: localProfile.isAdmin,
      isCEO: localProfile.isCEO,
      isLocal: true,
      videoTrack: localVideoTrack,
      audioTrack: localAudioTrack,
      isSpeaking: speakingUsers.has(localUserId)
    });

    remoteUsers.forEach(user => {
      const profile = profiles.get(user.uid) || {
        uid: user.uid,
        username: 'User',
        role: 'user',
        isAdmin: false,
        isCEO: false
      };

      participants.push({
        uid: user.uid,
        username: profile.username,
        role: profile.role,
        isAdmin: profile.isAdmin,
        isCEO: profile.isCEO,
        isLocal: false,
        remoteUser: user,
        isSpeaking: speakingUsers.has(user.uid)
      });
    });

    return participants;
  }, [remoteUsers, profiles, speakingUsers, localUserId, localUsername, localRole, localVideoTrack, localAudioTrack]);

  const orderedParticipants = useMemo(() => {
    const held: TeamParticipant[] = [];
    const unHeld: TeamParticipant[] = [];

    allParticipants.forEach(p => {
      if (heldPositions.has(p.uid)) {
        held.push(p);
      } else {
        unHeld.push(p);
      }
    });

    unHeld.sort((a, b) => {
      if (a.isCEO && b.isCEO) return 0;
      if (a.isCEO) return -1;
      if (b.isCEO) return 1;

      if (a.isAdmin && b.isAdmin) return 0;
      if (a.isAdmin) return -1;
      if (b.isAdmin) return 1;

      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;

      if (a.isLocal) return -1;
      if (b.isLocal) return 1;

      return 0;
    });

    return [...held, ...unHeld];
  }, [allParticipants, heldPositions]);

  const visibleParticipants = orderedParticipants.slice(0, MAX_VISIBLE);
  const overflowCount = Math.max(0, allParticipants.length - MAX_VISIBLE);

  const centerParticipant = useMemo(() => {
    const ceo = visibleParticipants.find(p => p.isCEO);
    if (ceo) return ceo.uid;

    const admin = visibleParticipants.find(p => p.isAdmin);
    if (admin) return admin.uid;

    const speaker = visibleParticipants.find(p => p.isSpeaking);
    if (speaker) return speaker.uid;

    return visibleParticipants[0]?.uid || null;
  }, [visibleParticipants]);

  const toggleHoldBox = useCallback((userId: string | number) => {
    setHeldPositions(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 p-4">
      <div className="flex-1 grid grid-cols-3 gap-4 mb-4">
        <AnimatePresence>
          {visibleParticipants.map((participant, index) => {
            const row = Math.floor(index / GRID_SIZE);
            const col = index % GRID_SIZE;
            const isCenter = row === 1 && col === 1;
            const isFocused = participant.uid === centerParticipant && isCenter;

            return (
              <ParticipantTile
                key={participant.uid}
                participant={participant}
                position={{ row, col, index }}
                isFocused={isFocused}
                isHeld={heldPositions.has(participant.uid)}
                onToggleHold={() => toggleHoldBox(participant.uid)}
                isLocal={participant.isLocal}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="text-center text-gray-400 text-sm py-2 border-t border-gray-800">
        {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''} in meeting
        {overflowCount > 0 && <span> ({overflowCount} more off-screen)</span>}
      </div>
    </div>
  );
};

export default TeamMeetingGrid;
