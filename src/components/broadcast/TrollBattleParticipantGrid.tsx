import React, { useMemo } from 'react';
import { RemoteParticipant } from 'livekit-client';
import { cn } from '@/lib/utils';
import { VideoOff, Mic, MicOff, Crown } from 'lucide-react';

interface BattleParticipant {
  userId: string;
  username: string;
  avatarUrl?: string;
  team: 'A' | 'B';
  seatIndex: number;
  coinsEarned: number;
  isActive: boolean;
  liveKitParticipant?: RemoteParticipant;
  hasCrown?: boolean;
}

interface TrollBattleParticipantGridProps {
  participants: BattleParticipant[];
  remoteParticipants: Map<string, RemoteParticipant>;
  onParticipantClick?: (participant: BattleParticipant) => void;
}

export default function TrollBattleParticipantGrid({
  participants,
  remoteParticipants: _remoteParticipants,
  onParticipantClick
}: TrollBattleParticipantGridProps) {
  // Split participants by team
  const teamA = useMemo(() => 
    participants.filter(p => p.team === 'A').sort((a, b) => a.seatIndex - b.seatIndex),
    [participants]
  );

  const teamB = useMemo(() => 
    participants.filter(p => p.team === 'B').sort((a, b) => a.seatIndex - b.seatIndex),
    [participants]
  );

  const ParticipantBox = ({ participant }: { participant: BattleParticipant }) => {
    const hasVideo = participant.liveKitParticipant?.isCameraEnabled || false;
    const hasAudio = participant.liveKitParticipant?.isMicrophoneEnabled || false;

    return (
      <div
        onClick={() => onParticipantClick?.(participant)}
        className={cn(
          "relative rounded-lg overflow-hidden bg-slate-900 border-2 transition-all cursor-pointer group",
          "hover:border-white/50",
          participant.team === 'A' ? "border-amber-500/50" : "border-purple-500/50"
        )}
      >
        {/* Video Container */}
        <div className="aspect-square bg-black relative flex items-center justify-center">
          {hasVideo ? (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <span className="text-sm text-gray-400">📹 Live Video</span>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 gap-2">
              {participant.avatarUrl ? (
                <img 
                  src={participant.avatarUrl} 
                  alt={participant.username}
                  className="w-12 h-12 rounded-full border border-white/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">
                  {participant.username.substring(0, 2).toUpperCase()}
                </div>
              )}
              <VideoOff size={20} className="text-gray-500" />
            </div>
          )}

          {/* Crown Badge */}
          {participant.hasCrown && (
            <div className="absolute top-1 left-1 bg-yellow-500 rounded-full p-1 shadow-lg">
              <Crown size={12} className="text-white fill-white" />
            </div>
          )}

          {/* Coins Earned Overlay */}
          <div className="absolute top-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-300">
            +{participant.coinsEarned}
          </div>

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
        </div>

        {/* Info Bar */}
        <div className={cn(
          "px-2 py-1.5 text-center text-[10px] border-t-2",
          participant.team === 'A' ? "bg-amber-500/10 border-amber-500/50" : "bg-purple-500/10 border-purple-500/50"
        )}>
          <div className="font-bold text-gray-200 truncate">{participant.username}</div>
          <div className="flex items-center justify-center gap-1 text-[8px] text-gray-400 mt-0.5">
            {hasAudio ? (
              <Mic size={10} className="text-green-400" />
            ) : (
              <MicOff size={10} className="text-red-400" />
            )}
            <span className={hasAudio ? "text-green-400" : "text-red-400"}>
              {hasAudio ? "ON" : "OFF"}
            </span>
          </div>
        </div>

        {/* Inactive Indicator */}
        {!participant.isActive && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm rounded">
            <span className="text-xs font-bold text-red-400">LEFT</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-3 p-3 md:p-4">
      {/* Team A */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-amber-400 uppercase px-1">Team A</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {teamA.map((participant) => (
            <ParticipantBox key={participant.userId} participant={participant} />
          ))}
        </div>
      </div>

      {/* Team B */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-purple-400 uppercase px-1">Team B</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {teamB.map((participant) => (
            <ParticipantBox key={participant.userId} participant={participant} />
          ))}
        </div>
      </div>
    </div>
  );
}
