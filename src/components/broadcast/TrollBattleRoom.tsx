import React, { useState, useCallback } from 'react';
import { RemoteParticipant } from 'livekit-client';
import { cn } from '@/lib/utils';
import { X, Volume2, VolumeX } from 'lucide-react';
import BattleScoreBar from './BattleScoreBar';
import TrollBattleParticipantGrid from './TrollBattleParticipantGrid';
import BattleResultsOverlay from './BattleResultsOverlay';

interface BattleParticipant {
  userId: string;
  username: string;
  avatarUrl?: string;
  team: 'A' | 'B';
  seatIndex: number;
  coinsEarned: number;
  isActive: boolean;
  hasCrown?: boolean;
}

interface TrollBattleRoomProps {
  battleId: string;
  isHost: boolean;
  participants: BattleParticipant[];
  remoteParticipants: Map<string, RemoteParticipant>;
  teamAScore: number;
  teamBScore: number;
  timerSeconds: number;
  isActive: boolean;
  phase: 'pre_battle' | 'active' | 'ended';
  winningTeam: 'A' | 'B' | 'draw' | null;
  muxPlaybackId?: string;
  onForfeit?: () => void;
  onRematch?: () => void;
  onClose?: () => void;
  rematchAccepted?: { A: boolean; B: boolean };
}

export default function TrollBattleRoom({
  battleId,
  isHost: _isHost,
  participants,
  remoteParticipants,
  teamAScore,
  teamBScore,
  timerSeconds,
  isActive: _isActive,
  phase,
  winningTeam,
  muxPlaybackId,
  onForfeit,
  onRematch,
  onClose,
  rematchAccepted = { A: false, B: false }
}: TrollBattleRoomProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [showParticipantGrid, setShowParticipantGrid] = useState(true);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      {/* Top Bar with Score */}
      <BattleScoreBar
        teamAScore={teamAScore}
        teamBScore={teamBScore}
        timerSeconds={timerSeconds}
        isActive={phase === 'active'}
      />

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-slate-900 to-black">
        {/* Mux Viewer (if available) */}
        {muxPlaybackId && (
          <div className="absolute inset-0 w-full h-full bg-black">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
              <div className="text-center text-gray-400">
                <div className="text-sm">Mux Player</div>
                <div className="text-[10px] text-gray-500 mt-1">(ID: {muxPlaybackId})</div>
              </div>
            </div>
          </div>
        )}

        {/* Participant Grid Overlay */}
        {showParticipantGrid && (
          <div className={cn(
            "absolute inset-0 bg-black/40 overflow-y-auto transition-all",
            phase === 'ended' ? "pointer-events-none" : ""
          )}>
            <TrollBattleParticipantGrid
              participants={participants}
              remoteParticipants={remoteParticipants}
            />
          </div>
        )}
      </div>

      {/* Battle Results Overlay */}
      <BattleResultsOverlay
        isVisible={phase === 'ended'}
        winningTeam={winningTeam}
        teamAScore={teamAScore}
        teamBScore={teamBScore}
        teamAName="Team A"
        teamBName="Team B"
        bonusPercentage={2}
        onRematch={onRematch}
        onClose={onForfeit || onClose}
        rematchAccepted={rematchAccepted}
      />

      {/* Control Panel */}
      <div className="bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-3 md:p-4 flex items-center justify-between gap-2">
        {/* Left: Battle Info */}
        <div className="flex items-center gap-2">
          <div className="text-[10px] md:text-xs font-mono text-gray-400 px-2 py-1 bg-white/5 rounded">
            Battle ID: {battleId.substring(0, 8)}
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2">
          {/* Toggle Grid */}
          <button
            onClick={() => setShowParticipantGrid(!showParticipantGrid)}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-bold transition-all",
              showParticipantGrid
                ? "bg-blue-500 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            )}
          >
            {showParticipantGrid ? "Hide Grid" : "Show Grid"}
          </button>

          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "px-2.5 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1",
              isMuted
                ? "bg-red-500/20 border border-red-500 text-red-300"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            )}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Close Button */}
          {phase !== 'active' && (
            <button
              onClick={handleClose}
              className="px-3 py-1.5 rounded text-xs font-bold bg-white/10 text-gray-300 hover:bg-white/20 transition-all flex items-center gap-1"
            >
              <X size={14} />
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
